// Public pages: home, calculators, library, blog, career, glossary and info pages.
import { html, raw, jsonScript, nowIso } from "../lib/util.js";
import { one, all } from "../lib/db.js";
import { layout, pageHead, waButton } from "../views/layout.js";
import { icon } from "../views/icons.js";
import { markdown, plain } from "../lib/markdown.js";
import { whatsapp } from "../lib/settings.js";
import { CALCULATORS, BY_SLUG, tr } from "../../public/js/calc/defs.js";
import { HttpError } from "../app.js";
import { infoPage } from "../views/info.js";

const TYPES = ["book", "excel", "cv", "doc"];
const TYPE_ICON = { book: "book-open", excel: "sheet", cv: "cv", doc: "doc" };
const POST_CATS = {
  fundamentals: ["Fundamentals", "মৌলিক বিষয়"], tco: ["Total cost of ownership", "মোট মালিকানা খরচ"], "supplier-evaluation": ["Supplier evaluation", "সাপ্লায়ার মূল্যায়ন"],
  incoterms: ["Incoterms", "ইনকোটার্মস"], "bangladesh-import": ["Bangladesh import", "বাংলাদেশে আমদানি"], "china-sourcing": ["China sourcing", "চীন সোর্সিং"],
  inventory: ["Inventory", "ইনভেন্টরি"], kpi: ["KPIs", "কেপিআই"], negotiation: ["Negotiation", "দর-কষাকষি"], "import-documentation": ["Import documents", "আমদানি ডকুমেন্ট"],
  interview: ["Interviews", "ইন্টারভিউ"], cv: ["CV & job search", "সিভি ও চাকরি খোঁজা"], skills: ["Skills", "দক্ষতা"], growth: ["Career growth", "ক্যারিয়ার উন্নতি"],
};
export const catLabel = (c, code) => (POST_CATS[code] ? c.pick(...POST_CATS[code]) : code);
const fileSize = (c, bytes) => (!bytes ? "—" : bytes < 1024 * 1024 ? `${c.num(bytes / 1024, 0)} KB` : `${c.num(bytes / 1024 / 1024, 1)} MB`);
const itemTitle = (c, it) => c.pick(it.title_en, it.title_bn);
const priceTag = (c, price) => (price > 0 ? html`<span class="tag dark">${c.t("lib.paid")} · ${c.money(price)}</span>` : html`<span class="tag">${c.t("lib.free")}</span>`);

