// Exams, certificates, email confirmation, purchases and "My downloads & certificates".
import { html, raw, jsonScript, nowIso, sha256, readSigned, paidLeft } from "../lib/util.js";
import { one, all, run } from "../lib/db.js";
import { layout, pageHead, waButton, certBadge } from "../views/layout.js";
import { icon } from "../views/icons.js";
import { HttpError } from "../app.js";
import { paymentMethods } from "../lib/settings.js";
import { levels, level, available, paidAttemptsLeft, freeAttemptsToday, activeAttempt, loadAttempt, publicQuestions, secondsLeft, topicRows } from "../lib/exams.js";
import { ownsFile, pendingOrder } from "../lib/orders.js";
import { qrSvg } from "../lib/qr.js";
import { recordEmail } from "./api.js";

const tagFor = (c, lv) => (lv.price > 0 ? html`<span class="tag dark">${c.t("exam.paid")} · ${c.money(lv.price)}</span>` : html`<span class="tag ok">${c.t("exam.free")}</span>`);

// ------------------------------------------------------------------ exams index
async function examsIndex(c) {
  const v = await c.readyVisitor();
  const lvs = await levels(c.env);
  const cards = [];
  for (const lv of paidLeft(lvs, 3, (l) => l.price > 0)) {
    const avail = await available(c.env, lv.code);
    const dark = lv.price > 0;
    let extra = "";
    let active = null, left = 0, pending = null;
    if (v) {
      active = await activeAttempt(c.env, v.email, lv.code);
      if (lv.price > 0) { left = await paidAttemptsLeft(c.env, v.email, lv.code); if (!left) pending = await pendingOrder(c.env, v.email, "exam", lv.code); }
    }
    const btn = dark ? "btn-light" : "btn-primary";
    const btn2 = dark ? "btn-outline-light" : "btn-secondary";
    let actions;
    if (avail < lv.question_count) actions = html`<div class="alert alert-warn">${icon("info", 18)}<div>${c.t("exam.err_not_enough", { have: c.d(avail), need: c.d(lv.question_count) })}</div></div>`;
    else if (active) actions = html`<a class="btn ${btn}" href="${c.p("/exams/attempt/" + active.id)}">${icon("clock", 16)} ${c.t("exam.resume")}</a>`;
    else if (lv.price > 0 && !left) actions = html`<a class="btn ${btn}" href="${c.p("/buy/exam/" + lv.code)}">${icon("cart", 16)} ${c.t("exam.buy", { price: c.money(lv.price) })}</a>
        <a class="btn ${btn2}" href="${c.p("/exams/" + lv.code)}">${c.L("Details", "বিস্তারিত")}</a>`;
    else actions = html`<a class="btn ${btn}" href="${c.p("/exams/" + lv.code)}">${icon("award", 16)} ${c.t("exam.start")}</a>`;
    if (lv.price > 0 && left) extra = html`<p class="small" style="margin-top:12px;opacity:.85">${c.t("exam.attempts_left", { n: c.d(left) })}</p>`;
    if (pending) extra = html`<p class="small" style="margin-top:12px;opacity:.85">${c.t("lib.pending")}</p>`;
    cards.push(html`<div class="card level-card ${dark ? "dark" : ""}">
      ${lv.thumb_id ? html`<img class="exam-thumb" src="/media/${lv.thumb_id}" alt="" loading="lazy">` : ""}
      <div class="row" style="gap:6px"><span class="tag ${dark ? "" : "dark"}" style="${dark ? "background:#333;color:#fff" : ""}">${c.pick(lv.title_en, lv.title_bn)}</span>${dark && lv.price > 0 ? html`<span class="tag" style="background:#fff;color:#000">${c.t("exam.paid")} · ${c.money(lv.price)}</span>` : tagFor(c, lv)}</div>
      <div class="meta">
        <div><strong>${c.d(lv.question_count)}</strong>${c.t("exam.questions")}</div>
        <div><strong>${c.d(lv.time_limit_min)}</strong>${c.t("exam.minutes")}</div>
        <div><strong>${c.d(lv.pass_mark)}%</strong>${c.t("exam.to_pass")}</div>
      </div>
      <p>${c.pick(lv.desc_en, lv.desc_bn)}</p>
      <p class="small" style="margin-top:10px">${icon(lv.certificate ? "award" : "chat", 15)} ${certBadge(c, lv)}</p>
      <p class="small" style="margin-top:4px;opacity:.75">${lv.price > 0 ? c.t("exam.attempts_info", { n: c.d(lv.attempts_per_purchase) }) : c.t("exam.free_limit", { n: c.d(lv.free_attempts_per_day) })}</p>
      <div style="height:18px"></div>
      <div class="actions">${actions}</div>${extra}
    </div>`);
  }
  const body = html`${pageHead(c, { title: c.t("exam.title"), lead: c.t("exam.lead"), extra: html`<div class="alert alert-info" style="max-width:760px">${icon("info", 18)}<div>${c.t("exam.demo_bank_note")}</div></div>` })}
<section class="section-sm" style="padding-top:0"><div class="wrap grid ${cards.length === 4 ? "grid-2" : "grid-3"}">${cards}</div></section>
<section class="section-sm">
  <div class="wrap grid grid-2">
    <div class="card surface"><h3>${c.t("exam.how_title")}</h3><ul class="feature-list" style="margin-top:14px">
      <li>${icon("check", 18)}<span>${c.t("exam.how_1")}</span></li><li>${icon("check", 18)}<span>${c.t("exam.how_2")}</span></li><li>${icon("check", 18)}<span>${c.t("exam.how_3")}</span></li></ul></div>
    <div class="card surface"><h3>${c.t("cert.title")}</h3><ul class="feature-list" style="margin-top:14px">
      <li>${icon("check", 18)}<span>${c.t("cert.f1")}</span></li><li>${icon("check", 18)}<span>${c.t("cert.f2")}</span></li><li>${icon("check", 18)}<span>${c.t("cert.f3")}</span></li></ul>
      <p style="margin-top:16px"><a class="link" href="${c.p("/certificates/verify")}">${c.t("cert.verify_title")} ${icon("arrow-right", 16)}</a></p></div>
  </div>
</section>`;
  return c.html(await layout(c, { title: c.t("exam.title"), description: c.t("exam.meta"), body }));
}

