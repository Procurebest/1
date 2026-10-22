// MCQ examination engine. Correct answers never leave the server; scoring happens here.
import { one, all, run, scalar } from "./db.js";
import { nowIso, isoPlus, randomToken, randomCode, MIN, DAY, parseJson } from "./util.js";

export const GRACE_MS = 30 * 1000;

export const TOPICS = {
  fundamentals: ["Procurement fundamentals", "প্রকিউরমেন্টের মৌলিক বিষয়"], purchasing_cycle: ["Purchasing cycle", "ক্রয় চক্র"],
  rfx: ["RFQ, RFP & tendering", "আরএফকিউ, আরএফপি ও দরপত্র"], purchase_orders: ["Purchase orders", "ক্রয়াদেশ (পারচেজ অর্ডার)"],
  sourcing: ["Sourcing", "সোর্সিং"], inventory: ["Inventory", "ইনভেন্টরি"], logistics: ["Logistics & Incoterms", "লজিস্টিকস ও ইনকোটার্মস"],
  terminology: ["Terminology", "পরিভাষা"], tco: ["Total cost of ownership", "মোট মালিকানা খরচ"], negotiation: ["Negotiation", "দর-কষাকষি"],
  supplier_selection: ["Supplier selection", "সাপ্লায়ার নির্বাচন"], contracts: ["Contract management", "চুক্তি ব্যবস্থাপনা"],
  kpi: ["Procurement KPIs", "প্রকিউরমেন্ট কেপিআই"], savings: ["Cost savings", "খরচ সাশ্রয়"], strategy: ["Sourcing strategy", "সোর্সিং কৌশল"],
  supplier_performance: ["Supplier performance", "সাপ্লায়ার পারফরম্যান্স"], risk: ["Supply risk", "সরবরাহ ঝুঁকি"],
  landed_cost: ["Landed cost", "ল্যান্ডেড কস্ট"], category_management: ["Category management", "ক্যাটাগরি ব্যবস্থাপনা"],
  international_trade: ["International trade", "আন্তর্জাতিক বাণিজ্য"], spend_analytics: ["Spend analytics", "ব্যয় বিশ্লেষণ"],
  scenario: ["Scenario decisions", "পরিস্থিতিভিত্তিক সিদ্ধান্ত"], ethics: ["Ethics & compliance", "নৈতিকতা ও কমপ্লায়েন্স"],
};
export const topicLabel = (t, lang) => (TOPICS[t] ? TOPICS[t][lang === "bn" ? 1 : 0] : String(t || "").replace(/_/g, " "));

export class ExamError extends Error {
  constructor(key, vars = {}) { super(key); this.key = key; this.vars = vars; }
}

export const levels = (env, publishedOnly = true) =>
  all(env, `SELECT * FROM exam_levels ${publishedOnly ? "WHERE published=1" : ""} ORDER BY sort`);
export const level = (env, code) => one(env, "SELECT * FROM exam_levels WHERE code=?", code);
export const available = async (env, code) => Number(await scalar(env, "SELECT COUNT(*) FROM questions WHERE level_code=? AND status='published'", code));

// Remaining paid attempts for this email (sum over all approved purchases).
export async function paidAttemptsLeft(env, email, code) {
  const row = await one(env, `SELECT COALESCE(SUM(attempts_total - attempts_used),0) AS n FROM entitlements WHERE email=? AND item_type='exam' AND item_ref=?`, email, code);
  return Number(row?.n || 0);
}
export async function freeAttemptsToday(env, email, code) {
  return Number(await scalar(env, "SELECT COUNT(*) FROM attempts WHERE email=? AND level_code=? AND paid=0 AND started_at >= ?", email, code, isoPlus(-DAY)));
}
export async function activeAttempt(env, email, code) {
  return one(env, "SELECT id, deadline_at FROM attempts WHERE email=? AND level_code=? AND submitted_at IS NULL AND deadline_at > ? ORDER BY started_at DESC LIMIT 1", email, code, nowIso());
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[r]] = [a[r], a[i]];
  }
  return a;
}

export async function startAttempt(env, { email, name, code, lang }) {
  const lv = await level(env, code);
  if (!lv || !lv.published) throw new ExamError("exam.err_not_available");
  const active = await activeAttempt(env, email, code);
  if (active) return active.id;
  let paid = 0, entitlementId = null;
  if (lv.price > 0) {
    const ent = await one(env, `SELECT id FROM entitlements WHERE email=? AND item_type='exam' AND item_ref=? AND attempts_used < attempts_total ORDER BY id LIMIT 1`, email, code);
    if (!ent) throw new ExamError("exam.err_paid");
    paid = 1; entitlementId = ent.id;
  } else if ((await freeAttemptsToday(env, email, code)) >= lv.free_attempts_per_day) {
    throw new ExamError("exam.err_free_limit");
  }
  const pool = (await all(env, "SELECT id, options_json FROM questions WHERE level_code=? AND status='published'", code));
  if (pool.length < lv.question_count) throw new ExamError("exam.err_not_enough", { have: pool.length, need: lv.question_count });
  const chosen = shuffle(pool).slice(0, lv.question_count);
  const orders = {};
  for (const q of chosen) orders[q.id] = shuffle([...Array(parseJson(q.options_json, []).length).keys()]);
  const id = randomToken(12);
  const now = nowIso();
  const stmts = [env.DB.prepare(`INSERT INTO attempts(id,email,name,level_code,lang,question_ids,option_orders,answers_json,pass_mark,paid,started_at,deadline_at)
      VALUES (?,?,?,?,?,?,?,'{}',?,?,?,?)`).bind(id, email, name, code, lang, JSON.stringify(chosen.map((q) => q.id)), JSON.stringify(orders),
      lv.pass_mark, paid, now, isoPlus(lv.time_limit_min * MIN))];
  if (entitlementId) stmts.push(env.DB.prepare("UPDATE entitlements SET attempts_used = attempts_used + 1 WHERE id=?").bind(entitlementId));
  stmts.push(env.DB.prepare("UPDATE emails SET name=COALESCE(NULLIF(?,''), name) WHERE email=?").bind(name, email));
  await env.DB.batch(stmts);
  return id;
}

