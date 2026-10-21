// Admin panel: library, blog, career, glossary, exams, questions, orders, emails,
// certificates, messages and settings. Server-rendered forms; same design as the site.
import { html, raw, jsonScript, nowIso, isoPlus, DAY, clip, slugify, toInt, sha256, clientIp, safeEqual, getCookie, cookie, parseJson, normEmail, isEmail } from "../lib/util.js";
import { one, all, run, scalar, rateLimit } from "../lib/db.js";
import { icon } from "../views/icons.js";
import { ASSET_V } from "../views/layout.js";
import { loadSettings, saveSettings, DEFAULTS, WHATSAPP_RE, paymentMethods } from "../lib/settings.js";
import { mailConfigured, sendMail, emailLayout } from "../lib/mail.js";
import { createFile, getFile, putChunk, completeFile, deleteFile, storageUsed, maxFileSize, ext, IMAGE_EXT, storageKind, expectedChunkSize } from "../lib/files.js";
import { approveOrder, rejectOrder } from "../lib/orders.js";
import { parseCsv, toCsv } from "../lib/csv.js";
import { TOPICS, topicLabel } from "../lib/exams.js";
import { installStep, starterStatus, STEPS } from "../seed/install.js";
import { HttpError } from "../app.js";

const PAGE = 50;
const TYPES = ["book", "excel", "cv", "doc"];
const FILE_EXT = ["pdf", "xlsx", "xls", "xlsm", "csv", "docx", "doc", "pptx", "zip", "epub", "txt"];
const MSG = {
  saved: ["Saved.", "সেভ হয়েছে।"], deleted: ["Deleted.", "মুছে ফেলা হয়েছে।"], approved: ["Order approved and the buyer was emailed.", "অর্ডার অনুমোদিত হয়েছে এবং ক্রেতাকে ইমেইল করা হয়েছে।"],
  approved_nomail: ["Order approved. The email could not be sent — tell the buyer yourself.", "অর্ডার অনুমোদিত হয়েছে। ইমেইল পাঠানো যায়নি — ক্রেতাকে নিজে জানান।"],
  rejected: ["Order marked as not approved.", "অর্ডারটি অনুমোদিত হয়নি হিসেবে চিহ্নিত হয়েছে।"], revoked: ["Certificate revoked.", "সার্টিফিকেট বাতিল হয়েছে।"],
  reinstated: ["Certificate reinstated.", "সার্টিফিকেট আবার বৈধ করা হয়েছে।"], mail_ok: ["Test email sent. Check the inbox (and spam).", "টেস্ট ইমেইল পাঠানো হয়েছে। ইনবক্স (ও স্প্যাম) দেখুন।"],
  imported: ["Import finished.", "ইমপোর্ট শেষ হয়েছে।"], read: ["Marked as read.", "পড়া হয়েছে হিসেবে চিহ্নিত।"],
};

// ------------------------------------------------------------------ layout & helpers
async function adminLayout(c, { title, body, active = "", narrow = false }) {
  const csrf = await c.csrfToken();
  const pending = Number(await scalar(c.env, "SELECT COUNT(*) FROM orders WHERE status='pending'"));
  const unread = Number(await scalar(c.env, "SELECT COUNT(*) FROM messages WHERE read_at IS NULL"));
  const nav = [
    ["dashboard", "/admin", "gauge", c.L("Dashboard", "ড্যাশবোর্ড")],
    ["orders", "/admin/orders", "receipt", c.L("Orders", "অর্ডার"), pending],
    ["library", "/admin/library", "book-open", c.L("Library", "লাইব্রেরি")],
    ["blog", "/admin/posts?section=blog", "file", c.L("Blog", "ব্লগ")],
    ["career", "/admin/posts?section=career", "briefcase", c.L("Career", "ক্যারিয়ার")],
    ["glossary", "/admin/glossary", "text", c.L("Glossary", "গ্লসারি")],
    ["exams", "/admin/exams", "award", c.L("Exams", "পরীক্ষা")],
    ["questions", "/admin/questions", "book", c.L("Question bank", "প্রশ্নব্যাংক")],
    ["certificates", "/admin/certificates", "shield", c.L("Certificates", "সার্টিফিকেট")],
    ["emails", "/admin/emails", "mail", c.L("Emails", "ইমেইল তালিকা")],
    ["activity", "/admin/activity", "download", c.L("Downloads & activity", "ডাউনলোড ও কার্যক্রম")],
    ["messages", "/admin/messages", "chat", c.L("Messages", "বার্তা"), unread],
    ["settings", "/admin/settings", "settings", c.L("Settings", "সেটিংস")],
  ];
  const msg = MSG[c.url.searchParams.get("msg")];
  const err = c.url.searchParams.get("err");
  return c.html(html`<html lang="${c.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ProcureBest Admin</title><meta name="robots" content="noindex, nofollow"><meta name="csrf-token" content="${csrf}">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/css/app.css?v=${ASSET_V}"><link rel="stylesheet" href="/css/admin.css?v=${ASSET_V}"></head>
<body class="admin"><div class="adm">
<aside class="adm-side" data-adm-side>
  <a class="brand" href="/admin"><img src="/img/logo.svg" alt="ProcureBest" style="height:22px"></a>
  <span class="tag dark" style="margin:10px 0 18px;align-self:flex-start">Admin</span>
  <nav>${nav.map(([key, href, ic, label, badge]) => html`<a href="${href}" class="${active === key ? "on" : ""}">${icon(ic, 17)} <span style="flex:1">${label}</span>${badge ? html`<span class="adm-badge">${c.d(badge)}</span>` : ""}</a>`)}</nav>
  <div class="adm-side-foot"><a href="/${c.lang}/" target="_blank">${icon("eye", 16)} ${c.L("View site", "সাইট দেখুন")}</a></div>
</aside>
<div class="adm-main">
  <header class="adm-top">
    <button class="nav-icon adm-menu" type="button" data-adm-toggle aria-label="Menu">${icon("menu", 20)}</button>
    <h1 class="adm-h1">${title}</h1>
    <div class="row" style="gap:10px">
      <div class="lang-switch"><a href="/admin/lang/en?back=${encodeURIComponent(c.url.pathname + c.url.search)}" class="${c.lang === "en" ? "on" : ""}">EN</a><a href="/admin/lang/bn?back=${encodeURIComponent(c.url.pathname + c.url.search)}" class="${c.lang === "bn" ? "on" : ""}">বাংলা</a></div>
      <form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${csrf}"><button class="btn btn-ghost btn-sm" type="submit" title="${c.L("Sign out", "সাইন আউট")}">${icon("logout", 15)}</button></form>
    </div>
  </header>
  ${msg ? html`<div class="alert alert-ok" style="margin-bottom:16px">${icon("check-circle", 18)}<div>${c.L(...msg)}</div></div>` : ""}
  ${err ? html`<div class="alert alert-err" style="margin-bottom:16px">${icon("alert", 18)}<div>${err.slice(0, 300)}</div></div>` : ""}
  <div class="${narrow ? "adm-narrow" : ""}">${body}</div>
</div></div>
<script src="/js/admin.js?v=${ASSET_V}" defer></script></body></html>`);
}

const csrfInput = async (c) => html`<input type="hidden" name="_csrf" value="${await c.csrfToken()}">`;
const fld = (name, label, value = "", { type = "text", help = "", full = false, required = false, rows = 0, attrs = "", third = false } = {}) => html`
  <div class="field ${full ? "full" : third ? "third" : ""}"><label for="f-${name}">${label}${required ? " *" : ""}</label>
  ${rows ? html`<textarea id="f-${name}" name="${name}" rows="${rows}" ${required ? raw("required") : ""} ${raw(attrs)}>${value ?? ""}</textarea>`
    : html`<input id="f-${name}" type="${type}" name="${name}" value="${value ?? ""}" ${required ? raw("required") : ""} ${raw(attrs)}>`}
  ${help ? html`<span class="help">${help}</span>` : ""}</div>`;
const sel = (name, label, value, options, { help = "", full = false, third = false } = {}) => html`
  <div class="field ${full ? "full" : third ? "third" : ""}"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">
  ${options.map(([v, l]) => html`<option value="${v}" ${String(v) === String(value) ? raw("selected") : ""}>${l}</option>`)}</select>${help ? html`<span class="help">${help}</span>` : ""}</div>`;
const statusTag = (c, s) => html`<span class="tag ${s === "published" || s === "approved" || s === "valid" ? "ok" : s === "rejected" || s === "revoked" ? "err" : s === "pending" ? "warn" : ""}">${statusLabel(c, s)}</span>`;
const statusLabel = (c, s) => ({ published: c.L("Published", "প্রকাশিত"), draft: c.L("Draft", "খসড়া"), pending: c.L("Pending", "অপেক্ষমাণ"), approved: c.L("Approved", "অনুমোদিত"), rejected: c.L("Not approved", "অনুমোদিত হয়নি"), valid: c.L("Valid", "বৈধ"), revoked: c.L("Revoked", "বাতিল") }[s] || s);
const fileSize = (c, b) => (!b ? "—" : b < 1048576 ? `${c.num(b / 1024, 0)} KB` : `${c.num(b / 1048576, 1)} MB`);
const back = (path, key) => `${path}${path.includes("?") ? "&" : "?"}msg=${key}`;
const errBack = (path, text) => `${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(text)}`;
function pager(c, page, total, base) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return "";
  const u = (p) => `${base}${base.includes("?") ? "&" : "?"}page=${p}`;
  return html`<div class="row" style="margin-top:16px;justify-content:center">${page > 1 ? html`<a class="btn btn-ghost btn-sm" href="${u(page - 1)}">${icon("arrow-left", 14)}</a>` : ""}
    <span class="small muted">${c.d(page)} / ${c.d(pages)}</span>${page < pages ? html`<a class="btn btn-ghost btn-sm" href="${u(page + 1)}">${icon("arrow-right", 14)}</a>` : ""}</div>`;
}
function uploadField(c, { name, label, file, accept, kind, help }) {
  return html`<div class="field full" data-upload data-kind="${kind}" data-accept="${accept}">
    <label>${label}</label>
    <div class="upload-box">
      <div class="row between" style="gap:10px"><span data-upload-name class="small">${file ? html`${icon("file", 15)} ${file.name} · ${fileSize(c, file.size)}` : html`<span class="muted">${c.L("No file yet", "এখনো কোনো ফাইল নেই")}</span>`}</span>
        <label class="btn btn-ghost btn-sm" style="cursor:pointer">${icon("upload", 15)} ${file ? c.L("Replace", "বদলান") : c.L("Choose file", "ফাইল বেছে নিন")}<input type="file" accept="${accept}" data-upload-input hidden></label></div>
      <div class="progress" data-upload-progress hidden style="max-width:none;margin-top:10px"><i style="width:0%"></i></div>
      <span class="help" data-upload-status>${help || ""}</span>
    </div>
    <input type="hidden" name="${name}" value="${file ? file.id : ""}" data-upload-value>
    ${file ? html`<label class="check small" style="margin-top:8px"><input type="checkbox" name="${name}_remove" value="1"> ${c.L("Remove this file", "এই ফাইলটি সরিয়ে দিন")}</label>` : ""}
  </div>`;
}

// ------------------------------------------------------------------ auth
async function loginPage(c, error = "") {
  const configured = Boolean(c.env.ADMIN_PASSWORD && String(c.env.ADMIN_PASSWORD).length >= 8);
  return c.html(html`<html lang="${c.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Admin — ProcureBest</title>
<meta name="robots" content="noindex"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap"><link rel="stylesheet" href="/css/app.css?v=${ASSET_V}"></head>
<body style="background:var(--surface)"><section class="section"><div class="wrap auth-box">
  <div class="panel"><img src="/img/logo.svg" alt="ProcureBest" style="height:24px"><h1 style="font-size:28px;margin-top:22px">${c.L("Admin sign in", "অ্যাডমিন সাইন ইন")}</h1>
  ${!configured ? html`<div class="alert alert-warn" style="margin:16px 0">${icon("alert", 18)}<div>${c.L("The admin password is not set yet. In Cloudflare open this Worker → Settings → Variables and Secrets, add a secret named ADMIN_PASSWORD (at least 12 characters), then reload this page.", "অ্যাডমিন পাসওয়ার্ড এখনো সেট করা হয়নি। Cloudflare-এ এই Worker → Settings → Variables and Secrets খুলে ADMIN_PASSWORD নামে একটি secret যোগ করুন (কমপক্ষে ১২ অক্ষর), তারপর পাতাটি আবার লোড করুন।")}</div></div>` : ""}
  ${error ? html`<div class="alert alert-err" style="margin:16px 0">${icon("alert", 18)}<div>${error}</div></div>` : ""}
  <form method="post" action="/admin/login" style="margin-top:16px">
    <div class="field full"><label for="pw">${c.L("Password", "পাসওয়ার্ড")}</label><input id="pw" type="password" name="password" autocomplete="current-password" required autofocus></div>
    <div class="form-actions"><button class="btn btn-primary" type="submit" ${configured ? "" : raw("disabled")}>${c.L("Sign in", "সাইন ইন")}</button>
      <a class="small muted" href="/admin/lang/${c.lang === "bn" ? "en" : "bn"}?back=/admin" style="margin-left:auto">${c.lang === "bn" ? "English" : "বাংলা"}</a></div>
  </form></div></div></section></body></html>`, error ? 401 : 200);
}

