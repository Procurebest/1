// Public pages: home, calculators, library, blog, career, glossary and info pages.
import { html, raw, jsonScript, nowIso, paidLeft } from "../lib/util.js";
import { one, all } from "../lib/db.js";
import { layout, pageHead, waButton, certBadge, LIB_TYPES } from "../views/layout.js";
import { calcList, ROADMAP } from "../lib/calclist.js";
import { calcOff } from "../lib/settings.js";
import { mailConfigured } from "../lib/mail.js";
import { DEFAULT_ROADMAP, mergeRoadmap, EDUCATION, PREVIOUS, PERFORMANCE } from "../../public/js/calc/roadmap.js";
import { icon } from "../views/icons.js";
import { markdown, plain } from "../lib/markdown.js";
import { whatsapp } from "../lib/settings.js";
import { CALCULATORS, BY_SLUG, tr } from "../../public/js/calc/defs.js";
import { HttpError } from "../app.js";
import { infoPage } from "../views/info.js";

const TYPES = LIB_TYPES;
const TYPE_ICON = { book: "book-open", excel: "sheet", cv: "cv", doc: "doc", pdf: "pdf", other: "file" };
// Article sections and their web addresses.
export const SECTION_PATH = { blog: "blog", career: "career", negotiation: "negotiation-guru", ai: "procurement-ai" };
const secT = (c, section, part) => (section === "blog" || section === "career" ? c.t(`${section}.${part}`) : c.t(`section.${section}.${part === "meta" ? "lead" : part}`));
const secNav = (c, section) => ({ blog: c.t("nav.blog"), career: c.t("nav.career"), negotiation: c.t("nav.negotiation"), ai: c.t("nav.ai") }[section]);
const POST_CATS = {
  fundamentals: ["Fundamentals", "মৌলিক বিষয়"], tco: ["Total cost of ownership", "মোট মালিকানা খরচ"], "supplier-evaluation": ["Supplier evaluation", "সাপ্লায়ার মূল্যায়ন"],
  incoterms: ["Incoterms", "ইনকোটার্মস"], "bangladesh-import": ["Bangladesh import", "বাংলাদেশে আমদানি"], "china-sourcing": ["China sourcing", "চীন সোর্সিং"],
  inventory: ["Inventory", "ইনভেন্টরি"], kpi: ["KPIs", "কেপিআই"], negotiation: ["Negotiation", "দর-কষাকষি"], "import-documentation": ["Import documents", "আমদানি ডকুমেন্ট"],
  interview: ["Interviews", "ইন্টারভিউ"], cv: ["CV & job search", "সিভি ও চাকরি খোঁজা"], skills: ["Skills", "দক্ষতা"], growth: ["Career growth", "ক্যারিয়ার উন্নতি"],
};
export const catLabel = (c, code) => (POST_CATS[code] ? c.pick(...POST_CATS[code]) : code);
const fileSize = (c, bytes) => (!bytes ? "—" : bytes < 1024 * 1024 ? `${c.num(bytes / 1024, 0)} KB` : `${c.num(bytes / 1024 / 1024, 1)} MB`);
const itemTitle = (c, it) => c.pick(it.title_en, it.title_bn);
const priceTag = (c, price) => (price > 0 ? html`<span class="tag dark">${c.t("lib.paid")} · ${c.money(price)}</span>` : html`<span class="tag free-blink-tag">${c.t("lib.free")}</span>`);

// ------------------------------------------------------------------ home
// Animated hero: many inputs travel as chains into one engine, which returns a result.
function heroArt(c) {
  const inputs = [
    [c.L("Quotation", "কোটেশন"), 48], [c.L("Freight", "ফ্রেইট"), 104], [c.L("Duty & VAT", "শুল্ক ও ভ্যাট"), 160],
    [c.L("Exchange rate", "বিনিময় হার"), 216], [c.L("Lead time", "লিড টাইম"), 272],
  ];
  const results = [
    [c.L("Landed cost per unit", "প্রতি ইউনিট ল্যান্ডেড খরচ"), `৳ ${c.d("2,279.45")}`, c.L("Shipping & import", "শিপিং ও আমদানি")],
    [c.L("5-year total cost", "৫ বছরের মোট খরচ"), `৳ ${c.d("18.4")} ${c.L("lakh", "লাখ")}`, c.L("Total cost of ownership", "মোট মালিকানা খরচ")],
    [c.L("Best offer", "সেরা অফার"), c.L("Supplier B · L1", "সাপ্লায়ার B · L1"), c.L("Comparative statement", "তুলনামূলক বিবরণী")],
  ];
  const path = (y) => `M150 ${y} C 300 ${y}, 330 160, 452 160`;
  return html`<div class="hero-art" aria-hidden="true">
  <svg viewBox="0 0 980 320" fill="none" xmlns="http://www.w3.org/2000/svg" class="ha">
    ${inputs.map(([, y], i) => html`<path d="${path(y)}" class="ha-rail"/><path d="${path(y)}" class="ha-chain" style="animation-delay:-${(i * 0.37).toFixed(2)}s"/>`)}
    <path d="M528 160 L 640 160" class="ha-rail"/><path d="M528 160 L 640 160" class="ha-chain ha-out"/>
    ${inputs.map(([label, y], i) => html`<g class="ha-node" style="animation-delay:${(i * 0.45).toFixed(2)}s">
      <rect x="22" y="${y - 15}" width="128" height="30" rx="15" class="ha-pill"/>
      <circle cx="40" cy="${y}" r="4.5" class="ha-dot"/>
      <text x="52" y="${y + 4.5}" class="ha-t">${label}</text></g>`)}
    <circle cx="490" cy="160" r="54" class="ha-ring"/>
    <circle cx="490" cy="160" r="38" fill="#000"/>
    <g class="ha-gear"><circle cx="490" cy="160" r="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="6 4.5"/></g>
    <circle cx="490" cy="160" r="5" fill="#fff"/>
    <rect x="640" y="98" width="300" height="124" rx="18" class="ha-card"/>
    ${results.map(([label, value, note], i) => html`<g class="ha-res" style="animation-delay:${i * 3}s">
      <text x="664" y="132" class="ha-t ha-label">${label}</text>
      <text x="664" y="172" class="ha-t ha-value">${value}</text>
      <text x="664" y="200" class="ha-t ha-note">${note}</text></g>`)}
  </svg></div>`;
}