// ------------------------------------------------------------------ exam start page
async function examStart(c) {
  const lv = await level(c.env, c.params.code);
  if (!lv || !lv.published) throw new HttpError(404);
  const v = await c.readyVisitor();
  const avail = await available(c.env, lv.code);
  let left = 0, pending = null, active = null, usedToday = 0;
  if (v) {
    active = await activeAttempt(c.env, v.email, lv.code);
    if (lv.price > 0) { left = await paidAttemptsLeft(c.env, v.email, lv.code); if (!left) pending = await pendingOrder(c.env, v.email, "exam", lv.code); }
    else usedToday = await freeAttemptsToday(c.env, v.email, lv.code);
  }
  const prevName = v ? (await one(c.env, "SELECT name FROM emails WHERE email=?", v.email))?.name || "" : "";
  let panel;
  if (avail < lv.question_count) panel = html`<div class="alert alert-warn">${icon("info", 18)}<div>${c.t("exam.err_not_enough", { have: c.d(avail), need: c.d(lv.question_count) })}</div></div>`;
  else if (active) panel = html`<div class="alert alert-info">${icon("clock", 18)}<div>${c.t("exam.in_progress_resume")}</div></div><a class="btn btn-primary btn-lg" style="margin-top:16px" href="${c.p("/exams/attempt/" + active.id)}">${c.t("exam.resume")}</a>`;
  else if (lv.price > 0 && !left) panel = html`
      ${pending ? html`<div class="alert alert-warn" style="margin-bottom:16px">${icon("clock", 18)}<div>${c.t("lib.pending")} (${pending.ref})</div></div>` : ""}
      <p>${c.t("exam.attempts_info", { n: c.d(lv.attempts_per_purchase) })}</p>
      <a class="btn btn-primary btn-lg" href="${c.p("/buy/exam/" + lv.code)}">${icon("cart", 18)} ${c.t("exam.buy", { price: c.money(lv.price) })}</a>`;
  else panel = html`
      <form action="/api/exams/${lv.code}/start" data-json-form data-needs-email novalidate>
        <div class="field full"><label for="ex-name">${c.t("exam.name_label")}</label>
          <input id="ex-name" name="name" required minlength="3" maxlength="80" autocomplete="name" value="${prevName}">
          <span class="help">${c.t("exam.name_help")}</span></div>
        <div class="alert" data-form-msg hidden style="margin-top:16px"></div>
        <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">${icon("award", 18)} ${c.t("exam.start")}</button>
          ${lv.price > 0 ? html`<span class="small muted">${c.t("exam.attempts_left", { n: c.d(left) })}</span>` : v ? html`<span class="small muted">${c.L(`Used today: ${usedToday} of ${lv.free_attempts_per_day}`, `আজ ব্যবহৃত: ${c.d(lv.free_attempts_per_day)}-এর মধ্যে ${c.d(usedToday)}`)}</span>` : ""}</div>
      </form>
      ${v ? html`<p class="tiny muted" style="margin-top:14px">${c.t("gate.as", { email: v.email })} · <a href="#" data-forget-email>${c.t("gate.change")}</a></p>` : ""}`;
  const body = html`
<section class="page-head" style="padding-bottom:24px"><div class="wrap wrap-narrow">
  <nav class="crumbs"><a href="${c.p("/exams")}">${c.t("nav.exams")}</a></nav>
  <div class="row" style="gap:6px;margin-bottom:12px">${tagFor(c, lv)}<span class="tag outline">${certBadge(c, lv)}</span></div>
  ${lv.thumb_id ? html`<img class="exam-hero" src="/media/${lv.thumb_id}" alt="">` : ""}
  <h1>${c.pick(lv.title_en, lv.title_bn)} — ${c.L("Procurement Exam", "প্রকিউরমেন্ট পরীক্ষা")}</h1>
  <p class="lead">${c.pick(lv.desc_en, lv.desc_bn)}</p>
</div></section>
<section class="section-sm" style="padding-top:0"><div class="wrap wrap-narrow">
  <div class="card surface" style="margin-bottom:24px"><h3>${c.t("exam.rules_title")}</h3><ul class="feature-list" style="margin-top:14px">
    <li>${icon("check", 18)}<span>${c.t("exam.rule_1", { n: c.d(lv.question_count), m: c.d(lv.time_limit_min), p: c.d(lv.pass_mark) })}</span></li>
    <li>${icon("check", 18)}<span>${c.t("exam.rule_2")}</span></li><li>${icon("check", 18)}<span>${c.t("exam.rule_3")}</span></li></ul></div>
  <div class="panel">${panel}</div>
</div></section>`;
  return c.html(await layout(c, { title: c.pick(lv.title_en, lv.title_bn) + " — " + c.t("nav.exams"), description: c.pick(lv.desc_en, lv.desc_bn), body, gate: true }));
}

// ------------------------------------------------------------------ attempt
async function needOwner(c, att) {
  if (att) return null;
  const body = html`<section class="section"><div class="wrap wrap-narrow center"><h1 style="font-size:40px">${c.t("exam.not_found")}</h1>
    <p class="lead">${c.t("my.need_email")}</p><div class="row" style="justify-content:center;margin-top:20px"><a class="btn btn-primary" href="${c.p("/exams")}">${c.t("exam.back_to_exams")}</a></div></div></section>`;
  return c.html(await layout(c, { title: c.t("exam.title"), body, noindex: true }), 404);
}