async function doLogin(c) {
  if (!c.sameOrigin()) return loginPage(c, c.L("Please reload the page and try again.", "পাতাটি আবার লোড করে চেষ্টা করুন।"));
  const ipKey = await sha256("admin-ip:" + clientIp(c.req));
  if (!(await rateLimit(c.env, "admin-login:" + ipKey, 8, 900))) return loginPage(c, c.L("Too many attempts. Wait 15 minutes.", "অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট অপেক্ষা করুন।"));
  const form = await c.form();
  const pw = String(form.get("password") || "");
  const expected = String(c.env.ADMIN_PASSWORD || "");
  if (expected.length < 8 || !safeEqual(await sha256("pw:" + pw), await sha256("pw:" + expected))) {
    return loginPage(c, c.L("Wrong password.", "পাসওয়ার্ড ভুল।"));
  }
  await c.startAdmin();
  return c.redirect("/admin");
}

// ------------------------------------------------------------------ dashboard
async function dashboard(c) {
  const s = await c.settings();
  // clean up uploads that were never finished
  const stale = await all(c.env, "SELECT id FROM files WHERE complete=0 AND created_at < ?", isoPlus(-DAY));
  for (const f of stale.slice(0, 5)) await deleteFile(c.env, f.id);
  const since = isoPlus(-7 * DAY);
  const m = await one(c.env, `SELECT
    (SELECT COUNT(*) FROM emails) AS emails, (SELECT COUNT(*) FROM emails WHERE verified_at IS NOT NULL) AS verified,
    (SELECT COUNT(*) FROM emails WHERE subscribed=1) AS subscribed,
    (SELECT COUNT(*) FROM events WHERE kind='download' AND created_at>=?) AS dl7, (SELECT COUNT(*) FROM events WHERE kind='calc_export' AND created_at>=?) AS calc7,
    (SELECT COUNT(*) FROM orders WHERE status='pending') AS pending, (SELECT COALESCE(SUM(amount),0) FROM orders WHERE status='approved') AS revenue,
    (SELECT COUNT(*) FROM attempts WHERE started_at>=?) AS att7, (SELECT COUNT(*) FROM certificates WHERE status='valid') AS certs,
    (SELECT COUNT(*) FROM items WHERE status='published') AS items, (SELECT COUNT(*) FROM posts WHERE status='published') AS posts,
    (SELECT COUNT(*) FROM messages WHERE read_at IS NULL) AS unread`, since, since, since);
  const store = await storageUsed(c.env);
  const starter = await starterStatus(c.env);
  const warnings = [];
  if (!mailConfigured(c.env, s)) warnings.push(c.L("Email sending is not set up, so email addresses are collected but NOT verified (\"collect-only\" mode). Add the BREVO_API_KEY secret and a sender address in Settings.", "ইমেইল পাঠানো সেট করা হয়নি, তাই ইমেইল ঠিকানা সংগ্রহ হচ্ছে কিন্তু যাচাই হচ্ছে না (\"শুধু সংগ্রহ\" মোড)। BREVO_API_KEY secret এবং সেটিংসে প্রেরকের ঠিকানা যোগ করুন।"));
  if (!paymentMethods(s).length) warnings.push(c.L("No bKash or Nagad number is set, so paid items cannot be bought. Add them in Settings → Payments.", "কোনো bKash বা Nagad নম্বর দেওয়া নেই, তাই পেইড আইটেম কেনা যাবে না। সেটিংস → পেমেন্টে যোগ করুন।"));
  if (!WHATSAPP_RE.test(s.whatsapp_url || "")) warnings.push(c.L("The WhatsApp group link is not set, so the WhatsApp button is hidden. Add it in Settings.", "WhatsApp গ্রুপের লিংক দেওয়া নেই, তাই WhatsApp বাটন লুকানো আছে। সেটিংসে যোগ করুন।"));
  const limit = store.kind === "kv" ? 1024 * 1024 * 1024 : store.kind === "d1" ? 500 * 1024 * 1024 : null;
  const recent = await all(c.env, "SELECT * FROM orders WHERE status='pending' ORDER BY id DESC LIMIT 5");
  const metric = (v, l, href) => html`<a class="metric" href="${href || "#"}" style="text-decoration:none;color:inherit"><div class="v">${v}</div><div class="l">${l}</div></a>`;
  const body = html`
  ${warnings.map((w) => html`<div class="alert alert-warn" style="margin-bottom:10px">${icon("alert", 18)}<div>${w}</div></div>`)}
  ${starter.questions === 0 || starter.posts === 0 || starter.glossary === 0 || starter.items === 0 ? html`<div class="panel" style="margin:6px 0 20px" data-seed>
    <h3>${c.L("Install starter content", "প্রাথমিক কনটেন্ট যোগ করুন")}</h3>
    <p class="small muted">${c.L("Adds the 122 starter exam questions, 10 blog articles, 2 career articles, 32 glossary terms and 7 Excel templates (one of them paid, as an example). You can edit or delete everything afterwards. Running it twice does not create duplicates.", "১২২টি প্রাথমিক পরীক্ষার প্রশ্ন, ১০টি ব্লগ আর্টিকেল, ২টি ক্যারিয়ার আর্টিকেল, ৩২টি গ্লসারি শব্দ ও ৭টি এক্সেল টেমপ্লেট (উদাহরণ হিসেবে একটি পেইড) যোগ হবে। পরে সবকিছু এডিট বা মুছতে পারবেন। দুবার চালালেও দ্বিগুণ হবে না।")}</p>
    <p class="small">${c.L("Now:", "এখন:")} ${c.d(starter.questions)} ${c.L("questions", "প্রশ্ন")} · ${c.d(starter.posts)} ${c.L("posts", "লেখা")} · ${c.d(starter.glossary)} ${c.L("terms", "শব্দ")} · ${c.d(starter.items)} ${c.L("library items", "লাইব্রেরি আইটেম")}</p>
    <button class="btn btn-primary" type="button" data-seed-run data-steps="${STEPS.join(",")}">${icon("sparkle", 16)} ${c.L("Install starter content", "প্রাথমিক কনটেন্ট যোগ করুন")}</button>
    <span class="small muted" data-seed-status style="margin-left:10px"></span></div>` : ""}
  <div class="grid grid-4">
    ${metric(c.d(m.pending), c.L("Orders waiting for approval", "অনুমোদনের অপেক্ষায় অর্ডার"), "/admin/orders")}
    ${metric(c.money(m.revenue), c.L("Approved sales (total)", "অনুমোদিত বিক্রি (মোট)"), "/admin/orders?status=approved")}
    ${metric(c.num(m.emails), c.L("Emails collected", "সংগৃহীত ইমেইল"), "/admin/emails")}
    ${metric(c.num(m.verified), c.L("Verified emails", "যাচাইকৃত ইমেইল"), "/admin/emails?filter=verified")}
    ${metric(c.num(m.dl7), c.L("Library downloads (7 days)", "লাইব্রেরি ডাউনলোড (৭ দিন)"), "/admin/activity?kind=download")}
    ${metric(c.num(m.calc7), c.L("Calculator reports (7 days)", "ক্যালকুলেটর রিপোর্ট (৭ দিন)"), "/admin/activity?kind=calc_export")}
    ${metric(c.num(m.att7), c.L("Exam attempts (7 days)", "পরীক্ষা (৭ দিন)"), "/admin/certificates")}
    ${metric(c.num(m.certs), c.L("Valid certificates", "বৈধ সার্টিফিকেট"), "/admin/certificates")}
    ${metric(c.num(m.items), c.L("Library items published", "প্রকাশিত লাইব্রেরি আইটেম"), "/admin/library")}
    ${metric(c.num(m.posts), c.L("Posts published", "প্রকাশিত লেখা"), "/admin/posts?section=blog")}
    ${metric(c.num(m.subscribed), c.L("Newsletter subscribers", "নিউজলেটার গ্রাহক"), "/admin/emails?filter=subscribed")}
    ${metric(c.num(m.unread), c.L("Unread messages", "না-পড়া বার্তা"), "/admin/messages")}
  </div>
  <div class="grid grid-2" style="margin-top:20px">
    <div class="panel"><div class="row between"><h3 style="margin:0">${c.L("Orders waiting", "অপেক্ষমাণ অর্ডার")}</h3><a class="link small" href="/admin/orders">${c.L("All orders", "সব অর্ডার")}</a></div>
      ${recent.length ? html`<ul class="details-list">${recent.map((o) => html`<li><span>${o.item_title}<small>${o.email} · ${o.method} · ${o.trx_id}</small></span><span>${c.money(o.amount)}</span></li>`)}</ul>` : html`<p class="muted small" style="margin-top:12px">${c.L("Nothing waiting.", "অপেক্ষায় কিছু নেই।")}</p>`}</div>
    <div class="panel"><h3>${c.L("File storage", "ফাইল স্টোরেজ")}</h3>
      <p class="small">${store.kind === "r2" ? c.L("Files are stored in Cloudflare R2.", "ফাইলগুলো Cloudflare R2-তে রাখা হচ্ছে।")
        : store.kind === "kv" ? c.L("Files are stored in Cloudflare KV (free plan: 1 GB in total).", "ফাইলগুলো Cloudflare KV-তে রাখা হচ্ছে (ফ্রি প্ল্যানে মোট ১ GB)।")
        : c.L("No KV storage is connected, so files are kept inside the database and are limited to 5 MB each. Connect KV (setup guide, step 5) for books and larger files.", "কোনো KV স্টোরেজ যুক্ত নেই, তাই ফাইল ডাটাবেসের ভেতরে রাখা হচ্ছে এবং প্রতিটি সর্বোচ্চ ৫ MB। বই ও বড় ফাইলের জন্য KV যুক্ত করুন (সেটআপ গাইড, ধাপ ৫)।")}</p>
      <p class="stat" style="font-size:30px;margin-top:10px">${fileSize(c, store.bytes)}</p><p class="small muted">${c.d(store.files)} ${c.L("files", "ফাইল")}${limit ? html` · ${c.L("about", "প্রায়")} ${c.d(Math.round(store.bytes / limit * 100))}% ${store.kind === "kv" ? c.L("of 1 GB", "(১ GB-এর)") : c.L("of 500 MB", "(৫০০ MB-এর)")}` : ""}</p>
      <p class="small muted" style="margin-top:8px">${c.L("Largest file allowed:", "সর্বোচ্চ ফাইলের আকার:")} ${fileSize(c, maxFileSize(c.env))}</p></div>
  </div>`;
  return adminLayout(c, { title: c.L("Dashboard", "ড্যাশবোর্ড"), body, active: "dashboard" });
}

// ------------------------------------------------------------------ library
async function libraryList(c) {
  const type = TYPES.includes(c.url.searchParams.get("type")) ? c.url.searchParams.get("type") : "";
  const rows = await all(c.env, `SELECT i.*, f.name AS file_name, f.size AS file_size FROM items i LEFT JOIN files f ON f.id=i.file_id ${type ? "WHERE i.type=?" : ""} ORDER BY i.sort, i.id DESC`, ...(type ? [type] : []));
  const typeLabel = { book: c.L("Book", "বই"), excel: "Excel", cv: c.L("CV sample", "সিভি নমুনা"), doc: c.L("Document", "ডকুমেন্ট") };
  const body = html`<div class="row between" style="margin-bottom:16px">
    <div class="chips"><a class="chip ${type ? "" : "on"}" href="/admin/library">${c.L("All", "সব")}</a>${TYPES.map((t) => html`<a class="chip ${type === t ? "on" : ""}" href="/admin/library?type=${t}">${typeLabel[t]}</a>`)}</div>
    <a class="btn btn-primary" href="/admin/library/new${type ? "?type=" + type : ""}">${icon("plus", 16)} ${c.L("Add item", "আইটেম যোগ করুন")}</a></div>
  <div class="table-wrap"><table><thead><tr><th>${c.L("Title", "শিরোনাম")}</th><th>${c.L("Type", "ধরন")}</th><th class="num">${c.L("Price", "মূল্য")}</th><th>${c.L("File", "ফাইল")}</th><th class="num">${c.L("Downloads", "ডাউনলোড")}</th><th>${c.L("Status", "অবস্থা")}</th><th></th></tr></thead>
  <tbody>${rows.length ? rows.map((r) => html`<tr><td><strong>${c.pick(r.title_en, r.title_bn)}</strong><div class="tiny muted">/${r.slug}</div></td><td>${typeLabel[r.type]}</td>
    <td class="num">${r.price > 0 ? c.money(r.price) : c.L("Free", "ফ্রি")}</td><td class="small">${r.file_name ? html`${r.file_name}<div class="tiny muted">${fileSize(c, r.file_size)}</div>` : html`<span class="tag warn">${c.L("No file", "ফাইল নেই")}</span>`}</td>
    <td class="num">${c.num(r.downloads)}</td><td>${statusTag(c, r.status)}</td><td class="num"><a class="btn btn-ghost btn-sm" href="/admin/library/${r.id}">${c.L("Edit", "এডিট")}</a></td></tr>`)
    : html`<tr><td colspan="7" class="muted">${c.L("No items yet.", "এখনো কোনো আইটেম নেই।")}</td></tr>`}</tbody></table></div>`;
  return adminLayout(c, { title: c.L("Library", "লাইব্রেরি"), body, active: "library" });
}

