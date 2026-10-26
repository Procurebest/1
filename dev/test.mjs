// End-to-end tests against the real Worker code (Node + SQLite stand-in for D1).
//   node --experimental-sqlite dev/test.mjs
import assert from "node:assert/strict";
import { makeEnv, handle } from "./server.mjs";
import FILES from "../src/seed/files.js";

const BASE = "http://test.local";
let failures = 0, passed = 0;
const maxQueries = { n: 0, path: "" };

function client(env) {
  const jar = new Map();
  async function req(method, path, { json, form, body, headers = {}, raw = false } = {}) {
    const h = new Headers({ Origin: BASE, ...headers });
    if (jar.size) h.set("Cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    let b = body;
    if (json !== undefined) { h.set("Content-Type", "application/json"); h.set("X-PB", "1"); b = JSON.stringify(json); }
    if (form) { b = new URLSearchParams(); for (const [k, v] of Object.entries(form)) for (const x of [].concat(v)) b.append(k, x); }
    const before = env.DB.queries;
    const res = await handle(env, new Request(BASE + path, { method, headers: h, body: b, redirect: "manual" }));
    const used = env.DB.queries - before;
    if (used > maxQueries.n) { maxQueries.n = used; maxQueries.path = `${method} ${path}`; }
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (/Max-Age=0/.test(c)) jar.delete(k); else jar.set(k, v);
    }
    if (raw) return res;
    const ct = res.headers.get("Content-Type") || "";
    const text = ct.includes("json") ? null : await res.text();
    const data = ct.includes("json") ? await res.json() : null;
    return { status: res.status, text, data, location: res.headers.get("Location"), headers: res.headers };
  }
  return { req, jar };
}

async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failures++; console.log("  ✗", name, "\n     ", e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n      ") : e); }
}

const csrfOf = (html) => (html.match(/name="csrf-token" content="([^"]+)"/) || [])[1];
const formCsrf = (html) => (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];