async function attemptPage(c) {
  const v = await c.readyVisitor();
  const att = v ? await loadAttempt(c.env, c.params.id, v.email) : null;
  const denied = await needOwner(c, att);
  if (denied) return denied;
  if (att.submitted_at) return c.redirect(c.p("/exams/result/" + att.id));
  const lv = await level(c.env, att.level_code);
  const qs = await publicQuestions(c.env, att, c.lang);
  const strings = { saved: c.t("exam.saved"), save_failed: c.t("exam.save_failed"), closed: c.t("exam.err_closed"), unanswered: c.t("exam.unanswered_warning"), confirm: c.t("exam.confirm_submit") };
  const body = html`
<div class="exam-bar"><div class="wrap">
  <div><strong>${c.pick(lv.title_en, lv.title_bn)}</strong></div>
  <div class="progress" aria-hidden="true"><i data-progress style="width:0%"></i></div>
  <div class="timer" data-timer role="timer" aria-live="off" aria-label="${c.t("exam.time_left")}">--:--</div>
</div></div>
<section class="section-sm">
  <div class="wrap" data-exam data-attempt="${att.id}" data-seconds="${secondsLeft(att)}" data-lang="${c.lang}">
    <div class="grid exam-grid" style="gap:28px;align-items:start">
      <div>${qs.map((q, i) => html`
        <div class="q-card" data-q="${q.id}" data-index="${i}" ${i ? raw("hidden") : ""}>
          <p class="small muted">${c.t("exam.question_x_of_y", { x: c.d(q.n), y: c.d(qs.length) })}</p>
          <h2 id="q-${q.id}">${q.text}</h2>
          <div class="options" role="radiogroup" aria-labelledby="q-${q.id}">${q.options.map((o, k) => html`
            <label class="option"><input type="radio" name="q${q.id}" value="${k}" ${q.chosen === k ? raw("checked") : ""}><span>${o}</span></label>`)}</div>
          <div class="row between" style="margin-top:26px">
            <button type="button" class="btn btn-ghost" data-prev ${i === 0 ? raw("disabled") : ""}>${icon("arrow-left", 16)} ${c.t("common.prev")}</button>
            <button type="button" class="icon-btn" data-clear-answer>${c.t("exam.clear_answer")}</button>
            ${i < qs.length - 1 ? html`<button type="button" class="btn btn-primary" data-next>${c.t("common.next")} ${icon("arrow-right", 16)}</button>` : html`<button type="button" class="btn btn-primary" data-open-submit>${c.t("exam.review_submit")}</button>`}
          </div>
        </div>`)}</div>
      <aside class="panel" style="padding:22px">
        <p class="small muted" style="margin-bottom:10px"><span data-answered>${c.d(0)}</span> / ${c.d(qs.length)} ${c.t("exam.answered")}</p>
        <div class="q-nav" data-qnav>${qs.map((q, i) => html`<button type="button" data-goto="${i}" aria-label="${c.t("exam.question_x_of_y", { x: q.n, y: qs.length })}">${c.d(q.n)}</button>`)}</div>
        <button class="btn btn-primary" type="button" style="width:100%;margin-top:20px" data-submit>${c.t("exam.submit")}</button>
        <p class="tiny muted" style="margin-top:12px" data-save-status>${c.t("exam.autosave")}</p>
      </aside>
    </div>
  </div>
</section>
<script type="application/json" id="exam-i18n">${jsonScript(strings)}</script>`;
  return c.html(await layout(c, { title: c.pick(lv.title_en, lv.title_bn), body, noindex: true, scripts: ["/js/exam.js"] }));
}

async function resultPage(c) {
  const v = await c.readyVisitor();
  const att = v ? await loadAttempt(c.env, c.params.id, v.email) : null;
  const denied = await needOwner(c, att);
  if (denied) return denied;
  if (!att.submitted_at) return c.redirect(c.p("/exams/attempt/" + att.id));
  const lv = await level(c.env, att.level_code);
  const cert = await one(c.env, "SELECT code FROM certificates WHERE attempt_id=?", att.id);
  const s = await c.settings();
  const pct = att.score_pct || 0;
  const topics = topicRows(att, c.lang);
  const left = lv.price > 0 ? await paidAttemptsLeft(c.env, v.email, lv.code) : null;
  const body = html`
<section class="page-head"><div class="wrap wrap-narrow center">
  <span class="tag dark">${c.pick(lv.title_en, lv.title_bn)}</span>
  <svg class="score-ring" viewBox="0 0 120 120" style="display:block;margin:28px auto 8px" role="img" aria-label="${c.pct(pct, 1)}">
    <circle cx="60" cy="60" r="52" fill="none" stroke="#e8e8ed" stroke-width="10"/>
    <circle cx="60" cy="60" r="52" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(326.73 * pct / 100).toFixed(2)} 326.73" transform="rotate(-90 60 60)"/>
    <text x="60" y="68" text-anchor="middle" font-size="24" font-weight="700" font-family="-apple-system, 'Segoe UI', sans-serif">${c.pct(pct, 0)}</text>
  </svg>
  <h1 style="font-size:44px;margin:12px auto">${att.passed ? c.t("exam.passed") : c.t("exam.not_passed")}</h1>
  <p class="lead">${c.t("exam.score_line", { correct: c.d(att.correct_count), total: c.d(att.total_count), pass: c.d(att.pass_mark) })}</p>
  ${att.auto_submitted ? html`<p class="small muted">${c.t("exam.auto_submitted")}</p>` : ""}
  ${cert ? html`<div class="alert alert-ok" style="margin:22px auto;max-width:560px;text-align:left">${icon("award", 18)}<div>${c.t("exam.cert_issued", { code: cert.code })}</div></div>
    <div class="row" style="justify-content:center"><a class="btn btn-primary" href="${c.p("/certificates/" + cert.code + "/print")}">${icon("print", 17)} ${c.t("cert.print")}</a>
    <a class="btn btn-secondary" href="${c.p("/certificates/" + cert.code)}">${c.t("cert.view")}</a></div>` : ""}
  <div class="row" style="justify-content:center;margin-top:20px">
    ${!att.passed && (lv.price === 0 || left > 0) ? html`<a class="btn btn-primary" href="${c.p("/exams/" + lv.code)}">${c.t("exam.try_again")}</a>` : ""}
    ${!att.passed && lv.price > 0 && !left ? html`<a class="btn btn-primary" href="${c.p("/buy/exam/" + lv.code)}">${c.t("exam.buy", { price: c.money(lv.price) })}</a>` : ""}
    <a class="btn btn-secondary" href="${c.p("/exams")}">${c.t("exam.back_to_exams")}</a>
  </div>
  ${!lv.certificate ? html`<p class="small muted" style="max-width:560px;margin:18px auto 0">${c.t("exam.no_cert_note")}</p>` : ""}
  ${shareBox(c, `${c.siteUrl}/${c.lang}/results/${att.id}`, c.t("exam.result_public_title", { name: att.name, score: c.pct(pct, 0), exam: c.pick(lv.title_en, lv.title_bn) }))}
  <div style="max-width:420px;margin:22px auto 0">${waButton(c, s, "")}</div>
</div></section>
<section class="section-sm" style="padding-top:0"><div class="wrap wrap-narrow">
  <h2 style="font-size:26px">${c.t("exam.by_topic")}</h2>
  <div class="table-wrap" style="margin-top:14px"><table>
    <thead><tr><th>${c.t("exam.topic")}</th><th class="num">${c.t("exam.correct")}</th><th style="width:40%">${c.t("exam.performance")}</th></tr></thead>
    <tbody>${topics.map((r) => html`<tr><td>${r.topic}</td><td class="num">${c.d(r.correct)} / ${c.d(r.total)}</td>
      <td><div class="bar-row" style="grid-template-columns:1fr 46px"><div class="bar"><i style="width:${r.pct}%"></i></div><span class="small">${c.d(r.pct)}%</span></div></td></tr>`)}</tbody>
  </table></div>
  <p class="small muted" style="margin-top:14px">${c.t("exam.certified_review_note")}</p>
</div></section>`;
  return c.html(await layout(c, { title: c.t("exam.result_title"), body, noindex: true }));
}