async function libraryEdit(c) {
  const isNew = c.params.id === "new";
  const it = isNew ? { type: TYPES.includes(c.url.searchParams.get("type")) ? c.url.searchParams.get("type") : "book", status: "draft", price: 0, sort: 100 } : await one(c.env, "SELECT * FROM items WHERE id=?", toInt(c.params.id));
  if (!it) throw new HttpError(404);
  const file = it.file_id ? await getFile(c.env, it.file_id) : null;
  const cover = it.cover_id ? await getFile(c.env, it.cover_id) : null;
  const body = html`<form method="post" action="/admin/library/${isNew ? "new" : it.id}" class="panel">${await csrfInput(c)}
  <div class="form-grid">
    ${sel("type", c.L("Type", "ধরন"), it.type, [["book", c.L("Book", "বই")], ["excel", "Excel"], ["cv", c.L("CV sample", "সিভি নমুনা")], ["doc", c.L("Document (Word etc.)", "ডকুমেন্ট (ওয়ার্ড ইত্যাদি)")]], { third: true })}
    ${sel("status", c.L("Status", "অবস্থা"), it.status, [["draft", c.L("Draft (hidden)", "খসড়া (লুকানো)")], ["published", c.L("Published", "প্রকাশিত")]], { third: true })}
    ${fld("price", c.L("Price in taka (0 = free)", "মূল্য টাকায় (০ = ফ্রি)"), it.price, { type: "number", third: true, attrs: 'min="0" step="1"' })}
    ${fld("title_en", c.L("Title (English)", "শিরোনাম (ইংরেজি)"), it.title_en, { required: true })}
    ${fld("title_bn", c.L("Title (Bengali)", "শিরোনাম (বাংলা)"), it.title_bn)}
    ${fld("summary_en", c.L("Short description (English)", "সংক্ষিপ্ত বিবরণ (ইংরেজি)"), it.summary_en, { rows: 2 })}
    ${fld("summary_bn", c.L("Short description (Bengali)", "সংক্ষিপ্ত বিবরণ (বাংলা)"), it.summary_bn, { rows: 2 })}
    ${fld("body_en", c.L("Full description (English, Markdown)", "পূর্ণ বিবরণ (ইংরেজি, Markdown)"), it.body_en, { rows: 8, help: c.L("Use ## for headings, - for lists, **bold**.", "শিরোনামে ##, তালিকায় -, মোটা লেখায় **লেখা** ব্যবহার করুন।") })}
    ${fld("body_bn", c.L("Full description (Bengali, Markdown)", "পূর্ণ বিবরণ (বাংলা, Markdown)"), it.body_bn, { rows: 8 })}
    ${uploadField(c, { name: "file_id", label: c.L("Downloadable file", "ডাউনলোডের ফাইল"), file, kind: "file", accept: FILE_EXT.map((e) => "." + e).join(","),
      help: c.L(`PDF, Excel, Word, PowerPoint, ZIP or EPUB — up to ${fileSize(c, maxFileSize(c.env))}.`, `PDF, Excel, Word, PowerPoint, ZIP বা EPUB — সর্বোচ্চ ${fileSize(c, maxFileSize(c.env))}।`) })}
    ${uploadField(c, { name: "cover_id", label: c.L("Cover image (optional, for books)", "কভার ছবি (ঐচ্ছিক, বইয়ের জন্য)"), file: cover, kind: "cover", accept: ".png,.jpg,.jpeg,.webp", help: c.L("PNG, JPG or WebP, ideally portrait, under 1 MB.", "PNG, JPG বা WebP, লম্বালম্বি হলে ভালো, ১ MB-এর কম।") })}
    ${fld("slug", c.L("Web address (slug)", "ওয়েব ঠিকানা (slug)"), it.slug, { help: c.L("Leave empty to create it from the English title.", "ফাঁকা রাখলে ইংরেজি শিরোনাম থেকে তৈরি হবে।") })}
    ${fld("sort", c.L("Order (smaller first)", "ক্রম (ছোট সংখ্যা আগে)"), it.sort, { type: "number" })}
  </div>
  <div class="form-actions"><button class="btn btn-primary" type="submit">${c.L("Save", "সেভ করুন")}</button><a class="btn btn-ghost" href="/admin/library">${c.L("Cancel", "বাতিল")}</a>
    ${!isNew && it.status === "published" ? html`<a class="link small" href="/${c.lang}/library/${it.slug}" target="_blank">${c.L("View on site", "সাইটে দেখুন")} ${icon("arrow-right", 14)}</a>` : ""}</div>
  </form>
  ${!isNew ? html`<form method="post" action="/admin/library/${it.id}/delete" style="margin-top:16px" data-confirm="${c.L("Delete this item and its file permanently?", "আইটেম ও তার ফাইল স্থায়ীভাবে মুছে ফেলবেন?")}">${await csrfInput(c)}<button class="btn btn-ghost btn-sm" type="submit" style="color:var(--err)">${icon("trash", 15)} ${c.L("Delete item", "আইটেম মুছুন")}</button></form>` : ""}`;
  return adminLayout(c, { title: isNew ? c.L("New library item", "নতুন লাইব্রেরি আইটেম") : c.pick(it.title_en, it.title_bn), body, active: "library" });
}

async function librarySave(c) {
  const f = await c.form();
  const isNew = c.params.id === "new";
  const old = isNew ? null : await one(c.env, "SELECT * FROM items WHERE id=?", toInt(c.params.id));
  if (!isNew && !old) throw new HttpError(404);
  const titleEn = clip(f.get("title_en"), 200);
  if (!titleEn) return c.redirect(errBack(`/admin/library/${c.params.id}`, c.L("The English title is required.", "ইংরেজি শিরোনাম আবশ্যক।")));
  let slug = slugify(clip(f.get("slug"), 80) || titleEn);
  const clash = await one(c.env, "SELECT id FROM items WHERE slug=? AND id<>?", slug, old ? old.id : 0);
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const type = TYPES.includes(f.get("type")) ? f.get("type") : "book";
  let fileId = clip(f.get("file_id"), 40) || null;
  let coverId = clip(f.get("cover_id"), 40) || null;
  if (f.get("file_id_remove")) fileId = null;
  if (f.get("cover_id_remove")) coverId = null;
  for (const id of [fileId, coverId]) if (id && !(await one(c.env, "SELECT id FROM files WHERE id=? AND complete=1", id))) return c.redirect(errBack(`/admin/library/${c.params.id}`, c.L("The upload did not finish. Please upload the file again.", "আপলোড শেষ হয়নি। ফাইলটি আবার আপলোড করুন।")));
  const vals = [slug, type, titleEn, clip(f.get("title_bn"), 200), clip(f.get("summary_en"), 600), clip(f.get("summary_bn"), 600),
    clip(f.get("body_en"), 20000), clip(f.get("body_bn"), 20000), Math.max(0, toInt(f.get("price"))), fileId, coverId,
    f.get("status") === "published" ? "published" : "draft", toInt(f.get("sort"), 100), nowIso()];
  let id;
  if (isNew) {
    const res = await run(c.env, `INSERT INTO items(slug,type,title_en,title_bn,summary_en,summary_bn,body_en,body_bn,price,file_id,cover_id,status,sort,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, ...vals, nowIso());
    id = res.meta.last_row_id;
  } else {
    await run(c.env, `UPDATE items SET slug=?,type=?,title_en=?,title_bn=?,summary_en=?,summary_bn=?,body_en=?,body_bn=?,price=?,file_id=?,cover_id=?,status=?,sort=?,updated_at=? WHERE id=?`, ...vals, old.id);
    id = old.id;
    if (old.file_id && old.file_id !== fileId) await deleteFile(c.env, old.file_id);
    if (old.cover_id && old.cover_id !== coverId) await deleteFile(c.env, old.cover_id);
    if (old.slug !== slug) await run(c.env, "UPDATE entitlements SET item_ref=? WHERE item_type='file' AND item_ref=?", slug, old.slug);
  }
  return c.redirect(back(`/admin/library/${id}`, "saved"));
}

async function libraryDelete(c) {
  const it = await one(c.env, "SELECT * FROM items WHERE id=?", toInt(c.params.id));
  if (it) {
    await deleteFile(c.env, it.file_id);
    await deleteFile(c.env, it.cover_id);
    await run(c.env, "DELETE FROM items WHERE id=?", it.id);
  }
  return c.redirect(back("/admin/library", "deleted"));
}

// Upload API (JSON + raw chunks)
async function uploadInit(c) {
  const b = await c.body();
  const name = clip(b.name, 200), size = toInt(b.size, 0), kind = b.kind === "cover" ? "cover" : "file";
  const e = ext(name);
  const allowed = kind === "cover" ? IMAGE_EXT : FILE_EXT;
  if (!allowed.includes(e)) return c.json({ ok: false, error: c.L(`This file type (.${e}) is not allowed.`, `এই ধরনের ফাইল (.${e}) অনুমোদিত নয়।`) }, 400);
  const max = kind === "cover" ? 3 * 1024 * 1024 : maxFileSize(c.env);
  if (size <= 0 || size > max) return c.json({ ok: false, error: c.L(`The file is too large. Maximum: ${fileSize(c, max)}.`, `ফাইলটি অনেক বড়। সর্বোচ্চ: ${fileSize(c, max)}।`) }, 400);
  return c.json({ ok: true, ...(await createFile(c.env, name, size)) });
}
async function uploadChunk(c) {
  const f = await getFile(c.env, c.params.id);
  if (!f || f.complete) return c.json({ ok: false }, 404);
  const idx = toInt(c.params.idx, -1);
  if (idx < 0 || idx >= f.chunks) return c.json({ ok: false }, 400);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  const expected = expectedChunkSize(f, idx);
  if (bytes.byteLength !== expected) return c.json({ ok: false, error: "size mismatch" }, 400);
  await putChunk(c.env, f, idx, bytes);
  return c.json({ ok: true });
}
async function uploadComplete(c) {
  const f = await getFile(c.env, c.params.id);
  if (!f) return c.json({ ok: false }, 404);
  const ok = await completeFile(c.env, f);
  return c.json(ok ? { ok: true, id: f.id, name: f.name, size: f.size } : { ok: false, error: "incomplete" }, ok ? 200 : 400);
}
async function seedStep(c) {
  try { return c.json({ ok: true, ...(await installStep(c.env, c.params.step)) }); }
  catch (e) { console.error(e); return c.json({ ok: false, error: String(e.message || e) }, 500); }
}

// ------------------------------------------------------------------ posts (blog & career)
const SECTIONS = ["blog", "career"];
async function postsList(c) {
  const section = SECTIONS.includes(c.url.searchParams.get("section")) ? c.url.searchParams.get("section") : "blog";
  const rows = await all(c.env, "SELECT id, slug, title_en, title_bn, category, status, published_at FROM posts WHERE section=? ORDER BY COALESCE(published_at, updated_at) DESC", section);
  const title = section === "career" ? c.L("Career articles", "ক্যারিয়ার লেখা") : c.L("Blog articles", "ব্লগ আর্টিকেল");
  const body = html`<div class="row between" style="margin-bottom:16px"><span class="small muted">${c.d(rows.length)} ${c.L("articles", "টি লেখা")}</span>
    <a class="btn btn-primary" href="/admin/posts/new?section=${section}">${icon("plus", 16)} ${c.L("New article", "নতুন লেখা")}</a></div>
  <div class="table-wrap"><table><thead><tr><th>${c.L("Title", "শিরোনাম")}</th><th>${c.L("Category", "ক্যাটাগরি")}</th><th>${c.L("Published", "প্রকাশ")}</th><th>${c.L("Status", "অবস্থা")}</th><th></th></tr></thead>
  <tbody>${rows.length ? rows.map((r) => html`<tr><td><strong>${c.pick(r.title_en, r.title_bn)}</strong><div class="tiny muted">/${section}/${r.slug}</div></td><td class="small">${r.category}</td><td class="small">${c.date(r.published_at)}</td><td>${statusTag(c, r.status)}</td>
    <td class="num"><a class="btn btn-ghost btn-sm" href="/admin/posts/${r.id}">${c.L("Edit", "এডিট")}</a></td></tr>`) : html`<tr><td colspan="5" class="muted">${c.L("No articles yet.", "এখনো কোনো লেখা নেই।")}</td></tr>`}</tbody></table></div>`;
  return adminLayout(c, { title, body, active: section });
}

async function postEdit(c) {
  const isNew = c.params.id === "new";
  const section = SECTIONS.includes(c.url.searchParams.get("section")) ? c.url.searchParams.get("section") : "blog";
  const p = isNew ? { section, status: "draft", published_at: nowIso().slice(0, 10), author: "ProcureBest", refs_json: "[]" } : await one(c.env, "SELECT * FROM posts WHERE id=?", toInt(c.params.id));
  if (!p) throw new HttpError(404);
  const refs = parseJson(p.refs_json, []).map((r) => (r.url ? `${r.title || ""} | ${r.url}` : r.title)).join("\n");
  const cats = p.section === "career" ? ["interview", "cv", "skills", "growth"] : ["fundamentals", "tco", "supplier-evaluation", "incoterms", "bangladesh-import", "china-sourcing", "inventory", "kpi", "negotiation", "import-documentation"];
  const body = html`<form method="post" action="/admin/posts/${isNew ? "new" : p.id}" class="panel">${await csrfInput(c)}<input type="hidden" name="section" value="${p.section}">
  <div class="form-grid">
    ${fld("title_en", c.L("Title (English)", "শিরোনাম (ইংরেজি)"), p.title_en, { required: true })}
    ${fld("title_bn", c.L("Title (Bengali)", "শিরোনাম (বাংলা)"), p.title_bn)}
    ${fld("summary_en", c.L("Summary (English)", "সারসংক্ষেপ (ইংরেজি)"), p.summary_en, { rows: 2 })}
    ${fld("summary_bn", c.L("Summary (Bengali)", "সারসংক্ষেপ (বাংলা)"), p.summary_bn, { rows: 2 })}
    ${fld("body_en", c.L("Article (English, Markdown)", "লেখা (ইংরেজি, Markdown)"), p.body_en, { rows: 18, full: true, help: c.L("## Heading, ### Subheading, - list, **bold**, [link text](https://…), > quote, tables with | pipes |.", "## শিরোনাম, ### উপশিরোনাম, - তালিকা, **মোটা**, [লিংকের লেখা](https://…), > উদ্ধৃতি, | পাইপ | দিয়ে টেবিল।") })}
    ${fld("body_bn", c.L("Article (Bengali, Markdown)", "লেখা (বাংলা, Markdown)"), p.body_bn, { rows: 18, full: true, help: c.L("If empty, the English article is shown with a note.", "ফাঁকা থাকলে নোটসহ ইংরেজি লেখাটি দেখানো হবে।") })}
    <div class="field third"><label for="f-category">${c.L("Category", "ক্যাটাগরি")}</label><input id="f-category" name="category" value="${p.category || ""}" list="cats"><datalist id="cats">${cats.map((k) => html`<option value="${k}">`)}</datalist></div>
    ${sel("status", c.L("Status", "অবস্থা"), p.status, [["draft", c.L("Draft (hidden)", "খসড়া (লুকানো)")], ["published", c.L("Published", "প্রকাশিত")]], { third: true })}
    ${fld("published_at", c.L("Publish date", "প্রকাশের তারিখ"), (p.published_at || "").slice(0, 10), { type: "date", third: true })}
    ${fld("author", c.L("Author", "লেখক"), p.author)}
    ${fld("slug", c.L("Web address (slug)", "ওয়েব ঠিকানা (slug)"), p.slug, { help: c.L("Leave empty to create it from the English title.", "ফাঁকা রাখলে ইংরেজি শিরোনাম থেকে তৈরি হবে।") })}
    ${fld("refs", c.L("References (one per line: Title | https://link)", "রেফারেন্স (প্রতি লাইনে একটি: শিরোনাম | https://লিংক)"), refs, { rows: 3, full: true })}
  </div>
  <div class="form-actions"><button class="btn btn-primary" type="submit">${c.L("Save", "সেভ করুন")}</button><a class="btn btn-ghost" href="/admin/posts?section=${p.section}">${c.L("Cancel", "বাতিল")}</a>
    ${!isNew && p.status === "published" ? html`<a class="link small" href="/${c.lang}/${p.section}/${p.slug}" target="_blank">${c.L("View on site", "সাইটে দেখুন")} ${icon("arrow-right", 14)}</a>` : ""}</div></form>
  ${!isNew ? html`<form method="post" action="/admin/posts/${p.id}/delete" style="margin-top:16px" data-confirm="${c.L("Delete this article permanently?", "লেখাটি স্থায়ীভাবে মুছে ফেলবেন?")}">${await csrfInput(c)}<button class="btn btn-ghost btn-sm" type="submit" style="color:var(--err)">${icon("trash", 15)} ${c.L("Delete article", "লেখা মুছুন")}</button></form>` : ""}`;
  return adminLayout(c, { title: isNew ? c.L("New article", "নতুন লেখা") : c.pick(p.title_en, p.title_bn), body, active: p.section });
}

async function postSave(c) {
  const f = await c.form();
  const isNew = c.params.id === "new";
  const old = isNew ? null : await one(c.env, "SELECT * FROM posts WHERE id=?", toInt(c.params.id));
  const section = old ? old.section : SECTIONS.includes(f.get("section")) ? f.get("section") : "blog";
  const titleEn = clip(f.get("title_en"), 200);
  if (!titleEn) return c.redirect(errBack(`/admin/posts/${c.params.id}?section=${section}`, c.L("The English title is required.", "ইংরেজি শিরোনাম আবশ্যক।")));
  let slug = slugify(clip(f.get("slug"), 80) || titleEn);
  if (await one(c.env, "SELECT id FROM posts WHERE section=? AND slug=? AND id<>?", section, slug, old ? old.id : 0)) slug += "-" + Date.now().toString(36).slice(-4);
  const refs = String(f.get("refs") || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20).map((l) => {
    const [t, u] = l.split("|").map((x) => x.trim());
    return /^https?:\/\//.test(u || "") ? { title: t, url: u } : /^https?:\/\//.test(t) ? { title: t, url: t } : { title: t };
  });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(f.get("published_at") || "") ? f.get("published_at") : nowIso().slice(0, 10);
  const vals = [slug, clip(f.get("category"), 40).toLowerCase(), titleEn, clip(f.get("title_bn"), 200), clip(f.get("summary_en"), 600), clip(f.get("summary_bn"), 600),
    clip(f.get("body_en"), 60000), clip(f.get("body_bn"), 60000), clip(f.get("author"), 80) || "ProcureBest", JSON.stringify(refs),
    f.get("status") === "published" ? "published" : "draft", date, nowIso()];
  let id;
  if (isNew) id = (await run(c.env, `INSERT INTO posts(slug,category,title_en,title_bn,summary_en,summary_bn,body_en,body_bn,author,refs_json,status,published_at,updated_at,section) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, ...vals, section)).meta.last_row_id;
  else { await run(c.env, `UPDATE posts SET slug=?,category=?,title_en=?,title_bn=?,summary_en=?,summary_bn=?,body_en=?,body_bn=?,author=?,refs_json=?,status=?,published_at=?,updated_at=? WHERE id=?`, ...vals, old.id); id = old.id; }
  return c.redirect(back(`/admin/posts/${id}`, "saved"));
}
async function postDelete(c) {
  const p = await one(c.env, "SELECT section FROM posts WHERE id=?", toInt(c.params.id));
  await run(c.env, "DELETE FROM posts WHERE id=?", toInt(c.params.id));
  return c.redirect(back(`/admin/posts?section=${p ? p.section : "blog"}`, "deleted"));
}