// ------------------------------------------------------------------ home
async function home(c) {
  const s = await c.settings();
  const [items, posts, levels] = await Promise.all([
    all(c.env, "SELECT * FROM items WHERE status='published' ORDER BY sort, id DESC LIMIT 4"),
    all(c.env, "SELECT * FROM posts WHERE section='blog' AND status='published' ORDER BY published_at DESC LIMIT 3"),
    all(c.env, "SELECT * FROM exam_levels WHERE published=1 ORDER BY sort"),
  ]);
  const lang = c.lang;
  const body = html`
<section class="hero">
  <div class="wrap">
    <span class="eyebrow">${s["tagline_" + lang]}</span>
    <h1>${s["hero_title_" + lang]}</h1>
    <p class="lead">${s["hero_subtitle_" + lang]}</p>
    <div class="row">
      <a class="btn btn-primary btn-lg" href="${c.p("/calculators")}">${c.t("home.cta_calculators")}</a>
      <a class="btn btn-secondary btn-lg" href="${c.p("/library")}">${c.t("home.cta_library")}</a>
    </div>
    <div class="hero-art" aria-hidden="true">
      <svg viewBox="0 0 980 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#d2d2d7" stroke-width="1.2">
          <path d="M70 60 C 260 60, 300 150, 490 150"/><path d="M70 150 C 260 150, 300 150, 490 150"/><path d="M70 240 C 260 240, 300 150, 490 150"/>
          <path d="M180 20 C 330 30, 360 150, 490 150"/><path d="M180 280 C 330 270, 360 150, 490 150"/>
        </g>
        <g stroke="#000" stroke-width="1.6"><path d="M490 150 C 640 150, 690 150, 900 150"/></g>
        <g fill="#fff" stroke="#000" stroke-width="1.4">
          <circle cx="70" cy="60" r="9"/><circle cx="70" cy="150" r="9"/><circle cx="70" cy="240" r="9"/><circle cx="180" cy="20" r="6"/><circle cx="180" cy="280" r="6"/>
        </g>
        <circle cx="490" cy="150" r="34" fill="#000"/><circle cx="490" cy="150" r="14" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="490" cy="150" r="5" fill="#fff"/>
        <g font-family="-apple-system, 'Segoe UI', sans-serif" font-size="13" fill="#6e6e73">
          <text x="94" y="64">${c.t("home.art_supplier", { n: "A" })}</text><text x="94" y="154">${c.t("home.art_supplier", { n: "B" })}</text><text x="94" y="244">${c.t("home.art_supplier", { n: "C" })}</text>
        </g>
        <rect x="640" y="96" width="250" height="108" rx="16" fill="#f5f5f7"/>
        <text x="662" y="128" font-family="-apple-system, 'Segoe UI', sans-serif" font-size="13" fill="#6e6e73">${c.t("home.art_landed")}</text>
        <text x="662" y="162" font-family="-apple-system, 'Segoe UI', sans-serif" font-size="28" font-weight="700" fill="#000">৳ ${c.d("2,279.45")}</text>
        <text x="662" y="186" font-family="-apple-system, 'Segoe UI', sans-serif" font-size="12" fill="#86868b">${c.t("home.art_example")}</text>
      </svg>
    </div>
  </div>
</section>

<section class="section alt" id="calculators">
  <div class="wrap">
    <div class="row between" style="margin-bottom:36px;align-items:flex-end">
      <div><span class="eyebrow">${c.t("home.featured_eyebrow")}</span><h2 style="margin:0">${c.t("home.featured_title")}</h2></div>
      <a class="link" href="${c.p("/calculators")}">${c.t("home.see_all")} ${icon("arrow-right", 16)}</a>
    </div>
    <div class="grid grid-3">${CALCULATORS.map((k) => calcCard(c, k))}</div>
  </div>
</section>

${levels.length ? html`<section class="section dark">
  <div class="wrap">
    <div class="center" style="max-width:720px;margin:0 auto 52px">
      <span class="eyebrow" style="color:#a1a1a6">${c.t("home.exams_eyebrow")}</span>
      <h2>${c.t("home.exams_title")}</h2>
      <p class="lead">${c.t("home.exams_lead")}</p>
    </div>
    <div class="grid grid-3">${levels.map((lv) => html`
      <div class="card dark level-card">
        <div class="row" style="gap:6px"><span class="tag" style="background:#333;color:#fff">${c.pick(lv.title_en, lv.title_bn)}</span>
          ${lv.price > 0 ? html`<span class="tag" style="background:#fff;color:#000">${c.t("exam.paid")} · ${c.money(lv.price)}</span>` : html`<span class="tag" style="background:#1d1d1f;color:#a1a1a6;border:1px solid #333">${c.t("exam.free")}</span>`}</div>
        <div class="meta">
          <div><strong>${c.d(lv.question_count)}</strong>${c.t("exam.questions")}</div>
          <div><strong>${c.d(lv.time_limit_min)}</strong>${c.t("exam.minutes")}</div>
          <div><strong>${c.d(lv.pass_mark)}%</strong>${c.t("exam.to_pass")}</div>
        </div>
        <p>${c.pick(lv.desc_en, lv.desc_bn)}</p>
      </div>`)}
    </div>
    <div class="row" style="justify-content:center;margin-top:40px">
      <a class="btn btn-light" href="${c.p("/exams")}">${c.t("home.exams_cta")}</a>
      <a class="btn btn-outline-light" href="${c.p("/certificates/verify")}">${c.t("footer.verify_cert")}</a>
    </div>
  </div>
</section>` : ""}

${items.length ? html`<section class="section">
  <div class="wrap">
    <div class="row between" style="margin-bottom:36px;align-items:flex-end">
      <div><span class="eyebrow">${c.t("home.library_eyebrow")}</span><h2 style="margin:0">${c.t("home.library_title")}</h2></div>
      <a class="link" href="${c.p("/library")}">${c.t("home.see_all")} ${icon("arrow-right", 16)}</a>
    </div>
    <div class="grid grid-4">${items.map((it) => itemCard(c, it))}</div>
  </div>
</section>` : ""}

<section class="section alt">
  <div class="wrap">
    <div class="row between" style="margin-bottom:36px;align-items:flex-end">
      <div><span class="eyebrow">${c.t("home.blog_eyebrow")}</span><h2 style="margin:0">${posts.length ? c.t("home.blog_title") : c.t("home.learn_cards_title")}</h2></div>
      ${posts.length ? html`<a class="link" href="${c.p("/blog")}">${c.t("home.see_all")} ${icon("arrow-right", 16)}</a>` : ""}
    </div>
    <div class="grid grid-3">
      ${posts.map((p) => postCard(c, p))}
      ${posts.length < 3 ? html`
      <a class="card hover" href="${c.p("/glossary")}"><div class="card-icon">${icon("text", 22)}</div><h3>${c.t("glossary.title")}</h3><p>${c.t("glossary.lead")}</p><div class="card-foot">${c.t("common.open")} ${icon("arrow-right", 16)}</div></a>
      <a class="card hover" href="${c.p("/career")}"><div class="card-icon">${icon("briefcase", 22)}</div><h3>${c.t("career.title")}</h3><p>${c.t("career.lead")}</p><div class="card-foot">${c.t("common.open")} ${icon("arrow-right", 16)}</div></a>` : ""}
    </div>
  </div>
</section>

<section class="section" id="newsletter">
  <div class="wrap newsletter center">
    <div class="card-icon" style="margin:0 auto 18px">${icon("mail", 22)}</div>
    <h2 style="font-size:36px">${c.t("newsletter.title")}</h2>
    <p class="muted">${c.t("newsletter.lead")}</p>
    <div class="row" style="justify-content:center;margin-top:20px">
      <button class="btn btn-primary" type="button" data-subscribe data-done="${c.L("✓ Subscribed — thank you", "✓ সাবস্ক্রাইব হয়েছে — ধন্যবাদ")}">${c.t("newsletter.subscribe")}</button>
      ${waButton(c, s)}
    </div>
  </div>
</section>
`;
  return c.html(await layout(c, { body, pageType: "home", gate: true }));
}