// Share buttons (Facebook, LinkedIn, WhatsApp, copy / native share). No tracking scripts.
export function shareBox(c, url, text) {
  const u = encodeURIComponent(url), t = encodeURIComponent(text);
  return html`<div class="share-box" data-share data-url="${url}" data-text="${text}">
    <p class="small muted" style="margin:0 0 10px">${c.t("exam.share")}</p>
    <div class="row" style="justify-content:center;gap:8px">
      <a class="btn btn-ghost btn-sm" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a>
      <a class="btn btn-ghost btn-sm" href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener">LinkedIn</a>
      <a class="btn btn-ghost btn-sm" href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener">WhatsApp</a>
      <button class="btn btn-secondary btn-sm" type="button" data-share-copy data-done="${c.t("exam.share_copied")}">${c.t("exam.share_copy")}</button>
    </div></div>`;
}

// Public, shareable result (no email, no answers — only name, exam, score and date).
async function publicResult(c) {
  const att = await one(c.env, "SELECT a.id, a.name, a.level_code, a.score_pct, a.passed, a.submitted_at, a.correct_count, a.total_count, l.title_en, l.title_bn, l.certificate FROM attempts a LEFT JOIN exam_levels l ON l.code=a.level_code WHERE a.id=? AND a.submitted_at IS NOT NULL", c.params.id);
  if (!att) throw new HttpError(404);
  const cert = att.passed ? await one(c.env, "SELECT code FROM certificates WHERE attempt_id=? AND status='valid'", att.id) : null;
  const exam = c.pick(att.title_en, att.title_bn);
  const pct = att.score_pct || 0;
  const title = c.t("exam.result_public_title", { name: att.name, score: c.pct(pct, 0), exam });
  const body = html`<section class="section"><div class="wrap wrap-narrow center">
    <span class="tag dark">${exam}</span>
    <svg class="score-ring" viewBox="0 0 120 120" style="display:block;margin:28px auto 8px" role="img" aria-label="${c.pct(pct, 1)}">
      <circle cx="60" cy="60" r="52" fill="none" stroke="#e8e8ed" stroke-width="10"/>
      <circle cx="60" cy="60" r="52" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(326.73 * pct / 100).toFixed(2)} 326.73" transform="rotate(-90 60 60)"/>
      <text x="60" y="68" text-anchor="middle" font-size="24" font-weight="700">${c.pct(pct, 0)}</text></svg>
    <h1 style="font-size:clamp(30px,4vw,44px);margin:12px auto;max-width:22ch">${title}</h1>
    <p class="lead">${c.t("exam.result_public_lead", { date: c.date(att.submitted_at) })} · ${att.passed ? c.t("exam.passed") : c.t("exam.not_passed")}</p>
    ${cert ? html`<p><a class="link" href="${c.p("/certificates/" + cert.code)}">${icon("award", 16)} ${c.t("cert.view")} — <span class="mono">${cert.code}</span></a></p>` : ""}
    <div class="row" style="justify-content:center;margin-top:24px"><a class="btn btn-primary btn-lg" href="${c.p("/exams")}">${c.t("exam.result_public_cta")}</a></div>
  </div></section>`;
  return c.html(await layout(c, { title, description: c.t("exam.result_public_lead", { date: c.date(att.submitted_at) }), body, alternates: false }));
}

// ------------------------------------------------------------------ certificates
async function certVerify(c) {
  const code = (c.params.code || c.url.searchParams.get("code") || "").trim().toUpperCase().slice(0, 40);
  const cert = code ? await one(c.env, "SELECT c.*, l.title_en, l.title_bn FROM certificates c LEFT JOIN exam_levels l ON l.code=c.level_code WHERE c.code=?", code) : null;
  const v = await c.readyVisitor();
  const owner = cert && v && v.email === cert.email;
  const shareUrl = cert ? `${c.siteUrl}/${c.lang}/certificates/${cert.code}` : "";
  const body = html`${pageHead(c, { title: c.t("cert.verify_title"), lead: c.t("cert.verify_lead"), narrow: true,
    extra: html`<form method="get" action="${c.p("/certificates/verify")}" class="toolbar" style="margin-top:20px">
      <div class="search">${icon("search", 18)}<input name="code" value="${code}" placeholder="PB-2026-XXXX-XXXX" aria-label="${c.t("cert.id")}" autocomplete="off" spellcheck="false" style="text-transform:uppercase"></div>
      <button class="btn btn-primary" type="submit">${c.t("cert.verify_button")}</button></form>` })}
  ${code ? html`<section class="section-sm" style="padding-top:0"><div class="wrap wrap-narrow">
    ${cert ? html`<div class="cert-preview">
      ${cert.status === "valid" ? html`<span class="tag ok" style="font-size:14px">${icon("check-circle", 16)} ${c.t("cert.status_valid")}</span>` : html`<span class="tag err" style="font-size:14px">${icon("x", 16)} ${c.t("cert.status_revoked")}</span>`}
      <img src="/img/logo.svg" alt="ProcureBest" style="height:26px;display:block;margin:28px auto 22px">
      <p class="muted" style="margin:0">${c.t("cert.certifies")}</p>
      <h2 style="font-size:38px;margin:10px 0">${cert.name}</h2>
      <p class="muted">${c.t("cert.completed")}</p>
      <h3>${c.pick(cert.title_en, cert.title_bn)} ${c.t("cert.level_suffix")}</h3>
      <div class="grid grid-3" style="margin-top:28px;text-align:center">
        <div><div class="stat" style="font-size:28px">${c.pct(cert.score_pct, 1)}</div><div class="stat-label">${c.t("cert.score")}</div></div>
        <div><div class="stat" style="font-size:24px">${c.date(cert.issued_at)}</div><div class="stat-label">${c.t("cert.issued")}</div></div>
        <div><div class="stat mono" style="font-size:18px;line-height:1.6">${cert.code}</div><div class="stat-label">${c.t("cert.id")}</div></div>
      </div>
      ${cert.status !== "valid" ? html`<div class="alert alert-err" style="margin-top:24px;text-align:left">${icon("alert", 18)}<div>${c.t("cert.revoked_on", { date: c.date(cert.revoked_at) })}</div></div>` : ""}
      <p class="tiny muted" style="margin-top:28px">${c.t("cert.not_accreditation")}</p>
      ${owner && cert.status === "valid" ? html`<a class="btn btn-primary" style="margin-top:18px" href="${c.p("/certificates/" + cert.code + "/print")}">${icon("print", 17)} ${c.t("cert.print")}</a>
        <p class="small muted" style="margin-top:12px">${c.t("cert.share")} <span class="mono">${shareUrl}</span></p>` : ""}
    </div>` : html`<div class="alert alert-err">${icon("alert", 18)}<div>${c.t("cert.not_found")}</div></div>`}
  </div></section>` : ""}`;
  return c.html(await layout(c, { title: c.t("cert.verify_title"), description: c.t("cert.verify_meta"), body, noindex: Boolean(code) }));
}