export async function loadAttempt(env, id, email) {
  const att = await one(env, "SELECT * FROM attempts WHERE id=?", id);
  if (!att || att.email !== email) return null;
  if (!att.submitted_at && Date.now() > Date.parse(att.deadline_at) + GRACE_MS) return finalize(env, att, true);
  return att;
}

export const secondsLeft = (att) => Math.max(0, Math.round((Date.parse(att.deadline_at) - Date.now()) / 1000));

export async function publicQuestions(env, att, lang) {
  const ids = parseJson(att.question_ids, []);
  const orders = parseJson(att.option_orders, {});
  const answers = parseJson(att.answers_json, {});
  const rows = await all(env, `SELECT id, text_en, text_bn, options_json FROM questions WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  return ids.map((qid, n) => {
    const q = byId[qid];
    if (!q) return null;
    const opts = parseJson(q.options_json, []);
    const order = orders[qid] || opts.map((_, i) => i);
    const chosen = answers[qid] !== undefined ? order.indexOf(answers[qid]) : -1;
    return {
      id: qid, n: n + 1, text: lang === "bn" ? q.text_bn || q.text_en : q.text_en || q.text_bn,
      options: order.map((i) => (lang === "bn" ? opts[i].bn || opts[i].en : opts[i].en || opts[i].bn)),
      chosen: chosen >= 0 ? chosen : null,
    };
  }).filter(Boolean);
}

export async function saveAnswer(env, att, qid, displayIndex) {
  if (att.submitted_at || Date.now() > Date.parse(att.deadline_at) + GRACE_MS) throw new ExamError("exam.err_closed");
  const ids = parseJson(att.question_ids, []);
  if (!ids.includes(qid)) throw new ExamError("exam.err_bad_question");
  const order = parseJson(att.option_orders, {})[qid];
  const path = `$."${qid}"`;
  if (displayIndex === null || displayIndex === undefined) {
    await run(env, "UPDATE attempts SET answers_json=json_remove(answers_json, ?) WHERE id=? AND submitted_at IS NULL", path, att.id);
    return;
  }
  if (!order || !(displayIndex >= 0 && displayIndex < order.length)) throw new ExamError("exam.err_bad_question");
  await run(env, "UPDATE attempts SET answers_json=json_set(answers_json, ?, ?) WHERE id=? AND submitted_at IS NULL", path, order[displayIndex], att.id);
}

// Score on the server. Idempotent: a submitted attempt is never re-scored.
export async function finalize(env, att, auto = false) {
  const fresh = await one(env, "SELECT * FROM attempts WHERE id=?", att.id);
  if (fresh.submitted_at) return fresh;
  const ids = parseJson(fresh.question_ids, []);
  const answers = parseJson(fresh.answers_json, {});
  const qs = await all(env, `SELECT id, topic, correct_index FROM questions WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
  let correct = 0;
  const topics = {};
  for (const q of qs) {
    const ok = answers[q.id] !== undefined && Number(answers[q.id]) === q.correct_index;
    if (ok) correct++;
    const t = topics[q.topic] || (topics[q.topic] = [0, 0]);
    t[0] += ok ? 1 : 0; t[1] += 1;
  }
  const total = ids.length;
  const pct = total ? Math.round((correct / total) * 10000) / 100 : 0;
  const passed = pct >= fresh.pass_mark ? 1 : 0;
  const now = nowIso();
  const res = await run(env, `UPDATE attempts SET submitted_at=?, auto_submitted=?, correct_count=?, total_count=?, score_pct=?, passed=?, topics_json=?
      WHERE id=? AND submitted_at IS NULL`, now, auto ? 1 : 0, correct, total, pct, passed, JSON.stringify(topics), fresh.id);
  if (passed && res.meta && res.meta.changes) {
    const lv = await one(env, "SELECT certificate FROM exam_levels WHERE code=?", fresh.level_code);
    if (!lv || lv.certificate) await issueCertificate(env, { ...fresh, score_pct: pct, submitted_at: now });
  }
  return one(env, "SELECT * FROM attempts WHERE id=?", fresh.id);
}

export async function issueCertificate(env, att) {
  const existing = await one(env, "SELECT code FROM certificates WHERE attempt_id=?", att.id);
  if (existing) return existing.code;
  for (let i = 0; i < 5; i++) {
    const code = `PB-${new Date().getUTCFullYear()}-${randomCode(4)}-${randomCode(4)}`;
    try {
      await run(env, `INSERT INTO certificates(code,email,name,level_code,score_pct,attempt_id,issued_at,status) VALUES (?,?,?,?,?,?,?, 'valid')`,
        code, att.email, att.name, att.level_code, att.score_pct, att.id, att.submitted_at || nowIso());
      return code;
    } catch (e) { if (!/UNIQUE/i.test(String(e.message))) throw e; }
  }
  throw new Error("Could not create a unique certificate code");
}

export function topicRows(att, lang) {
  const data = parseJson(att.topics_json, {});
  return Object.entries(data).map(([k, [c, t]]) => ({ topic: topicLabel(k, lang), correct: c, total: t, pct: t ? Math.round((c / t) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct);
}