function calcCard(c, k) {
  return html`<a class="card hover" href="${c.p("/calculators/" + k.slug)}">
    <div class="card-icon">${icon(k.icon, 22)}</div>
    <h3>${tr(k.title, c.lang)}</h3><p>${tr(k.summary, c.lang)}</p>
    <div class="card-foot">${c.t("common.open_tool")} ${icon("arrow-right", 16)}</div></a>`;
}

export function itemCard(c, it) {
  return html`<a class="card hover" href="${c.p("/library/" + it.slug)}" data-search="${(it.title_en + " " + it.title_bn + " " + it.summary_en + " " + it.summary_bn).toLowerCase()}" data-cat="${it.type}">
    ${it.cover_id ? html`<img class="item-cover" src="/media/${it.cover_id}" alt="" loading="lazy">` : html`<div class="card-icon">${icon(TYPE_ICON[it.type] || "file", 22)}</div>`}
    <div class="row" style="gap:6px;margin-bottom:10px"><span class="tag outline">${c.t("lib.one." + it.type)}</span>${priceTag(c, it.price)}</div>
    <h3 style="font-size:18px">${itemTitle(c, it)}</h3>
    <p>${plain(c.pick(it.summary_en, it.summary_bn), 130)}</p>
  </a>`;
}

function postCard(c, p, section = "blog") {
  return html`<a class="card hover" href="${c.p(`/${section}/${p.slug}`)}" data-search="${(p.title_en + " " + p.title_bn + " " + p.summary_en + " " + p.summary_bn).toLowerCase()}" data-cat="${p.category}">
    <div class="row" style="gap:6px;margin-bottom:12px">${p.category ? html`<span class="tag">${catLabel(c, p.category)}</span>` : ""}</div>
    <h3>${c.pick(p.title_en, p.title_bn)}</h3>
    <p>${c.pick(p.summary_en, p.summary_bn)}</p>
    <div class="card-foot muted">${c.date(p.published_at)}</div></a>`;
}

// ------------------------------------------------------------------ calculators
async function calcDirectory(c) {
  const body = html`${pageHead(c, { title: c.t("calc.dir_title"), lead: c.t("calc.dir_lead") })}
  <section class="section-sm" style="padding-top:0"><div class="wrap"><div class="grid grid-3">${CALCULATORS.map((k) => calcCard(c, k))}</div></div></section>`;
  return c.html(await layout(c, { title: c.t("calc.dir_title"), description: c.t("calc.dir_lead"), body }));
}