// Printable A4 landscape certificate (owner only). "Save as PDF" from the print dialog.
async function certPrint(c) {
  const code = c.params.code.toUpperCase();
  const cert = await one(c.env, "SELECT c.*, l.title_en, l.title_bn FROM certificates c LEFT JOIN exam_levels l ON l.code=c.level_code WHERE c.code=?", code);
  if (!cert) throw new HttpError(404);
  const v = await c.readyVisitor();
  if (!v || v.email !== cert.email) return c.redirect(c.p("/certificates/" + code));
  const url = `${c.siteUrl}/${c.lang}/certificates/${cert.code}`;
  const T = c.t;
  const page = html`<html lang="${c.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T("cert.pdf_title")} — ${cert.code}</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap">
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #e8e8ed; font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Bengali", sans-serif; color: #1d1d1f; }
.bar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #d2d2d7; padding: 10px 16px; display: flex; gap: 10px; justify-content: center; align-items: center; flex-wrap: wrap; font-size: 14px; }
.bar button, .bar a { font: inherit; padding: 9px 18px; border-radius: 999px; border: 1px solid #000; background: #000; color: #fff; cursor: pointer; text-decoration: none; }
.bar a { background: #fff; color: #000; }
.sheet-wrap { padding: 24px 12px; overflow-x: auto; }
.page { position: relative; width: 297mm; height: 210mm; padding: 16mm; background: #fff; margin: 0 auto; box-shadow: 0 8px 30px rgba(0,0,0,.12); }
.frame { position: absolute; inset: 10mm; border: 1.2px solid #000; border-radius: 6mm; }
.frame::after { content: ""; position: absolute; inset: 2.2mm; border: 0.4px solid #c7c7cc; border-radius: 4.5mm; }
.inner { position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12mm 22mm 0; }
.kicker { margin-top: 10mm; font-size: 10pt; letter-spacing: 3px; text-transform: uppercase; color: #6e6e73; }
html[lang="bn"] .kicker { letter-spacing: 0; text-transform: none; font-size: 12pt; }
h1 { font-size: 30pt; margin: 3mm 0 0; letter-spacing: -0.6px; font-weight: 700; }
.lead { margin-top: 8mm; font-size: 11pt; color: #6e6e73; }
.name { font-size: 34pt; font-weight: 700; letter-spacing: -0.8px; margin: 3mm 0 2mm; line-height: 1.2; }
.level { font-size: 15pt; font-weight: 600; margin-top: 2mm; }
.rule { width: 60mm; height: 1px; background: #000; margin: 6mm auto 0; }
.facts { display: flex; gap: 18mm; margin-top: 8mm; }
.facts .v { font-size: 13pt; font-weight: 700; }
.facts .l { font-size: 8.5pt; color: #86868b; margin-top: 1mm; }
.qr { position: absolute; right: 8mm; bottom: 8mm; text-align: center; }
.qr svg { width: 26mm; height: 26mm; display: block; margin: 0 auto; }
.qr .u { font-size: 6.5pt; color: #86868b; max-width: 62mm; word-break: break-all; margin-top: 1mm; }
.foot { position: absolute; left: 8mm; bottom: 9mm; max-width: 150mm; text-align: left; font-size: 7.5pt; color: #86868b; line-height: 1.5; }
.revoked { color: #b42318; font-weight: 700; }
@media print { html, body { background: #fff; } .bar { display: none; } .sheet-wrap { padding: 0; } .page { box-shadow: none; margin: 0; } }
</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">${T("cert.print")}</button><a href="${c.p("/certificates/" + cert.code)}">${T("cert.view")}</a>
  <span style="color:#6e6e73">${c.t("calc.pdf_hint")}</span></div>
<div class="sheet-wrap"><div class="page"><div class="frame"></div><div class="inner">
  <img src="/img/logo.svg" alt="ProcureBest" style="height:9mm">
  <div class="kicker">${T("cert.pdf_kicker")}</div>
  <h1>${T("cert.pdf_title")}</h1>
  <div class="lead">${T("cert.certifies")}</div>
  <div class="name">${cert.name}</div>
  <div class="lead" style="margin-top:2mm">${T("cert.completed")}</div>
  <div class="level">${c.pick(cert.title_en, cert.title_bn)} ${T("cert.level_suffix")}</div>
  <div class="rule"></div>
  <div class="facts">
    <div><div class="v">${c.pct(cert.score_pct, 1)}</div><div class="l">${T("cert.score")}</div></div>
    <div><div class="v">${c.date(cert.issued_at)}</div><div class="l">${T("cert.issued")}</div></div>
    <div><div class="v" style="font-family:Menlo,Consolas,monospace;font-size:11pt">${cert.code}</div><div class="l">${T("cert.id")}</div></div>
  </div>
  <div class="foot">${T("cert.not_accreditation")}${cert.status !== "valid" ? html`<br><span class="revoked">${T("cert.status_revoked")}</span>` : ""}</div>
  <div class="qr">${raw(qrSvg(url))}<div class="u">${T("cert.verify_at")}<br>${url}</div></div>
</div></div></div></body></html>`;
  return c.html(page);
}