// =====================================================================================
console.log("\nCollect-only mode (no email service) + KV storage");
{
  const { env } = makeEnv({ storage: "kv" });
  const admin = client(env), visitor = client(env), other = client(env);
  let csrf, form;

  await test("admin login rejects a wrong password", async () => {
    const r = await admin.req("POST", "/admin/login", { form: { password: "nope" } });
    assert.equal(r.status, 401);
  });
  await test("admin login works and dashboard loads", async () => {
    const r = await admin.req("POST", "/admin/login", { form: { password: "local-admin-password" } });
    assert.equal(r.status, 303);
    const d = await admin.req("GET", "/admin");
    assert.equal(d.status, 200);
    csrf = csrfOf(d.text); form = formCsrf(d.text);
    assert.ok(csrf && form);
    assert.match(d.text, /collect-only|শুধু সংগ্রহ/);
  });
  await test("admin API refuses requests without the CSRF header", async () => {
    const r = await admin.req("POST", "/admin/api/seed/questions", { headers: {} });
    assert.equal(r.status, 403);
  });
  await test("starter content installs (and twice is harmless)", async () => {
    for (const step of ["questions", "blog", "glossary", "files", "files2", "questions", "files"]) {
      const r = await admin.req("POST", `/admin/api/seed/${step}`, { headers: { "X-CSRF": csrf } });
      assert.equal(r.status, 200, step + " " + JSON.stringify(r.data));
    }
    const count = async (sql) => Object.values(await env.DB.prepare(sql).first())[0];
    assert.equal(await count("SELECT COUNT(*) FROM questions"), 122);
    assert.equal(await count("SELECT COUNT(*) FROM posts WHERE section='blog'"), 10);
    assert.equal(await count("SELECT COUNT(*) FROM posts WHERE section='career'"), 2);
    assert.equal(await count("SELECT COUNT(*) FROM glossary"), 32);
    assert.equal(await count("SELECT COUNT(*) FROM items"), 7);
  });
  await test("public pages render with content in both languages", async () => {
    for (const p of ["/en/", "/bn/", "/en/library", "/bn/library/supplier-database", "/en/blog", "/bn/blog/procure-to-pay-cycle", "/en/career", "/bn/career/procurement-cv-that-gets-shortlisted", "/en/glossary", "/bn/glossary", "/en/exams", "/bn/exams/expert", "/en/learn/procure-to-pay-cycle"]) {
      const r = await visitor.req("GET", p);
      assert.ok([200, 301].includes(r.status), p + " " + r.status);
    }
    const g = await visitor.req("GET", "/bn/glossary");
    assert.match(g.text, /তুলনামূলক বিবরণী/);
    const lib = await visitor.req("GET", "/en/library");
    assert.match(lib.text, /Supplier Comparison Scorecard/);
    assert.match(lib.text, /Premium/);
  });
  await test("downloads need an email", async () => {
    const r = await visitor.req("POST", "/api/library/supplier-database/link", { json: { lang: "en" } });
    assert.equal(r.status, 401);
    assert.equal(r.data.need_email, true);
  });
  await test("API rejects cross-site requests", async () => {
    const r = await visitor.req("POST", "/api/verify/start", { json: { email: "a@b.com", consent: true }, headers: { Origin: "https://evil.example" } });
    assert.equal(r.status, 403);
  });
  await test("email gate: invalid email and missing consent are refused", async () => {
    assert.equal((await visitor.req("POST", "/api/verify/start", { json: { email: "nope", consent: true } })).status, 400);
    assert.equal((await visitor.req("POST", "/api/verify/start", { json: { email: "rahim@example.com" } })).status, 400);
  });
  await test("email gate (collect-only) records the email and sets the cookie", async () => {
    const r = await visitor.req("POST", "/api/verify/start", { json: { email: "Rahim@Example.com", consent: true, subscribe: true, lang: "bn" } });
    assert.equal(r.status, 200);
    assert.equal(r.data.status, "collected");
    const me = await visitor.req("GET", "/api/me");
    assert.equal(me.data.ok, true);
    assert.equal(me.data.email, "rahim@example.com");
    const row = await env.DB.prepare("SELECT * FROM emails WHERE email='rahim@example.com'").first();
    assert.equal(row.subscribed, 1);
  });
  await test("free library download streams the exact file", async () => {
    const r = await visitor.req("POST", "/api/library/supplier-database/link", { json: { lang: "en" } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const res = await visitor.req("GET", r.data.url, { raw: true });
    assert.equal(res.status, 200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const seed = FILES.find((f) => f.slug === "supplier-database");
    assert.deepEqual(Buffer.from(bytes), Buffer.from(seed.data, "base64"));
    assert.match(res.headers.get("Content-Disposition"), /supplier-database\.xlsx/);
  });
  await test("download links are signed and expire", async () => {
    const bad = await visitor.req("GET", "/dl/abc.def.ghi");
    assert.equal(bad.status, 410);
  });
  await test("paid file asks to buy", async () => {
    const r = await visitor.req("POST", "/api/library/procurement-kpi-dashboard/link", { json: { lang: "en" } });
    assert.equal(r.status, 402);
    assert.equal(r.data.buy, "/en/buy/file/procurement-kpi-dashboard");
  });
  await test("buy page explains that payment numbers are missing", async () => {
    const r = await visitor.req("GET", "/en/buy/file/procurement-kpi-dashboard");
    assert.match(r.text, /payment details have not been set up/);
  });
  await test("admin saves payment numbers and WhatsApp link", async () => {
    const s = await admin.req("GET", "/admin/settings");
    const r = await admin.req("POST", "/admin/settings", { form: { _csrf: formCsrf(s.text), pay_bkash_number: "01712-345678", pay_bkash_type: "Personal", pay_nagad_number: "", whatsapp_url: "https://chat.whatsapp.com/AbCdEfGhIjKlMn12", whatsapp_enabled: "1", default_lang: "en" } });
    assert.equal(r.status, 303);
    assert.match(r.location, /msg=saved/);
    const bad = await admin.req("POST", "/admin/settings", { form: { _csrf: formCsrf(s.text), whatsapp_url: "https://example.com/x" } });
    assert.match(bad.location, /err=/);
    const page = await visitor.req("GET", "/en/buy/file/procurement-kpi-dashboard");
    assert.match(page.text, /01712345678/);
    assert.doesNotMatch(page.text, /Nagad<\/strong>/);
  });
  await test("admin forms refuse a missing CSRF token", async () => {
    const r = await admin.req("POST", "/admin/settings", { form: { tagline_en: "x" } });
    assert.equal(r.status, 403);
  });
  await test("order validation (TrxID, sender, duplicates)", async () => {
    const base = { item_type: "file", item_ref: "procurement-kpi-dashboard", method: "bkash", name: "Rahim Uddin", email: "rahim@example.com", lang: "en" };
    assert.equal((await visitor.req("POST", "/api/orders", { json: { ...base, sender: "01712345678", trx: "x" } })).status, 400);
    assert.equal((await visitor.req("POST", "/api/orders", { json: { ...base, sender: "123", trx: "9JK7XQ2ABC" } })).status, 400);
    assert.equal((await visitor.req("POST", "/api/orders", { json: { ...base, method: "nagad", sender: "01712345678", trx: "9JK7XQ2ABC" } })).status, 400);
    const ok = await visitor.req("POST", "/api/orders", { json: { ...base, sender: "01712345678", trx: "9jk7xq2abc" } });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.match(ok.data.redirect, /\/en\/buy\/done\/PB-/);
    const again = await visitor.req("POST", "/api/orders", { json: { ...base, sender: "01712345678", trx: "OTHER12345" } });
    assert.equal(again.status, 409);
    const done = await visitor.req("GET", ok.data.redirect);
    assert.equal(done.status, 200);
    // another visitor cannot reuse the same transaction ID
    await other.req("POST", "/api/verify/start", { json: { email: "karim@example.com", consent: true } });
    const dup = await other.req("POST", "/api/orders", { json: { ...base, email: "karim@example.com", sender: "01812345678", trx: "9JK7XQ2ABC" } });
    assert.equal(dup.status, 409);
  });
  await test("admin approves the order and the buyer can download", async () => {
    const list = await admin.req("GET", "/admin/orders");
    assert.match(list.text, /9JK7XQ2ABC/);
    const o = await env.DB.prepare("SELECT id FROM orders WHERE trx_id='9JK7XQ2ABC'").first();
    const r = await admin.req("POST", `/admin/orders/${o.id}/approve`, { form: { _csrf: formCsrf(list.text) } });
    assert.equal(r.status, 303);
    const link = await visitor.req("POST", "/api/library/procurement-kpi-dashboard/link", { json: { lang: "en" } });
    assert.equal(link.status, 200);
    const my = await visitor.req("GET", "/en/my");
    assert.match(my.text, /Procurement KPI Dashboard/);
    assert.match(my.text, /Approved/);
  });

  // ---------------- exams
  let attemptId;
  async function answerAll(c, id, correct = true) {
    const att = await env.DB.prepare("SELECT * FROM attempts WHERE id=?").bind(id).first();
    const ids = JSON.parse(att.question_ids), orders = JSON.parse(att.option_orders);
    for (const qid of ids) {
      const q = await env.DB.prepare("SELECT correct_index FROM questions WHERE id=?").bind(qid).first();
      const display = orders[qid].indexOf(q.correct_index);
      const choice = correct ? display : (display + 1) % orders[qid].length;
      const r = await c.req("POST", `/api/exams/attempt/${id}/answer`, { json: { question_id: qid, choice } });
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
  }
  await test("exam start needs a name for the certificate", async () => {
    const r = await visitor.req("POST", "/api/exams/beginner/start", { json: { name: "R", lang: "en" } });
    assert.equal(r.status, 400);
  });
  await test("free exam: 20 random questions, no answers in the page", async () => {
    const r = await visitor.req("POST", "/api/exams/beginner/start", { json: { name: "Rahim Uddin", lang: "en" } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    attemptId = r.data.redirect.split("/").pop();
    const page = await visitor.req("GET", r.data.redirect);
    assert.equal(page.status, 200);
    assert.equal((page.text.match(/class="q-card"/g) || []).length, 20);
    assert.doesNotMatch(page.text, /correct_index|explanation/i);
    const again = await visitor.req("POST", "/api/exams/beginner/start", { json: { name: "Rahim Uddin", lang: "en" } });
    assert.equal(again.data.redirect.split("/").pop(), attemptId, "resumes the active attempt");
  });
  await test("another email cannot open or answer someone else's attempt", async () => {
    const r = await other.req("GET", `/en/exams/attempt/${attemptId}`);
    assert.equal(r.status, 404);
    const a = await other.req("POST", `/api/exams/attempt/${attemptId}/answer`, { json: { question_id: 1, choice: 0 } });
    assert.equal(a.status, 404);
  });
  let certCode;
  await test("Knowledge Check: scored on the server, no certificate, shareable result", async () => {
    await answerAll(visitor, attemptId, true);
    const s = await visitor.req("POST", `/api/exams/attempt/${attemptId}/submit`, { json: { lang: "en" } });
    assert.equal(s.status, 200);
    const res = await visitor.req("GET", `/en/exams/result/${attemptId}`);
    assert.match(res.text, /Passed/);
    assert.match(res.text, /does not issue a certificate/);
    assert.match(res.text, new RegExp(`/en/results/${attemptId}`));
    assert.equal(await env.DB.prepare("SELECT code FROM certificates WHERE attempt_id=?").bind(attemptId).first(), null);
    const pub = await other.req("GET", `/en/results/${attemptId}`);
    assert.equal(pub.status, 200);
    assert.match(pub.text, /Rahim Uddin scored 100%/);
    assert.doesNotMatch(pub.text, /rahim@example.com/);
  });
  await test("Professional exam: a pass issues a certificate", async () => {
    const st = await visitor.req("POST", "/api/exams/experienced/start", { json: { name: "Rahim Uddin", lang: "en" } });
    assert.equal(st.status, 200, JSON.stringify(st.data));
    const pid = st.data.redirect.split("/").pop();
    await answerAll(visitor, pid, true);
    const s = await visitor.req("POST", `/api/exams/attempt/${pid}/submit`, { json: { lang: "en" } });
    assert.equal(s.status, 200);
    const cert = await env.DB.prepare("SELECT * FROM certificates WHERE attempt_id=?").bind(pid).first();
    assert.ok(cert && /^PB-\d{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(cert.code));
    certCode = cert.code;
    assert.equal(cert.name, "Rahim Uddin");
    const late = await visitor.req("POST", `/api/exams/attempt/${attemptId}/answer`, { json: { question_id: 1, choice: 0 } });
    assert.equal(late.status, 400);
  });
  await test("certificate verification and owner-only print page with QR", async () => {
    const v = await other.req("GET", `/bn/certificates/verify?code=${certCode.toLowerCase()}`);
    assert.match(v.text, /বৈধ সার্টিফিকেট/);
    assert.match(v.text, /Rahim Uddin/);
    assert.doesNotMatch(v.text, /rahim@example.com/);
    const p = await other.req("GET", `/en/certificates/${certCode}/print`);
    assert.equal(p.status, 303);
    const mine = await visitor.req("GET", `/en/certificates/${certCode}/print`);
    assert.equal(mine.status, 200);
    assert.match(mine.text, /<svg[^>]+aria-label="QR code"/);
    const nf = await other.req("GET", "/en/certificates/verify?code=PB-2026-AAAA-BBBB");
    assert.match(nf.text, /No certificate was found/);
  });
  await test("free exam daily limit (2 per day by default)", async () => {
    const r2 = await visitor.req("POST", "/api/exams/beginner/start", { json: { name: "Rahim Uddin", lang: "en" } });
    assert.equal(r2.status, 200);
    const id2 = r2.data.redirect.split("/").pop();
    await answerAll(visitor, id2, false);
    await visitor.req("POST", `/api/exams/attempt/${id2}/submit`, { json: { lang: "en" } });
    const res = await visitor.req("GET", `/en/exams/result/${id2}`);
    assert.match(res.text, /Not passed/);
    const r3 = await visitor.req("POST", "/api/exams/beginner/start", { json: { name: "Rahim Uddin", lang: "en" } });
    assert.equal(r3.status, 400);
    assert.match(r3.data.error, /today's free attempts/);
  });
  await test("paid exam: buy, approve, 3 attempts", async () => {
    const no = await visitor.req("POST", "/api/exams/expert/start", { json: { name: "Rahim Uddin", lang: "en" } });
    assert.equal(no.status, 400);
    assert.equal(no.data.buy, "/en/buy/exam/expert");
    const o = await visitor.req("POST", "/api/orders", { json: { item_type: "exam", item_ref: "expert", method: "bkash", sender: "01712345678", trx: "EXAM777777", name: "Rahim Uddin", email: "rahim@example.com", lang: "bn" } });
    assert.equal(o.status, 200, JSON.stringify(o.data));
    const list = await admin.req("GET", "/admin/orders");
    const row = await env.DB.prepare("SELECT id FROM orders WHERE trx_id='EXAM777777'").first();
    await admin.req("POST", `/admin/orders/${row.id}/approve`, { form: { _csrf: formCsrf(list.text) } });
    const page = await visitor.req("GET", "/en/exams/expert");
    assert.match(page.text, /3 attempts left/);
    const s = await visitor.req("POST", "/api/exams/expert/start", { json: { name: "Rahim Uddin", lang: "en" } });
    assert.equal(s.status, 200);
    const idx = s.data.redirect.split("/").pop();
    const page2 = await visitor.req("GET", "/en/exams/expert");
    assert.match(page2.text, /Resume/);
    await visitor.req("POST", `/api/exams/attempt/${idx}/submit`, { json: { auto: true, lang: "en" } });
    const page3 = await visitor.req("GET", "/en/exams/expert");
    assert.match(page3.text, /2 attempts left/);
  });
  await test("expired attempts are scored automatically", async () => {
    const s = await other.req("POST", "/api/exams/experienced/start", { json: { name: "Karim Mia", lang: "en" } });
    const id = s.data.redirect.split("/").pop();
    await env.DB.prepare("UPDATE attempts SET deadline_at='2020-01-01T00:00:00Z' WHERE id=?").bind(id).run();
    const r = await other.req("GET", `/en/exams/attempt/${id}`);
    assert.equal(r.status, 303);
    const row = await env.DB.prepare("SELECT submitted_at, auto_submitted FROM attempts WHERE id=?").bind(id).first();
    assert.ok(row.submitted_at);
    assert.equal(row.auto_submitted, 1);
  });

  // ---------------- admin pages & content management
  await test("every admin page loads", async () => {
    for (const p of ["/admin", "/admin/library", "/admin/library/new", "/admin/library/1", "/admin/posts?section=blog", "/admin/posts?section=career", "/admin/posts/new?section=career", "/admin/posts/1",
      "/admin/glossary", "/admin/glossary?edit=new", "/admin/glossary?edit=1", "/admin/exams", "/admin/questions", "/admin/questions?level=expert&q=risk", "/admin/questions/new", "/admin/questions/5",
      "/admin/questions/import", "/admin/orders", "/admin/orders?status=all", "/admin/emails", "/admin/emails?filter=subscribed", "/admin/activity", "/admin/certificates", "/admin/messages", "/admin/settings", "/admin/lang/en?back=/admin"]) {
      const r = await admin.req("GET", p);
      assert.ok([200, 303].includes(r.status), `${p} → ${r.status}`);
    }
  });
  await test("admin uploads a file in chunks (KV) and publishes a book", async () => {
    const size = 21 * 1024 * 1024 + 12345; // two KV parts
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) data[i] = (i * 31 + 7) & 255;
    const init = await admin.req("POST", "/admin/api/files/init", { body: JSON.stringify({ name: "procurement-handbook.pdf", size, kind: "file" }), headers: { "X-CSRF": csrf, "Content-Type": "application/json" } });
    assert.equal(init.status, 200, JSON.stringify(init.data));
    assert.equal(init.data.storage, "kv");
    assert.equal(init.data.chunks, 2);
    for (let i = 0; i < init.data.chunks; i++) {
      const part = data.subarray(i * init.data.chunkSize, (i + 1) * init.data.chunkSize);
      const r = await admin.req("PUT", `/admin/api/files/${init.data.id}/chunk/${i}`, { body: part, headers: { "X-CSRF": csrf } });
      assert.equal(r.status, 200);
    }
    const done = await admin.req("POST", `/admin/api/files/${init.data.id}/complete`, { headers: { "X-CSRF": csrf } });
    assert.equal(done.status, 200);
    const edit = await admin.req("GET", "/admin/library/new?type=book");
    const save = await admin.req("POST", "/admin/library/new", { form: { _csrf: formCsrf(edit.text), type: "book", status: "published", price: "0", title_en: "Procurement Handbook (test)", title_bn: "প্রকিউরমেন্ট হ্যান্ডবুক", summary_en: "A test book", body_en: "## Chapters\n\n- One\n- Two", file_id: init.data.id, sort: "5" } });
    assert.equal(save.status, 303, save.text);
    const pub = await visitor.req("GET", "/en/library/procurement-handbook-test");
    assert.match(pub.text, /Procurement Handbook \(test\)/);
    assert.match(pub.text, /<h2[^>]*>Chapters<\/h2>/);
    const link = await visitor.req("POST", "/api/library/procurement-handbook-test/link", { json: { lang: "en" } });
    const res = await visitor.req("GET", link.data.url, { raw: true });
    const got = new Uint8Array(await res.arrayBuffer());
    assert.equal(got.length, size);
    assert.ok(Buffer.from(got).equals(Buffer.from(data)));
  });
  await test("upload rejects wrong file types and oversize files", async () => {
    const a = await admin.req("POST", "/admin/api/files/init", { body: JSON.stringify({ name: "x.exe", size: 10, kind: "file" }), headers: { "X-CSRF": csrf, "Content-Type": "application/json" } });
    assert.equal(a.status, 400);
    const b = await admin.req("POST", "/admin/api/files/init", { body: JSON.stringify({ name: "x.pdf", size: 500 * 1024 * 1024, kind: "file" }), headers: { "X-CSRF": csrf, "Content-Type": "application/json" } });
    assert.equal(b.status, 400);
  });
  await test("markdown cannot inject scripts", async () => {
    const edit = await admin.req("GET", "/admin/posts/new?section=blog");
    await admin.req("POST", "/admin/posts/new", { form: { _csrf: formCsrf(edit.text), section: "blog", title_en: "XSS test", body_en: "Hello <script>alert(1)</script> [x](javascript:alert(1))", status: "published", published_at: "2026-10-01" } });
    const r = await visitor.req("GET", "/en/blog/xss-test");
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.text, /<script>alert/);
    assert.doesNotMatch(r.text, /href="javascript:/);
  });
  await test("question CSV export → import round trip", async () => {
    const expRes = await admin.req("GET", "/admin/questions/export?level=beginner", { raw: true });
    const expBytes = new Uint8Array(await expRes.arrayBuffer());
    assert.deepEqual([...expBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "UTF-8 BOM for Excel");
    const exp = { text: new TextDecoder().decode(expBytes) };
    assert.match(exp.text, /^id,level,topic/);
    const lines = exp.text.trim().split("\r\n");
    { const bc = Number(Object.values(await env.DB.prepare("SELECT COUNT(*) FROM questions WHERE level_code='beginner'").first())[0]); assert.equal(lines.length, bc + 1); }
    const newRow = '\r\n,expert,risk,published,"What is a ""single point of failure"" in supply?",,A risk where one supplier failure stops supply,,A discount,,,,,,1,Explained,';
    const beforeCount = Number(Object.values(await env.DB.prepare("SELECT COUNT(*) FROM questions").first())[0]);
    const fd = new FormData();
    const imp = await admin.req("GET", "/admin/questions/import");
    fd.set("_csrf", formCsrf(imp.text));
    fd.set("csv", new Blob([exp.text + newRow], { type: "text/csv" }), "q.csv");
    const r = await admin.req("POST", "/admin/questions/import", { body: fd });
    assert.equal(r.status, 200);
    assert.match(r.text, /(Added 1,|যোগ হয়েছে 1,)/);
    const n = Object.values(await env.DB.prepare("SELECT COUNT(*) FROM questions").first())[0];
    assert.equal(n, beforeCount + 1);
  });
  await test("contact form stores the message (honeypot ignored)", async () => {
    const r = await other.req("POST", "/api/contact", { json: { name: "Karim", email: "karim@example.com", subject: "Hi", message: "Please add a freight calculator for air.", lang: "en" } });
    assert.equal(r.status, 200);
    const bot = await other.req("POST", "/api/contact", { json: { name: "Bot", email: "b@x.com", message: "spam spam spam", website: "http://x" } });
    assert.equal(bot.status, 200);
    const n = Object.values(await env.DB.prepare("SELECT COUNT(*) FROM messages").first())[0];
    assert.equal(n, 1);
  });
  await test("email list CSV export", async () => {
    const r = await admin.req("GET", "/admin/emails/export");
    assert.match(r.text, /rahim@example.com/);
    assert.match(r.text, /karim@example.com/);
  });
  await test("certificate revoke shows on the public page", async () => {
    const page = await admin.req("GET", "/admin/certificates");
    await admin.req("POST", `/admin/certificates/${certCode}/revoke`, { form: { _csrf: formCsrf(page.text), reason: "Test" } });
    const v = await other.req("GET", `/en/certificates/${certCode}`);
    assert.match(v.text, /has been revoked/);
  });
  await test("signed-out admin is redirected; visitor cookie cannot open admin", async () => {
    const r = await visitor.req("GET", "/admin/orders");
    assert.equal(r.status, 303);
    assert.equal(r.location, "/admin/login");
  });
  await test("calculator export is logged against the email", async () => {
    const r = await visitor.req("POST", "/api/calc-export", { json: { slug: "comparative-statement", format: "xlsx" } });
    assert.equal(r.status, 200);
    const n = Object.values(await env.DB.prepare("SELECT COUNT(*) FROM events WHERE kind='calc_export'").first())[0];
    assert.equal(n, 1);
  });
  await test("sitemap lists posts and library items", async () => {
    const r = await visitor.req("GET", "/sitemap.xml");
    assert.match(r.text, /\/bn\/blog\/procure-to-pay-cycle/);
    assert.match(r.text, /\/en\/library\/supplier-database/);
  });
}

// =====================================================================================
console.log("\nEmail verification mode (email service configured) + D1 file storage");
{
  const { env, outbox } = makeEnv({ storage: "d1", mail: true });
  const admin = client(env), visitor = client(env);
  await admin.req("POST", "/admin/login", { form: { password: "local-admin-password" } });
  const s = await admin.req("GET", "/admin/settings");
  await admin.req("POST", "/admin/settings", { form: { _csrf: formCsrf(s.text), mail_from_email: "no-reply@procurebest.test", mail_from_name: "ProcureBest", notify_email: "owner@procurebest.test", pay_bkash_number: "01712345678" } });
  const d = await admin.req("GET", "/admin");
  for (const step of ["files", "files2"]) await admin.req("POST", `/admin/api/seed/${step}`, { headers: { "X-CSRF": csrfOf(d.text) } });

  let link;
  await test("verification email is sent with a one-time link", async () => {
    const r = await visitor.req("POST", "/api/verify/start", { json: { email: "nasrin@example.com", consent: true, lang: "bn", next: "/bn/library" } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.status, "sent");
    const me = await visitor.req("GET", "/api/me");
    assert.equal(me.data.ok, false);
    const mail = outbox.find((m) => m.to === "nasrin@example.com");
    assert.ok(mail);
    link = mail.text.match(/https?:\/\/\S+\/bn\/verify\?t=[\w-]+/)[0];
  });
  await test("GET shows a confirm button (safe against link scanners); POST confirms", async () => {
    const path = link.replace(/^https?:\/\/[^/]+/, "");
    const g = await visitor.req("GET", path);
    assert.match(g.text, /আমার ইমেইল নিশ্চিত করুন/);
    const meBefore = await visitor.req("GET", "/api/me");
    assert.equal(meBefore.data.ok, false);
    const p = await visitor.req("POST", path, { form: {} });
    assert.equal(p.status, 200);
    assert.match(p.text, /pb_verified/);
    const me = await visitor.req("GET", "/api/me");
    assert.equal(me.data.ok, true);
    assert.equal(me.data.verified, true);
    const reuse = await visitor.req("POST", path, { form: {} });
    assert.match(reuse.text, /আগেই ব্যবহার/);
  });
  await test("6-digit code confirms the email on another device", async () => {
    const phone = client(env);
    const r = await phone.req("POST", "/api/verify/start", { json: { email: "rafiq@example.com", consent: true, lang: "en" } });
    assert.equal(r.data.status, "sent");
    const mail = outbox.filter((m) => m.to === "rafiq@example.com").pop();
    const code = mail.subject.match(/\d{6}/)[0];
    assert.match(mail.text, new RegExp(code));
    const wrong = await phone.req("POST", "/api/verify/code", { json: { email: "rafiq@example.com", code: code === "000000" ? "111111" : "000000" } });
    assert.equal(wrong.status, 400);
    const ok = await phone.req("POST", "/api/verify/code", { json: { email: "rafiq@example.com", code } });
    assert.equal(ok.status, 200);
    assert.equal((await phone.req("GET", "/api/me")).data.ok, true);
    const again = await phone.req("POST", "/api/verify/code", { json: { email: "rafiq@example.com", code } });
    assert.equal(again.status, 400, "a code works once");
  });
  await test("refused orders are listed for the admin with the reason", async () => {
    const stranger = client(env);
    await stranger.req("POST", "/api/orders", { json: { item_type: "file", item_ref: "procurement-kpi-dashboard", method: "bkash", sender: "01912345678", trx: "ABC12345", name: "X", lang: "en" } });
    const list = await admin.req("GET", "/admin/orders");
    assert.match(list.text, /ABC12345/);
  });
  await test("D1 file storage serves a template", async () => {
    const r = await visitor.req("POST", "/api/library/tco-comparison-template/link", { json: { lang: "en" } });
    const res = await visitor.req("GET", r.data.url, { raw: true });
    const got = Buffer.from(await res.arrayBuffer());
    assert.equal(got.subarray(0, 2).toString(), "PK");
    const seed = FILES.find((f) => f.slug === "tco-comparison-template");
    assert.ok(got.equals(Buffer.from(seed.data, "base64")));
  });
  await test("D1 storage limits uploads to 5 MB", async () => {
    const dd = await admin.req("GET", "/admin");
    const r = await admin.req("POST", "/admin/api/files/init", { body: JSON.stringify({ name: "big.pdf", size: 6 * 1024 * 1024, kind: "file" }), headers: { "X-CSRF": csrfOf(dd.text), "Content-Type": "application/json" } });
    assert.equal(r.status, 400);
  });
  await test("new orders notify the site owner; approval emails the buyer", async () => {
    const o = await visitor.req("POST", "/api/orders", { json: { item_type: "file", item_ref: "procurement-kpi-dashboard", method: "bkash", sender: "01912345678", trx: "ZX81QWERTY", name: "Nasrin", email: "nasrin@example.com", lang: "bn" } });
    assert.equal(o.status, 200, JSON.stringify(o.data));
    assert.ok(outbox.find((m) => m.to === "owner@procurebest.test" && /ZX81QWERTY|new order/i.test(m.text + m.subject)));
    const list = await admin.req("GET", "/admin/orders");
    const row = await env.DB.prepare("SELECT id FROM orders WHERE trx_id='ZX81QWERTY'").first();
    const a = await admin.req("POST", `/admin/orders/${row.id}/approve`, { form: { _csrf: formCsrf(list.text) } });
    assert.match(a.location, /msg=approved$/);
    const mail = outbox.find((m) => m.to === "nasrin@example.com" && /অনুমোদিত/.test(m.subject));
    assert.ok(mail, "Bengali approval email");
  });
  await test("rejecting an order emails the reason", async () => {
    const o = await visitor.req("POST", "/api/orders", { json: { item_type: "exam", item_ref: "expert", method: "bkash", sender: "01912345678", trx: "WRONG12345", name: "Nasrin", email: "nasrin@example.com", lang: "en" } });
    const list = await admin.req("GET", "/admin/orders");
    const row = await env.DB.prepare("SELECT id FROM orders WHERE trx_id='WRONG12345'").first();
    await admin.req("POST", `/admin/orders/${row.id}/reject`, { form: { _csrf: formCsrf(list.text), note: "No payment with this TrxID" } });
    assert.ok(outbox.find((m) => m.to === "nasrin@example.com" && /No payment with this TrxID/.test(m.text)));
  });
  await test("a buyer orders without any confirmation email; the approval link opens the purchase", async () => {
    const buyer = client(env);
    const before = outbox.length;
    const o = await buyer.req("POST", "/api/orders", { json: { item_type: "exam", item_ref: "expert", method: "bkash", sender: "01612345678", trx: "SIMPLE1234", name: "Selim Reza", email: "Selim@Example.com", lang: "bn" } });
    assert.equal(o.status, 200, JSON.stringify(o.data));
    assert.ok(!outbox.slice(before).some((m) => m.to === "selim@example.com"), "no confirmation email before approval");
    const done = await buyer.req("GET", o.data.redirect);
    assert.equal(done.status, 200);
    const list = await admin.req("GET", "/admin/orders");
    assert.match(list.text, /SIMPLE1234/);
    const row = await env.DB.prepare("SELECT id FROM orders WHERE trx_id='SIMPLE1234'").first();
    await admin.req("POST", `/admin/orders/${row.id}/approve`, { form: { _csrf: formCsrf(list.text) } });
    const mail = outbox.find((m) => m.to === "selim@example.com");
    const link = (mail.html.match(/href="([^"]*\/access\/[^"]+)"/) || [])[1];
    assert.ok(link, "approval email carries an access link");
    const phone = client(env);
    const r = await phone.req("GET", new URL(link.replace(/&amp;/g, "&")).pathname);
    assert.equal(r.status, 303);
    assert.equal(r.location, "/bn/exams/expert");
    const me = await phone.req("GET", "/api/me");
    assert.equal(me.data.ok, true);
    assert.equal(me.data.email, "selim@example.com");
    const s = await phone.req("POST", "/api/exams/expert/start", { json: { name: "Selim Reza", lang: "bn" } });
    assert.ok(!s.data.buy && s.status !== 401 && !s.data.need_email, "paid access granted: " + JSON.stringify(s.data));
    const bad = await client(env).req("GET", "/bn/access/forged.token");
    assert.equal(bad.status, 410);
  });
  await test("new pages load in both languages", async () => {
    const pub = client(env);
    for (const p of ["/en/courses", "/bn/courses", "/en/negotiation-guru", "/bn/procurement-ai", "/en/calculators/career-roadmap", "/bn/calculators/career-roadmap",
      "/en/certificate-policy", "/bn/certificate-policy", "/en/about", "/bn/", "/en/", "/en/library?type=pdf"]) {
      const r = await pub.req("GET", p);
      assert.equal(r.status, 200, p);
    }
    const home = await pub.req("GET", "/en/");
    assert.match(home.text, /class="free-blink"/);
    assert.match(home.text, /Negotiation Guru/);
    assert.match(home.text, /href="\/en\/certificate-policy"/);
    const rm = await pub.req("GET", "/en/calculators/career-roadmap");
    assert.match(rm.text, /id="roadmap-data"/);
    for (const p of ["/admin/courses", "/admin/courses/new", "/admin/reviews", "/admin/calculators", "/admin/about", "/admin/posts?section=ai", "/admin/posts/new?section=negotiation", "/admin/exams"]) {
      const r = await admin.req("GET", p);
      assert.equal(r.status, 200, p);
    }
  });
  await test("admin can switch a calculator off", async () => {
    const pg = await admin.req("GET", "/admin/calculators");
    const r = await admin.req("POST", "/admin/calculators", { form: { _csrf: formCsrf(pg.text), on: ["total-cost-of-ownership", "comparative-statement", "career-roadmap"], nav_free_badge: "1" } });
    assert.equal(r.status, 303);
    const off = await client(env).req("GET", "/en/calculators/shipping-import-cost");
    assert.equal(off.status, 404);
    const dir = await client(env).req("GET", "/en/calculators");
    assert.doesNotMatch(dir.text, /calculators\/shipping-import-cost/);
    await admin.req("POST", "/admin/calculators", { form: { _csrf: formCsrf(pg.text), on: ["total-cost-of-ownership", "shipping-import-cost", "comparative-statement", "career-roadmap"], nav_free_badge: "1" } });
    assert.equal((await client(env).req("GET", "/en/calculators/shipping-import-cost")).status, 200);
  });
  await test("paid course: order, approval link, lessons unlocked", async () => {
    const pg = await admin.req("GET", "/admin/courses/new");
    const r = await admin.req("POST", "/admin/courses/new", { form: { _csrf: formCsrf(pg.text), kind: "recorded", status: "published", price: "800", title_en: "Negotiation Masterclass", title_bn: "নেগোসিয়েশন মাস্টারক্লাস",
      summary_en: "Six recorded lessons.", body_en: "## You will learn\n- Preparing", content_en: "Lesson 1\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n\nSECRET-LESSON-TEXT", sort: "1" } });
    assert.equal(r.status, 303);
    const list = await client(env).req("GET", "/en/courses");
    assert.match(list.text, /Negotiation Masterclass/);
    const buyer = client(env);
    const page = await buyer.req("GET", "/en/courses/negotiation-masterclass");
    assert.equal(page.status, 200);
    assert.doesNotMatch(page.text, /SECRET-LESSON-TEXT/);
    const o = await buyer.req("POST", "/api/orders", { json: { item_type: "course", item_ref: "negotiation-masterclass", method: "bkash", sender: "01512345678", trx: "COURSE1234", name: "Mitu", email: "mitu@example.com", lang: "en" } });
    assert.equal(o.status, 200, JSON.stringify(o.data));
    const ol = await admin.req("GET", "/admin/orders");
    const row = await env.DB.prepare("SELECT id FROM orders WHERE trx_id='COURSE1234'").first();
    await admin.req("POST", `/admin/orders/${row.id}/approve`, { form: { _csrf: formCsrf(ol.text) } });
    const mail = outbox.find((m) => m.to === "mitu@example.com");
    const link = (mail.html.match(/href="([^"]*\/access\/[^"]+)"/) || [])[1];
    const go = await buyer.req("GET", new URL(link.replace(/&amp;/g, "&")).pathname);
    assert.equal(go.location, "/en/courses/negotiation-masterclass");
    const open = await buyer.req("GET", "/en/courses/negotiation-masterclass");
    assert.match(open.text, /SECRET-LESSON-TEXT/);
    assert.match(open.text, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  });
  await test("reviews appear only after the admin publishes them", async () => {
    const r = await visitor.req("POST", "/api/reviews", { json: { name: "Nasrin Akter", role: "Procurement Executive", rating: 4, body: "The CS calculator saved me an hour every week. Thank you!", lang: "en" } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.doesNotMatch((await client(env).req("GET", "/en/")).text, /saved me an hour/);
    const pg = await admin.req("GET", "/admin/reviews");
    const row = await env.DB.prepare("SELECT id FROM reviews WHERE name='Nasrin Akter'").first();
    await admin.req("POST", `/admin/reviews/${row.id}/publish`, { form: { _csrf: formCsrf(pg.text) } });
    assert.match((await client(env).req("GET", "/en/")).text, /saved me an hour/);
    const short = await visitor.req("POST", "/api/reviews", { json: { name: "N", body: "ok", lang: "en" } });
    assert.equal(short.status, 400);
  });
  await test("admin creates a hidden exam and can delete it", async () => {
    const pg = await admin.req("GET", "/admin/exams");
    const r = await admin.req("POST", "/admin/exams-new", { form: { _csrf: formCsrf(pg.text), title_en: "Negotiation Skills", title_bn: "দর-কষাকষি দক্ষতা", code: "", price: "0", certificate: "1", question_count: "10" } });
    assert.equal(r.status, 303);
    const lv = await env.DB.prepare("SELECT * FROM exam_levels WHERE code='negotiation-skills'").first();
    assert.ok(lv && lv.published === 0 && lv.question_count === 10);
    assert.equal((await client(env).req("GET", "/en/exams/negotiation-skills")).status, 404);
    const d = await admin.req("POST", "/admin/exams/negotiation-skills/delete", { form: { _csrf: formCsrf(pg.text) } });
    assert.equal(d.status, 303);
    assert.equal(await env.DB.prepare("SELECT code FROM exam_levels WHERE code='negotiation-skills'").first(), null);
  });
  await test("newsletter: one click, no confirmation code", async () => {
    const fresh = client(env);
    const before = outbox.length;
    const ask = await fresh.req("POST", "/api/subscribe", { json: { lang: "en" } });
    assert.equal(ask.status, 400);
    assert.equal(ask.data.ask_email, true);
    assert.equal((await fresh.req("POST", "/api/subscribe", { json: { email: "bad", lang: "en" } })).status, 400);
    const ok = await fresh.req("POST", "/api/subscribe", { json: { email: "Reader@Example.com", lang: "bn" } });
    assert.equal(ok.status, 200);
    assert.equal(outbox.length, before, "no email is sent");
    const row = await env.DB.prepare("SELECT subscribed FROM emails WHERE email='reader@example.com'").first();
    assert.equal(row.subscribed, 1);
    assert.equal((await fresh.req("POST", "/api/subscribe", { json: { lang: "en" } })).status, 200, "second click uses the remembered email");
  });
  await test("orders and activity download as CSV", async () => {
    const o = await admin.req("GET", "/admin/orders/export?status=approved", { raw: true });
    assert.equal(o.status, 200);
    const ot = await o.text();
    assert.match(ot, /^\uFEFF?ref,created_at,status/);
    assert.match(ot, /COURSE1234/);
    const a = await admin.req("GET", "/admin/activity/export", { raw: true });
    assert.equal(a.status, 200);
    assert.match(await a.text(), /created_at,kind,email/);
    assert.equal((await client(env).req("GET", "/admin/orders/export")).status, 303, "admins only");
  });
  await test("an unconfirmed email cannot see someone else's data", async () => {
    const eve = client(env);
    await eve.req("POST", "/api/orders", { json: { item_type: "file", item_ref: "procurement-kpi-dashboard", method: "bkash", sender: "01712340000", trx: "ATTACK1234", name: "Eve", email: "nasrin@example.com", lang: "en" } });
    const my = await eve.req("GET", "/en/my");
    assert.equal(my.status, 200);
    assert.doesNotMatch(my.text, /Procurement KPI Dashboard/);
    assert.equal((await eve.req("GET", "/api/me")).data.ok, false);
  });
  await test("home page has the pop-up, the quote strip and the typed slogan", async () => {
    const h = await client(env).req("GET", "/en/");
    assert.match(h.text, /data-welcome/);
    assert.match(h.text, /class="quote-strip"/);
    assert.match(h.text, /data-typewriter=/);
  });
  await test("a book tagged for Negotiation Guru appears on that page and its menu has Courses/Books/Articles", async () => {
    await env.DB.prepare("UPDATE items SET section='negotiation' WHERE slug='supplier-database'").run();
    const p = await client(env).req("GET", "/en/negotiation-guru");
    assert.equal(p.status, 200);
    assert.match(p.text, /id="books"/);
    assert.match(p.text, /Supplier Database/);
    assert.match(p.text, /negotiation-guru#courses/);
  });
  await test("posts in the new sections get their own address and a cover picture", async () => {
    const pg = await admin.req("GET", "/admin/posts/new?section=ai");
    const r = await admin.req("POST", "/admin/posts/new", { form: { _csrf: formCsrf(pg.text), section: "ai", title_en: "Prompts for buyers", body_en: "Text ![chart](/media/x)", status: "published", published_at: "2026-10-01" } });
    assert.equal(r.status, 303);
    const p = await client(env).req("GET", "/en/procurement-ai/prompts-for-buyers");
    assert.equal(p.status, 200);
    assert.match(p.text, /<img src="\/media\/x"/);
    assert.match((await client(env).req("GET", "/en/procurement-ai")).text, /Prompts for buyers/);
  });
}

console.log(`\nLargest number of database queries in one request: ${maxQueries.n} (${maxQueries.path}) — free plan limit is 50.`);
console.log(`${passed} passed, ${failures} failed\n`);
process.exit(failures ? 1 : 0);