async function calcPage(c) {
  const def = BY_SLUG[c.params.slug];
  if (!def) {
    const legacy = { "china-bangladesh-import-cost": "shipping-import-cost" }[c.params.slug];
    if (legacy) return c.redirect(c.p("/calculators/" + legacy), 301);
    throw new HttpError(404);
  }
  const s = await c.settings();
  const wa = whatsapp(s, c.lang);
  const L = (o) => tr(o, c.lang);
  const i18nBlob = {
    optional: c.t("form.optional"), rows_limit: c.t("calc.rows_limit"), remove: c.t("calc.remove"), add_row: c.t("calc.add_row"),
    result_actions: c.t("calc.result_actions"), download_excel: c.t("delivery.download_excel"), download_pdf: c.t("delivery.download_pdf"),
    download_note: c.t("calc.download_note"), fix_errors: c.t("calc.fix_errors"), yes: c.t("common.yes"), no: c.t("common.no"),
    report_subtitle: c.t("report.subtitle"), generated: c.t("report.generated"), key_results: c.t("report.key_results"), value: c.t("report.col_value"),
    warnings: c.t("report.warnings"), section: c.t("report.col_section"), input: c.t("report.col_input"), sheet_summary: c.t("report.sheet_summary"),
    sheet_inputs: c.t("report.sheet_inputs"), sheet_method: c.t("report.sheet_method"), method_title: c.t("report.method_title"), notes: c.L("Notes", "নোট"),
    footer_disclaimer: c.t("report.footer_disclaimer"), your_inputs: c.t("report.inputs"),
    cs_suppliers: c.L("Suppliers & commercial terms", "সাপ্লায়ার ও বাণিজ্যিক শর্ত"), cs_items: c.L("Items & unit prices", "আইটেম ও একক মূল্য"),
    cs_add_supplier: c.L("Add supplier", "সাপ্লায়ার যোগ করুন"), cs_add_item: c.L("Add item", "আইটেম যোগ করুন"),
    cs_blank_help: c.L("Leave a price blank if that supplier did not quote the item.", "কোনো সাপ্লায়ার আইটেমের দাম না দিলে ঘরটি ফাঁকা রাখুন।"),
    unit_price: c.L("Unit price", "একক মূল্য"), supplier: c.L("Supplier", "সাপ্লায়ার"), item: c.L("Item", "আইটেম"),
    wa: wa.enabled && wa.configured ? { url: wa.url, label: wa.label, note: wa.note } : null,
    msg: {
      required: c.t("form.required"), number: c.L("Enter a valid number.", "একটি সঠিক সংখ্যা লিখুন।"), integer: c.L("Enter a whole number.", "একটি পূর্ণ সংখ্যা লিখুন।"),
      min: c.L("Must be at least {v}.", "কমপক্ষে {v} হতে হবে।"), max: c.L("Must be at most {v}.", "সর্বোচ্চ {v} হতে পারে।"), gt: c.L("Must be greater than {v}.", "{v}-এর চেয়ে বেশি হতে হবে।"),
      choice: c.L("Choose one of the listed options.", "তালিকা থেকে একটি বিকল্প বেছে নিন।"), too_long: c.L("Text is too long.", "লেখাটি অনেক বড়।"),
      few_items: c.L("Add at least {v} rows.", "কমপক্ষে {v}টি সারি যোগ করুন।"),
      generic_en: "The inputs could not be calculated. Check the values and try again.", generic_bn: "ইনপুট দিয়ে হিসাব করা যায়নি। মানগুলো যাচাই করে আবার চেষ্টা করুন।",
    },
  };
  const others = CALCULATORS.filter((k) => k.slug !== def.slug);
  const related = await all(c.env, "SELECT slug, title_en, title_bn FROM posts WHERE section='blog' AND status='published' ORDER BY published_at DESC LIMIT 40");
  const relWords = { "total-cost-of-ownership": ["total-cost", "negotiation"], "shipping-import-cost": ["import", "incoterms", "documents"], "comparative-statement": ["supplier", "procure-to-pay", "negotiation"] }[def.slug] || [];
  const rel = related.filter((p) => relWords.some((w) => p.slug.includes(w))).slice(0, 3);
  const body = html`
<section class="page-head" style="padding-bottom:28px">
  <div class="wrap">
    <nav class="crumbs" aria-label="${c.t("common.breadcrumb")}"><a href="${c.p("/")}">${c.t("nav.home")}</a><span>/</span><a href="${c.p("/calculators")}">${c.t("nav.calculators")}</a></nav>
    <h1 style="max-width:24ch">${L(def.title)}</h1>
    <p class="lead">${L(def.intro)}</p>
    <div class="row no-print" style="margin-top:6px">
      <button class="btn btn-ghost btn-sm" type="button" data-calc-example form="calc-form">${icon("sparkle", 16)} ${c.t("calc.load_example")}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-calc-clear form="calc-form">${icon("refresh", 16)} ${c.t("calc.reset")}</button>
    </div>
    <div class="alert alert-info" data-example-note hidden style="margin-top:18px;max-width:760px">${icon("info", 18)}<div>${c.t("calc.example_loaded")}</div></div>
  </div>
</section>
<section class="section-sm" style="padding-top:8px" data-calc data-slug="${def.slug}">
  <div class="wrap ${def.custom === "cs" ? "" : "calc-layout"}">
    <form class="panel" id="calc-form" data-calc-form novalidate autocomplete="off">
      <div class="alert alert-err" data-form-error hidden></div>
      <div data-form><noscript><p class="muted">${c.L("Please enable JavaScript to use the calculator.", "ক্যালকুলেটর ব্যবহার করতে JavaScript চালু করুন।")}</p></noscript><p class="muted small">${c.t("common.loading")}</p></div>
      <div class="form-actions">
        <button class="btn btn-primary btn-lg" type="submit">${c.t("calc.calculate")}</button>
        <label class="check small" style="margin-left:auto"><input type="checkbox" data-auto checked> ${c.t("calc.auto")}</label>
      </div>
    </form>
    <div class="results-col" ${def.custom === "cs" ? raw('style="margin-top:28px"') : ""}>
      <div data-result aria-live="polite"><div class="result-empty"><div class="card-icon" style="margin:0 auto 14px">${icon(def.icon, 22)}</div><p style="margin:0">${c.t("calc.empty")}</p></div></div>
    </div>
  </div>
</section>
<section class="section-sm">
  <div class="wrap wrap-narrow">
    <details class="disclosure" open><summary>${c.t("calc.method")}</summary><div><ol class="method-list">${def.method.map((m) => html`<li>${L(m)}</li>`)}</ol></div></details>
    <details class="disclosure" open><summary>${c.t("calc.important")}</summary><div>${def.disclaimer ? html`<p class="muted">${L(def.disclaimer)}</p>` : ""}<p class="muted small">${c.t("report.footer_disclaimer")}</p></div></details>
    ${rel.length ? html`<details class="disclosure" open><summary>${c.t("calc.related_reading")}</summary><div><ul class="feature-list">${rel.map((p) => html`<li>${icon("book", 18)}<a href="${c.p("/blog/" + p.slug)}">${c.pick(p.title_en, p.title_bn)}</a></li>`)}</ul></div></details>` : ""}
  </div>
</section>
<section class="section alt">
  <div class="wrap">
    <h2 style="font-size:32px">${c.L("More calculators", "আরও ক্যালকুলেটর")}</h2>
    <div class="grid grid-2" style="margin-top:24px">${others.map((k) => calcCard(c, k))}</div>
  </div>
</section>
<script type="application/json" id="calc-i18n">${jsonScript(i18nBlob)}</script>`;
  return c.html(await layout(c, { title: L(def.title), description: L(def.summary), body, scripts: ["/js/calc/engine.js"], gate: true }));
}