// ------------------------------------------------------------------ email confirmation landing
async function verifyPage(c) {
  const token = c.url.searchParams.get("t") || "";
  const row = token ? await one(c.env, "SELECT * FROM verifications WHERE token_hash=?", await sha256(token)) : null;
  let state = "ok";
  if (!row) state = "invalid";
  else if (row.used_at) state = "used";
  else if (Date.parse(row.expires_at) < Date.now()) state = "expired";
  if (c.req.method === "POST" && state === "ok") {
    const res = await run(c.env, "UPDATE verifications SET used_at=? WHERE id=? AND used_at IS NULL", nowIso(), row.id);
    if (!res.meta || res.meta.changes !== 0) {
      await recordEmail(c.env, row.email, { source: row.purpose, lang: c.lang, verified: true, subscribe: !!row.subscribe });
      await run(c.env, "UPDATE emails SET verified_at=COALESCE(verified_at, ?) WHERE email=?", nowIso(), row.email);
      await c.setVisitor(row.email, true);
      const body = html`<section class="section"><div class="wrap wrap-narrow center">
        <div class="card-icon" style="margin:0 auto 18px;background:var(--ok-bg);color:var(--ok)">${icon("check-circle", 24)}</div>
        <h1 style="font-size:40px">${c.t("verify.done_title")}</h1><p class="lead">${c.t("verify.done", { email: row.email })}</p>
        <a class="btn btn-primary btn-lg" style="margin-top:16px" href="${row.next || c.p("/")}">${c.t("verify.continue")}</a></div></section>
        <script>try{localStorage.setItem("pb_verified",String(Date.now()))}catch(e){}</script>`;
      return c.html(await layout(c, { title: c.t("verify.done_title"), body, noindex: true, alternates: false }));
    }
    state = "used";
  }
  const msg = { invalid: ["delivery.link_invalid_title", "delivery.link_invalid"], used: ["delivery.link_used_title", "delivery.link_used"], expired: ["delivery.link_expired_title", "delivery.link_expired"] }[state];
  const body = state === "ok" ? html`<section class="section"><div class="wrap wrap-narrow center">
      <div class="card-icon" style="margin:0 auto 18px">${icon("mail", 22)}</div>
      <h1 style="font-size:40px">${c.t("verify.title")}</h1><p class="lead">${c.t("verify.lead", { email: row.email })}</p>
      <form method="post"><button class="btn btn-primary btn-lg" type="submit" style="margin-top:12px">${c.t("verify.button")}</button></form></div></section>`
    : html`<section class="section"><div class="wrap wrap-narrow center"><h1 style="font-size:40px">${c.t(msg[0])}</h1><p class="lead">${c.t(msg[1])}</p>
      <a class="btn btn-secondary" href="${c.p("/")}">${c.t("error.go_home")}</a></div></section>`;
  return c.html(await layout(c, { title: c.t("verify.title"), body, noindex: true, alternates: false }));
}

// ------------------------------------------------------------------ buy (manual bKash / Nagad)
async function buyPage(c) {
  const { type, ref } = c.params;
  let title, amount, back, owned = false, pending = null;
  const v = await c.readyVisitor();
  if (type === "file") {
    const it = await one(c.env, "SELECT * FROM items WHERE slug=? AND status='published'", ref);
    if (!it || it.price <= 0) throw new HttpError(404);
    title = c.pick(it.title_en, it.title_bn); amount = it.price; back = c.p("/library/" + it.slug);
    if (v) { owned = await ownsFile(c.env, v.email, it.slug); pending = owned ? null : await pendingOrder(c.env, v.email, "file", it.slug); }
  } else if (type === "course") {
    const k = await one(c.env, "SELECT * FROM courses WHERE slug=? AND status='published'", ref);
    if (!k || k.price <= 0) throw new HttpError(404);
    title = c.pick(k.title_en, k.title_bn); amount = k.price; back = c.p("/courses/" + k.slug);
    if (v) {
      owned = Boolean(await one(c.env, "SELECT id FROM entitlements WHERE email=? AND item_type='course' AND item_ref=?", v.email, k.slug));
      pending = owned ? null : await pendingOrder(c.env, v.email, "course", k.slug);
    }
  } else {
    const lv = await level(c.env, ref);
    if (!lv || lv.price <= 0) throw new HttpError(404);
    title = `${c.pick(lv.title_en, lv.title_bn)} — ${c.L("Procurement Exam", "প্রকিউরমেন্ট পরীক্ষা")}`; amount = lv.price; back = c.p("/exams/" + lv.code);
    if (v) pending = await pendingOrder(c.env, v.email, "exam", lv.code);
  }
  const s = await c.settings();
  const methods = paymentMethods(s);
  let content;
  if (owned) content = html`<div class="alert alert-ok">${icon("check-circle", 18)}<div>${c.t("lib.owned")}</div></div><a class="btn btn-primary" style="margin-top:16px" href="${back}">${c.t("common.back")}</a>`;
  else if (pending) content = html`<div class="alert alert-warn">${icon("clock", 18)}<div>${c.t("order.received", { ref: pending.ref, email: v.email })}</div></div><a class="btn btn-secondary" style="margin-top:16px" href="${c.p("/my")}">${c.t("nav.my")}</a>`;
  else if (!methods.length) content = html`<div class="alert alert-info">${icon("info", 18)}<div>${c.t("order.no_methods")}</div></div><a class="btn btn-secondary" style="margin-top:16px" href="${c.p("/contact")}">${c.t("footer.contact")}</a>`;
  else content = html`
    <div class="order-amount"><span class="label">${c.t("order.amount")}</span><span class="stat">${c.money(amount)}</span></div>
    <h3 style="margin-top:26px"><span class="step-no">${c.d(1)}</span> ${c.t("order.step1")}</h3>
    <div class="grid grid-2" style="margin-top:12px">${methods.map((m) => html`<div class="card surface pay-card">
      <div class="row between"><strong style="font-size:18px">${m.name}</strong><span class="tag outline">${m.type}</span></div>
      <div class="mono pay-number">${m.number}</div>
      <p class="small">${c.t("order.send_to", { method: m.name, type: m.type })}</p></div>`)}</div>
    <p class="small muted" style="margin-top:12px">${c.pick(s.pay_note_en, s.pay_note_bn)}</p>
    <h3 style="margin-top:26px"><span class="step-no">${c.d(2)}</span> ${c.t("order.step2")}</h3>
    <form action="/api/orders" data-json-form novalidate style="margin-top:12px">
      <input type="hidden" name="item_type" value="${type}"><input type="hidden" name="item_ref" value="${ref}">
      <div class="form-grid">
        <div class="field full"><span class="label">${c.t("order.method")}</span><div class="seg">${methods.map((m, i) => html`<label><input type="radio" name="method" value="${m.code}" ${i === 0 ? raw("checked") : ""}> ${m.name}</label>`)}</div></div>
        <div class="field"><label for="o-sender">${c.t("order.sender_generic")}</label><input id="o-sender" name="sender" inputmode="tel" placeholder="01XXXXXXXXX" required autocomplete="tel"></div>
        <div class="field"><label for="o-trx">${c.t("order.trx")}</label><input id="o-trx" name="trx" required autocomplete="off" spellcheck="false" style="text-transform:uppercase"><span class="help">${c.t("order.trx_help")}</span></div>
        <div class="field"><label for="o-name">${c.t("order.name")}</label><input id="o-name" name="name" required autocomplete="name"></div>
        <div class="field"><label for="o-email">${c.t("order.email")}</label><input id="o-email" name="email" type="email" required autocomplete="email" value="${v ? v.email : ""}"><span class="help">${c.t("order.email_help")}</span></div>
        <div class="field"><label for="o-phone">${c.t("order.phone")}</label><input id="o-phone" name="phone" inputmode="tel" autocomplete="tel"></div>
      </div>
      <div class="alert" data-form-msg hidden style="margin-top:16px"></div>
      <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">${c.t("order.submit")}</button></div>
    </form>`;
  const body = html`
<section class="page-head" style="padding-bottom:24px"><div class="wrap wrap-narrow">
  <nav class="crumbs"><a href="${back}">${c.t("common.back")}</a></nav>
  <h1 style="font-size:clamp(30px,4vw,44px)">${c.t("order.title", { item: title })}</h1>
</div></section>
<section class="section-sm" style="padding-top:0"><div class="wrap wrap-narrow"><div class="panel">${content}</div></div></section>`;
  return c.html(await layout(c, { title: c.t("order.title", { item: title }), body, noindex: true, gate: true }));
}