const stars = (n) => html`<span class="stars" aria-label="${n}/5">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`;

// Moving strip of procurement quotes (Admin → Settings). Scrolls right to left, pauses on hover.
function quoteStrip(c, s) {
  if (s.quotes_enabled === "0") return "";
  const list = String(c.pick(s.quotes_en, s.quotes_bn) || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 30);
  if (!list.length) return "";
  const items = list.map((q) => html`<span class="quote-item"><span class="q-mark" aria-hidden="true">“</span><span>${q}</span></span>`);
  return html`<section class="quote-strip" aria-label="${c.L("Procurement quotes", "প্রকিউরমেন্ট বাণী")}"><div class="quote-track"><div class="quote-group">${items}</div><div class="quote-group" aria-hidden="true">${items}</div></div></section>`;
}

async function home(c) {
  const s = await c.settings();
  const [items, posts, levels, reviews] = await Promise.all([
    all(c.env, "SELECT * FROM items WHERE status='published' ORDER BY sort, id DESC LIMIT 4"),
    all(c.env, "SELECT * FROM posts WHERE section IN ('blog','negotiation','ai') AND status='published' ORDER BY published_at DESC LIMIT 3"),
    all(c.env, "SELECT * FROM exam_levels WHERE published=1 ORDER BY sort"),
    all(c.env, "SELECT name, role, rating, body, lang, created_at FROM reviews WHERE status='published' ORDER BY id DESC LIMIT 6"),
  ]);
  const lang = c.lang;
  const calcs = calcList(s);
  const v = await c.readyVisitor();
  const body = html`
<section class="hero">
  <div class="wrap">
    <span class="eyebrow" data-typewriter="${s["tagline_" + lang]}">${s["tagline_" + lang]}</span>
    <h1>${s["hero_title_" + lang]}</h1>
    <p class="lead">${s["hero_subtitle_" + lang]}</p>
    <div class="row">
      <a class="btn btn-primary btn-lg" href="${c.p("/calculators")}">${c.t("home.cta_calculators")}</a>
      <a class="btn btn-secondary btn-lg" href="${c.p("/library")}">${c.t("home.cta_library")}</a>
    </div>
    ${heroArt(c)}
  </div>
</section>

${quoteStrip(c, s)}

${calcs.length ? html`<section class="section alt" id="calculators">
  <div class="wrap">
    <div class="row between" style="margin-bottom:36px;align-items:flex-end">
      <div><span class="eyebrow">${c.t("home.featured_eyebrow")}</span><h2 style="margin:0">${c.t("home.featured_title")}</h2></div>
      <a class="link" href="${c.p("/calculators")}">${c.t("home.see_all")} ${icon("arrow-right", 16)}</a>
    </div>
    <div class="grid ${calcs.length === 4 ? "grid-4" : "grid-3"}">${calcs.map((k) => calcCard(c, k))}</div>
  </div>
</section>` : ""}

${levels.length ? html`<section class="section dark">
  <div class="wrap">
    <div class="center" style="max-width:720px;margin:0 auto 52px">
      <span class="eyebrow" style="color:#a1a1a6">${c.t("home.exams_eyebrow")}</span>
      <h2>${c.t("home.exams_title")}</h2>
      <p class="lead">${c.t("home.exams_lead")}</p>
    </div>
    <div class="grid grid-3">${paidLeft(levels, 3, (l) => l.price > 0).map((lv) => html`
      <a class="card dark level-card" href="${c.p("/exams/" + lv.code)}">
        ${lv.thumb_id ? html`<img class="exam-thumb" src="/media/${lv.thumb_id}" alt="" loading="lazy">` : ""}
        <div class="row" style="gap:6px"><span class="tag" style="background:#333;color:#fff">${c.pick(lv.title_en, lv.title_bn)}</span>
          ${lv.price > 0 ? html`<span class="tag" style="background:#fff;color:#000">${c.t("exam.paid")} · ${c.money(lv.price)}</span>` : html`<span class="tag free-tag">${c.t("exam.free")}</span>`}</div>
        <div class="meta">
          <div><strong>${c.d(lv.question_count)}</strong>${c.t("exam.questions")}</div>
          <div><strong>${c.d(lv.time_limit_min)}</strong>${c.t("exam.minutes")}</div>
          <div><strong>${c.d(lv.pass_mark)}%</strong>${c.t("exam.to_pass")}</div>
        </div>
        <p>${c.pick(lv.desc_en, lv.desc_bn)}</p>
        <p class="small" style="margin-top:14px;color:#d2d2d7">${icon(lv.certificate ? "award" : "chat", 15)} ${certBadge(c, lv)}</p>
      </a>`)}
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
    <div class="grid grid-4">${paidLeft(items, 4, (i) => i.price > 0).map((it) => itemCard(c, it))}</div>
  </div>
</section>` : ""}

<section class="section alt">
  <div class="wrap">
    <div class="row between" style="margin-bottom:36px;align-items:flex-end">
      <div><span class="eyebrow">${c.t("home.blog_eyebrow")}</span><h2 style="margin:0">${posts.length ? c.t("home.blog_title") : c.t("home.learn_cards_title")}</h2></div>
      ${posts.length ? html`<a class="link" href="${c.p("/blog")}">${c.t("home.see_all")} ${icon("arrow-right", 16)}</a>` : ""}
    </div>
    <div class="grid grid-3">
      ${posts.map((p) => postCard(c, p, p.section))}
      ${posts.length < 3 ? html`
      <a class="card hover" href="${c.p("/negotiation-guru")}"><div class="card-icon">${icon("chat", 22)}</div><h3>${c.t("nav.negotiation")}</h3><p>${c.t("section.negotiation.lead")}</p><div class="card-foot">${c.t("common.open")} ${icon("arrow-right", 16)}</div></a>
      <a class="card hover" href="${c.p("/procurement-ai")}"><div class="card-icon">${icon("sparkle", 22)}</div><h3>${c.t("nav.ai")}</h3><p>${c.t("section.ai.lead")}</p><div class="card-foot">${c.t("common.open")} ${icon("arrow-right", 16)}</div></a>` : ""}
    </div>
  </div>
</section>

<section class="section" id="reviews">
  <div class="wrap">
    <div class="row between" style="margin-bottom:32px;align-items:flex-end">
      <div><span class="eyebrow">${c.t("reviews.eyebrow")}</span><h2 style="margin:0">${c.t("reviews.title")}</h2></div>
      <button class="btn btn-secondary" type="button" data-toggle-target="review-form">${icon("chat", 16)} ${c.t("reviews.write")}</button>
    </div>
    ${reviews.length ? html`<div class="grid grid-3">${reviews.map((r) => html`<figure class="card review-card">
        ${stars(r.rating)}
        <blockquote lang="${r.lang}">${r.body}</blockquote>
        <figcaption><strong>${r.name}</strong>${r.role ? html`<span class="small muted">${r.role}</span>` : ""}</figcaption></figure>`)}</div>`
      : html`<p class="empty" style="padding:40px 20px">${c.t("reviews.empty")}</p>`}
    <div class="panel review-form" id="review-form" hidden style="margin-top:24px">
      <form action="/api/reviews" data-json-form data-needs-email data-hide-on-ok novalidate>
        <div class="form-grid">
          <div class="field"><label for="r-name">${c.t("reviews.name")} *</label><input id="r-name" name="name" required maxlength="80" autocomplete="name"></div>
          <div class="field"><label for="r-role">${c.t("reviews.role")}</label><input id="r-role" name="role" maxlength="100"></div>
          <div class="field full"><span class="label">${c.t("reviews.rating")}</span>
            <div class="rate-input">${[5, 4, 3, 2, 1].map((n) => html`<input type="radio" name="rating" id="rate-${n}" value="${n}" ${n === 5 ? raw("checked") : ""}><label for="rate-${n}" title="${n}">★</label>`)}</div></div>
          <div class="field full"><label for="r-text">${c.t("reviews.text")} *</label><textarea id="r-text" name="body" required minlength="20" maxlength="800" rows="4"></textarea></div>
        </div>
        <div class="alert" data-form-msg hidden style="margin-top:16px"></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${c.t("reviews.submit")}</button>
          ${v ? html`<span class="tiny muted">${c.t("gate.as", { email: v.email })}</span>` : ""}</div>
      </form>
    </div>
  </div>
</section>

<section class="section alt" id="newsletter">
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
  return html`<a class="card hover post-card ${p.cover_id ? "has-cover" : ""}" href="${c.p(`/${SECTION_PATH[section] || section}/${p.slug}`)}" data-search="${(p.title_en + " " + p.title_bn + " " + p.summary_en + " " + p.summary_bn).toLowerCase()}" data-cat="${p.category}">
    ${p.cover_id ? html`<img class="post-cover" src="/media/${p.cover_id}" alt="" loading="lazy">` : ""}
    <div class="row" style="gap:6px;margin-bottom:12px">${section !== "blog" && section !== "career" ? html`<span class="tag dark">${secNav(c, section)}</span>` : ""}${p.category ? html`<span class="tag">${catLabel(c, p.category)}</span>` : ""}</div>
    <h3>${c.pick(p.title_en, p.title_bn)}</h3>
    <p>${c.pick(p.summary_en, p.summary_bn)}</p>
    <div class="card-foot muted">${c.date(p.published_at)}</div></a>`;
}

// ------------------------------------------------------------------ calculators
async function calcDirectory(c) {
  const calcs = calcList(await c.settings());
  const body = html`${pageHead(c, { title: c.t("calc.dir_title"), lead: c.t("calc.dir_lead") })}
  <section class="section-sm" style="padding-top:0"><div class="wrap"><div class="grid ${calcs.length === 4 ? "grid-2" : "grid-3"}">${calcs.map((k) => calcCard(c, k))}</div></div></section>`;
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
  if (calcOff(s).has(def.slug)) return calcOffPage(c);
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
  const others = calcList(s).filter((k) => k.slug !== def.slug);
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
    <div class="grid ${others.length === 3 ? "grid-3" : "grid-2"}" style="margin-top:24px">${others.map((k) => calcCard(c, k))}</div>
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
        ${TYPES.filter((t) => counts[t] || type === t).map((t) => html`<button type="button" class="chip ${type === t ? "on" : ""}" data-dir-cat="${t}">${c.t("lib.type." + t)} <span class="muted">${c.d(counts[t])}</span></button>`)}
      </div>
    </div>
    ${items.length ? html`<div class="grid grid-3">${paidLeft(items, 3, (i) => i.price > 0).map((it) => itemCard(c, it))}</div>
      <p class="empty" data-dir-empty hidden>${c.t("dir.no_results")}</p>` : html`<p class="empty">${c.t("lib.none")}</p>`}
  </div>
</section>`;
  return c.html(await layout(c, { title: c.t("lib.title"), description: c.t("lib.meta"), body }));
}