// ------------------------------------------------------------------ library
async function library(c) {
  const type = TYPES.includes(c.url.searchParams.get("type")) ? c.url.searchParams.get("type") : "";
  const items = await all(c.env, "SELECT * FROM items WHERE status='published' ORDER BY sort, id DESC");
  const counts = Object.fromEntries(TYPES.map((t) => [t, items.filter((i) => i.type === t).length]));
  const body = html`${pageHead(c, { title: c.t("lib.title"), lead: c.t("lib.lead") })}
<section class="section-sm" style="padding-top:0">
  <div class="wrap" data-directory>
    <div class="toolbar">
      <div class="search">${icon("search", 18)}<input type="search" placeholder="${c.t("lib.search")}" aria-label="${c.t("lib.search")}" data-dir-search></div>
      <div class="chips" role="group">
        <button type="button" class="chip ${type ? "" : "on"}" data-dir-cat="">${c.t("dir.all")} <span class="muted">${c.d(items.length)}</span></button>
        ${TYPES.filter((t) => counts[t]).map((t) => html`<button type="button" class="chip ${type === t ? "on" : ""}" data-dir-cat="${t}">${c.t("lib.type." + t)} <span class="muted">${c.d(counts[t])}</span></button>`)}
      </div>
    </div>
    ${items.length ? html`<div class="grid grid-3">${items.map((it) => itemCard(c, it))}</div>
      <p class="empty" data-dir-empty hidden>${c.t("dir.no_results")}</p>` : html`<p class="empty">${c.t("lib.none")}</p>`}
  </div>
</section>`;
  return c.html(await layout(c, { title: c.t("lib.title"), description: c.t("lib.meta"), body }));
}