async function buyDone(c) {
  const v = await c.visitor();
  const o = v ? await one(c.env, "SELECT * FROM orders WHERE ref=? AND email=?", c.params.ref, v.email) : null;
  if (!o) throw new HttpError(404);
  const body = html`<section class="section"><div class="wrap wrap-narrow center">
    <div class="card-icon" style="margin:0 auto 18px;background:var(--ok-bg);color:var(--ok)">${icon("receipt", 24)}</div>
    <h1 style="font-size:40px">${c.t("order.received_title")}</h1>
    <p class="lead">${c.t("order.received", { ref: o.ref, email: o.email })}</p>
    <div class="row" style="justify-content:center;margin-top:20px"><a class="btn btn-primary" href="${c.p("/my")}">${c.t("nav.my")}</a><a class="btn btn-secondary" href="${c.p("/")}">${c.t("error.go_home")}</a></div>
  </div></section>`;
  return c.html(await layout(c, { title: c.t("order.received_title"), body, noindex: true }));
}

// ------------------------------------------------------------------ my area
async function myPage(c) {
  const v = await c.readyVisitor();
  if (!v) {
    const body = html`${pageHead(c, { title: c.t("my.title"), lead: c.t("my.need_email"), narrow: true,
      extra: html`<button class="btn btn-primary btn-lg" type="button" data-confirm-email>${icon("mail", 18)} ${c.t("gate.title")}</button>
      <script>document.addEventListener("click",async function(e){if(!e.target.closest("[data-confirm-email]"))return;if(await window.PB.requireEmail())location.reload();});</script>` })}`;
    return c.html(await layout(c, { title: c.t("my.title"), body, noindex: true, gate: true }));
  }
  const [certs, attempts, ents, orders] = await Promise.all([
    all(c.env, "SELECT c.*, l.title_en, l.title_bn FROM certificates c LEFT JOIN exam_levels l ON l.code=c.level_code WHERE c.email=? ORDER BY issued_at DESC", v.email),
    all(c.env, "SELECT a.*, l.title_en, l.title_bn FROM attempts a LEFT JOIN exam_levels l ON l.code=a.level_code WHERE a.email=? ORDER BY started_at DESC LIMIT 30", v.email),
    all(c.env, `SELECT e.item_type, e.item_ref, SUM(e.attempts_total) AS total, SUM(e.attempts_used) AS used, i.title_en AS i_en, i.title_bn AS i_bn, l.title_en AS l_en, l.title_bn AS l_bn
      , k.title_en AS k_en, k.title_bn AS k_bn
      FROM entitlements e LEFT JOIN items i ON e.item_type='file' AND i.slug=e.item_ref LEFT JOIN exam_levels l ON e.item_type='exam' AND l.code=e.item_ref
      LEFT JOIN courses k ON e.item_type='course' AND k.slug=e.item_ref
      WHERE e.email=? GROUP BY e.item_type, e.item_ref ORDER BY MAX(e.id) DESC`, v.email),
    all(c.env, "SELECT * FROM orders WHERE email=? ORDER BY id DESC LIMIT 30", v.email),
  ]);
  const none = html`<p class="muted small">${c.t("my.none")}</p>`;
  const statusTag = (s) => html`<span class="tag ${s === "approved" ? "ok" : s === "rejected" ? "err" : "warn"}">${c.t("order.status." + s)}</span>`;
  const body = html`${pageHead(c, { title: c.t("my.title"), lead: c.t("my.lead", { email: v.email }), narrow: true,
    extra: html`<p class="small"><a href="#" data-forget-email>${c.t("my.sign_out")}</a>${!v.verified ? html` · <span class="muted">${c.L("Email not yet confirmed", "ইমেইল এখনো নিশ্চিত হয়নি")}</span>` : ""}</p>` })}
<section class="section-sm" style="padding-top:0"><div class="wrap wrap-narrow stack">
  <div class="panel"><h3>${c.t("my.certs")}</h3>
    ${certs.length ? html`<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>${c.t("cert.id")}</th><th>${c.t("cert.level")}</th><th class="num">${c.t("cert.score")}</th><th>${c.t("cert.issued")}</th><th></th></tr></thead><tbody>
      ${certs.map((x) => html`<tr><td class="mono">${x.code}</td><td>${c.pick(x.title_en, x.title_bn)}</td><td class="num">${c.pct(x.score_pct, 1)}</td><td>${c.date(x.issued_at)}</td>
        <td class="num">${x.status === "valid" ? html`<a class="btn btn-ghost btn-sm" href="${c.p("/certificates/" + x.code + "/print")}">${icon("print", 15)} ${c.L("Print", "প্রিন্ট")}</a>` : html`<span class="tag err">${c.t("cert.revoked")}</span>`}</td></tr>`)}
    </tbody></table></div>` : none}</div>
  <div class="panel"><h3>${c.t("my.owned")}</h3>
    ${ents.length ? html`<ul class="details-list">${ents.map((e) => e.item_type === "course"
      ? html`<li><span>${c.pick(e.k_en, e.k_bn) || e.item_ref} — ${c.t("nav.courses")}</span><span><a class="btn btn-ghost btn-sm" href="${c.p("/courses/" + e.item_ref)}">${c.t("common.open")}</a></span></li>`
      : e.item_type === "file"
      ? html`<li><span>${c.pick(e.i_en, e.i_bn) || e.item_ref}</span><span><a class="btn btn-ghost btn-sm" href="${c.p("/library/" + e.item_ref)}">${icon("download", 15)} ${c.t("lib.download")}</a></span></li>`
      : html`<li><span>${c.pick(e.l_en, e.l_bn)} — ${c.t("nav.exams")}</span><span>${c.t("exam.attempts_left", { n: c.d(Math.max(0, e.total - e.used)) })} <a class="btn btn-ghost btn-sm" href="${c.p("/exams/" + e.item_ref)}">${c.t("exam.start")}</a></span></li>`)}</ul>` : none}</div>
  <div class="panel"><h3>${c.t("my.attempts")}</h3>
    ${attempts.length ? html`<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>${c.t("common.date")}</th><th>${c.t("cert.level")}</th><th class="num">${c.t("cert.score")}</th><th>${c.t("common.status")}</th><th></th></tr></thead><tbody>
      ${attempts.map((a) => html`<tr><td>${c.date(a.started_at, true)}</td><td>${c.pick(a.title_en, a.title_bn)}</td><td class="num">${a.submitted_at ? c.pct(a.score_pct, 0) : "—"}</td>
        <td>${!a.submitted_at ? html`<span class="tag warn">${c.t("exam.in_progress")}</span>` : a.passed ? html`<span class="tag ok">${c.t("exam.passed")}</span>` : html`<span class="tag">${c.t("exam.not_passed")}</span>`}</td>
        <td class="num"><a class="btn btn-ghost btn-sm" href="${c.p((a.submitted_at ? "/exams/result/" : "/exams/attempt/") + a.id)}">${c.t("common.open")}</a></td></tr>`)}
    </tbody></table></div>` : none}</div>
  <div class="panel"><h3>${c.t("my.orders")}</h3>
    ${orders.length ? html`<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Ref</th><th>${c.t("common.date")}</th><th>${c.L("Item", "আইটেম")}</th><th class="num">${c.t("common.price")}</th><th>${c.t("common.status")}</th></tr></thead><tbody>
      ${orders.map((o) => html`<tr><td class="mono">${o.ref}</td><td>${c.date(o.created_at)}</td><td>${o.item_title}</td><td class="num">${c.money(o.amount)}</td><td>${statusTag(o.status)}${o.status === "rejected" && o.admin_note ? html`<div class="tiny muted">${o.admin_note}</div>` : ""}</td></tr>`)}
    </tbody></table></div>` : none}</div>
</div></section>`;
  return c.html(await layout(c, { title: c.t("my.title"), body, noindex: true }));
}