async function libraryItem(c) {
  const it = await one(c.env, "SELECT * FROM items WHERE slug=? AND status='published'", c.params.slug);
  if (!it) throw new HttpError(404);
  const file = it.file_id ? await one(c.env, "SELECT name, size, mime FROM files WHERE id=? AND complete=1", it.file_id) : null;
  const v = await c.readyVisitor();
  let owned = false, pending = null;
  if (v && it.price > 0) {
    owned = Boolean(await one(c.env, "SELECT id FROM entitlements WHERE email=? AND item_type='file' AND item_ref=?", v.email, it.slug));
    if (!owned) pending = await one(c.env, "SELECT ref FROM orders WHERE email=? AND item_type='file' AND item_ref=? AND status='pending'", v.email, it.slug);
  }
  const s = await c.settings();
  const preview = it.preview_id ? await one(c.env, "SELECT id, name FROM files WHERE id=? AND complete=1", it.preview_id) : null;
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
      ${it.cover_id ? html`<img class="item-cover-lg" src="/media/${it.cover_id}" alt="${itemTitle(c, it)}">` : html`<div class="card-icon" style="width:64px;height:64px">${icon(TYPE_ICON[it.type], 30)}</div>`}
      <div class="row" style="gap:6px;margin-bottom:12px"><span class="tag outline">${c.t("lib.one." + it.type)}</span>${priceTag(c, it.price)}</div>
      <h1 style="font-size:clamp(32px,4vw,48px)">${itemTitle(c, it)}</h1>
      <p class="lead">${c.pick(it.summary_en, it.summary_bn)}</p>
      ${preview ? html`<h2 style="font-size:22px;margin-top:32px">${c.t("lib.preview")}</h2>
        <div class="pdf-preview"><iframe src="/preview/${it.slug}#view=FitH" title="${c.t("lib.preview")}" loading="lazy"></iframe></div>
        <p class="small" style="margin-top:8px"><a class="link" href="/preview/${it.slug}" target="_blank" rel="noopener">${icon("eye", 16)} ${c.t("lib.preview_open")}</a></p>` : ""}
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

// Public images (covers, thumbnails, article pictures). Only image files are served here;
// downloadable files always go through the email-checked download link.
async function media(c) {
  const { getFile, fileResponse } = await import("../lib/files.js");
  const f = await getFile(c.env, c.params.id);
  if (!f || !f.complete || !f.mime.startsWith("image/")) throw new HttpError(404);
  return fileResponse(c.env, f, "inline", { "Cache-Control": "public, max-age=604800" });
}

// Public PDF preview (a sample file the admin uploads separately from the real download).
async function preview(c) {
  const it = await one(c.env, "SELECT preview_id FROM items WHERE slug=? AND status='published'", c.params.slug);
  if (!it || !it.preview_id) throw new HttpError(404);
  const { getFile, fileResponse } = await import("../lib/files.js");
  const f = await getFile(c.env, it.preview_id);
  if (!f || !f.complete || f.mime !== "application/pdf") throw new HttpError(404);
  return fileResponse(c.env, f, "inline", { "Cache-Control": "public, max-age=3600" });
}

async function calcOffPage(c) {
  const body = html`<section class="section"><div class="wrap wrap-narrow center"><h1 style="font-size:40px">${c.t("calc.off")}</h1>
    <div class="row" style="justify-content:center;margin-top:20px"><a class="btn btn-primary" href="${c.p("/calculators")}">${c.t("nav.all_calculators")}</a></div></div></section>`;
  return c.html(await layout(c, { title: c.t("calc.off"), body, noindex: true }), 404);
}

// ------------------------------------------------------------------ blog & career
async function postList(c, section) {
  const q = (c.url.searchParams.get("q") || "").trim().slice(0, 80);
  const cat = (c.url.searchParams.get("category") || "").trim().slice(0, 40);
  const posts = await all(c.env, "SELECT * FROM posts WHERE section=? AND status='published' ORDER BY published_at DESC", section);
  const cats = [...new Set(posts.map((p) => p.category).filter(Boolean))];
  // Negotiation Guru and Procurement AI also show the books and courses the admin tagged for them.
  const hub = section === "negotiation" || section === "ai";
  const books = hub ? await all(c.env, "SELECT * FROM items WHERE status='published' AND section=? ORDER BY sort, id DESC", section) : [];
  const courses = hub ? await all(c.env, "SELECT * FROM courses WHERE status='published' AND section=? ORDER BY sort, id DESC", section) : [];
  const extras = books.length + courses.length > 0;
  const body = html`${pageHead(c, { title: secT(c, section, "title"), lead: secT(c, section, "lead") })}
${extras ? html`<section class="section-sm" style="padding-top:0"><div class="wrap">
  <div class="chips" style="margin-bottom:8px">
    ${courses.length ? html`<a class="chip" href="#courses">${c.t("nav.courses")} <span class="muted">${c.d(courses.length)}</span></a>` : ""}
    ${books.length ? html`<a class="chip" href="#books">${c.t("nav.books")} <span class="muted">${c.d(books.length)}</span></a>` : ""}
    ${posts.length ? html`<a class="chip" href="#articles">${c.t("nav.articles")} <span class="muted">${c.d(posts.length)}</span></a>` : ""}
  </div>
  ${courses.length ? html`<h2 class="hub-h" id="courses">${c.t("nav.courses")}</h2><div class="grid grid-3">${paidLeft(courses, 3, (k) => k.price > 0).map((k) => courseCard(c, k))}</div>` : ""}
  ${books.length ? html`<h2 class="hub-h" id="books">${c.t("nav.books")}</h2><div class="grid grid-3">${paidLeft(books, 3, (it) => it.price > 0).map((it) => itemCard(c, it))}</div>` : ""}
</div></section>` : ""}
<section class="section-sm" style="padding-top:0" id="articles">
  <div class="wrap" data-directory>
    ${extras && posts.length ? html`<h2 class="hub-h" style="margin-top:0">${c.t("nav.articles")}</h2>` : ""}
    ${posts.length ? html`<div class="toolbar">
      <div class="search">${icon("search", 18)}<input type="search" value="${q}" placeholder="${c.t("learn.search")}" aria-label="${c.t("learn.search")}" data-dir-search></div>
      ${cats.length > 1 ? html`<div class="chips" role="group"><button type="button" class="chip ${cat ? "" : "on"}" data-dir-cat="">${c.t("dir.all")}</button>
        ${cats.map((k) => html`<button type="button" class="chip ${cat === k ? "on" : ""}" data-dir-cat="${k}">${catLabel(c, k)}</button>`)}</div>` : ""}
    </div>
    <div class="grid grid-3">${posts.map((p) => postCard(c, p, section))}</div>
    <p class="empty" data-dir-empty hidden>${c.t("post.none")}</p>` : extras ? "" : html`<div class="empty"><p style="margin:0 0 16px">${section === "career" ? c.t("career.none") : c.t("section.empty")}</p>
      <button class="btn btn-primary" type="button" data-subscribe data-done="${c.L("✓ Subscribed — thank you", "✓ সাবস্ক্রাইব হয়েছে — ধন্যবাদ")}">${c.t("newsletter.subscribe")}</button></div>`}
  </div>
</section>`;
  return c.html(await layout(c, { title: secT(c, section, "title"), description: secT(c, section, "meta"), body, gate: !posts.length }));
}

async function postPage(c, section) {
  const p = await one(c.env, "SELECT * FROM posts WHERE section=? AND slug=? AND status='published'", section, c.params.slug);
  if (!p) throw new HttpError(404);
  const base = "/" + SECTION_PATH[section];
  const fallback = c.lang === "bn" ? !p.body_bn : !p.body_en;
  const more = await all(c.env, "SELECT slug, title_en, title_bn FROM posts WHERE section=? AND status='published' AND id<>? ORDER BY (category=?) DESC, published_at DESC LIMIT 4", section, p.id, p.category);
  let refs = [];
  try { refs = JSON.parse(p.refs_json || "[]"); } catch { refs = []; }
  const relCalc = { tco: "total-cost-of-ownership", "bangladesh-import": "shipping-import-cost", incoterms: "shipping-import-cost", "import-documentation": "shipping-import-cost", "china-sourcing": "shipping-import-cost", "supplier-evaluation": "comparative-statement", fundamentals: "comparative-statement", negotiation: "total-cost-of-ownership" }[p.category];
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: c.pick(p.title_en, p.title_bn), description: c.pick(p.summary_en, p.summary_bn), inLanguage: c.lang, datePublished: p.published_at, dateModified: p.updated_at, author: { "@type": "Organization", name: p.author || "ProcureBest" }, publisher: { "@type": "Organization", name: "ProcureBest" } };
  const body = html`<article>
<section class="page-head" style="padding-bottom:24px">
  <div class="wrap wrap-narrow">
    <nav class="crumbs"><a href="${c.p(base)}">${secNav(c, section)}</a>${p.category ? html`<span>/</span><span>${catLabel(c, p.category)}</span>` : ""}</nav>
    <h1 style="max-width:none">${c.pick(p.title_en, p.title_bn)}</h1>
    <p class="lead">${c.pick(p.summary_en, p.summary_bn)}</p>
    <div class="article-meta"><span>${c.t("learn.by", { author: p.author || "ProcureBest" })}</span>${p.published_at ? html`<span>${c.t("learn.published")}: ${c.date(p.published_at)}</span>` : ""}</div>
    ${fallback ? html`<div class="alert alert-info" style="margin-top:18px">${icon("globe", 18)}<div>${c.t("learn.fallback")}</div></div>` : ""}
  </div>
</section>
${p.cover_id ? html`<div class="wrap wrap-narrow"><img class="article-cover" src="/media/${p.cover_id}" alt=""></div>` : ""}
<section class="section-sm" style="padding-top:12px">
  <div class="wrap wrap-narrow">
    <div class="prose" ${fallback ? raw(`lang="${c.lang === "bn" ? "en" : "bn"}"`) : ""}>${raw(markdown(c.pick(p.body_en, p.body_bn)))}</div>
    ${refs.length ? html`<h2 style="font-size:22px;margin-top:48px">${c.t("learn.references")}</h2><ol class="method-list">${refs.map((r) => html`<li>${r.url ? html`<a href="${r.url}" rel="noopener nofollow" target="_blank">${r.title || r.url}</a>` : r.title}</li>`)}</ol>` : ""}
    ${relCalc && !calcOff(await c.settings()).has(relCalc) ? html`<h2 style="font-size:22px;margin-top:48px">${c.t("learn.related_tools")}</h2><div class="grid grid-2" style="margin-top:16px">${calcCard(c, BY_SLUG[relCalc])}</div>` : ""}
    ${more.length ? html`<h2 style="font-size:22px;margin-top:48px">${c.t("learn.more")}</h2><ul class="feature-list">${more.map((m) => html`<li>${icon("book", 18)}<a href="${c.p(`${base}/${m.slug}`)}">${c.pick(m.title_en, m.title_bn)}</a></li>`)}</ul>` : ""}
  </div>
</section></article>`;
  return c.html(await layout(c, { title: c.pick(p.title_en, p.title_bn), description: c.pick(p.summary_en, p.summary_bn), pageType: "article", body,
    head: html`<script type="application/ld+json">${jsonScript(ld)}</script>`, ogImage: p.cover_id ? `${c.siteUrl}/media/${p.cover_id}` : "" }));
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

// ------------------------------------------------------------------ career roadmap
async function roadmapPage(c) {
  const s = await c.settings();
  if (calcOff(s).has(ROADMAP.slug)) return calcOffPage(c);
  let saved = null;
  try { saved = JSON.parse(s.roadmap_json || "null"); } catch { saved = null; }
  const data = mergeRoadmap(saved);
  const nm = (o) => c.pick(o.en, o.bn);
  const opt = (list, val) => list.map((o, i) => html`<option value="${o.key ?? i}" ${String(o.key ?? i) === String(val) ? raw("selected") : ""}>${nm(o)}</option>`);
  const levelOpts = (val) => data.levels.map((o, i) => html`<option value="${i}" ${i === val ? raw("selected") : ""}>${nm(o)}</option>`);
  const body = html`
<section class="page-head" style="padding-bottom:28px"><div class="wrap">
  <nav class="crumbs"><a href="${c.p("/")}">${c.t("nav.home")}</a><span>/</span><a href="${c.p("/calculators")}">${c.t("nav.calculators")}</a></nav>
  <h1 style="max-width:24ch">${tr(ROADMAP.title, c.lang)}</h1>
  <p class="lead">${tr(ROADMAP.summary, c.lang)}</p>
</div></section>
<section class="section-sm" style="padding-top:8px" data-roadmap>
  <div class="wrap calc-layout">
    <form class="panel" novalidate autocomplete="off">
      <div class="form-section"><h3>${c.L("Where you are", "আপনি এখন কোথায়")}</h3><div class="form-grid" style="margin-top:12px">
        <div class="field full"><label for="rm-current">${c.L("Current role", "বর্তমান পদ")}</label><select id="rm-current" name="current">${levelOpts(1)}</select></div>
        <div class="field"><label for="rm-inrole">${c.L("Years in this role", "এই পদে কত বছর")}</label><input id="rm-inrole" name="years_in_role" type="number" min="0" max="40" step="0.5" value="1" inputmode="decimal"></div>
        <div class="field"><label for="rm-total">${c.L("Total years of experience", "মোট অভিজ্ঞতা (বছর)")}</label><input id="rm-total" name="total_years" type="number" min="0" max="50" step="0.5" value="2" inputmode="decimal"></div>
        <div class="field full"><label for="rm-prev">${c.L("Previous role", "আগের পদ")}</label><select id="rm-prev" name="previous">${opt(PREVIOUS, "none")}</select></div>
        <div class="field"><label for="rm-edu">${c.L("Highest education", "সর্বোচ্চ শিক্ষাগত যোগ্যতা")}</label><select id="rm-edu" name="education">${opt(EDUCATION, "bachelor")}</select></div>
        <div class="field"><label for="rm-perf">${c.L("Your performance", "আপনার পারফরম্যান্স")}</label><select id="rm-perf" name="performance">${opt(PERFORMANCE, "good")}</select></div>
        <div class="field full"><label for="rm-ind">${c.L("Sector you work in", "যে খাতে কাজ করেন")}</label><select id="rm-ind" name="industry">${opt(data.industries, "local_large")}</select></div>
      </div></div>
      <div class="form-section"><h3>${c.L("Where you want to go", "কোথায় যেতে চান")}</h3><div class="form-grid" style="margin-top:12px">
        <div class="field full"><label for="rm-target">${c.L("Target role", "লক্ষ্য পদ")}</label><select id="rm-target" name="target">${levelOpts(4)}</select></div>
      </div></div>
      <div class="form-section"><h3>${c.L("Qualifications", "যোগ্যতা")}</h3>
        <p class="help">${c.L("Tick what you already have, and what you plan to start.", "যা আছে এবং যা শুরু করার পরিকল্পনা করছেন, টিক দিন।")}</p>
        <div class="table-wrap" style="margin-top:10px"><table class="rm-creds"><thead><tr><th>${c.L("Qualification", "যোগ্যতা")}</th><th>${c.L("I have it", "আছে")}</th><th>${c.L("I plan it", "পরিকল্পনা")}</th></tr></thead><tbody>
          ${data.credentials.map((cr) => html`<tr><td>${nm(cr)}</td><td><input type="checkbox" name="have" value="${cr.key}" aria-label="${nm(cr)} — ${c.L("have", "আছে")}"></td><td><input type="checkbox" name="plan" value="${cr.key}" aria-label="${nm(cr)} — ${c.L("plan", "পরিকল্পনা")}"></td></tr>`)}
        </tbody></table></div></div>
      <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">${c.L("Show my roadmap", "আমার রোডম্যাপ দেখান")}</button></div>
    </form>
    <div class="results-col"><div data-roadmap-result aria-live="polite"><div class="result-empty"><p style="margin:0">${c.t("common.loading")}</p></div></div></div>
  </div>
</section>
<section class="section-sm"><div class="wrap wrap-narrow">
  <details class="disclosure" open><summary>${c.t("calc.method")}</summary><div><ol class="method-list">
    <li>${c.L("Each role has a typical number of years before the next promotion and a typical salary range in Bangladesh.", "প্রতিটি পদের পরের পদোন্নতি পর্যন্ত সাধারণ সময় ও বাংলাদেশে সাধারণ বেতন-সীমা ধরা হয়েছে।")}</li>
    <li>${c.L("Your performance, education and previous role shorten or lengthen each step.", "আপনার পারফরম্যান্স, শিক্ষা ও আগের পদ প্রতিটি ধাপের সময় কমায় বা বাড়ায়।")}</li>
    <li>${c.L("Each qualification shortens promotion time and raises salary by a set percentage, adjusted for how much your sector values it. Combined effects are capped.", "প্রতিটি যোগ্যতা নির্দিষ্ট শতাংশে পদোন্নতির সময় কমায় ও বেতন বাড়ায়, আপনার খাত তা কতটা মূল্য দেয় সেই অনুযায়ী। সম্মিলিত প্রভাবের ঊর্ধ্বসীমা আছে।")}</li>
    <li>${c.L("Salary ranges are multiplied by the sector factor (for example, multinationals usually pay more).", "বেতন-সীমা খাতভিত্তিক গুণক দিয়ে গুণ করা হয় (যেমন বহুজাতিক কোম্পানি সাধারণত বেশি দেয়)।")}</li>
  </ol></div></details>
  <details class="disclosure" open><summary>${c.t("calc.important")}</summary><div><p class="muted">${c.L("All figures are indicative estimates for planning, not offers or guarantees. Check current job ads and salary surveys for your field.", "সব সংখ্যা পরিকল্পনার জন্য আনুমানিক হিসাব, কোনো প্রস্তাব বা নিশ্চয়তা নয়। নিজের ক্ষেত্রের বর্তমান চাকরির বিজ্ঞাপন ও বেতন জরিপ দেখে নিন।")}</p></div></details>
</div></section>
<script type="application/json" id="roadmap-data">${jsonScript(data)}</script>`;
  return c.html(await layout(c, { title: tr(ROADMAP.title, c.lang), description: tr(ROADMAP.summary, c.lang), body, scripts: ["/js/calc/roadmap-ui.js"] }));
}

// ------------------------------------------------------------------ courses
const VIDEO_RE = /^\s*(https?:\/\/\S+)\s*$/;
function videoEmbed(url) {
  let m = url.match(/^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = url.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  m = url.match(/^https?:\/\/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return null;
}
// Course content: Markdown, where a line holding only a YouTube / Vimeo / Google Drive link becomes a video player.
export function courseContent(text) {
  const videos = [];
  const src = String(text || "").split("\n").map((line) => {
    const m = line.match(VIDEO_RE);
    const e = m && videoEmbed(m[1]);
    if (!e) return line;
    videos.push(e);
    return `\nPBVIDEO${videos.length - 1}PB\n`;
  }).join("\n");
  return markdown(src).replace(/<p>PBVIDEO(\d+)PB<\/p>/g, (_, i) => `<div class="video"><iframe src="${videos[Number(i)]}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`);
}

function courseCard(c, k) {
  return html`<a class="card hover course-card" href="${c.p("/courses/" + k.slug)}">
    ${k.thumb_id ? html`<img class="course-thumb" src="/media/${k.thumb_id}" alt="" loading="lazy">` : html`<div class="course-thumb placeholder">${icon(k.kind === "live" ? "calendar" : "book-open", 34)}</div>`}
    <div class="row" style="gap:6px;margin:16px 0 10px"><span class="tag ${k.kind === "live" ? "dark" : "outline"}">${c.t("courses.one." + k.kind)}</span>${priceTag(c, k.price)}</div>
    <h3>${c.pick(k.title_en, k.title_bn)}</h3><p>${plain(c.pick(k.summary_en, k.summary_bn), 140)}</p>
    ${c.pick(k.schedule_en, k.schedule_bn) ? html`<div class="card-foot muted">${icon("calendar", 15)} ${c.pick(k.schedule_en, k.schedule_bn)}</div>` : ""}</a>`;
}

async function coursesPage(c) {
  const kind = ["live", "recorded"].includes(c.url.searchParams.get("kind")) ? c.url.searchParams.get("kind") : "";
  const list = await all(c.env, "SELECT * FROM courses WHERE status='published' ORDER BY sort, id DESC");
  const shown = kind ? list.filter((k) => k.kind === kind) : list;
  const body = html`${pageHead(c, { title: c.t("courses.title"), lead: c.t("courses.lead") })}
<section class="section-sm" style="padding-top:0"><div class="wrap">
  ${list.length ? html`<div class="chips" style="margin-bottom:28px"><a class="chip ${kind ? "" : "on"}" href="${c.p("/courses")}">${c.t("dir.all")}</a>
      <a class="chip ${kind === "live" ? "on" : ""}" href="${c.p("/courses?kind=live")}">${c.t("courses.live")}</a><a class="chip ${kind === "recorded" ? "on" : ""}" href="${c.p("/courses?kind=recorded")}">${c.t("courses.recorded")}</a></div>
    ${shown.length ? html`<div class="grid grid-3">${paidLeft(shown, 3, (k) => k.price > 0).map((k) => courseCard(c, k))}</div>` : html`<p class="empty">${c.t("courses.none_kind")}</p>`}`
  : html`<div class="panel center" style="max-width:640px;margin:0 auto"><div class="card-icon" style="margin:0 auto 16px">${icon("calendar", 22)}</div>
      <h2 style="font-size:30px">${c.t("courses.soon_title")}</h2><p class="muted">${c.t("courses.soon")}</p>
      <button class="btn btn-primary" type="button" data-subscribe data-done="${c.L("✓ We will let you know", "✓ আমরা জানিয়ে দেব")}">${c.t("courses.notify")}</button></div>`}
</div></section>`;
  return c.html(await layout(c, { title: c.t("courses.title"), description: c.t("courses.meta"), body, gate: !list.length }));
}

async function coursePage(c) {
  const k = await one(c.env, "SELECT * FROM courses WHERE slug=? AND status='published'", c.params.slug);
  if (!k) throw new HttpError(404);
  const v = await c.readyVisitor();
  const s = await c.settings();
  const ready = v && (v.verified || !mailConfigured(c.env, s));
  const owned = k.price <= 0 || (ready && await one(c.env, "SELECT id FROM entitlements WHERE email=? AND item_type='course' AND item_ref=?", v.email, k.slug));
  const pending = !owned && v ? await one(c.env, "SELECT ref FROM orders WHERE email=? AND item_type='course' AND item_ref=? AND status='pending'", v.email, k.slug) : null;
  const content = c.pick(k.content_en, k.content_bn);
  const schedule = c.pick(k.schedule_en, k.schedule_bn);
  const body = html`
<section class="page-head" style="padding-bottom:24px"><div class="wrap">
  <nav class="crumbs"><a href="${c.p("/courses")}">${c.t("nav.courses")}</a><span>/</span><a href="${c.p("/courses?kind=" + k.kind)}">${c.t("courses." + k.kind)}</a></nav>
</div></section>
<section class="section-sm" style="padding-top:0"><div class="wrap split" style="align-items:start;gap:48px">
  <div>
    ${k.thumb_id ? html`<img class="course-hero" src="/media/${k.thumb_id}" alt="">` : ""}
    <div class="row" style="gap:6px;margin:18px 0 12px"><span class="tag ${k.kind === "live" ? "dark" : "outline"}">${c.t("courses.one." + k.kind)}</span>${priceTag(c, k.price)}</div>
    <h1 style="font-size:clamp(32px,4vw,48px)">${c.pick(k.title_en, k.title_bn)}</h1>
    <p class="lead">${c.pick(k.summary_en, k.summary_bn)}</p>
    <div class="prose" style="font-size:16px">${raw(markdown(c.pick(k.body_en, k.body_bn)))}</div>
    ${content ? html`<h2 style="font-size:24px;margin-top:36px">${c.t("courses.content")}</h2>
      ${owned ? html`${k.price > 0 ? html`<div class="alert alert-ok" style="margin:12px 0">${icon("check-circle", 18)}<div>${c.t("courses.enrolled")}</div></div>` : ""}<div class="prose course-content" style="font-size:16px">${raw(courseContent(content))}</div>`
        : html`<div class="alert alert-info" style="margin-top:12px">${icon("lock", 18)}<div>${c.t("courses.locked")}</div></div>`}` : ""}
  </div>
  <aside class="panel" style="position:sticky;top:calc(var(--nav-h) + 20px)">
    <ul class="details-list" style="margin-top:0">
      <li><span>${c.t("common.price")}</span><span>${k.price > 0 ? c.money(k.price) : c.t("lib.free")}</span></li>
      ${schedule ? html`<li><span>${c.t("courses.schedule")}</span><span>${schedule}</span></li>` : ""}
      ${k.duration ? html`<li><span>${c.t("courses.duration")}</span><span>${k.duration}</span></li>` : ""}
    </ul>
    <div style="margin-top:22px">${owned ? (k.price > 0 ? html`<div class="alert alert-ok">${icon("check-circle", 18)}<div>${c.t("courses.enrolled")}</div></div>` : "")
      : pending ? html`<div class="alert alert-warn">${icon("clock", 18)}<div>${c.t("lib.pending")} (${pending.ref})</div></div>`
      : html`<a class="btn btn-primary btn-lg" style="width:100%" href="${c.p("/buy/course/" + k.slug)}">${icon("cart", 18)} ${c.t("courses.enroll", { price: c.money(k.price) })}</a>`}</div>
    <div style="margin-top:14px">${waButton(c, s, "btn-sm")}</div>
  </aside>
</div></section>`;
  return c.html(await layout(c, { title: c.pick(k.title_en, k.title_bn), description: plain(c.pick(k.summary_en, k.summary_bn), 160), body, ogImage: k.thumb_id ? `${c.siteUrl}/media/${k.thumb_id}` : "" }));
}

// ------------------------------------------------------------------ sitemap & robots
async function sitemap(c) {
  const [posts, items, courses] = await Promise.all([
    all(c.env, "SELECT section, slug, updated_at FROM posts WHERE status='published'"),
    all(c.env, "SELECT slug, updated_at FROM items WHERE status='published'"),
    all(c.env, "SELECT slug FROM courses WHERE status='published'"),
  ]);
  const paths = ["/", "/calculators", ...calcList(await c.settings()).map((k) => "/calculators/" + k.slug), "/exams", "/library", "/courses", "/blog", "/negotiation-guru", "/procurement-ai", "/glossary", "/career",
    "/certificates/verify", "/about", "/contact", "/help", "/privacy", "/terms", "/certificate-policy", "/disclaimer",
    ...posts.map((p) => `/${SECTION_PATH[p.section] || p.section}/${p.slug}`), ...items.map((i) => "/library/" + i.slug), ...courses.map((k) => "/courses/" + k.slug)];
  const urls = paths.flatMap((p) => ["en", "bn"].map((l) => `<url><loc>${c.siteUrl}/${l}${p === "/" ? "/" : p}</loc><xhtml:link rel="alternate" hreflang="en" href="${c.siteUrl}/en${p === "/" ? "/" : p}"/><xhtml:link rel="alternate" hreflang="bn" href="${c.siteUrl}/bn${p === "/" ? "/" : p}"/></url>`));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

export function registerPublic(r) {
  const L = "/:lang(en|bn)";
  r.get(`${L}`, home);
  r.get(`${L}/calculators`, calcDirectory);
  r.get(`${L}/calculators/career-roadmap`, roadmapPage);
  r.get(`${L}/calculators/:slug`, calcPage);
  r.get(`${L}/courses`, coursesPage);
  r.get(`${L}/courses/:slug`, coursePage);
  r.get(`/preview/:slug`, preview);
  r.get(`${L}/library`, library);
  r.get(`${L}/library/:slug`, libraryItem);
  r.get(`/media/:id`, media);
  r.get(`${L}/blog`, (c) => postList(c, "blog"));
  r.get(`${L}/blog/:slug`, (c) => postPage(c, "blog"));
  r.get(`${L}/learn/:slug`, (c) => c.redirect(c.p("/blog/" + c.params.slug), 301));
  r.get(`${L}/career`, (c) => postList(c, "career"));
  r.get(`${L}/career/:slug`, (c) => postPage(c, "career"));
  r.get(`${L}/negotiation-guru`, (c) => postList(c, "negotiation"));
  r.get(`${L}/negotiation-guru/:slug`, (c) => postPage(c, "negotiation"));
  r.get(`${L}/procurement-ai`, (c) => postList(c, "ai"));
  r.get(`${L}/procurement-ai/:slug`, (c) => postPage(c, "ai"));
  r.get(`${L}/glossary`, glossary);
  r.get(`${L}/:page(about|help|privacy|terms|disclaimer|contact|certificate-policy)`, (c) => infoPage(c, c.params.page));
  r.get("/sitemap.xml", sitemap);
  r.get("/robots.txt", (c) => new Response(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /dl/\nDisallow: /en/my\nDisallow: /bn/my\nSitemap: ${c.siteUrl}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain" } }));
}