async function libraryItem(c) {
  const it = await one(c.env, "SELECT * FROM items WHERE slug=? AND status='published'", c.params.slug);
  if (!it) throw new HttpError(404);
  const file = it.file_id ? await one(c.env, "SELECT name, size, mime FROM files WHERE id=? AND complete=1", it.file_id) : null;
  const v = await c.visitor();
  let owned = false, pending = null;
  if (v && it.price > 0) {
    owned = Boolean(await one(c.env, "SELECT id FROM entitlements WHERE email=? AND item_type='file' AND item_ref=?", v.email, it.slug));
    if (!owned) pending = await one(c.env, "SELECT ref FROM orders WHERE email=? AND item_type='file' AND item_ref=? AND status='pending'", v.email, it.slug);
  }
  const s = await c.settings();
  const ext = file ? file.name.split(".").pop().toUpperCase() : "";
  const bodyMd = c.pick(it.body_en, it.body_bn);
  const action = !file ? html`<div class="alert alert-info">${icon("info", 18)}<div>${c.t("lib.no_file")}</div></div>`
    : it.price > 0 && !owned ? html`${pending ? html`<div class="alert alert-warn" style="margin-bottom:12px">${icon("clock", 18)}<div>${c.t("lib.pending")} (${pending.ref})</div></div>` : ""}
        <a class="btn btn-primary btn-lg" style="width:100%" href="${c.p("/buy/file/" + it.slug)}">${icon("cart", 18)} ${c.t("lib.buy", { price: c.money(it.price) })}</a>`
      : html`${owned ? html`<div class="alert alert-ok" style="margin-bottom:12px">${icon("check-circle", 18)}<div>${c.t("lib.owned")}</div></div>` : ""}
        <button class="btn btn-primary btn-lg" style="width:100%" type="button" data-download="${it.slug}">${icon("download", 18)} ${it.price > 0 ? c.t("lib.download") : c.t("lib.download_free")}</button>
        <div class="alert" data-dl-status hidden style="margin-top:12px"></div>`;
  const body = html`
<section class="page-head" style="padding-bottom:24px">
  <div class="wrap">
    <nav class="crumbs"><a href="${c.p("/library")}">${c.t("nav.library")}</a><span>/</span><a href="${c.p("/library?type=" + it.type)}">${c.t("lib.type." + it.type)}</a></nav>
  </div>
</section>
<section class="section-sm" style="padding-top:0">
  <div class="wrap split" style="align-items:start;gap:48px">
    <div>
      ${it.cover_id ? html`<img src="/media/${it.cover_id}" alt="" style="max-width:220px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:24px">` : html`<div class="card-icon" style="width:64px;height:64px">${icon(TYPE_ICON[it.type], 30)}</div>`}
      <div class="row" style="gap:6px;margin-bottom:12px"><span class="tag outline">${c.t("lib.one." + it.type)}</span>${priceTag(c, it.price)}</div>
      <h1 style="font-size:clamp(32px,4vw,48px)">${itemTitle(c, it)}</h1>
      <p class="lead">${c.pick(it.summary_en, it.summary_bn)}</p>
      ${bodyMd ? html`<h2 style="font-size:22px;margin-top:32px">${c.t("lib.whats_inside")}</h2><div class="prose" style="font-size:16px">${raw(markdown(bodyMd))}</div>` : ""}
    </div>
    <aside class="panel" style="position:sticky;top:calc(var(--nav-h) + 20px)">
      <ul class="details-list" style="margin-top:0">
        <li><span>${c.t("common.price")}</span><span>${it.price > 0 ? c.money(it.price) : c.t("lib.free")}</span></li>
        ${file ? html`<li><span>${c.t("lib.file_info")}</span><span>${ext}</span></li><li><span>${c.t("lib.size")}</span><span>${fileSize(c, file.size)}</span></li>` : ""}
        <li><span>${c.t("lib.downloads")}</span><span>${c.num(it.downloads)}</span></li>
      </ul>
      <div style="margin-top:22px">${action}</div>
      ${v ? html`<p class="tiny muted" style="margin-top:12px">${c.t("gate.as", { email: v.email })} · <a href="#" data-forget-email>${c.t("gate.change")}</a></p>` : html`<p class="tiny muted" style="margin-top:12px">${c.t("calc.download_note")}</p>`}
      <div style="margin-top:14px">${waButton(c, s, "btn-sm")}</div>
    </aside>
  </div>
</section>`;
  return c.html(await layout(c, { title: itemTitle(c, it), description: plain(c.pick(it.summary_en, it.summary_bn), 160), body, gate: true }));
}

// Public cover images (only images that belong to a published item).
async function media(c) {
  const it = await one(c.env, "SELECT cover_id FROM items WHERE cover_id=? AND status='published' LIMIT 1", c.params.id);
  if (!it) throw new HttpError(404);
  const { getFile, fileResponse } = await import("../lib/files.js");
  const f = await getFile(c.env, c.params.id);
  if (!f || !f.complete || !f.mime.startsWith("image/")) throw new HttpError(404);
  return fileResponse(c.env, f, "inline", { "Cache-Control": "public, max-age=86400" });
}

// ------------------------------------------------------------------ blog & career
async function postList(c, section) {
  const q = (c.url.searchParams.get("q") || "").trim().slice(0, 80);
  const cat = (c.url.searchParams.get("category") || "").trim().slice(0, 40);
  const posts = await all(c.env, "SELECT * FROM posts WHERE section=? AND status='published' ORDER BY published_at DESC", section);
  const cats = [...new Set(posts.map((p) => p.category).filter(Boolean))];
  const titleKey = section === "career" ? "career" : "blog";
  const body = html`${pageHead(c, { title: c.t(titleKey + ".title"), lead: c.t(titleKey + ".lead") })}
<section class="section-sm" style="padding-top:0">
  <div class="wrap" data-directory>
    ${posts.length ? html`<div class="toolbar">
      <div class="search">${icon("search", 18)}<input type="search" value="${q}" placeholder="${c.t("learn.search")}" aria-label="${c.t("learn.search")}" data-dir-search></div>
      ${cats.length > 1 ? html`<div class="chips" role="group"><button type="button" class="chip ${cat ? "" : "on"}" data-dir-cat="">${c.t("dir.all")}</button>
        ${cats.map((k) => html`<button type="button" class="chip ${cat === k ? "on" : ""}" data-dir-cat="${k}">${catLabel(c, k)}</button>`)}</div>` : ""}
    </div>
    <div class="grid grid-3">${posts.map((p) => postCard(c, p, section))}</div>
    <p class="empty" data-dir-empty hidden>${c.t("post.none")}</p>` : html`<p class="empty">${section === "career" ? c.t("career.none") : c.t("post.none")}</p>`}
  </div>
</section>`;
  return c.html(await layout(c, { title: c.t(titleKey + ".title"), description: c.t(titleKey + ".meta"), body }));
}