// ------------------------------------------------------------------ glossary
async function glossaryList(c) {
  const edit = c.url.searchParams.get("edit");
  const rows = await all(c.env, "SELECT * FROM glossary ORDER BY LOWER(term_en)");
  const cur = edit === "new" ? { status: "published" } : edit ? rows.find((r) => String(r.id) === edit) : null;
  const form = cur ? html`<form method="post" action="/admin/glossary/${edit === "new" ? "new" : cur.id}" class="panel" style="margin-bottom:20px">${await csrfInput(c)}
    <h3>${edit === "new" ? c.L("New term", "নতুন শব্দ") : c.L("Edit term", "শব্দ এডিট")}</h3>
    <div class="form-grid">${fld("term_en", c.L("Term (English)", "শব্দ (ইংরেজি)"), cur.term_en, { required: true })}${fld("term_bn", c.L("Term (Bengali)", "শব্দ (বাংলা)"), cur.term_bn)}
    ${fld("def_en", c.L("Definition (English, Markdown)", "সংজ্ঞা (ইংরেজি, Markdown)"), cur.def_en, { rows: 4 })}${fld("def_bn", c.L("Definition (Bengali, Markdown)", "সংজ্ঞা (বাংলা, Markdown)"), cur.def_bn, { rows: 4 })}
    ${sel("status", c.L("Status", "অবস্থা"), cur.status, [["published", c.L("Published", "প্রকাশিত")], ["draft", c.L("Draft (hidden)", "খসড়া (লুকানো)")]], { third: true })}</div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">${c.L("Save", "সেভ করুন")}</button><a class="btn btn-ghost" href="/admin/glossary">${c.L("Cancel", "বাতিল")}</a></div></form>
    ${edit !== "new" ? html`<form method="post" action="/admin/glossary/${cur.id}/delete" style="margin:-8px 0 20px" data-confirm="${c.L("Delete this term?", "শব্দটি মুছবেন?")}">${await csrfInput(c)}<button class="btn btn-ghost btn-sm" style="color:var(--err)">${icon("trash", 15)} ${c.L("Delete term", "শব্দ মুছুন")}</button></form>` : ""}` : "";
  const body = html`${form}<div class="row between" style="margin-bottom:16px"><span class="small muted">${c.d(rows.length)} ${c.L("terms", "টি শব্দ")}</span><a class="btn btn-primary" href="/admin/glossary?edit=new">${icon("plus", 16)} ${c.L("New term", "নতুন শব্দ")}</a></div>
  <div class="table-wrap"><table><thead><tr><th>${c.L("Term", "শব্দ")}</th><th>${c.L("Definition", "সংজ্ঞা")}</th><th>${c.L("Status", "অবস্থা")}</th><th></th></tr></thead><tbody>
  ${rows.map((r) => html`<tr><td><strong>${r.term_en}</strong><div class="small muted">${r.term_bn}</div></td><td class="small">${(c.pick(r.def_en, r.def_bn) || "").slice(0, 140)}…</td><td>${statusTag(c, r.status)}</td><td class="num"><a class="btn btn-ghost btn-sm" href="/admin/glossary?edit=${r.id}">${c.L("Edit", "এডিট")}</a></td></tr>`)}</tbody></table></div>`;
  return adminLayout(c, { title: c.L("Glossary", "গ্লসারি"), body, active: "glossary" });
}
async function glossarySave(c) {
  const f = await c.form();
  const termEn = clip(f.get("term_en"), 150);
  if (!termEn) return c.redirect(errBack("/admin/glossary?edit=" + c.params.id, c.L("The English term is required.", "ইংরেজি শব্দ আবশ্যক।")));
  const vals = [termEn, clip(f.get("term_bn"), 150), clip(f.get("def_en"), 4000), clip(f.get("def_bn"), 4000), f.get("status") === "draft" ? "draft" : "published", nowIso()];
  if (c.params.id === "new") {
    let slug = slugify(termEn);
    if (await one(c.env, "SELECT id FROM glossary WHERE slug=?", slug)) slug += "-" + Date.now().toString(36).slice(-4);
    await run(c.env, "INSERT INTO glossary(term_en,term_bn,def_en,def_bn,status,updated_at,slug) VALUES (?,?,?,?,?,?,?)", ...vals, slug);
  } else await run(c.env, "UPDATE glossary SET term_en=?,term_bn=?,def_en=?,def_bn=?,status=?,updated_at=? WHERE id=?", ...vals, toInt(c.params.id));
  return c.redirect(back("/admin/glossary", "saved"));
}

// ------------------------------------------------------------------ exams & questions
async function examsAdmin(c) {
  const lvs = await all(c.env, "SELECT l.*, (SELECT COUNT(*) FROM questions q WHERE q.level_code=l.code AND q.status='published') AS published_q FROM exam_levels l ORDER BY sort");
  const csrf = await csrfInput(c);
  const body = html`<p class="small muted" style="margin-bottom:16px">${c.L("Each exam draws the set number of questions at random from its published questions. Put a price above 0 to make an exam paid; buyers get the number of attempts shown per payment.", "প্রতিটি পরীক্ষা তার প্রকাশিত প্রশ্ন থেকে নির্ধারিত সংখ্যক প্রশ্ন এলোমেলোভাবে নেয়। পরীক্ষা পেইড করতে মূল্য ০-এর বেশি দিন; প্রতি পেমেন্টে ক্রেতা নির্ধারিত সংখ্যকবার পরীক্ষা দিতে পারবেন।")}</p>
  ${lvs.map((lv) => html`<form method="post" action="/admin/exams/${lv.code}" class="panel" style="margin-bottom:18px">${csrf}
    <div class="row between"><h3 style="margin:0">${c.pick(lv.title_en, lv.title_bn)} <span class="tag">${lv.code}</span></h3>
      <span class="small ${lv.published_q < lv.question_count ? "" : "muted"}" style="${lv.published_q < lv.question_count ? "color:var(--err)" : ""}">${c.d(lv.published_q)} ${c.L("published questions", "প্রকাশিত প্রশ্ন")} · <a href="/admin/questions?level=${lv.code}">${c.L("Manage", "পরিচালনা")}</a></span></div>
    <div class="form-grid" style="margin-top:16px">
      ${fld("title_en", c.L("Name (English)", "নাম (ইংরেজি)"), lv.title_en, { third: true })}${fld("title_bn", c.L("Name (Bengali)", "নাম (বাংলা)"), lv.title_bn, { third: true })}
      ${sel("published", c.L("Visible", "দেখানো হবে"), lv.published, [[1, c.L("Yes", "হ্যাঁ")], [0, c.L("No (hidden)", "না (লুকানো)")]], { third: true })}
      ${fld("desc_en", c.L("Description (English)", "বিবরণ (ইংরেজি)"), lv.desc_en, { rows: 2 })}${fld("desc_bn", c.L("Description (Bengali)", "বিবরণ (বাংলা)"), lv.desc_bn, { rows: 2 })}
      ${fld("question_count", c.L("Questions per exam", "প্রতি পরীক্ষায় প্রশ্ন"), lv.question_count, { type: "number", third: true, attrs: 'min="5" max="100"' })}
      ${fld("time_limit_min", c.L("Time limit (minutes)", "সময় (মিনিট)"), lv.time_limit_min, { type: "number", third: true, attrs: 'min="5" max="240"' })}
      ${fld("pass_mark", c.L("Pass mark (%)", "পাস নম্বর (%)"), lv.pass_mark, { type: "number", third: true, attrs: 'min="1" max="100"' })}
      ${fld("price", c.L("Price in taka (0 = free)", "মূল্য টাকায় (০ = ফ্রি)"), lv.price, { type: "number", third: true, attrs: 'min="0"' })}
      ${fld("attempts_per_purchase", c.L("Attempts per payment (paid exams)", "প্রতি পেমেন্টে কতবার (পেইড)"), lv.attempts_per_purchase, { type: "number", third: true, attrs: 'min="1" max="20"' })}
      ${fld("free_attempts_per_day", c.L("Attempts per day (free exams)", "দিনে কতবার (ফ্রি)"), lv.free_attempts_per_day, { type: "number", third: true, attrs: 'min="1" max="20"' })}
    </div><div class="form-actions"><button class="btn btn-primary" type="submit">${c.L("Save", "সেভ করুন")}</button></div></form>`)}`;
  return adminLayout(c, { title: c.L("Exams", "পরীক্ষা"), body, active: "exams" });
}
async function examSave(c) {
  const f = await c.form();
  const n = (k, lo, hi, d) => Math.min(hi, Math.max(lo, toInt(f.get(k), d)));
  await run(c.env, `UPDATE exam_levels SET title_en=?, title_bn=?, desc_en=?, desc_bn=?, question_count=?, time_limit_min=?, pass_mark=?, price=?, attempts_per_purchase=?, free_attempts_per_day=?, published=? WHERE code=?`,
    clip(f.get("title_en"), 80) || c.params.code, clip(f.get("title_bn"), 80), clip(f.get("desc_en"), 600), clip(f.get("desc_bn"), 600),
    n("question_count", 5, 100, 20), n("time_limit_min", 5, 240, 25), n("pass_mark", 1, 100, 70), n("price", 0, 1000000, 0),
    n("attempts_per_purchase", 1, 20, 3), n("free_attempts_per_day", 1, 20, 2), f.get("published") === "0" ? 0 : 1, c.params.code);
  return c.redirect(back("/admin/exams", "saved"));
}