// ------------------------------------------------------------------ access link from the "order approved" email
async function accessLink(c) {
  const payload = await readSigned(await c.secret(), c.params.token);
  if (!payload) {
    const body = html`<section class="section"><div class="wrap wrap-narrow center"><h1 style="font-size:40px">${c.t("access.expired_title")}</h1>
      <p class="lead">${c.t("access.expired")}</p><a class="btn btn-secondary" href="${c.p("/contact")}">${c.t("footer.contact")}</a></div></section>`;
    return c.html(await layout(c, { title: c.t("access.expired_title"), body, noindex: true, alternates: false }), 410);
  }
  const { e, to } = JSON.parse(payload);
  await recordEmail(c.env, e, { source: "order", lang: c.lang, verified: true });
  await run(c.env, "UPDATE emails SET verified_at=COALESCE(verified_at, ?) WHERE email=?", nowIso(), e);
  await c.setVisitor(e, true);
  return c.redirect(String(to || "").startsWith("/") && !String(to).startsWith("//") ? to : c.p("/my"));
}

export function registerVisitor(r) {
  const L = "/:lang(en|bn)";
  r.get(`${L}/exams`, examsIndex);
  r.get(`${L}/exams/attempt/:id`, attemptPage);
  r.get(`${L}/exams/result/:id`, resultPage);
  r.get(`${L}/results/:id`, publicResult);
  r.get(`${L}/exams/:code(beginner|experienced|expert|[a-z0-9-]+)`, examStart);
  r.get(`${L}/certificates/verify`, certVerify);
  r.get(`${L}/certificates/:code/print`, certPrint);
  r.get(`${L}/certificates/:code`, certVerify);
  r.get(`${L}/verify`, verifyPage);
  r.post(`${L}/verify`, verifyPage);
  r.get(`${L}/buy/done/:ref`, buyDone);
  r.get(`${L}/buy/:type(file|exam|course)/:ref`, buyPage);
  r.get(`${L}/my`, myPage);
  r.get(`${L}/access/:token`, accessLink);
}
