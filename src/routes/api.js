// JSON API used by the site's own pages (email gate, downloads, orders, exams, contact).
// Every POST must come from this site (Origin check + custom X-PB header).
import { one, run, rateLimit, logEvent } from "../lib/db.js";
import { nowIso, isoPlus, MIN, HOUR, randomToken, sha256, isEmail, normEmail, clip, clientIp, signValue, readSigned, toInt } from "../lib/util.js";
import { mailConfigured, sendMail, emailLayout } from "../lib/mail.js";
import { paymentMethods } from "../lib/settings.js";
import { getFile, fileResponse } from "../lib/files.js";
import { createOrder, ownsFile, pendingOrder, TRX_RE, PHONE_RE } from "../lib/orders.js";
import { startAttempt, loadAttempt, saveAnswer, finalize, ExamError, level } from "../lib/exams.js";
import { BY_SLUG } from "../../public/js/calc/defs.js";

// ------------------------------------------------------------------ helpers
export async function recordEmail(env, email, { source, lang, verified = false, subscribe = false, name = null }) {
  const now = nowIso();
  await run(env, `INSERT INTO emails(email,name,lang,source,verified_at,first_seen,last_seen,subscribed) VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(email) DO UPDATE SET last_seen=excluded.last_seen, lang=excluded.lang,
       verified_at=COALESCE(emails.verified_at, excluded.verified_at), subscribed=MAX(emails.subscribed, excluded.subscribed),
       name=COALESCE(excluded.name, emails.name)`,
    email, name, lang, source, verified ? now : null, now, now, subscribe ? 1 : 0);
}

// A visitor may proceed when their email is confirmed — or when the site has no
// email service yet ("collect-only" mode, used while testing).
export async function visitorReady(c) {
  const v = await c.visitor();
  if (!v) return null;
  if (v.verified) return v;
  return mailConfigured(c.env, await c.settings()) ? null : v;
}

const needEmail = (c) => c.json({ ok: false, need_email: true, error: c.t("gate.title") }, 401);