async function postPage(c, section) {
  const p = await one(c.env, "SELECT * FROM posts WHERE section=? AND slug=? AND status='published'", section, c.params.slug);
  if (!p) throw new HttpError(404);
  const titleKey = section === "career" ? "career" : "blog";
  const fallback = c.lang === "bn" ? !p.body_bn : !p.body_en;
  const more = await all(c.env, "SELECT slug, title_en, title_bn FROM posts WHERE section=? AND status='published' AND id<>? ORDER BY (category=?) DESC, published_at DESC LIMIT 4", section, p.id, p.category);
  let refs = [];
  try { refs = JSON.parse(p.refs_json || "[]"); } catch { refs = []; }
  const relCalc = { tco: "total-cost-of-ownership", "bangladesh-import": "shipping-import-cost", incoterms: "shipping-import-cost", "import-documentation": "shipping-import-cost", "china-sourcing": "shipping-import-cost", "supplier-evaluation": "comparative-statement", fundamentals: "comparative-statement", negotiation: "total-cost-of-ownership" }[p.category];
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: c.pick(p.title_en, p.title_bn), description: c.pick(p.summary_en, p.summary_bn), inLanguage: c.lang, datePublished: p.published_at, dateModified: p.updated_at, author: { "@type": "Organization", name: p.author || "ProcureBest" }, publisher: { "@type": "Organization", name: "ProcureBest" } };
  const body = html`<article>
<section class="page-head" style="padding-bottom:24px">
  <div class="wrap wrap-narrow">
    <nav class="crumbs"><a href="${c.p("/" + section)}">${c.t("nav." + titleKey)}</a>${p.category ? html`<span>/</span><span>${catLabel(c, p.category)}</span>` : ""}</nav>
    <h1 style="max-width:none">${c.pick(p.title_en, p.title_bn)}</h1>
    <p class="lead">${c.pick(p.summary_en, p.summary_bn)}</p>
    <div class="article-meta"><span>${c.t("learn.by", { author: p.author || "ProcureBest" })}</span>${p.published_at ? html`<span>${c.t("learn.published")}: ${c.date(p.published_at)}</span>` : ""}</div>
    ${fallback ? html`<div class="alert alert-info" style="margin-top:18px">${icon("globe", 18)}<div>${c.t("learn.fallback")}</div></div>` : ""}
  </div>
</section>
<section class="section-sm" style="padding-top:12px">
  <div class="wrap wrap-narrow">
    <div class="prose" ${fallback ? raw(`lang="${c.lang === "bn" ? "en" : "bn"}"`) : ""}>${raw(markdown(c.pick(p.body_en, p.body_bn)))}</div>
    ${refs.length ? html`<h2 style="font-size:22px;margin-top:48px">${c.t("learn.references")}</h2><ol class="method-list">${refs.map((r) => html`<li>${r.url ? html`<a href="${r.url}" rel="noopener nofollow" target="_blank">${r.title || r.url}</a>` : r.title}</li>`)}</ol>` : ""}
    ${relCalc ? html`<h2 style="font-size:22px;margin-top:48px">${c.t("learn.related_tools")}</h2><div class="grid grid-2" style="margin-top:16px">${calcCard(c, BY_SLUG[relCalc])}</div>` : ""}
    ${more.length ? html`<h2 style="font-size:22px;margin-top:48px">${c.t("learn.more")}</h2><ul class="feature-list">${more.map((m) => html`<li>${icon("book", 18)}<a href="${c.p(`/${section}/${m.slug}`)}">${c.pick(m.title_en, m.title_bn)}</a></li>`)}</ul>` : ""}
  </div>
</section></article>`;
  return c.html(await layout(c, { title: c.pick(p.title_en, p.title_bn), description: c.pick(p.summary_en, p.summary_bn), pageType: "article", body,
    head: html`<script type="application/ld+json">${jsonScript(ld)}</script>` }));
}