async function questionsList(c) {
  const lvs = await all(c.env, "SELECT code, title_en, title_bn FROM exam_levels ORDER BY sort");
  const level = lvs.some((l) => l.code === c.url.searchParams.get("level")) ? c.url.searchParams.get("level") : "";
  const q = clip(c.url.searchParams.get("q"), 80);
  const page = Math.max(1, toInt(c.url.searchParams.get("page"), 1));
  const where = [], args = [];
  if (level) { where.push("level_code=?"); args.push(level); }
  if (q) { where.push("(text_en LIKE ? OR text_bn LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = Number(await scalar(c.env, `SELECT COUNT(*) FROM questions ${w}`, ...args));
  const rows = await all(c.env, `SELECT id, level_code, topic, text_en, text_bn, status FROM questions ${w} ORDER BY id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, ...args);
  const base = `/admin/questions?level=${level}&q=${encodeURIComponent(q)}`;
  const body = html`<form class="adm-filters" method="get">
    <select name="level"><option value="">${c.L("All levels", "সব স্তর")}</option>${lvs.map((l) => html`<option value="${l.code}" ${l.code === level ? raw("selected") : ""}>${c.pick(l.title_en, l.title_bn)}</option>`)}</select>
    <input type="search" name="q" value="${q}" placeholder="${c.L("Search question text", "প্রশ্নের লেখায় খুঁজুন")}"><button class="btn btn-ghost btn-sm" type="submit">${icon("search", 15)}</button>
    <span style="flex:1"></span>
    <a class="btn btn-ghost btn-sm" href="/admin/questions/export?level=${level}">${icon("download", 15)} CSV</a>
    <a class="btn btn-ghost btn-sm" href="/admin/questions/import">${icon("upload", 15)} ${c.L("Import CSV", "CSV ইমপোর্ট")}</a>
    <a class="btn btn-primary btn-sm" href="/admin/questions/new${level ? "?level=" + level : ""}">${icon("plus", 15)} ${c.L("New question", "নতুন প্রশ্ন")}</a></form>
  <p class="small muted">${c.d(total)} ${c.L("questions", "টি প্রশ্ন")}</p>
  <div class="table-wrap"><table><thead><tr><th>#</th><th>${c.L("Question", "প্রশ্ন")}</th><th>${c.L("Level", "স্তর")}</th><th>${c.L("Topic", "বিষয়")}</th><th>${c.L("Status", "অবস্থা")}</th><th></th></tr></thead><tbody>
  ${rows.map((r) => html`<tr><td class="muted small">${r.id}</td><td>${(c.pick(r.text_en, r.text_bn) || "").slice(0, 120)}</td><td class="small">${r.level_code}</td><td class="small">${topicLabel(r.topic, c.lang)}</td><td>${statusTag(c, r.status)}</td>
    <td class="num"><a class="btn btn-ghost btn-sm" href="/admin/questions/${r.id}">${c.L("Edit", "এডিট")}</a></td></tr>`)}</tbody></table></div>${pager(c, page, total, base)}`;
  return adminLayout(c, { title: c.L("Question bank", "প্রশ্নব্যাংক"), body, active: "questions" });
}

async function questionEdit(c) {
  const isNew = c.params.id === "new";
  const lvs = await all(c.env, "SELECT code, title_en, title_bn FROM exam_levels ORDER BY sort");
  const q = isNew ? { level_code: c.url.searchParams.get("level") || "beginner", status: "published", options_json: "[]", correct_index: 0, topic: "" } : await one(c.env, "SELECT * FROM questions WHERE id=?", toInt(c.params.id));
  if (!q) throw new HttpError(404);
  const opts = parseJson(q.options_json, []);
  while (opts.length < 4) opts.push({ en: "", bn: "" });
  const body = html`<form method="post" action="/admin/questions/${isNew ? "new" : q.id}" class="panel">${await csrfInput(c)}
  <div class="form-grid">
    ${sel("level_code", c.L("Level", "স্তর"), q.level_code, lvs.map((l) => [l.code, c.pick(l.title_en, l.title_bn)]), { third: true })}
    <div class="field third"><label for="f-topic">${c.L("Topic", "বিষয়")}</label><input id="f-topic" name="topic" value="${q.topic}" list="topics"><datalist id="topics">${Object.keys(TOPICS).map((k) => html`<option value="${k}">${topicLabel(k, c.lang)}</option>`)}</datalist></div>
    ${sel("status", c.L("Status", "অবস্থা"), q.status, [["published", c.L("Published", "প্রকাশিত")], ["draft", c.L("Draft (not used)", "খসড়া (ব্যবহৃত হবে না)")]], { third: true })}
    ${fld("text_en", c.L("Question (English)", "প্রশ্ন (ইংরেজি)"), q.text_en, { rows: 3, required: true })}${fld("text_bn", c.L("Question (Bengali)", "প্রশ্ন (বাংলা)"), q.text_bn, { rows: 3 })}
  </div>
  <h3 style="margin-top:24px">${c.L("Options — tick the correct one", "বিকল্প — সঠিকটিতে টিক দিন")}</h3>
  <div class="stack">${opts.slice(0, 6).concat(opts.length < 6 ? Array(Math.max(0, 6 - opts.length)).fill({ en: "", bn: "" }) : []).slice(0, 6).map((o, i) => html`
    <div class="q-opt-row"><label class="check" title="${c.L("Correct answer", "সঠিক উত্তর")}"><input type="radio" name="correct" value="${i}" ${q.correct_index === i ? raw("checked") : ""}> <strong>${c.d(i + 1)}</strong></label>
    <input name="opt_en_${i}" value="${o.en || ""}" placeholder="${c.L("Option (English)", "বিকল্প (ইংরেজি)")}"><input name="opt_bn_${i}" value="${o.bn || ""}" placeholder="${c.L("Option (Bengali)", "বিকল্প (বাংলা)")}"></div>`)}</div>
  <p class="help" style="margin-top:8px">${c.L("At least 2 options. Empty rows are ignored. The order is shuffled for every candidate.", "কমপক্ষে ২টি বিকল্প। ফাঁকা সারি বাদ যাবে। প্রত্যেক পরীক্ষার্থীর জন্য ক্রম এলোমেলো হবে।")}</p>
  <div class="form-grid" style="margin-top:16px">${fld("explanation_en", c.L("Explanation (English, not shown to candidates)", "ব্যাখ্যা (ইংরেজি, পরীক্ষার্থীদের দেখানো হয় না)"), q.explanation_en, { rows: 2 })}${fld("explanation_bn", c.L("Explanation (Bengali)", "ব্যাখ্যা (বাংলা)"), q.explanation_bn, { rows: 2 })}</div>
  <div class="form-actions"><button class="btn btn-primary" type="submit">${c.L("Save", "সেভ করুন")}</button><a class="btn btn-ghost" href="/admin/questions?level=${q.level_code}">${c.L("Cancel", "বাতিল")}</a></div></form>
  ${!isNew ? html`<form method="post" action="/admin/questions/${q.id}/delete" style="margin-top:16px" data-confirm="${c.L("Delete this question? Past results are kept.", "প্রশ্নটি মুছবেন? আগের ফলাফল থেকে যাবে।")}">${await csrfInput(c)}<button class="btn btn-ghost btn-sm" style="color:var(--err)">${icon("trash", 15)} ${c.L("Delete question", "প্রশ্ন মুছুন")}</button></form>` : ""}`;
  return adminLayout(c, { title: isNew ? c.L("New question", "নতুন প্রশ্ন") : c.L(`Question #${q.id}`, `প্রশ্ন #${q.id}`), body, active: "questions" });
}

function questionFromForm(f) {
  const opts = [];
  let correct = -1;
  const chosen = toInt(f.get("correct"), -1);
  for (let i = 0; i < 6; i++) {
    const en = clip(f.get(`opt_en_${i}`), 400), bn = clip(f.get(`opt_bn_${i}`), 400);
    if (!en && !bn) continue;
    if (i === chosen) correct = opts.length;
    opts.push({ en: en || bn, bn });
  }
  return { opts, correct };
}
async function questionSave(c) {
  const f = await c.form();
  const textEn = clip(f.get("text_en"), 2000);
  const { opts, correct } = questionFromForm(f);
  const backTo = `/admin/questions/${c.params.id}`;
  if (!textEn) return c.redirect(errBack(backTo, c.L("The English question is required.", "ইংরেজি প্রশ্ন আবশ্যক।")));
  if (opts.length < 2) return c.redirect(errBack(backTo, c.L("Add at least two options.", "কমপক্ষে দুটি বিকল্প দিন।")));
  if (correct < 0) return c.redirect(errBack(backTo, c.L("Tick the correct option (it must not be empty).", "সঠিক বিকল্পে টিক দিন (সেটি ফাঁকা হতে পারবে না)।")));
  const level = await one(c.env, "SELECT code FROM exam_levels WHERE code=?", f.get("level_code"));
  const vals = [level ? level.code : "beginner", clip(f.get("topic"), 40).toLowerCase().replace(/\s+/g, "_"), textEn, clip(f.get("text_bn"), 2000), JSON.stringify(opts), correct,
    clip(f.get("explanation_en"), 2000), clip(f.get("explanation_bn"), 2000), f.get("status") === "draft" ? "draft" : "published", nowIso()];
  let id;
  if (c.params.id === "new") id = (await run(c.env, "INSERT INTO questions(level_code,topic,text_en,text_bn,options_json,correct_index,explanation_en,explanation_bn,status,updated_at,source) VALUES (?,?,?,?,?,?,?,?,?,?,'admin')", ...vals)).meta.last_row_id;
  else { id = toInt(c.params.id); await run(c.env, "UPDATE questions SET level_code=?,topic=?,text_en=?,text_bn=?,options_json=?,correct_index=?,explanation_en=?,explanation_bn=?,status=?,updated_at=? WHERE id=?", ...vals, id); }
  return c.redirect(back(`/admin/questions/${id}`, "saved"));
}

const CSV_HEAD = ["id", "level", "topic", "status", "question_en", "question_bn", "option1_en", "option1_bn", "option2_en", "option2_bn", "option3_en", "option3_bn", "option4_en", "option4_bn", "correct", "explanation_en", "explanation_bn"];
async function questionsExport(c) {
  const level = c.url.searchParams.get("level");
  const rows = await all(c.env, `SELECT * FROM questions ${level ? "WHERE level_code=?" : ""} ORDER BY level_code, id`, ...(level ? [level] : []));
  const out = [CSV_HEAD, ...rows.map((q) => {
    const o = parseJson(q.options_json, []);
    const cells = [q.id, q.level_code, q.topic, q.status, q.text_en, q.text_bn];
    for (let i = 0; i < 4; i++) cells.push(o[i] ? o[i].en : "", o[i] ? o[i].bn : "");
    return [...cells, q.correct_index + 1, q.explanation_en, q.explanation_bn];
  })];
  return new Response(toCsv(out), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="procurebest-questions${level ? "-" + level : ""}.csv"` } });
}
async function questionsImportPage(c, report = null) {
  const body = html`<div class="panel" style="margin-bottom:20px">
    <p>${c.L("Upload a CSV file with these columns (export the current bank to get a ready template). Rows with an id update that question; rows without an id are added. Questions can be written in Excel and saved as \"CSV UTF-8\".", "এই কলামগুলো সহ একটি CSV ফাইল আপলোড করুন (তৈরি টেমপ্লেট পেতে বর্তমান প্রশ্নব্যাংক এক্সপোর্ট করুন)। id থাকা সারি সেই প্রশ্ন আপডেট করবে; id ছাড়া সারি নতুন যোগ হবে। এক্সেলে লিখে \"CSV UTF-8\" হিসেবে সেভ করুন।")}</p>
    <p class="mono small" style="word-break:break-all">${CSV_HEAD.join(", ")}</p>
    <p class="small muted">${c.L("level = beginner, experienced or expert · correct = 1–4 · status = published or draft · options 3 and 4 may be empty.", "level = beginner, experienced বা expert · correct = ১–৪ · status = published বা draft · ৩ ও ৪ নম্বর বিকল্প ফাঁকা থাকতে পারে।")}</p>
    <form method="post" action="/admin/questions/import" enctype="multipart/form-data" style="margin-top:16px">${await csrfInput(c)}
      <input type="file" name="csv" accept=".csv,text/csv" required> <button class="btn btn-primary" type="submit">${icon("upload", 16)} ${c.L("Import", "ইমপোর্ট")}</button></form></div>
  ${report ? html`<div class="panel"><h3>${c.L("Result", "ফলাফল")}</h3><p>${c.L(`Added ${report.added}, updated ${report.updated}, skipped ${report.errors.length}.`, `যোগ হয়েছে ${report.added}, আপডেট ${report.updated}, বাদ ${report.errors.length}।`)}</p>
    ${report.errors.length ? html`<ul class="small">${report.errors.slice(0, 50).map((e) => html`<li>${c.L("Line", "লাইন")} ${e.line}: ${e.msg}</li>`)}</ul>` : ""}</div>` : ""}`;
  return adminLayout(c, { title: c.L("Import questions", "প্রশ্ন ইমপোর্ট"), body, active: "questions" });
}
async function questionsImport(c) {
  const f = await c.form();
  const file = f.get("csv");
  if (!file || typeof file === "string") return questionsImportPage(c, { added: 0, updated: 0, errors: [{ line: 0, msg: "No file" }] });
  const rows = parseCsv(await file.text());
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(CSV_HEAD.map((h) => [h, head.indexOf(h)]));
  const levelsOk = (await all(c.env, "SELECT code FROM exam_levels")).map((l) => l.code);
  const report = { added: 0, updated: 0, errors: [] };
  const inserts = [], updates = [];
  if (rows.length > 300) report.errors.push({ line: 302, msg: c.L("Only the first 300 rows are imported at a time. Split larger files.", "একবারে প্রথম ৩০০টি সারি ইমপোর্ট হয়। বড় ফাইল ভাগ করে দিন।") });
  rows.slice(0, 300).forEach((r, n) => {
    const g = (k) => (idx[k] >= 0 ? String(r[idx[k]] ?? "").trim() : "");
    const line = n + 2;
    const level = g("level").toLowerCase();
    if (!levelsOk.includes(level)) { report.errors.push({ line, msg: "level" }); return; }
    if (!g("question_en")) { report.errors.push({ line, msg: "question_en" }); return; }
    const opts = [];
    for (let i = 1; i <= 4; i++) { const en = g(`option${i}_en`), bn = g(`option${i}_bn`); if (en || bn) opts.push({ en: en || bn, bn }); }
    const correct = toInt(g("correct"), 0) - 1;
    if (opts.length < 2 || correct < 0 || correct >= opts.length) { report.errors.push({ line, msg: "options / correct" }); return; }
    const vals = [level, g("topic").toLowerCase().replace(/\s+/g, "_"), g("question_en").slice(0, 2000), g("question_bn").slice(0, 2000), JSON.stringify(opts), correct,
      g("explanation_en").slice(0, 2000), g("explanation_bn").slice(0, 2000), g("status") === "draft" ? "draft" : "published", nowIso()];
    const id = toInt(g("id"), 0);
    if (id) { updates.push([id, ...vals]); report.updated++; } else { inserts.push([...vals, "csv"]); report.added++; }
  });
  // Many rows per statement keeps a 300-row import far below the free plan's per-request query limit.
  const COLS = ["level_code", "topic", "text_en", "text_bn", "options_json", "correct_index", "explanation_en", "explanation_bn", "status", "updated_at"];
  const stmts = [];
  for (let i = 0; i < inserts.length; i += 9) {
    const chunk = inserts.slice(i, i + 9);
    stmts.push(c.env.DB.prepare(`INSERT INTO questions(${COLS.join(",")},source) VALUES ${chunk.map(() => "(" + Array(11).fill("?").join(",") + ")").join(",")}`).bind(...chunk.flat()));
  }
  for (let i = 0; i < updates.length; i += 9) {
    const chunk = updates.slice(i, i + 9);
    stmts.push(c.env.DB.prepare(`WITH v(id,${COLS.join(",")}) AS (VALUES ${chunk.map(() => "(" + Array(11).fill("?").join(",") + ")").join(",")})
      UPDATE questions SET ${COLS.map((k) => `${k}=v.${k}`).join(",")} FROM v WHERE questions.id=v.id`).bind(...chunk.flat()));
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return questionsImportPage(c, report);
}

// ------------------------------------------------------------------ orders
async function ordersList(c) {
  const status = ["pending", "approved", "rejected", "all"].includes(c.url.searchParams.get("status")) ? c.url.searchParams.get("status") : "pending";
  const page = Math.max(1, toInt(c.url.searchParams.get("page"), 1));
  const w = status === "all" ? "" : "WHERE status=?";
  const args = status === "all" ? [] : [status];
  const total = Number(await scalar(c.env, `SELECT COUNT(*) FROM orders ${w}`, ...args));
  const rows = await all(c.env, `SELECT * FROM orders ${w} ORDER BY id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, ...args);
  const csrf = await csrfInput(c);
  const problems = await all(c.env, "SELECT * FROM events WHERE kind='problem' AND created_at >= ? ORDER BY id DESC LIMIT 15", isoPlus(-7 * DAY));
  const problemPanel = problems.length ? html`<details class="panel" style="margin-top:20px" ${status === "pending" && !rows.length ? raw("open") : ""}>
    <summary style="cursor:pointer"><strong>${c.L("Orders and emails that did not go through (last 7 days)", "যেসব অর্ডার ও ইমেইল জমা পড়েনি (গত ৭ দিন)")}</strong> <span class="tag warn">${c.d(problems.length)}</span></summary>
    <p class="small muted" style="margin-top:10px">${c.L("These are attempts the site refused or could not finish, with the reason. They are not orders — nothing needs approving.", "সাইট যেসব চেষ্টা গ্রহণ করেনি বা শেষ করতে পারেনি, কারণসহ। এগুলো অর্ডার নয় — অনুমোদনের কিছু নেই।")}</p>
    <div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>${c.L("When", "কখন")}</th><th>${c.L("Email", "ইমেইল")}</th><th>${c.L("What", "কী")}</th><th>${c.L("Reason", "কারণ")}</th></tr></thead><tbody>
    ${problems.map((p) => html`<tr><td class="small">${c.date(p.created_at, true)}</td><td class="small">${p.email || "—"}</td><td class="small">${p.ref}</td><td class="small">${p.detail}</td></tr>`)}</tbody></table></div></details>` : "";
  const body = html`<div class="chips" style="margin-bottom:16px">${["pending", "approved", "rejected", "all"].map((s) => html`<a class="chip ${status === s ? "on" : ""}" href="/admin/orders?status=${s}">${s === "all" ? c.L("All", "সব") : statusLabel(c, s)}</a>`)}</div>
  ${status === "pending" ? html`<div class="alert alert-info" style="margin-bottom:16px">${icon("info", 18)}<div>${c.L("Open your bKash / Nagad app, find a payment with the same Transaction ID, sender number and amount, then approve. Approval gives the buyer access and sends an email.", "আপনার bKash / Nagad অ্যাপ খুলে একই Transaction ID, প্রেরকের নম্বর ও পরিমাণের পেমেন্ট খুঁজুন, তারপর অনুমোদন দিন। অনুমোদন দিলে ক্রেতা অ্যাক্সেস পাবেন এবং ইমেইল যাবে।")}</div></div>` : ""}
  <div class="table-wrap"><table><thead><tr><th>${c.L("Order", "অর্ডার")}</th><th>${c.L("Buyer", "ক্রেতা")}</th><th>${c.L("Item", "আইটেম")}</th><th class="num">${c.L("Amount", "পরিমাণ")}</th><th>${c.L("Payment", "পেমেন্ট")}</th><th>${c.L("Status", "অবস্থা")}</th><th style="min-width:230px"></th></tr></thead><tbody>
  ${rows.length ? rows.map((o) => html`<tr><td class="small"><span class="mono">${o.ref}</span><div class="tiny muted">${c.date(o.created_at, true)}</div></td>
    <td class="small">${o.name}<div class="tiny muted">${o.email}${o.phone ? " · " + o.phone : ""}</div></td>
    <td class="small">${o.item_title}<div class="tiny muted">${o.item_type}: ${o.item_ref}</div></td><td class="num"><strong>${c.money(o.amount)}</strong></td>
    <td class="small"><strong>${o.method === "bkash" ? "bKash" : "Nagad"}</strong><div class="mono">${o.trx_id}</div><div class="tiny muted">${o.sender}</div></td>
    <td>${statusTag(c, o.status)}${o.admin_note ? html`<div class="tiny muted">${o.admin_note}</div>` : ""}</td>
    <td>${o.status === "pending" ? html`<form method="post" action="/admin/orders/${o.id}/approve" class="inline-form" style="margin-bottom:6px">${csrf}<button class="btn btn-primary btn-sm" type="submit">${icon("check", 14)} ${c.L("Approve", "অনুমোদন")}</button></form>
      <form method="post" action="/admin/orders/${o.id}/reject" class="inline-form">${csrf}<input name="note" placeholder="${c.L("Reason (sent to buyer)", "কারণ (ক্রেতাকে পাঠানো হবে)")}" style="min-height:34px;padding:6px 10px;font-size:13px;width:150px"><button class="btn btn-ghost btn-sm" type="submit">${c.L("Reject", "বাতিল")}</button></form>` : ""}</td></tr>`)
    : html`<tr><td colspan="7" class="muted">${c.L("No orders here.", "এখানে কোনো অর্ডার নেই।")}</td></tr>`}</tbody></table></div>${pager(c, page, total, `/admin/orders?status=${status}`)}${problemPanel}`;
  return adminLayout(c, { title: c.L("Orders", "অর্ডার"), body, active: "orders" });
}
async function orderDecide(c) {
  const f = await c.form();
  const s = await c.settings();
  const note = clip(f.get("note"), 300);
  const id = toInt(c.params.id);
  if (c.params.action === "approve") {
    const r = await approveOrder(c.env, s, c.siteUrl, id, note);
    return c.redirect(back("/admin/orders", r.mailed ? "approved" : "approved_nomail"));
  }
  await rejectOrder(c.env, s, c.siteUrl, id, note);
  return c.redirect(back("/admin/orders", "rejected"));
}

// ------------------------------------------------------------------ emails, activity, certificates, messages
function emailFilter(c) {
  const q = clip(c.url.searchParams.get("q"), 80).toLowerCase();
  const filter = c.url.searchParams.get("filter") || "";
  const where = [], args = [];
  if (q) { where.push("(email LIKE ? OR LOWER(COALESCE(name,'')) LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  if (filter === "verified") where.push("verified_at IS NOT NULL");
  if (filter === "subscribed") where.push("subscribed=1");
  if (filter === "buyers") where.push("email IN (SELECT email FROM orders WHERE status='approved')");
  return { q, filter, w: where.length ? "WHERE " + where.join(" AND ") : "", args };
}
async function emailsList(c) {
  const { q, filter, w, args } = emailFilter(c);
  const page = Math.max(1, toInt(c.url.searchParams.get("page"), 1));
  const total = Number(await scalar(c.env, `SELECT COUNT(*) FROM emails ${w}`, ...args));
  const rows = await all(c.env, `SELECT * FROM emails ${w} ORDER BY last_seen DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, ...args);
  const qs = `q=${encodeURIComponent(q)}&filter=${filter}`;
  const body = html`<form class="adm-filters" method="get"><input type="search" name="q" value="${q}" placeholder="${c.L("Search email or name", "ইমেইল বা নাম খুঁজুন")}">
    <select name="filter"><option value="">${c.L("Everyone", "সবাই")}</option><option value="verified" ${filter === "verified" ? raw("selected") : ""}>${c.L("Verified", "যাচাইকৃত")}</option>
    <option value="subscribed" ${filter === "subscribed" ? raw("selected") : ""}>${c.L("Newsletter subscribers", "নিউজলেটার গ্রাহক")}</option><option value="buyers" ${filter === "buyers" ? raw("selected") : ""}>${c.L("Buyers", "ক্রেতা")}</option></select>
    <button class="btn btn-ghost btn-sm" type="submit">${icon("search", 15)}</button><span style="flex:1"></span>
    <a class="btn btn-primary btn-sm" href="/admin/emails/export?${qs}">${icon("download", 15)} ${c.L("Download CSV (Excel)", "CSV ডাউনলোড (এক্সেল)")}</a></form>
  <p class="small muted">${c.d(total)} ${c.L("addresses", "টি ঠিকানা")}</p>
  <div class="table-wrap"><table><thead><tr><th>${c.L("Email", "ইমেইল")}</th><th>${c.L("Name", "নাম")}</th><th>${c.L("Verified", "যাচাই")}</th><th>${c.L("Newsletter", "নিউজলেটার")}</th><th class="num">${c.L("Downloads", "ডাউনলোড")}</th><th>${c.L("Source", "উৎস")}</th><th>${c.L("Last seen", "শেষ দেখা")}</th></tr></thead><tbody>
  ${rows.map((e) => html`<tr><td>${e.email}</td><td class="small">${e.name || ""}</td><td>${e.verified_at ? html`<span class="tag ok">${icon("check", 12)}</span>` : html`<span class="tag">—</span>`}</td>
    <td>${e.subscribed ? html`<span class="tag ok">${icon("check", 12)}</span>` : ""}</td><td class="num">${c.num(e.downloads)}</td><td class="small">${e.source}</td><td class="small">${c.date(e.last_seen)}</td></tr>`)}</tbody></table></div>${pager(c, page, total, `/admin/emails?${qs}`)}`;
  return adminLayout(c, { title: c.L("Email list", "ইমেইল তালিকা"), body, active: "emails" });
}
async function emailsExport(c) {
  const { w, args } = emailFilter(c);
  const rows = await all(c.env, `SELECT * FROM emails ${w} ORDER BY first_seen`, ...args);
  const out = [["email", "name", "verified_at", "subscribed", "downloads", "source", "language", "first_seen", "last_seen"],
    ...rows.map((e) => [e.email, e.name || "", e.verified_at || "", e.subscribed ? "yes" : "no", e.downloads, e.source, e.lang, e.first_seen, e.last_seen])];
  return new Response(toCsv(out), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="procurebest-emails-${nowIso().slice(0, 10)}.csv"` } });
}

async function activityList(c) {
  const kind = ["download", "calc_export"].includes(c.url.searchParams.get("kind")) ? c.url.searchParams.get("kind") : "";
  const page = Math.max(1, toInt(c.url.searchParams.get("page"), 1));
  const w = kind ? "WHERE kind=?" : "";
  const args = kind ? [kind] : [];
  const total = Number(await scalar(c.env, `SELECT COUNT(*) FROM events ${w}`, ...args));
  const rows = await all(c.env, `SELECT * FROM events ${w} ORDER BY id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, ...args);
  const top = await all(c.env, "SELECT ref, COUNT(*) AS n FROM events WHERE kind='download' GROUP BY ref ORDER BY n DESC LIMIT 8");
  const kindLabel = { download: c.L("Library download", "লাইব্রেরি ডাউনলোড"), calc_export: c.L("Calculator report", "ক্যালকুলেটর রিপোর্ট") };
  const body = html`<div class="grid grid-2" style="margin-bottom:20px"><div class="panel"><h3>${c.L("Most downloaded", "সবচেয়ে বেশি ডাউনলোড")}</h3>
    ${top.length ? html`<ul class="details-list">${top.map((t) => html`<li><span>${t.ref}</span><span>${c.num(t.n)}</span></li>`)}</ul>` : html`<p class="muted small">—</p>`}</div></div>
  <div class="chips" style="margin-bottom:12px"><a class="chip ${kind ? "" : "on"}" href="/admin/activity">${c.L("All", "সব")}</a><a class="chip ${kind === "download" ? "on" : ""}" href="/admin/activity?kind=download">${kindLabel.download}</a><a class="chip ${kind === "calc_export" ? "on" : ""}" href="/admin/activity?kind=calc_export">${kindLabel.calc_export}</a></div>
  <div class="table-wrap"><table><thead><tr><th>${c.L("When", "কখন")}</th><th>${c.L("What", "কী")}</th><th>${c.L("Email", "ইমেইল")}</th><th>${c.L("Item", "আইটেম")}</th></tr></thead><tbody>
  ${rows.map((e) => html`<tr><td class="small">${c.date(e.created_at, true)}</td><td class="small">${kindLabel[e.kind] || e.kind}</td><td class="small">${e.email || ""}</td><td class="small">${e.ref || ""} <span class="muted">${e.detail || ""}</span></td></tr>`)}</tbody></table></div>${pager(c, page, total, `/admin/activity?kind=${kind}`)}`;
  return adminLayout(c, { title: c.L("Downloads & activity", "ডাউনলোড ও কার্যক্রম"), body, active: "activity" });
}

async function certificatesList(c) {
  const q = clip(c.url.searchParams.get("q"), 80);
  const page = Math.max(1, toInt(c.url.searchParams.get("page"), 1));
  const w = q ? "WHERE c.code LIKE ? OR c.email LIKE ? OR c.name LIKE ?" : "";
  const args = q ? [`%${q.toUpperCase()}%`, `%${q.toLowerCase()}%`, `%${q}%`] : [];
  const total = Number(await scalar(c.env, `SELECT COUNT(*) FROM certificates c ${w}`, ...args));
  const rows = await all(c.env, `SELECT c.*, l.title_en, l.title_bn FROM certificates c LEFT JOIN exam_levels l ON l.code=c.level_code ${w} ORDER BY issued_at DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, ...args);
  const stats = await all(c.env, "SELECT l.code, l.title_en, l.title_bn, COUNT(a.id) AS n, SUM(a.passed) AS p FROM exam_levels l LEFT JOIN attempts a ON a.level_code=l.code AND a.submitted_at IS NOT NULL GROUP BY l.code ORDER BY l.sort");
  const csrf = await csrfInput(c);
  const body = html`<div class="grid grid-3" style="margin-bottom:20px">${stats.map((s) => html`<div class="metric"><div class="v">${c.d(s.n || 0)}</div><div class="l">${c.pick(s.title_en, s.title_bn)} — ${c.L("attempts", "বার")} · ${c.L("passed", "পাস")} ${c.d(s.p || 0)}</div></div>`)}</div>
  <form class="adm-filters" method="get"><input type="search" name="q" value="${q}" placeholder="${c.L("Code, email or name", "কোড, ইমেইল বা নাম")}"><button class="btn btn-ghost btn-sm" type="submit">${icon("search", 15)}</button></form>
  <div class="table-wrap"><table><thead><tr><th>${c.L("Certificate", "সার্টিফিকেট")}</th><th>${c.L("Name", "নাম")}</th><th>${c.L("Level", "স্তর")}</th><th class="num">${c.L("Score", "নম্বর")}</th><th>${c.L("Issued", "ইস্যু")}</th><th>${c.L("Status", "অবস্থা")}</th><th></th></tr></thead><tbody>
  ${rows.length ? rows.map((x) => html`<tr><td class="mono small"><a href="/${c.lang}/certificates/${x.code}" target="_blank">${x.code}</a></td><td class="small">${x.name}<div class="tiny muted">${x.email}</div></td><td class="small">${c.pick(x.title_en, x.title_bn)}</td>
    <td class="num">${c.pct(x.score_pct, 1)}</td><td class="small">${c.date(x.issued_at)}</td><td>${statusTag(c, x.status)}${x.revoke_reason ? html`<div class="tiny muted">${x.revoke_reason}</div>` : ""}</td>
    <td>${x.status === "valid" ? html`<form method="post" action="/admin/certificates/${x.code}/revoke" class="inline-form" data-confirm="${c.L("Revoke this certificate?", "এই সার্টিফিকেট বাতিল করবেন?")}">${csrf}<input name="reason" required placeholder="${c.L("Reason", "কারণ")}" style="min-height:34px;padding:6px 10px;font-size:13px;width:130px"><button class="btn btn-ghost btn-sm">${c.L("Revoke", "বাতিল")}</button></form>`
      : html`<form method="post" action="/admin/certificates/${x.code}/reinstate" class="inline-form">${csrf}<button class="btn btn-ghost btn-sm">${c.L("Reinstate", "আবার বৈধ")}</button></form>`}</td></tr>`)
    : html`<tr><td colspan="7" class="muted">${c.L("No certificates yet.", "এখনো কোনো সার্টিফিকেট নেই।")}</td></tr>`}</tbody></table></div>${pager(c, page, total, `/admin/certificates?q=${encodeURIComponent(q)}`)}`;
  return adminLayout(c, { title: c.L("Certificates", "সার্টিফিকেট"), body, active: "certificates" });
}
async function certificateAction(c) {
  const f = await c.form();
  if (c.params.action === "revoke") await run(c.env, "UPDATE certificates SET status='revoked', revoked_at=?, revoke_reason=? WHERE code=?", nowIso(), clip(f.get("reason"), 200) || "—", c.params.code);
  else await run(c.env, "UPDATE certificates SET status='valid', revoked_at=NULL, revoke_reason=NULL WHERE code=?", c.params.code);
  return c.redirect(back("/admin/certificates", c.params.action === "revoke" ? "revoked" : "reinstated"));
}

async function messagesList(c) {
  const rows = await all(c.env, "SELECT * FROM messages ORDER BY id DESC LIMIT 100");
  const csrf = await csrfInput(c);
  const body = rows.length ? html`<div class="stack">${rows.map((m) => html`<div class="panel" style="${m.read_at ? "opacity:.75" : ""}">
    <div class="row between"><div><strong>${m.name}</strong> · <a href="mailto:${m.email}?subject=${encodeURIComponent("Re: " + (m.subject || "ProcureBest"))}">${m.email}</a> <span class="tiny muted">${c.date(m.created_at, true)}</span></div>
      <div class="row" style="gap:6px">${!m.read_at ? html`<form method="post" action="/admin/messages/${m.id}/read">${csrf}<button class="btn btn-ghost btn-sm">${icon("check", 14)} ${c.L("Mark read", "পড়া হয়েছে")}</button></form>` : ""}
        <form method="post" action="/admin/messages/${m.id}/delete" data-confirm="${c.L("Delete this message?", "বার্তাটি মুছবেন?")}">${csrf}<button class="btn btn-ghost btn-sm">${icon("trash", 14)}</button></form></div></div>
    ${m.subject ? html`<h3 style="margin-top:10px;font-size:17px">${m.subject}</h3>` : ""}<p style="white-space:pre-wrap;margin-top:8px">${m.body}</p></div>`)}</div>`
    : html`<p class="empty">${c.L("No messages yet.", "এখনো কোনো বার্তা নেই।")}</p>`;
  return adminLayout(c, { title: c.L("Messages", "বার্তা"), body, active: "messages" });
}
async function messageAction(c) {
  const id = toInt(c.params.id);
  if (c.params.action === "read") await run(c.env, "UPDATE messages SET read_at=? WHERE id=?", nowIso(), id);
  else await run(c.env, "DELETE FROM messages WHERE id=?", id);
  return c.redirect(back("/admin/messages", c.params.action === "read" ? "read" : "deleted"));
}

// ------------------------------------------------------------------ settings
async function settingsPage(c) {
  const s = await c.settings();
  const mailOk = mailConfigured(c.env, s);
  const csrf = await csrfInput(c);
  const section = (title, note, content) => html`<div class="form-section"><h3>${title}</h3>${note ? html`<p class="help">${note}</p>` : html`<div style="height:12px"></div>`}<div class="form-grid">${content}</div></div>`;
  const body = html`<form method="post" action="/admin/settings" class="panel">${csrf}
  ${section(c.L("Homepage & site text", "হোমপেজ ও সাইটের লেখা"), "", html`
    ${fld("tagline_en", c.L("Tagline (English)", "ট্যাগলাইন (ইংরেজি)"), s.tagline_en)}${fld("tagline_bn", c.L("Tagline (Bengali)", "ট্যাগলাইন (বাংলা)"), s.tagline_bn)}
    ${fld("hero_title_en", c.L("Homepage headline (English)", "হোমপেজের শিরোনাম (ইংরেজি)"), s.hero_title_en)}${fld("hero_title_bn", c.L("Homepage headline (Bengali)", "হোমপেজের শিরোনাম (বাংলা)"), s.hero_title_bn)}
    ${fld("hero_subtitle_en", c.L("Homepage sub-headline (English)", "হোমপেজের উপশিরোনাম (ইংরেজি)"), s.hero_subtitle_en, { rows: 2 })}${fld("hero_subtitle_bn", c.L("Homepage sub-headline (Bengali)", "হোমপেজের উপশিরোনাম (বাংলা)"), s.hero_subtitle_bn, { rows: 2 })}
    ${fld("seo_description_en", c.L("Search engine description (English)", "সার্চ ইঞ্জিনের বিবরণ (ইংরেজি)"), s.seo_description_en, { rows: 2 })}${fld("seo_description_bn", c.L("Search engine description (Bengali)", "সার্চ ইঞ্জিনের বিবরণ (বাংলা)"), s.seo_description_bn, { rows: 2 })}
    ${sel("default_lang", c.L("Language when someone opens the bare domain", "শুধু ডোমেইন খুললে কোন ভাষা"), s.default_lang, [["en", "English"], ["bn", "বাংলা"]], { third: true })}`)}
  ${section(c.L("Payments (bKash / Nagad)", "পেমেন্ট (bKash / Nagad)"), c.L("Buyers see these numbers and send money with \"Send Money\". Leave a number empty to hide that method.", "ক্রেতারা এই নম্বরগুলো দেখে \"Send Money\" করবেন। কোনো নম্বর ফাঁকা রাখলে সেই পদ্ধতি লুকানো থাকবে।"), html`
    ${fld("pay_bkash_number", c.L("bKash number", "bKash নম্বর"), s.pay_bkash_number, { third: true, attrs: 'placeholder="01XXXXXXXXX"' })}
    ${sel("pay_bkash_type", c.L("bKash account type", "bKash অ্যাকাউন্টের ধরন"), s.pay_bkash_type, [["Personal", "Personal"], ["Merchant", "Merchant"], ["Agent", "Agent"]], { third: true })}<div class="field third"></div>
    ${fld("pay_nagad_number", c.L("Nagad number", "Nagad নম্বর"), s.pay_nagad_number, { third: true, attrs: 'placeholder="01XXXXXXXXX"' })}
    ${sel("pay_nagad_type", c.L("Nagad account type", "Nagad অ্যাকাউন্টের ধরন"), s.pay_nagad_type, [["Personal", "Personal"], ["Merchant", "Merchant"], ["Agent", "Agent"]], { third: true })}<div class="field third"></div>
    ${fld("pay_note_en", c.L("Payment instructions (English)", "পেমেন্টের নির্দেশনা (ইংরেজি)"), s.pay_note_en, { rows: 3 })}${fld("pay_note_bn", c.L("Payment instructions (Bengali)", "পেমেন্টের নির্দেশনা (বাংলা)"), s.pay_note_bn, { rows: 3 })}`)}
  ${section(c.L("WhatsApp group", "WhatsApp গ্রুপ"), c.L("On your phone: group → Group info → Invite via link → Copy link. It looks like https://chat.whatsapp.com/AbC123…", "ফোনে: গ্রুপ → Group info → Invite via link → Copy link। দেখতে এমন: https://chat.whatsapp.com/AbC123…"), html`
    ${fld("whatsapp_url", c.L("Invite link", "ইনভাইট লিংক"), s.whatsapp_url, { full: true, attrs: 'placeholder="https://chat.whatsapp.com/…"' })}
    ${sel("whatsapp_enabled", c.L("Show the button", "বাটন দেখান"), s.whatsapp_enabled, [["1", c.L("Yes", "হ্যাঁ")], ["0", c.L("No", "না")]], { third: true })}<div class="field third"></div><div class="field third"></div>
    ${fld("whatsapp_label_en", c.L("Button text (English)", "বাটনের লেখা (ইংরেজি)"), s.whatsapp_label_en)}${fld("whatsapp_label_bn", c.L("Button text (Bengali)", "বাটনের লেখা (বাংলা)"), s.whatsapp_label_bn)}
    ${fld("whatsapp_note_en", c.L("Note under the button (English)", "বাটনের নিচের নোট (ইংরেজি)"), s.whatsapp_note_en)}${fld("whatsapp_note_bn", c.L("Note under the button (Bengali)", "বাটনের নিচের নোট (বাংলা)"), s.whatsapp_note_bn)}`)}
  ${section(c.L("Email", "ইমেইল"), mailOk ? c.L("Email sending is working: addresses are verified with a one-time link.", "ইমেইল পাঠানো চালু আছে: এককালীন লিংক দিয়ে ঠিকানা যাচাই হয়।")
    : c.L(`Not active yet${c.env.BREVO_API_KEY ? " — add the sender address below" : " — the BREVO_API_KEY secret is missing"}. Until then email addresses are collected without verification.`, `এখনো চালু হয়নি${c.env.BREVO_API_KEY ? " — নিচে প্রেরকের ঠিকানা দিন" : " — BREVO_API_KEY secret নেই"}। ততক্ষণ ইমেইল যাচাই ছাড়া সংগ্রহ হবে।`), html`
    ${fld("mail_from_email", c.L("Send emails from (verified in Brevo)", "যে ঠিকানা থেকে ইমেইল যাবে (Brevo-তে যাচাইকৃত)"), s.mail_from_email, { type: "email", attrs: 'placeholder="no-reply@procurebest.com"' })}
    ${fld("mail_from_name", c.L("Sender name", "প্রেরকের নাম"), s.mail_from_name)}
    ${fld("notify_email", c.L("Notify me about new orders and messages at", "নতুন অর্ডার ও বার্তার খবর পাঠান এই ঠিকানায়"), s.notify_email, { type: "email" })}`)}
  ${section(c.L("Contact details (shown on the Contact page)", "যোগাযোগের তথ্য (যোগাযোগ পাতায় দেখানো হয়)"), "", html`
    ${fld("contact_email", c.L("Email", "ইমেইল"), s.contact_email, { type: "email", third: true })}${fld("contact_phone", c.L("Phone", "ফোন"), s.contact_phone, { third: true })}${fld("contact_address", c.L("Address", "ঠিকানা"), s.contact_address, { third: true })}`)}
  <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">${c.L("Save settings", "সেটিংস সেভ করুন")}</button></div></form>
  <form method="post" action="/admin/settings/test-email" class="panel" style="margin-top:20px">${csrf}<h3>${c.L("Send a test email", "টেস্ট ইমেইল পাঠান")}</h3>
    <div class="row" style="margin-top:12px"><input type="email" name="to" required placeholder="you@example.com" style="max-width:320px" value="${s.notify_email || ""}"><button class="btn btn-secondary" type="submit" ${mailOk ? "" : raw("disabled")}>${icon("mail", 16)} ${c.L("Send", "পাঠান")}</button></div></form>
  <div class="panel" style="margin-top:20px"><h3>${c.L("Technical status", "কারিগরি অবস্থা")}</h3><ul class="details-list">
    <li><span>${c.L("Email service (BREVO_API_KEY)", "ইমেইল সেবা (BREVO_API_KEY)")}</span><span>${c.env.BREVO_API_KEY ? "✓" : "—"}</span></li>
    <li><span>${c.L("File storage", "ফাইল স্টোরেজ")}</span><span>${{ r2: "Cloudflare R2", kv: "Cloudflare KV", d1: c.L("Database (max 5 MB per file)", "ডাটাবেস (প্রতি ফাইল সর্বোচ্চ ৫ MB)") }[storageKind(c.env)]}</span></li>
    <li><span>${c.L("Site address", "সাইটের ঠিকানা")}</span><span>${c.siteUrl}</span></li>
    <li><span>${c.L("Session secret", "সেশন সিক্রেট")}</span><span>${c.env.SESSION_SECRET ? "SESSION_SECRET" : c.L("auto (stored in database)", "স্বয়ংক্রিয় (ডাটাবেসে রাখা)")}</span></li></ul></div>`;
  return adminLayout(c, { title: c.L("Settings", "সেটিংস"), body, active: "settings" });
}
async function settingsSave(c) {
  const f = await c.form();
  const values = {};
  for (const k of Object.keys(DEFAULTS)) if (f.has(k)) values[k] = clip(f.get(k), 2000);
  if (values.whatsapp_url && !WHATSAPP_RE.test(values.whatsapp_url)) return c.redirect(errBack("/admin/settings", c.L("The WhatsApp link must look like https://chat.whatsapp.com/XXXXXXXX", "WhatsApp লিংক এমন হতে হবে: https://chat.whatsapp.com/XXXXXXXX")));
  for (const k of ["pay_bkash_number", "pay_nagad_number"]) if (values[k]) values[k] = values[k].replace(/[\s-]/g, "");
  for (const k of ["mail_from_email", "notify_email", "contact_email"]) if (values[k] && !isEmail(values[k])) return c.redirect(errBack("/admin/settings", c.L("Check the email addresses.", "ইমেইল ঠিকানাগুলো যাচাই করুন।")));
  values.default_lang = values.default_lang === "bn" ? "bn" : "en";
  await saveSettings(c.env, values);
  return c.redirect(back("/admin/settings", "saved"));
}
async function testEmail(c) {
  const f = await c.form();
  const to = normEmail(f.get("to"));
  const s = await loadSettings(c.env);
  if (!isEmail(to)) return c.redirect(errBack("/admin/settings", c.L("Enter a valid email address.", "সঠিক ইমেইল ঠিকানা দিন।")));
  const mail = emailLayout({ title: "ProcureBest test email", paragraphs: ["If you can read this, email sending works.", "এটি পড়তে পারলে ইমেইল পাঠানো ঠিকমতো কাজ করছে।"], footer: "ProcureBest", siteUrl: c.siteUrl });
  const r = await sendMail(c.env, s, { to, subject: "ProcureBest test email", ...mail });
  return c.redirect(r.ok ? back("/admin/settings", "mail_ok") : errBack("/admin/settings", r.error || "failed"));
}

// ------------------------------------------------------------------ registration
export function registerAdmin(r) {
  // Admin pages use their own language cookie (default Bengali).
  const setLang = (c) => { const l = getCookie(c.req, "pb_admin_lang"); c.setLang(l === "en" ? "en" : "bn"); };
  const guard = (fn, { form = false, api = false } = {}) => async (c) => {
    setLang(c);
    if (!(await c.isAdmin())) return api ? c.json({ ok: false, error: "signed out" }, 401) : c.redirect("/admin/login");
    if (c.req.method !== "GET") {
      if (!c.sameOrigin()) return api ? c.json({ ok: false, error: "origin" }, 403) : new Response("Forbidden", { status: 403 });
      if (api) { if (!safeEqual(c.req.headers.get("X-CSRF") || "", await c.csrfToken())) return c.json({ ok: false, error: "csrf" }, 403); }
      else if (form && !(await c.checkCsrf(await c.form()))) return new Response("Your session expired. Go back, reload the page and try again.", { status: 403 });
    }
    return fn(c);
  };
  r.get("/admin/login", async (c) => { setLang(c); return (await c.isAdmin()) ? c.redirect("/admin") : loginPage(c); });
  r.post("/admin/login", async (c) => { setLang(c); return doLogin(c); });
  r.post("/admin/logout", guard(async (c) => { c.endAdmin(); return c.redirect("/admin/login"); }, { form: true }));
  r.get("/admin/lang/:l(en|bn)", async (c) => {
    c.cookies.push(cookie("pb_admin_lang", c.params.l, { maxAge: 365 * 86400, secure: c.secure }));
    const b = c.url.searchParams.get("back") || "/admin";
    return c.redirect(b.startsWith("/admin") ? b : "/admin");
  });
  r.get("/admin", guard(dashboard));
  r.get("/admin/library", guard(libraryList));
  r.get("/admin/library/:id", guard(libraryEdit));
  r.post("/admin/library/:id/delete", guard(libraryDelete, { form: true }));
  r.post("/admin/library/:id", guard(librarySave, { form: true }));
  r.post("/admin/api/files/init", guard(uploadInit, { api: true }));
  r.put("/admin/api/files/:id/chunk/:idx", guard(uploadChunk, { api: true }));
  r.post("/admin/api/files/:id/complete", guard(uploadComplete, { api: true }));
  r.post("/admin/api/seed/:step", guard(seedStep, { api: true }));
  r.get("/admin/posts", guard(postsList));
  r.get("/admin/posts/:id", guard(postEdit));
  r.post("/admin/posts/:id/delete", guard(postDelete, { form: true }));
  r.post("/admin/posts/:id", guard(postSave, { form: true }));
  r.get("/admin/glossary", guard(glossaryList));
  r.post("/admin/glossary/:id/delete", guard(async (c) => { await run(c.env, "DELETE FROM glossary WHERE id=?", toInt(c.params.id)); return c.redirect(back("/admin/glossary", "deleted")); }, { form: true }));
  r.post("/admin/glossary/:id", guard(glossarySave, { form: true }));
  r.get("/admin/exams", guard(examsAdmin));
  r.post("/admin/exams/:code", guard(examSave, { form: true }));
  r.get("/admin/questions", guard(questionsList));
  r.get("/admin/questions/export", guard(questionsExport));
  r.get("/admin/questions/import", guard((c) => questionsImportPage(c)));
  r.post("/admin/questions/import", guard(questionsImport, { form: true }));
  r.get("/admin/questions/:id", guard(questionEdit));
  r.post("/admin/questions/:id/delete", guard(async (c) => { await run(c.env, "DELETE FROM questions WHERE id=?", toInt(c.params.id)); return c.redirect(back("/admin/questions", "deleted")); }, { form: true }));
  r.post("/admin/questions/:id", guard(questionSave, { form: true }));
  r.get("/admin/orders", guard(ordersList));
  r.post("/admin/orders/:id/:action(approve|reject)", guard(orderDecide, { form: true }));
  r.get("/admin/emails", guard(emailsList));
  r.get("/admin/emails/export", guard(emailsExport));
  r.get("/admin/activity", guard(activityList));
  r.get("/admin/certificates", guard(certificatesList));
  r.post("/admin/certificates/:code/:action(revoke|reinstate)", guard(certificateAction, { form: true }));
  r.get("/admin/messages", guard(messagesList));
  r.post("/admin/messages/:id/:action(read|delete)", guard(messageAction, { form: true }));
  r.get("/admin/settings", guard(settingsPage));
  r.post("/admin/settings/test-email", guard(testEmail, { form: true }));
  r.post("/admin/settings", guard(settingsSave, { form: true }));
}