// ------------------------------------------------------------------ routes
export function registerApi(r) {
  r.get("/api/me", async (c) => {
    const v = await c.visitor();
    const ready = await visitorReady(c);
    return c.json({ ok: Boolean(ready), email: v ? v.email : null, verified: v ? v.verified : false });
  });

  r.post("/api/forget-email", async (c) => { c.clearVisitor(); return c.json({ ok: true }); });

  // Newsletter: one click, no confirmation code. Uses the email this browser already
  // gave us, or the address typed in the small subscribe box.
  r.post("/api/subscribe", async (c) => {
    const b = await c.body();
    c.setLang(b.lang);
    const v = await c.visitor();
    const email = b.email ? normEmail(b.email) : v ? v.email : "";
    if (!email) return c.json({ ok: false, ask_email: true }, 400);
    if (!isEmail(email)) return c.json({ ok: false, error: c.t("form.invalid_email"), field: "email" }, 400);
    if (!(await rateLimit(c.env, "sub-ip:" + (await sha256("ip:" + clientIp(c.req))), 20, 3600))) return c.json({ ok: false, error: c.t("error.rate_limited") }, 429);
    const verified = Boolean(v && v.email === email && v.verified);
    await recordEmail(c.env, email, { source: "newsletter", lang: c.lang, verified, subscribe: true });
    if (!v) await c.setVisitor(email, false);
    return c.json({ ok: true, email });
  });

  // Step 1 of the email gate: send a confirmation link (or, without an email
  // service, record the address and continue).
  r.post("/api/verify/start", async (c) => {
    const b = await c.body();
    c.setLang(b.lang);
    const email = normEmail(b.email);
    if (!isEmail(email)) return c.json({ ok: false, error: c.t("form.invalid_email"), field: "email" }, 400);
    if (!b.consent) return c.json({ ok: false, error: c.t("gate.consent_required") }, 400);
    const s = await c.settings();
    const ipKey = await sha256("ip:" + clientIp(c.req));
    if (!(await rateLimit(c.env, "verify-ip:" + ipKey, 12, 3600)) || !(await rateLimit(c.env, "verify-em:" + email, 6, 3600))) {
      return c.json({ ok: false, error: c.t("gate.rate") }, 429);
    }
    const next = typeof b.next === "string" && b.next.startsWith("/") && !b.next.startsWith("//") ? b.next.slice(0, 300) : c.p("/");
    if (!mailConfigured(c.env, s)) {
      await recordEmail(c.env, email, { source: "gate", lang: c.lang, verified: false, subscribe: !!b.subscribe });
      await c.setVisitor(email, false);
      return c.json({ ok: true, status: "collected", email, message: c.t("gate.collected") });
    }
    const token = randomToken(24);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    await run(c.env, "INSERT INTO verifications(token_hash,email,purpose,next,lang,subscribe,created_at,expires_at,code_hash) VALUES (?,?,?,?,?,?,?,?,?)",
      await sha256(token), email, "gate", next, c.lang, b.subscribe ? 1 : 0, nowIso(), isoPlus(60 * MIN), await sha256(`code:${email}:${code}`));
    const link = `${c.siteUrl}/${c.lang}/verify?t=${token}`;
    const mail = emailLayout({ title: c.t("verify.title"), paragraphs: [c.t("verify.mail_code", { code }), c.t("verify.mail_lead"), c.t("verify.mail_ignore")],
      button: { label: c.t("verify.button"), url: link }, footer: "ProcureBest", siteUrl: c.siteUrl });
    const sent = await sendMail(c.env, s, { to: email, subject: c.t("verify.subject_code", { code }), ...mail });
    if (!sent.ok) {
      console.error("verification email failed", sent.error);
      await logProblem(c, email, "email", sent.error);
      return c.json({ ok: false, error: c.t("gate.mail_failed") }, 502);
    }
    await recordEmail(c.env, email, { source: "gate", lang: c.lang, verified: false });
    return c.json({ ok: true, status: "sent", message: c.t("gate.sent", { email }) });
  });

  // Step 2 (alternative to the link): the 6-digit code from the email, typed on any device.
  r.post("/api/verify/code", async (c) => {
    const b = await c.body();
    c.setLang(b.lang);
    const email = normEmail(b.email);
    const code = String(b.code || "").replace(/\D/g, "");
    if (!isEmail(email) || code.length !== 6) return c.json({ ok: false, error: c.t("gate.code_bad") }, 400);
    if (!(await rateLimit(c.env, "code:" + email, 8, 900))) return c.json({ ok: false, error: c.t("gate.rate") }, 429);
    const row = await one(c.env, `SELECT * FROM verifications WHERE email=? AND code_hash=? AND used_at IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1`,
      email, await sha256(`code:${email}:${code}`), nowIso());
    if (!row) return c.json({ ok: false, error: c.t("gate.code_bad") }, 400);
    await run(c.env, "UPDATE verifications SET used_at=? WHERE id=?", nowIso(), row.id);
    await recordEmail(c.env, email, { source: row.purpose, lang: c.lang, verified: true, subscribe: !!row.subscribe });
    await run(c.env, "UPDATE emails SET verified_at=COALESCE(verified_at, ?) WHERE email=?", nowIso(), email);
    await c.setVisitor(email, true);
    return c.json({ ok: true, email });
  });

  // Calculator report downloads are generated in the browser; this records who asked.
  r.post("/api/calc-export", async (c) => {
    const v = await visitorReady(c);
    if (!v) return needEmail(c);
    const b = await c.body();
    if (!BY_SLUG[b.slug]) return c.json({ ok: false }, 400);
    await logEvent(c.env, "calc_export", v.email, b.slug, b.format === "pdf" ? "pdf" : "xlsx");
    await run(c.env, "UPDATE emails SET downloads=downloads+1, last_seen=? WHERE email=?", nowIso(), v.email);
    return c.json({ ok: true });
  });

  // Library: returns a short-lived signed download URL.
  r.post("/api/library/:slug/link", async (c) => {
    const b = await c.body();
    c.setLang(b.lang);
    const v = await visitorReady(c);
    if (!v) return needEmail(c);
    const item = await one(c.env, "SELECT * FROM items WHERE slug=? AND status='published'", c.params.slug);
    if (!item) return c.json({ ok: false, error: c.t("error.not_found") }, 404);
    if (!item.file_id) return c.json({ ok: false, error: c.t("lib.no_file") }, 404);
    if (item.price > 0 && !(await ownsFile(c.env, v.email, item.slug))) {
      return c.json({ ok: false, buy: c.p(`/buy/file/${item.slug}`) }, 402);
    }
    if (!(await rateLimit(c.env, "dl:" + v.email, 60, 3600))) return c.json({ ok: false, error: c.t("error.rate_limited") }, 429);
    const token = await signValue(await c.secret(), JSON.stringify({ f: item.file_id, i: item.id, e: v.email }), 10 * MIN);
    await env_logDownload(c, v.email, item);
    return c.json({ ok: true, url: `/dl/${encodeURIComponent(token)}`, message: c.t("lib.started") });
  });

  r.get("/dl/:token", async (c) => {
    const payload = await readSigned(await c.secret(), c.params.token);
    if (!payload) return c.html(`<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">${c.t("delivery.download_expired")}</p>`, 410);
    const { f } = JSON.parse(payload);
    const file = await getFile(c.env, f);
    if (!file || !file.complete) return c.html(`<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">${c.t("delivery.err_file_missing")}</p>`, 404);
    return fileResponse(c.env, file, "attachment", { "Cache-Control": "private, no-store" });
  });

  // User review (shown after the admin approves it).
  r.post("/api/reviews", async (c) => {
    const b = await c.body();
    c.setLang(b.lang);
    const v = await visitorReady(c);
    if (!v) return needEmail(c);
    const name = clip(b.name, 80).replace(/\s+/g, " ");
    const text = clip(b.body, 800).trim();
    if (name.length < 2) return c.json({ ok: false, error: c.t("form.required"), field: "name" }, 400);
    if (text.length < 20) return c.json({ ok: false, error: c.t("reviews.err_text"), field: "body" }, 400);
    if (!(await rateLimit(c.env, "review:" + v.email, 3, 86400))) return c.json({ ok: false, error: c.t("error.rate_limited") }, 429);
    const rating = Math.min(5, Math.max(1, toInt(b.rating, 5)));
    await run(c.env, "INSERT INTO reviews(email,name,role,rating,body,lang,status,created_at) VALUES (?,?,?,?,?,?,'pending',?)",
      v.email, name, clip(b.role, 100), rating, text, c.lang, nowIso());
    await recordEmail(c.env, v.email, { source: "review", lang: c.lang, verified: v.verified, name });
    return c.json({ ok: true, message: c.t("reviews.thanks") });
  });

  // Manual bKash / Nagad order.
  r.post("/api/orders", async (c) => {
    const b = await c.body();
    c.setLang(b.lang);
    try { return await placeOrder(c, b); }
    catch (e) {
      console.error("order failed", e);
      await logProblem(c, (await c.visitor())?.email, "order", `${b.item_type}:${b.item_ref} → server error: ${e && e.message}`);
      return c.json({ ok: false, error: c.t("error.generic") }, 500);
    }
  });

  // No email confirmation here: the buyer types their email with the TrxID. Access is only
  // granted through the link in the "approved" email, which proves the address.
  async function placeOrder(c, b) {
    const email = normEmail(b.email);
    if (!isEmail(email)) return orderFail(c, b, c.t("form.invalid_email"), 400, "email");
    if (!(await rateLimit(c.env, "orderip:" + (await sha256("ip:" + clientIp(c.req))), 20, 86400))) return orderFail(c, b, c.t("error.rate_limited"), 429);
    const cur = await c.visitor();
    if (!cur || cur.email !== email) await c.setVisitor(email, false);
    const v = await c.visitor();
    const s = await c.settings();
    const methods = paymentMethods(s);
    const method = methods.find((m) => m.code === b.method);
    if (!method) return orderFail(c, b, c.t("order.no_methods"), 400, "method");
    const trx = clip(b.trx, 30).replace(/\s+/g, "");
    if (!TRX_RE.test(trx)) return orderFail(c, b, c.t("order.err_trx"), 400, "trx");
    const sender = clip(b.sender, 20).replace(/[\s-]/g, "");
    if (!PHONE_RE.test(sender)) return orderFail(c, b, c.t("order.err_sender"), 400, "sender");
    const name = clip(b.name, 100);
    if (name.length < 2) return orderFail(c, b, c.t("form.required"), 400, "name");
    const phone = clip(b.phone, 20);
    let itemTitle, amount;
    if (b.item_type === "file") {
      const item = await one(c.env, "SELECT * FROM items WHERE slug=? AND status='published'", b.item_ref);
      if (!item || item.price <= 0) return orderFail(c, b, c.t("error.not_found"), 404);
      if (await ownsFile(c.env, v.email, item.slug)) return orderFail(c, b, c.t("order.err_owned"), 409);
      itemTitle = item.title_en || item.title_bn; amount = item.price;
    } else if (b.item_type === "course") {
      const k = await one(c.env, "SELECT * FROM courses WHERE slug=? AND status='published'", b.item_ref);
      if (!k || k.price <= 0) return orderFail(c, b, c.t("error.not_found"), 404);
      if (await one(c.env, "SELECT id FROM entitlements WHERE email=? AND item_type='course' AND item_ref=?", v.email, k.slug)) return orderFail(c, b, c.t("order.err_owned"), 409);
      itemTitle = `${k.title_en || k.title_bn} (course)`; amount = k.price;
    } else if (b.item_type === "exam") {
      const lv = await level(c.env, b.item_ref);
      if (!lv || lv.price <= 0) return orderFail(c, b, c.t("error.not_found"), 404);
      itemTitle = `${lv.title_en} exam`; amount = lv.price;
    } else return orderFail(c, b, c.t("error.bad_request"), 400);
    if (await pendingOrder(c.env, v.email, b.item_type, b.item_ref)) return orderFail(c, b, c.t("order.err_pending"), 409);
    if (!(await rateLimit(c.env, "order:" + v.email, 10, 86400))) return orderFail(c, b, c.t("error.rate_limited"), 429);
    let ref;
    try {
      ref = await createOrder(c.env, { email: v.email, name, phone, itemType: b.item_type, itemRef: b.item_ref, itemTitle, amount, method: method.code, sender, trx, lang: c.lang });
    } catch (e) {
      if (/UNIQUE/i.test(String(e.message))) return orderFail(c, b, c.t("order.err_dup"), 409, "trx");
      throw e;
    }
    await recordEmail(c.env, v.email, { source: "order", lang: c.lang, verified: v.verified, name });
    if ((s.notify_email || "").includes("@")) {
      const mail = emailLayout({ title: `New order ${ref}`, paragraphs: [`${name} <${v.email}> paid ${amount} BDT by ${method.name} for “${itemTitle}”.`, `Sender: ${sender} · TrxID: ${trx.toUpperCase()}`, "Check the payment in your app, then approve it in Admin → Orders."],
        button: { label: "Open orders", url: `${c.siteUrl}/admin/orders` }, footer: "ProcureBest admin notification" });
      c.exec?.waitUntil?.(sendMail(c.env, s, { to: s.notify_email.trim(), subject: `ProcureBest: new order ${ref} (${amount} BDT)`, ...mail }));
    }
    return c.json({ ok: true, redirect: c.p(`/buy/done/${ref}`) });
  }

  // Exams
  r.post("/api/exams/:code/start", async (c) => {
    const b = await c.body();
    c.setLang(b.lang);
    const v = await visitorReady(c);
    if (!v) return needEmail(c);
    const name = clip(b.name, 80).replace(/\s+/g, " ");
    if (name.length < 3) return c.json({ ok: false, error: c.t("exam.err_name"), field: "name" }, 400);
    try {
      const id = await startAttempt(c.env, { email: v.email, name, code: c.params.code, lang: c.lang });
      await recordEmail(c.env, v.email, { source: "exam", lang: c.lang, verified: v.verified, name });
      return c.json({ ok: true, redirect: c.p(`/exams/attempt/${id}`) });
    } catch (e) {
      if (e instanceof ExamError) {
        const extra = e.key === "exam.err_paid" ? { buy: c.p(`/buy/exam/${c.params.code}`) } : {};
        return c.json({ ok: false, error: c.t(e.key, e.vars), ...extra }, 400);
      }
      throw e;
    }
  });

  r.post("/api/exams/attempt/:id/answer", async (c) => {
    const v = await c.visitor();
    if (!v) return needEmail(c);
    const att = await loadAttempt(c.env, c.params.id, v.email);
    if (!att) return c.json({ ok: false }, 404);
    const b = await c.body();
    try {
      await saveAnswer(c.env, att, toInt(b.question_id, -1), b.choice === null || b.choice === undefined ? null : toInt(b.choice, -1));
      return c.json({ ok: true, seconds_left: Math.max(0, Math.round((Date.parse(att.deadline_at) - Date.now()) / 1000)) });
    } catch (e) {
      if (e instanceof ExamError) return c.json({ ok: false, closed: e.key === "exam.err_closed", error: c.t(e.key) }, 400);
      throw e;
    }
  });

  r.post("/api/exams/attempt/:id/submit", async (c) => {
    const v = await c.visitor();
    if (!v) return needEmail(c);
    const att = await loadAttempt(c.env, c.params.id, v.email);
    if (!att) return c.json({ ok: false }, 404);
    const b = await c.body();
    c.setLang(b.lang || att.lang);
    await finalize(c.env, att, !!b.auto);
    return c.json({ ok: true, redirect: c.p(`/exams/result/${att.id}`) });
  });

  r.post("/api/contact", async (c) => {
    const b = await c.body();
    c.setLang(b.lang);
    const email = normEmail(b.email);
    const name = clip(b.name, 100), subject = clip(b.subject, 150), body = String(b.message || "").trim();
    if (name.length < 2) return c.json({ ok: false, error: c.t("form.required"), field: "name" }, 400);
    if (!isEmail(email)) return c.json({ ok: false, error: c.t("form.invalid_email"), field: "email" }, 400);
    if (body.length < 10 || body.length > 5000) return c.json({ ok: false, error: c.t("contact.message_length"), field: "message" }, 400);
    if (b.website) return c.json({ ok: true, message: c.t("contact.sent") }); // honeypot
    const ipKey = await sha256("ip:" + clientIp(c.req));
    if (!(await rateLimit(c.env, "contact:" + ipKey, 5, 3600))) return c.json({ ok: false, error: c.t("error.rate_limited") }, 429);
    await run(c.env, "INSERT INTO messages(name,email,subject,body,lang,created_at) VALUES (?,?,?,?,?,?)", name, email, subject, body, c.lang, nowIso());
    await recordEmail(c.env, email, { source: "contact", lang: c.lang, name });
    const s = await c.settings();
    if ((s.notify_email || "").includes("@")) {
      const mail = emailLayout({ title: `Message from ${name}`, paragraphs: [`${name} <${email}>`, subject, body], footer: "ProcureBest contact form" });
      c.exec?.waitUntil?.(sendMail(c.env, s, { to: s.notify_email.trim(), subject: `ProcureBest contact: ${subject || name}`, ...mail }));
    }
    return c.json({ ok: true, message: c.t("contact.sent") });
  });
}

// Failed order attempts are logged so the admin can see why an order did not arrive.
async function logProblem(c, email, what, detail) {
  try { await run(c.env, "INSERT INTO events(kind,email,ref,detail,created_at) VALUES ('problem',?,?,?,?)", email || null, what, String(detail || "").slice(0, 300), nowIso()); }
  catch (e) { console.error(e); }
}
async function orderFail(c, b, message, status, field) {
  const v = await c.visitor();
  await logProblem(c, (v && v.email) || (isEmail(b.email) ? normEmail(b.email) : null), "order", `${b.item_type || "?"}:${b.item_ref || "?"} trx=${String(b.trx || "").slice(0, 30)} → ${message}`);
  return c.json({ ok: false, error: message, ...(field ? { field } : {}) }, status);
}

async function env_logDownload(c, email, item) {
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO events(kind,email,ref,detail,created_at) VALUES ('download',?,?,?,?)").bind(email, item.slug, item.type, nowIso()),
    c.env.DB.prepare("UPDATE items SET downloads=downloads+1 WHERE id=?").bind(item.id),
    c.env.DB.prepare("UPDATE emails SET downloads=downloads+1, last_seen=? WHERE email=?").bind(nowIso(), email),
  ]);
}