// ------------------------------------------------------------------ glossary
async function glossary(c) {
  const terms = await all(c.env, "SELECT * FROM glossary WHERE status='published' ORDER BY LOWER(term_en)");
  const first = (t) => { const ch = (c.lang === "bn" && t.term_bn ? t.term_bn : t.term_en || "#").trim().charAt(0).toUpperCase(); return /[A-Z]/.test(ch) || c.lang === "bn" ? ch : "#"; };
  const sorted = c.lang === "bn" ? [...terms].sort((a, b) => (a.term_bn || a.term_en).localeCompare(b.term_bn || b.term_en, "bn")) : terms;
  const groups = [];
  for (const t of sorted) { const k = first(t); if (!groups.length || groups[groups.length - 1][0] !== k) groups.push([k, []]); groups[groups.length - 1][1].push(t); }
  const body = html`${pageHead(c, { title: c.t("glossary.title"), lead: c.t("glossary.lead") })}
<section class="section-sm" style="padding-top:0">
  <div class="wrap wrap-narrow" data-directory>
    <div class="toolbar"><div class="search" style="max-width:none">${icon("search", 18)}<input type="search" placeholder="${c.t("glossary.search")}" aria-label="${c.t("glossary.search")}" data-dir-search></div>
      <span class="small muted">${c.t("glossary.count", { n: c.d(terms.length) })}</span></div>
    ${groups.length > 6 ? html`<div class="chips" style="margin:-8px 0 28px">${groups.map(([k]) => html`<a class="chip" href="#g-${encodeURIComponent(k)}" style="padding:6px 12px">${k}</a>`)}</div>` : ""}
    ${groups.map(([k, list]) => html`<div data-letter-group id="g-${encodeURIComponent(k)}" style="margin-bottom:28px">
      <h2 style="font-size:28px;border-bottom:1px solid var(--line-2);padding-bottom:8px">${k}</h2>
      ${list.map((t) => html`<div class="gloss-term" id="${t.slug}" data-search="${(t.term_en + " " + t.term_bn + " " + t.def_en + " " + t.def_bn).toLowerCase()}">
        <h3>${c.lang === "bn" && t.term_bn ? t.term_bn : t.term_en}${c.lang === "bn" && t.term_bn && t.term_en !== t.term_bn ? html` <span class="muted" style="font-weight:400;font-size:15px">(${t.term_en})</span>` : c.lang === "en" && t.term_bn ? html` <span class="muted" style="font-weight:400;font-size:15px" lang="bn">${t.term_bn}</span>` : ""}</h3>
        <div class="prose" style="font-size:16px">${raw(markdown(c.pick(t.def_en, t.def_bn)))}</div></div>`)}
    </div>`)}
    <p class="empty" data-dir-empty ${terms.length ? raw("hidden") : ""}>${terms.length ? c.t("glossary.none") : c.L("The glossary is being prepared.", "গ্লসারি তৈরি হচ্ছে।")}</p>
  </div>
</section>`;
  return c.html(await layout(c, { title: c.t("glossary.title"), description: c.t("glossary.meta"), body }));
}

// ------------------------------------------------------------------ sitemap & robots
async function sitemap(c) {
  const [posts, items] = await Promise.all([
    all(c.env, "SELECT section, slug, updated_at FROM posts WHERE status='published'"),
    all(c.env, "SELECT slug, updated_at FROM items WHERE status='published'"),
  ]);
  const paths = ["/", "/calculators", ...CALCULATORS.map((k) => "/calculators/" + k.slug), "/exams", "/library", "/blog", "/glossary", "/career",
    "/certificates/verify", "/about", "/contact", "/help", "/privacy", "/terms", "/disclaimer",
    ...posts.map((p) => `/${p.section}/${p.slug}`), ...items.map((i) => "/library/" + i.slug)];
  const urls = paths.flatMap((p) => ["en", "bn"].map((l) => `<url><loc>${c.siteUrl}/${l}${p === "/" ? "/" : p}</loc><xhtml:link rel="alternate" hreflang="en" href="${c.siteUrl}/en${p === "/" ? "/" : p}"/><xhtml:link rel="alternate" hreflang="bn" href="${c.siteUrl}/bn${p === "/" ? "/" : p}"/></url>`));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

export function registerPublic(r) {
  const L = "/:lang(en|bn)";
  r.get(`${L}`, home);
  r.get(`${L}/calculators`, calcDirectory);
  r.get(`${L}/calculators/:slug`, calcPage);
  r.get(`${L}/library`, library);
  r.get(`${L}/library/:slug`, libraryItem);
  r.get(`/media/:id`, media);
  r.get(`${L}/blog`, (c) => postList(c, "blog"));
  r.get(`${L}/blog/:slug`, (c) => postPage(c, "blog"));
  r.get(`${L}/learn/:slug`, (c) => c.redirect(c.p("/blog/" + c.params.slug), 301));
  r.get(`${L}/career`, (c) => postList(c, "career"));
  r.get(`${L}/career/:slug`, (c) => postPage(c, "career"));
  r.get(`${L}/glossary`, glossary);
  r.get(`${L}/:page(about|help|privacy|terms|disclaimer|contact)`, (c) => infoPage(c, c.params.page));
  r.get("/sitemap.xml", sitemap);
  r.get("/robots.txt", (c) => new Response(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /dl/\nDisallow: /en/my\nDisallow: /bn/my\nSitemap: ${c.siteUrl}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain" } }));
}
