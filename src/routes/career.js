// Career Hub: home, roadmap tree, job role library, career analysis, skills assessment, certifications,
// tools, CV & LinkedIn toolkit, interview preparation, salary benchmark and opportunities.
// All content comes from the database (Admin → Career Management).
import { html, raw, jsonScript } from "../lib/util.js";
import { one, all } from "../lib/db.js";
import { layout, pageHead } from "../views/layout.js";
import { icon } from "../views/icons.js";
import { markdown, plain } from "../lib/markdown.js";
import { HttpError } from "../app.js";
import { careerData, careerOff, homeOrder, TRACKS, CERT_KINDS, Q_KINDS, BASIS } from "../lib/career.js";
import { parseWeights } from "../../public/js/career/engine.js";
import { skateHub } from "../views/skate.js";
import { postList, postPage, catLabel, itemCard } from "./public.js";

const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
const pk = (c, o, f) => c.pick(o[f + "_en"], o[f + "_bn"]);
const UL = (items) => (items.length ? html`<ul class="cr-list">${items.map((x) => html`<li>${x}</li>`)}</ul>` : "");
const yrs = (c, a, b) => (b && b > a ? c.L(`${c.num(a, a % 1 ? 1 : 0)}–${c.num(b, b % 1 ? 1 : 0)} years`, `${c.num(a, a % 1 ? 1 : 0)}–${c.num(b, b % 1 ? 1 : 0)} বছর`) : c.L(`${c.num(a)}+ years`, `${c.num(a)}+ বছর`));

// Sub-navigation shared by every Career Hub page.
export const HUB = [
  ["home", "", "Career Home", "ক্যারিয়ার হোম"], ["roadmap", "/roadmap", "Roadmap", "রোডম্যাপ"], ["job-roles", "/job-roles", "Job Roles", "জব রোল"],
  ["career-analysis", "/career-analysis", "Career Analysis", "ক্যারিয়ার অ্যানালাইসিস"], ["skills-assessment", "/skills-assessment", "Skills Assessment", "স্কিলস অ্যাসেসমেন্ট"],
  ["certifications", "/certifications", "Certifications", "সার্টিফিকেশন"], ["tools", "/tools", "Career Tools", "ক্যারিয়ার টুলস"], ["cv-linkedin", "/cv-linkedin", "CV & LinkedIn", "সিভি ও লিংকডইন"],
  ["interview-preparation", "/interview-preparation", "Interview Prep", "ইন্টারভিউ প্রস্তুতি"], ["salary-benchmark", "/salary-benchmark", "Salary Benchmark", "বেতন বেঞ্চমার্ক"],
  ["opportunities", "/opportunities", "Opportunities", "সুযোগ"], ["blog", "/blog", "Career Blog", "ক্যারিয়ার ব্লগ"],
];
export const hubLinks = (c, s) => { const off = careerOff(s); return HUB.filter(([k]) => k === "home" || !off.has(k)); };
function hubNav(c, s, active) {
  return html`<nav class="hub-nav" aria-label="${c.L("Career Hub", "ক্যারিয়ার হাব")}"><div class="wrap"><div class="hub-nav-row">
    ${hubLinks(c, s).map(([k, p, en, bn]) => html`<a href="${c.p("/career" + p)}" class="${k === active ? "on" : ""}" ${k === active ? raw('aria-current="page"') : ""}>${c.L(en, bn)}</a>`)}</div></div></nav>`;
}
async function page(c, { key, title, lead, body, description, crumbs = true, scripts = [], data = null, head = "" }) {
  const s = await c.settings();
  const full = html`${hubNav(c, s, key)}${title ? pageHead(c, { title, lead, crumbs: crumbs && key !== "home" ? [[c.L("Career Hub", "ক্যারিয়ার হাব"), c.p("/career")], [title]] : [] }) : ""}${body}
    ${data ? html`<script type="application/json" id="career-data">${jsonScript(data)}</script>` : ""}`;
  return c.html(await layout(c, { title: title || c.pick(s.career_title_en, s.career_title_bn), description: description || (lead ? plain(lead, 160) : c.pick(s.career_lead_en, s.career_lead_bn)), body: full, scripts: ["/js/career/ui.js", ...scripts], head }));
}
async function guard(c, key) {
  const s = await c.settings();
  if (careerOff(s).has(key)) throw new HttpError(404);
  return s;
}
const preparing = (c) => html`<div class="panel center" style="max-width:640px;margin:0 auto"><div class="card-icon" style="margin:0 auto 16px">${icon("briefcase", 22)}</div>
  <h2 style="font-size:28px">${c.L("This section is being prepared", "এই অংশটি তৈরি হচ্ছে")}</h2><p class="muted">${c.L("Please check back soon.", "শিগগিরই আবার দেখুন।")}</p></div>`;

function roleCard(c, r, levels) {
  const lv = levels.find((l) => l.slug === r.level_slug);
  return html`<a class="card hover role-card" href="${c.p("/career/job-roles/" + r.slug)}" data-search="${(r.title_en + " " + r.title_bn + " " + (r.overview_en || "")).toLowerCase()}" data-cat="${r.level_slug}">
    <div class="row" style="gap:6px;margin-bottom:10px">${lv ? html`<span class="tag dark">${c.pick(lv.title_en, lv.title_bn)}</span>` : ""}${TRACKS[r.track] ? html`<span class="tag">${c.pick(...TRACKS[r.track])}</span>` : ""}</div>
    <h3 style="font-size:19px">${c.pick(r.title_en, r.title_bn)}</h3><p>${plain(c.pick(r.overview_en, r.overview_bn), 120)}</p>
    <div class="card-foot muted">${icon("clock", 15)} ${yrs(c, r.exp_min, r.exp_max)} · ${c.L("indicative", "আনুমানিক")}</div></a>`;
}
function certCard(c, x) {
  return html`<a class="card hover" href="${c.p("/career/certifications/" + x.slug)}"><div class="card-icon">${icon("award", 22)}</div>
    <div class="row" style="gap:6px;margin-bottom:10px"><span class="tag outline">${CERT_KINDS[x.kind] ? c.pick(CERT_KINDS[x.kind][0], CERT_KINDS[x.kind][1]) : x.kind}</span></div>
    <h3 style="font-size:18px">${c.pick(x.name_en, x.name_bn)}</h3><p>${x.issuer}</p></a>`;
}
function toolCard(c, t) {
  const href = t.kind === "link" && t.url ? c.p(t.url) : c.p("/career/tools/" + t.slug);
  return html`<a class="card hover" href="${href}"><div class="card-icon">${icon(t.icon || "file", 22)}</div><h3 style="font-size:18px">${c.pick(t.name_en, t.name_bn)}</h3><p>${c.pick(t.desc_en, t.desc_bn)}</p>
    <div class="card-foot">${c.L("Open", "খুলুন")} ${icon("arrow-right", 16)}</div></a>`;
}
const careerPostCard = (c, p) => html`<a class="card hover post-card ${p.cover_id ? "has-cover" : ""}" href="${c.p("/career/blog/" + p.slug)}">
  ${p.cover_id ? html`<img class="post-cover" src="/media/${p.cover_id}" alt="" loading="lazy">` : ""}
  <div class="row" style="gap:6px;margin-bottom:12px">${p.category ? html`<span class="tag">${catLabel(c, p.category)}</span>` : ""}</div>
  <h3>${c.pick(p.title_en, p.title_bn)}</h3><p>${plain(c.pick(p.summary_en, p.summary_bn), 130)}</p></a>`;
const visiblePosts = "status='published' AND (published_at IS NULL OR published_at <= date('now'))";

// ------------------------------------------------------------------ home
async function careerHome(c) {
  const s = await c.settings();
  const off = careerOff(s);
  const d = await careerData(c, false);
  const [posts, certs, tools, qn] = await Promise.all([
    all(c.env, `SELECT slug, title_en, title_bn, summary_en, summary_bn, category, cover_id FROM posts WHERE section='career' AND ${visiblePosts} ORDER BY featured DESC, views DESC, published_at DESC LIMIT 3`),
    all(c.env, "SELECT slug, kind, name_en, name_bn, issuer FROM certifications WHERE status='published' ORDER BY sort, id LIMIT 4"),
    all(c.env, "SELECT * FROM career_tools WHERE status='published' AND grp='tools' ORDER BY sort, id LIMIT 4"),
    one(c.env, "SELECT COUNT(*) AS n FROM career_questions WHERE status='published'"),
  ]);
  const head = (eyebrow, title, href, label) => html`<div class="row between" style="margin-bottom:28px;align-items:flex-end"><div><span class="eyebrow">${eyebrow}</span><h2 style="margin:0">${title}</h2></div>
    ${href ? html`<a class="link" href="${c.p(href)}">${label} ${icon("arrow-right", 16)}</a>` : ""}</div>`;
  const popular = ["procurement-officer", "procurement-manager", "category-manager", "sourcing-manager", "contract-manager", "procurement-analyst"].map((x) => d.roles.find((r) => r.slug === x)).filter(Boolean);
  const roles = popular.length ? popular : d.roles.slice(0, 6);
  const S = {
    journey: () => html`<section class="section-sm"><div class="wrap">${head(c.L("How it works", "কীভাবে কাজ করে"), c.L("Your career development journey", "আপনার ক্যারিয়ার উন্নয়নের যাত্রা"))}
      <ol class="journey">${[["map", "Understand", "বুঝুন", "See every procurement role and how they connect.", "প্রতিটি প্রকিউরমেন্ট পদ ও তাদের সংযোগ দেখুন।", "/career/roadmap"],
        ["bars", "Assess", "যাচাই করুন", "Rate your skills and find your gaps.", "নিজের দক্ষতা রেটিং দিন ও ঘাটতি খুঁজুন।", "/career/skills-assessment"],
        ["calendar", "Plan", "পরিকল্পনা করুন", "Get a personalised roadmap and 90-day plan.", "ব্যক্তিগত রোডম্যাপ ও ৯০ দিনের পরিকল্পনা পান।", "/career/career-analysis"],
        ["award", "Grow", "এগিয়ে যান", "Choose qualifications, prepare for interviews, apply.", "যোগ্যতা বাছুন, ইন্টারভিউর প্রস্তুতি নিন, আবেদন করুন।", "/career/certifications"]].map(([ic, en, bn, den, dbn, href], i) => html`
        <li><a href="${c.p(href)}"><span class="journey-n">${c.d(i + 1)}</span><strong>${c.L(en, bn)}</strong><span class="small muted">${c.L(den, dbn)}</span></a></li>`)}</ol></div></section>`,
    roadmap: () => off.has("roadmap") || !d.levels.length ? "" : html`<section class="section-sm alt"><div class="wrap">${head(c.L("Interactive Career Roadmap", "ইন্টারঅ্যাকটিভ ক্যারিয়ার রোডম্যাপ"), c.L("From your first job to CPO", "প্রথম চাকরি থেকে সিপিও"), "/career/roadmap", c.L("Explore Career Roadmap", "ক্যারিয়ার রোডম্যাপ দেখুন"))}
      <div class="level-preview">${d.levels.map((l) => html`<a class="lp-col" href="${c.p("/career/roadmap#lv-" + l.slug)}"><span class="lp-years">${pk(c, l, "years")}</span><strong>${pk(c, l, "title")}</strong>
        <span class="small muted">${d.roles.filter((r) => r.level_slug === l.slug).slice(0, 3).map((r) => c.pick(r.title_en, r.title_bn)).join(" · ")}</span></a>`)}</div></div></section>`,
    calculator: () => off.has("career-analysis") ? "" : html`<section class="section-sm"><div class="wrap"><div class="cta-band">
      <div><span class="eyebrow" style="color:#a1a1a6">${c.L("Career Development Analysis", "ক্যারিয়ার ডেভেলপমেন্ট অ্যানালাইসিস")}</span><h2>${c.L("Where are you now, and what is your next step?", "আপনি এখন কোথায়, আর পরের ধাপ কী?")}</h2>
      <p>${c.L("Five short steps. You get a readiness indicator, your skill and experience gaps, recommended qualifications and a 90-day action plan — with the reason behind every recommendation.", "পাঁচটি ছোট ধাপ। আপনি পাবেন প্রস্তুতির সূচক, দক্ষতা ও অভিজ্ঞতার ঘাটতি, প্রস্তাবিত যোগ্যতা এবং ৯০ দিনের অ্যাকশন প্ল্যান — প্রতিটি সুপারিশের কারণসহ।")}</p></div>
      <a class="btn btn-light btn-lg" href="${c.p("/career/career-analysis")}">${c.L("Analyze My Career", "আমার ক্যারিয়ার বিশ্লেষণ করুন")}</a></div></div></section>`,
    articles: () => off.has("blog") || !posts.length ? "" : html`<section class="section-sm"><div class="wrap">${head(c.L("Career Blog", "ক্যারিয়ার ব্লগ"), c.L("Popular career articles", "জনপ্রিয় ক্যারিয়ার আর্টিকেল"), "/career/blog", c.L("All articles", "সব আর্টিকেল"))}
      <div class="grid grid-3">${posts.map((p) => careerPostCard(c, p))}</div></div></section>`,
    roles: () => off.has("job-roles") || !roles.length ? "" : html`<section class="section-sm alt"><div class="wrap">${head(c.L("Job Role Library", "জব রোল লাইব্রেরি"), c.L("Popular procurement job roles", "জনপ্রিয় প্রকিউরমেন্ট পদ"), "/career/job-roles", c.L("Explore Job Roles", "জব রোল দেখুন"))}
      <div class="grid grid-3">${roles.map((r) => roleCard(c, r, d.levels))}</div></div></section>`,
    certifications: () => off.has("certifications") || !certs.length ? "" : html`<section class="section-sm"><div class="wrap">${head(c.L("Certification Guide", "সার্টিফিকেশন গাইড"), c.L("Qualifications that matter in procurement", "প্রকিউরমেন্টে গুরুত্বপূর্ণ যোগ্যতা"), "/career/certifications", c.L("Explore Certifications", "সার্টিফিকেশন দেখুন"))}
      <div class="grid grid-4">${certs.map((x) => certCard(c, x))}</div></div></section>`,
    tools: () => off.has("tools") || !tools.length ? "" : html`<section class="section-sm alt"><div class="wrap">${head(c.L("Career Tools", "ক্যারিয়ার টুলস"), c.L("Practical tools for your next move", "পরের পদক্ষেপের জন্য ব্যবহারিক টুল"), "/career/tools", c.L("All tools", "সব টুল"))}
      <div class="grid grid-4">${tools.map((t) => toolCard(c, t))}</div></div></section>`,
    interview: () => off.has("interview-preparation") ? "" : html`<section class="section-sm"><div class="wrap split" style="align-items:center;gap:40px">
      <div><span class="eyebrow">${c.L("Interview Preparation", "ইন্টারভিউ প্রস্তুতি")}</span><h2>${c.L("Practise before the real interview", "আসল ইন্টারভিউর আগে অনুশীলন করুন")}</h2>
      <p class="lead" style="font-size:18px">${c.L(`${c.num(qn ? qn.n : 0)} questions, negotiation scenarios and case studies with model answers — by career level and topic.`, `ক্যারিয়ার স্তর ও বিষয় অনুযায়ী মডেল উত্তরসহ ${c.num(qn ? qn.n : 0)}টি প্রশ্ন, দর-কষাকষির পরিস্থিতি ও কেস স্টাডি।`)}</p>
      <a class="btn btn-primary" href="${c.p("/career/interview-preparation")}">${c.L("Start practising", "অনুশীলন শুরু করুন")}</a></div>
      <ul class="feature-list">${[[c.L("Multiple-choice questions with explanations", "ব্যাখ্যাসহ বহুনির্বাচনী প্রশ্ন")], [c.L("Negotiation and supplier scenarios", "দর-কষাকষি ও সাপ্লায়ার পরিস্থিতি")], [c.L("Practical problems: TCO and landed cost", "ব্যবহারিক সমস্যা: টিসিও ও ল্যান্ডেড কস্ট")], [c.L("Free exams with verifiable certificates", "যাচাইযোগ্য সার্টিফিকেটসহ ফ্রি পরীক্ষা")]].map(([t]) => html`<li>${icon("check-circle", 18)}<span>${t}</span></li>`)}</ul></div></section>`,
    resources: () => html`<section class="section-sm alt"><div class="wrap">${head(c.L("Career Resources", "ক্যারিয়ার রিসোর্স"), c.L("Everything else you need", "আর যা যা দরকার"))}
      <div class="grid grid-4">${[["cv-linkedin", "cv", "CV & LinkedIn Toolkit", "সিভি ও লিংকডইন টুলকিট", "Checklists, examples and templates.", "চেকলিস্ট, উদাহরণ ও টেমপ্লেট।"],
        ["salary-benchmark", "wallet", "Salary Benchmark", "বেতন বেঞ্চমার্ক", "Indicative ranges with source and date.", "উৎস ও তারিখসহ আনুমানিক বেতন-সীমা।"],
        ["opportunities", "briefcase", "Career Opportunities", "ক্যারিয়ার সুযোগ", "Industries, employer types and job sources.", "খাত, নিয়োগকর্তার ধরন ও চাকরির উৎস।"],
        ["", "award", "Free exams & certificates", "ফ্রি পরীক্ষা ও সার্টিফিকেট", "Test your knowledge and share the result.", "জ্ঞান যাচাই করুন ও ফলাফল শেয়ার করুন।"]].filter(([k]) => !k || !off.has(k)).map(([k, ic, en, bn, den, dbn]) => html`
        <a class="card hover" href="${c.p(k ? "/career/" + k : "/exams")}"><div class="card-icon">${icon(ic, 22)}</div><h3 style="font-size:18px">${c.L(en, bn)}</h3><p>${c.L(den, dbn)}</p></a>`)}</div></div></section>`,
  };
  const body = html`<section class="career-hero"><div class="wrap">
    <span class="eyebrow">${c.L("ProcureBest Career Hub", "ProcureBest ক্যারিয়ার হাব")}</span>
    <h1>${c.pick(s.career_title_en, s.career_title_bn)}</h1>
    <p class="lead">${c.pick(s.career_lead_en, s.career_lead_bn)}</p>
    <div class="row">${[["roadmap", "/career/roadmap", "Explore Career Roadmap", "ক্যারিয়ার রোডম্যাপ দেখুন", "btn-primary"], ["career-analysis", "/career/career-analysis", "Analyze My Career", "আমার ক্যারিয়ার বিশ্লেষণ করুন", "btn-secondary"],
      ["job-roles", "/career/job-roles", "Explore Job Roles", "জব রোল দেখুন", "btn-secondary"], ["certifications", "/career/certifications", "Explore Certifications", "সার্টিফিকেশন দেখুন", "btn-secondary"]]
      .filter(([k]) => !off.has(k)).map(([, href, en, bn, cls]) => html`<a class="btn ${cls} btn-lg" href="${c.p(href)}">${c.L(en, bn)}</a>`)}</div>
    ${skateHub(c, s, d.levels)}
  </div></section>
  ${d.roles.length ? homeOrder(s).filter((k) => !k.startsWith("-")).map((k) => S[k]()) : html`<section class="section-sm"><div class="wrap">${preparing(c)}</div></section>`}`;
  return page(c, { key: "home", body });
}

// ------------------------------------------------------------------ roadmap tree
async function roadmap(c) {
  const s = await guard(c, "roadmap");
  const d = await careerData(c, false);
  const tracks = [...new Set(d.roles.map((r) => r.track))].filter((t) => TRACKS[t]);
  const body = html`<section class="section-sm" style="padding-top:0" data-tree><div class="wrap">
    ${d.roles.length ? html`<div class="toolbar"><div class="chips" role="group" aria-label="${c.L("Career track", "ক্যারিয়ার ট্র্যাক")}">
      <button type="button" class="chip on" data-track="">${c.L("All tracks", "সব ট্র্যাক")}</button>
      <button type="button" class="chip" data-track="@mgmt">${c.L("Management track", "ম্যানেজমেন্ট ট্র্যাক")}</button>
      <button type="button" class="chip" data-track="@spec">${c.L("Specialist tracks", "বিশেষজ্ঞ ট্র্যাক")}</button>
      <select class="track-pick" data-track-select aria-label="${c.L("A single track", "একটি ট্র্যাক")}"><option value="">${c.L("Or pick one track…", "অথবা একটি ট্র্যাক…")}</option>${tracks.map((t) => html`<option value="${t}">${c.pick(...TRACKS[t])}</option>`)}</select></div>
      <span class="small muted">${c.L("Tap a position to see details, next steps and alternatives.", "বিস্তারিত, পরের ধাপ ও বিকল্প দেখতে একটি পদে ট্যাপ করুন।")}</span></div>
    <div class="tree-layout">
      <div class="tree" data-tree-canvas><svg class="tree-lines" data-tree-lines aria-hidden="true"></svg>
        ${d.levels.map((l) => html`<div class="tree-level" id="lv-${l.slug}"><div class="tree-level-head"><strong>${pk(c, l, "title")}</strong><span class="small muted">${pk(c, l, "years")}</span></div>
          <div class="tree-roles">${d.roles.filter((r) => r.level_slug === l.slug).map((r) => html`<a class="tree-role" href="${c.p("/career/job-roles/" + r.slug)}" data-role="${r.slug}" data-track-key="${r.track}">${c.pick(r.title_en, r.title_bn)}</a>`)}</div></div>`)}
      </div>
      <aside class="panel tree-panel" data-tree-panel aria-live="polite"><p class="muted" style="margin:0">${c.L("Select a position in the tree.", "ট্রি থেকে একটি পদ বেছে নিন।")}</p></aside>
    </div>
    <p class="small muted" style="margin-top:18px">${icon("info", 15)} ${c.L("Experience ranges are indicative, not promotion rules. Titles and requirements differ between employers.", "অভিজ্ঞতার সীমা আনুমানিক, পদোন্নতির নিয়ম নয়। নিয়োগকর্তাভেদে পদবি ও শর্ত আলাদা হয়।")}</p>` : preparing(c)}
  </div></section>`;
  const data = { lang: c.lang, base: c.p("/career"), levels: d.levels.map((l) => ({ slug: l.slug, title: pk(c, l, "title"), years: pk(c, l, "years") })),
    roles: d.roles.map((r) => ({ slug: r.slug, level: r.level_slug, track: r.track, title: c.pick(r.title_en, r.title_bn), overview: c.pick(r.overview_en, r.overview_bn), exp: yrs(c, r.exp_min, r.exp_max), trackName: TRACKS[r.track] ? c.pick(...TRACKS[r.track]) : "" })),
    paths: d.paths, mgmt: ["operations", "management", "leadership"],
    t: { next: c.L("Usual next step", "সাধারণ পরের ধাপ"), alt: c.L("Alternative paths", "বিকল্প পথ"), from: c.L("Common previous roles", "সাধারণ আগের পদ"), exp: c.L("Indicative experience", "আনুমানিক অভিজ্ঞতা"), open: c.L("Open full profile", "পূর্ণ প্রোফাইল খুলুন"), top: c.L("Top of the career ladder.", "ক্যারিয়ার সিঁড়ির শীর্ষ।"), analyse: c.L("Analyse my gap to this role", "এই পদের সঙ্গে আমার ঘাটতি বিশ্লেষণ করুন") } };
  return page(c, { key: "roadmap", title: c.L("Interactive Career Roadmap", "ইন্টারঅ্যাকটিভ ক্যারিয়ার রোডম্যাপ"), lead: c.L("Every procurement position from entry level to Chief Procurement Officer, and how they connect — including specialist and management tracks.", "এন্ট্রি লেভেল থেকে চিফ প্রকিউরমেন্ট অফিসার পর্যন্ত প্রতিটি প্রকিউরমেন্ট পদ এবং তাদের সংযোগ — বিশেষজ্ঞ ও ম্যানেজমেন্ট ট্র্যাকসহ।"), body, data });
}

// ------------------------------------------------------------------ job role library
async function rolesList(c) {
  await guard(c, "job-roles");
  const d = await careerData(c, false);
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap" data-directory>
    ${d.roles.length ? html`<div class="toolbar"><div class="search">${icon("search", 18)}<input type="search" placeholder="${c.L("Search job roles", "পদ খুঁজুন")}" aria-label="${c.L("Search job roles", "পদ খুঁজুন")}" data-dir-search></div>
      <div class="chips" role="group"><button type="button" class="chip on" data-dir-cat="">${c.t("dir.all")}</button>${d.levels.map((l) => html`<button type="button" class="chip" data-dir-cat="${l.slug}">${pk(c, l, "title")}</button>`)}</div></div>
    <div class="grid grid-3">${d.roles.map((r) => roleCard(c, r, d.levels))}</div><p class="empty" data-dir-empty hidden>${c.L("No roles match.", "কোনো পদ মেলেনি।")}</p>` : preparing(c)}</div></section>`;
  return page(c, { key: "job-roles", title: c.L("Procurement Job Role Library", "প্রকিউরমেন্ট জব রোল লাইব্রেরি"), lead: c.L("Detailed profiles of procurement positions: responsibilities, skills, education, experience, qualifications, salary and progression.", "প্রকিউরমেন্ট পদের বিস্তারিত প্রোফাইল: দায়িত্ব, দক্ষতা, শিক্ষা, অভিজ্ঞতা, যোগ্যতা, বেতন ও অগ্রগতি।"), body });
}

async function roleProfile(c) {
  const s = await guard(c, "job-roles");
  const r = await one(c.env, "SELECT * FROM job_roles WHERE slug=? AND status='published'", c.params.slug);
  if (!r) throw new HttpError(404);
  const d = await careerData(c);
  const [salaries, rc] = await Promise.all([
    all(c.env, "SELECT * FROM salary_benchmarks WHERE role_slug=? AND status='published' ORDER BY country, industry_slug", r.slug),
    all(c.env, "SELECT rc.priority, x.slug, x.name_en, x.name_bn, x.kind FROM role_certifications rc JOIN certifications x ON x.slug=rc.cert_slug AND x.status='published' WHERE rc.role_slug=? ORDER BY rc.priority='core' DESC, x.sort", r.slug),
  ]);
  const lv = d.levels.find((l) => l.slug === r.level_slug);
  const roleBy = Object.fromEntries(d.roles.map((x) => [x.slug, x]));
  const next = d.paths.filter((p) => p.from_slug === r.slug && roleBy[p.to_slug]);
  const prev = d.paths.filter((p) => p.to_slug === r.slug && roleBy[p.from_slug]);
  const req = d.roleSkills.filter((x) => x.role_slug === r.slug);
  const skillBy = Object.fromEntries(d.skills.map((x) => [x.slug, x]));
  const link = (slug) => html`<a href="${c.p("/career/job-roles/" + slug)}">${c.pick(roleBy[slug].title_en, roleBy[slug].title_bn)}</a>`;
  const sec = (n, title, content) => (content ? html`<section class="role-sec"><h2><span class="role-n">${c.d(n)}</span>${title}</h2>${content}</section>` : "");
  const resources = lines(pk(c, r, "resources"));
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap split role-split" style="align-items:start;gap:48px">
    <div>
      ${sec(1, c.L("Job overview", "পদের সংক্ষিপ্ত বিবরণ"), html`<p class="lead" style="font-size:18px">${pk(c, r, "overview")}</p>`)}
      ${sec(2, c.L("Key responsibilities", "প্রধান দায়িত্ব"), UL(lines(pk(c, r, "resp"))))}
      ${sec(3, c.L("Required skills", "প্রয়োজনীয় দক্ষতা"), html`${UL(lines(pk(c, r, "skills")))}${req.length ? html`<h3 class="small" style="margin:18px 0 8px">${c.L("Competency levels expected (1–5)", "প্রত্যাশিত দক্ষতার স্তর (১–৫)")}</h3>
        <div class="meter-list">${req.filter((x) => skillBy[x.skill_slug]).map((x) => html`<div class="meter-row"><span>${c.pick(skillBy[x.skill_slug].name_en, skillBy[x.skill_slug].name_bn)}</span><span class="meter" aria-label="${x.level}/5"><i style="width:${x.level * 20}%"></i></span><b>${c.d(x.level)}</b></div>`)}</div>` : ""}`)}
      ${sec(4, c.L("Technical skills", "কারিগরি দক্ষতা"), UL(lines(pk(c, r, "tech"))))}
      ${sec(5, c.L("Educational requirements", "শিক্ষাগত যোগ্যতা"), pk(c, r, "edu") ? html`<p>${pk(c, r, "edu")}</p>` : "")}
      ${sec(6, c.L("Indicative experience", "আনুমানিক অভিজ্ঞতা"), html`<p><strong>${yrs(c, r.exp_min, r.exp_max)}</strong>${lv ? html` · ${pk(c, lv, "title")} (${pk(c, lv, "years")})` : ""}</p><p class="small muted">${c.L("Indicative only — employers set their own requirements.", "শুধু আনুমানিক — নিয়োগকর্তারা নিজস্ব শর্ত ঠিক করেন।")}</p>`)}
      ${sec(7, c.L("Relevant certifications", "প্রাসঙ্গিক সার্টিফিকেশন"), rc.length ? html`<ul class="cr-list">${rc.map((x) => html`<li><a href="${c.p("/career/certifications/" + x.slug)}">${c.pick(x.name_en, x.name_bn)}</a> <span class="tag ${x.priority === "core" ? "dark" : ""}">${x.priority === "core" ? c.L("Often requested", "প্রায়ই চাওয়া হয়") : c.L("Useful", "সহায়ক")}</span></li>`)}</ul>
        <p class="small muted">${c.L("No qualification guarantees a promotion or salary increase.", "কোনো যোগ্যতাই পদোন্নতি বা বেতন বৃদ্ধির নিশ্চয়তা দেয় না।")}</p>` : "")}
      ${sec(8, c.L("Indicative salary range", "আনুমানিক বেতন-সীমা"), salaries.length ? html`<div class="table-wrap"><table><thead><tr><th>${c.L("Country", "দেশ")}</th><th>${c.L("Range", "সীমা")}</th><th>${c.L("Data", "তথ্য")}</th></tr></thead><tbody>
        ${salaries.map((x) => html`<tr><td>${x.country}</td><td><strong>${x.currency} ${c.num(x.min_amount)}–${c.num(x.max_amount)}</strong> / ${x.period === "year" ? c.L("year", "বছর") : c.L("month", "মাস")}</td><td class="small"><span class="tag ${x.basis === "estimate" ? "warn" : "ok"}">${c.pick(...(BASIS[x.basis] || [x.basis]))}</span><div class="muted">${x.source}${x.updated_on ? html` · ${c.date(x.updated_on)}` : ""}</div></td></tr>`)}</tbody></table></div>
        <p class="small muted">${c.L("Ranges are indicative and not offers. See the Salary Benchmark for details.", "সীমাগুলো আনুমানিক, কোনো প্রস্তাব নয়। বিস্তারিত বেতন বেঞ্চমার্কে দেখুন।")} <a href="${c.p("/career/salary-benchmark?role=" + r.slug)}">${c.L("Salary Benchmark", "বেতন বেঞ্চমার্ক")}</a></p>`
        : html`<p class="muted">${c.L("No verified or estimated salary data has been added for this role yet.", "এই পদের জন্য এখনো কোনো যাচাইকৃত বা আনুমানিক বেতনের তথ্য যোগ করা হয়নি।")}</p>`)}
      ${sec(9, c.L("Relevant industries", "প্রাসঙ্গিক খাত"), lines(pk(c, r, "industries")).length ? html`<div class="chips">${lines(pk(c, r, "industries")).map((x) => html`<span class="chip">${x}</span>`)}</div>` : "")}
      ${sec(10, c.L("Types of companies", "প্রতিষ্ঠানের ধরন"), UL(lines(pk(c, r, "companies"))))}
      ${sec(11, c.L("Career progression", "ক্যারিয়ার অগ্রগতি"), html`${prev.length ? html`<p><span class="muted">${c.L("Common previous roles:", "সাধারণ আগের পদ:")}</span> ${prev.map((p, i) => html`${i ? ", " : ""}${link(p.from_slug)}`)}</p>` : ""}
        ${next.filter((p) => p.kind === "next").length ? html`<p><span class="muted">${c.L("Usual next step:", "সাধারণ পরের ধাপ:")}</span> ${next.filter((p) => p.kind === "next").map((p, i) => html`${i ? ", " : ""}<strong>${link(p.to_slug)}</strong>`)}</p>` : html`<p class="muted">${c.L("This is the top of the procurement career ladder.", "এটি প্রকিউরমেন্ট ক্যারিয়ার সিঁড়ির শীর্ষ।")}</p>`}
        ${next.filter((p) => p.kind === "alt").length ? html`<p><span class="muted">${c.L("Alternative paths:", "বিকল্প পথ:")}</span> ${next.filter((p) => p.kind === "alt").map((p, i) => html`${i ? ", " : ""}${link(p.to_slug)}`)}</p>` : ""}
        <a class="link small" href="${c.p("/career/roadmap")}">${c.L("See it on the roadmap", "রোডম্যাপে দেখুন")} ${icon("arrow-right", 14)}</a>`)}
      ${sec(12, c.L("Recommended learning resources", "প্রস্তাবিত শেখার রিসোর্স"), UL(resources))}
    </div>
    <aside class="panel role-aside">
      <div class="row" style="gap:6px;margin-bottom:12px">${lv ? html`<span class="tag dark">${pk(c, lv, "title")}</span>` : ""}${TRACKS[r.track] ? html`<span class="tag">${c.pick(...TRACKS[r.track])}</span>` : ""}</div>
      <ul class="details-list" style="margin-top:0"><li><span>${c.L("Experience", "অভিজ্ঞতা")}</span><span>${yrs(c, r.exp_min, r.exp_max)}</span></li>
        ${salaries[0] ? html`<li><span>${c.L("Salary", "বেতন")} (${c.pick(...(BASIS[salaries[0].basis] || [""]))})</span><span>${salaries[0].currency} ${c.num(salaries[0].min_amount)}–${c.num(salaries[0].max_amount)}</span></li>` : ""}</ul>
      ${careerOff(s).has("career-analysis") ? "" : html`<a class="btn btn-primary" style="width:100%;margin-top:18px" href="${c.p("/career/career-analysis?target=" + r.slug)}">${c.L("Analyse my gap to this role", "এই পদের সঙ্গে আমার ঘাটতি বিশ্লেষণ")}</a>`}
      <a class="btn btn-ghost" style="width:100%;margin-top:10px" href="${c.p("/career/interview-preparation?level=" + r.level_slug)}">${c.L("Interview questions for this level", "এই স্তরের ইন্টারভিউ প্রশ্ন")}</a>
    </aside></div></section>`;
  const ld = { "@context": "https://schema.org", "@type": "Occupation", name: c.pick(r.title_en, r.title_bn), description: pk(c, r, "overview"), occupationalCategory: "Procurement", inLanguage: c.lang };
  return page(c, { key: "job-roles", title: c.pick(r.title_en, r.title_bn), lead: "", body, description: plain(pk(c, r, "overview"), 160), head: html`<script type="application/ld+json">${jsonScript(ld)}</script>` });
}

// ------------------------------------------------------------------ career development analysis
const COUNTRIES = ["Bangladesh", "India", "Pakistan", "Sri Lanka", "Nepal", "United Arab Emirates", "Saudi Arabia", "Qatar", "Malaysia", "Singapore", "United Kingdom", "United States", "Canada", "Australia", "Other"];
async function analysis(c) {
  const s = await guard(c, "career-analysis");
  const d = await careerData(c);
  const inds = await all(c.env, "SELECT slug, name_en, name_bn FROM industries WHERE status='published' ORDER BY sort, id");
  const target = c.url.searchParams.get("target") || "";
  const opt = (list) => list.map(([v, l]) => html`<option value="${v}">${l}</option>`);
  const roleOpts = (sel, blank) => html`${blank ? html`<option value="">${blank}</option>` : ""}${d.levels.map((l) => html`<optgroup label="${pk(c, l, "title")}">${d.roles.filter((r) => r.level_slug === l.slug).map((r) => html`<option value="${r.slug}" ${r.slug === sel ? raw("selected") : ""}>${c.pick(r.title_en, r.title_bn)}</option>`)}</optgroup>`)}`;
  const indOpts = html`<option value="">${c.L("Choose…", "বেছে নিন…")}</option>${inds.map((x) => html`<option value="${x.slug}">${c.pick(x.name_en, x.name_bn)}</option>`)}<option value="other">${c.L("Other", "অন্যান্য")}</option>`;
  const ctry = (name, sel) => html`<select id="ca-${name}" name="${name}">${COUNTRIES.map((x) => html`<option ${x === sel ? raw("selected") : ""}>${x}</option>`)}</select>`;
  const calcSkills = d.skills.filter((x) => x.in_calc);
  const step = (n, title, content) => html`<fieldset class="wiz-step" data-step="${n}" ${n > 1 ? raw("hidden") : ""}><legend><span class="role-n">${c.d(n)}</span>${title}</legend><div class="form-grid" style="margin-top:14px">${content}</div></fieldset>`;
  const body = html`<section class="section-sm" style="padding-top:0" data-analysis><div class="wrap">${d.roles.length ? html`
    <div class="calc-layout">
    <form class="panel" novalidate autocomplete="off" data-wizard>
      <ol class="wiz-progress" aria-hidden="true">${[c.L("Background", "পটভূমি"), c.L("Current role", "বর্তমান পদ"), c.L("Certifications", "সার্টিফিকেশন"), c.L("Skills", "দক্ষতা"), c.L("Goal", "লক্ষ্য")].map((t, i) => html`<li data-dot="${i + 1}" class="${i ? "" : "on"}"><span>${c.d(i + 1)}</span>${t}</li>`)}</ol>
      ${step(1, c.L("Personal and academic background", "ব্যক্তিগত ও শিক্ষাগত পটভূমি"), html`
        <div class="field"><label for="ca-country">${c.L("Country", "দেশ")}</label>${ctry("country", "Bangladesh")}</div>
        <div class="field"><label for="ca-education">${c.L("Education level", "শিক্ষার স্তর")}</label><select id="ca-education" name="education">${opt([["hsc", c.L("HSC / A level", "এইচএসসি / এ লেভেল")], ["diploma", c.L("Diploma", "ডিপ্লোমা")], ["bachelor", c.L("Bachelor's degree", "স্নাতক")], ["master", c.L("Master's / MBA", "মাস্টার্স / এমবিএ")], ["phd", c.L("PhD", "পিএইচডি")]])}</select></div>
        <div class="field"><label for="ca-background">${c.L("Academic background", "শিক্ষাগত পটভূমি")}</label><select id="ca-background" name="background">${opt([["business", c.L("Business / commerce", "ব্যবসা / বাণিজ্য")], ["engineering", c.L("Engineering / technology", "প্রকৌশল / প্রযুক্তি")], ["science", c.L("Science", "বিজ্ঞান")], ["arts", c.L("Arts / social science", "কলা / সমাজবিজ্ঞান")], ["law", c.L("Law", "আইন")], ["other", c.L("Other", "অন্যান্য")]])}</select></div>
        <div class="field"><label for="ca-field">${c.L("Field of study", "পড়ার বিষয়")}</label><input id="ca-field" name="field" maxlength="80" placeholder="${c.L("e.g. Accounting, Textile Engineering", "যেমন হিসাববিজ্ঞান, টেক্সটাইল ইঞ্জিনিয়ারিং")}"></div>`)}
      ${step(2, c.L("Current career position", "বর্তমান ক্যারিয়ার অবস্থান"), html`
        <div class="field full"><label for="ca-current">${c.L("Current job position", "বর্তমান পদ")}</label><select id="ca-current" name="current">${roleOpts("", c.L("Student / not yet in procurement", "শিক্ষার্থী / এখনো প্রকিউরমেন্টে নই"))}</select>
          <span class="help">${c.L("Pick the closest match — titles differ between employers.", "সবচেয়ে কাছের পদটি বাছুন — নিয়োগকর্তাভেদে পদবি আলাদা।")}</span></div>
        <div class="field"><label for="ca-total">${c.L("Total work experience (years)", "মোট কাজের অভিজ্ঞতা (বছর)")}</label><input id="ca-total" name="totalExp" type="number" min="0" max="50" step="0.5" value="0" inputmode="decimal"></div>
        <div class="field"><label for="ca-proc">${c.L("Procurement experience (years)", "প্রকিউরমেন্ট অভিজ্ঞতা (বছর)")}</label><input id="ca-proc" name="procExp" type="number" min="0" max="50" step="0.5" value="0" inputmode="decimal"></div>
        <div class="field full"><label for="ca-industry">${c.L("Current industry", "বর্তমান খাত")}</label><select id="ca-industry" name="industry">${indOpts}</select></div>`)}
      ${step(3, c.L("Certifications and qualifications you hold", "আপনার সার্টিফিকেশন ও যোগ্যতা"), html`<div class="field full"><div class="share-checks">
        ${d.certs.map((x) => html`<label class="check"><input type="checkbox" name="certs" value="${x.slug}"> <span>${c.pick(x.name_en, x.name_bn)}</span></label>`)}</div>
        <span class="help">${c.L("Tick only completed qualifications (for CIPS, tick it if you hold Level 4 or above).", "শুধু সম্পন্ন যোগ্যতায় টিক দিন (CIPS-এর ক্ষেত্রে লেভেল ৪ বা তার বেশি থাকলে)।")}</span></div>
        <div class="field full"><label for="ca-other">${c.L("Other relevant qualifications", "অন্যান্য প্রাসঙ্গিক যোগ্যতা")}</label><input id="ca-other" name="otherCerts" maxlength="120"></div>`)}
      ${step(4, c.L("Skills self-assessment (1 = beginner, 5 = expert)", "দক্ষতার স্ব-মূল্যায়ন (১ = নতুন, ৫ = বিশেষজ্ঞ)"), html`<div class="field full"><div class="rating-list">
        ${calcSkills.map((x) => html`<div class="rating-row"><div><strong>${c.pick(x.name_en, x.name_bn)}</strong><span class="small muted">${c.pick(x.desc_en, x.desc_bn)}</span></div>
          <div class="rating" role="radiogroup" aria-label="${c.pick(x.name_en, x.name_bn)}">${[1, 2, 3, 4, 5].map((v) => html`<label><input type="radio" name="sk_${x.slug}" value="${v}" ${v === 2 ? raw("checked") : ""}><span>${c.d(v)}</span></label>`)}</div></div>`)}</div></div>`)}
      ${step(5, c.L("Career goal", "ক্যারিয়ার লক্ষ্য"), html`
        <div class="field full"><label for="ca-target">${c.L("Target job position", "লক্ষ্য পদ")}</label><select id="ca-target" name="target" required>${roleOpts(target || "procurement-manager")}</select></div>
        <div class="field"><label for="ca-tind">${c.L("Target industry", "লক্ষ্য খাত")}</label><select id="ca-tind" name="targetIndustry">${indOpts}</select></div>
        <div class="field"><label for="ca-targetCountry">${c.L("Target country", "লক্ষ্য দেশ")}</label>${ctry("targetCountry", "Bangladesh")}</div>
        <div class="field full"><label for="ca-goal">${c.L("Career development goal", "ক্যারিয়ার উন্নয়নের লক্ষ্য")}</label><select id="ca-goal" name="goal">${opt([["promotion", c.L("Get promoted", "পদোন্নতি পাওয়া")], ["enter", c.L("Enter procurement", "প্রকিউরমেন্টে প্রবেশ")], ["specialise", c.L("Move into a specialism", "বিশেষায়িত ক্ষেত্রে যাওয়া")], ["abroad", c.L("Work abroad", "বিদেশে কাজ")], ["lead", c.L("Become a procurement leader", "প্রকিউরমেন্ট নেতা হওয়া")]])}</select></div>`)}
      <div class="form-actions wiz-actions"><button class="btn btn-ghost" type="button" data-wiz-prev hidden>${icon("arrow-left", 16)} ${c.L("Back", "পেছনে")}</button>
        <button class="btn btn-primary" type="button" data-wiz-next>${c.L("Next", "পরের ধাপ")} ${icon("arrow-right", 16)}</button>
        <button class="btn btn-primary btn-lg" type="submit" data-wiz-submit hidden>${c.L("Show my analysis", "আমার বিশ্লেষণ দেখান")}</button></div>
    </form>
    <div class="results-col"><div data-analysis-result aria-live="polite"><div class="result-empty"><p style="margin:0">${c.L("Complete the five steps to see your analysis.", "বিশ্লেষণ দেখতে পাঁচটি ধাপ পূরণ করুন।")}</p></div></div></div></div>
    <section class="section-sm"><div class="wrap-narrow" style="margin:0 auto"><details class="disclosure"><summary>${c.t("calc.method")}</summary><div><ol class="method-list">
      <li>${c.L(`Readiness = skills match × ${parseWeights(s.career_weights).skills}% + experience × ${parseWeights(s.career_weights).experience}% + core qualifications × ${parseWeights(s.career_weights).certs}%.`, `প্রস্তুতি = দক্ষতার মিল × ${parseWeights(s.career_weights).skills}% + অভিজ্ঞতা × ${parseWeights(s.career_weights).experience}% + মূল যোগ্যতা × ${parseWeights(s.career_weights).certs}%।`)}</li>
      <li>${c.L("Skills match compares your rating with the level the target role expects for each competency (capped at 100% per skill).", "দক্ষতার মিল প্রতিটি দক্ষতায় আপনার রেটিংকে লক্ষ্য পদের প্রত্যাশিত স্তরের সঙ্গে তুলনা করে (প্রতি দক্ষতায় সর্বোচ্চ ১০০%)।")}</li>
      <li>${c.L("Experience compares your procurement years with the indicative minimum for the role.", "অভিজ্ঞতা আপনার প্রকিউরমেন্ট বছরকে পদের আনুমানিক ন্যূনতমের সঙ্গে তুলনা করে।")}</li>
      <li>${c.L("Qualifications counts those marked 'often requested' for the role. Recommendations come from the role's linked qualifications, qualifications that cover your biggest gaps, and published rules.", "যোগ্যতা অংশে পদের জন্য 'প্রায়ই চাওয়া হয়' চিহ্নিতগুলো গোনা হয়। সুপারিশ আসে পদের সঙ্গে যুক্ত যোগ্যতা, আপনার বড় ঘাটতি পূরণকারী যোগ্যতা এবং প্রকাশিত নিয়ম থেকে।")}</li>
    </ol></div></details>
    <details class="disclosure" open><summary>${c.t("calc.important")}</summary><div><p class="muted">${c.L("The readiness score is a development indicator based on your own answers. It is not the probability of getting a job, a promotion or any salary.", "প্রস্তুতির স্কোর আপনার নিজের উত্তরের ভিত্তিতে একটি উন্নয়ন সূচক। এটি চাকরি, পদোন্নতি বা কোনো বেতন পাওয়ার সম্ভাবনা নয়।")}</p></div></details></div></section>` : preparing(c)}
  </div></section>`;
  const data = { lang: c.lang, base: c.p("/career"), root: c.p(""), weights: parseWeights(s.career_weights), ...d,
    roles: d.roles.map((r) => ({ slug: r.slug, level_slug: r.level_slug, exp_min: r.exp_min, exp_max: r.exp_max, title_en: r.title_en, title_bn: r.title_bn })) };
  return page(c, { key: "career-analysis", title: c.L("Career Development Analysis", "ক্যারিয়ার ডেভেলপমেন্ট অ্যানালাইসিস"), lead: c.L("Find out where you stand today, which gaps matter for your target role, and what to do in the next 90 days.", "আজ আপনি কোথায় আছেন, লক্ষ্য পদের জন্য কোন ঘাটতি গুরুত্বপূর্ণ এবং আগামী ৯০ দিনে কী করবেন, জেনে নিন।"), body, data });
}

// ------------------------------------------------------------------ skills assessment
const SKILL_CATS = { "procurement-process": ["fundamentals"], "strategic-sourcing": ["supplier-evaluation", "china-sourcing"], negotiation: ["negotiation", "preparation", "tactics"], "contract-management": ["import-documentation"],
  srm: ["supplier-evaluation", "kpi"], "cost-analysis": ["tco", "bangladesh-import"], "data-analytics": ["kpi", "spend-analysis", "tools"], "risk-management": ["supplier-evaluation"], leadership: ["growth", "leadership", "career-development"], "project-procurement": ["import-documentation"] };
async function assessment(c) {
  await guard(c, "skills-assessment");
  const d = await careerData(c);
  const [posts, tools] = await Promise.all([
    all(c.env, `SELECT section, slug, title_en, title_bn, category, tags FROM posts WHERE ${visiblePosts} ORDER BY views DESC LIMIT 200`),
    all(c.env, "SELECT slug, kind, url, name_en, name_bn FROM career_tools WHERE status='published' ORDER BY sort"),
  ]);
  const SP = { blog: "/blog", career: "/career/blog", negotiation: "/negotiation-guru", ai: "/procurement-ai" };
  const skills = d.skills.filter((x) => x.in_assess);
  const body = html`<section class="section-sm" style="padding-top:0" data-assess><div class="wrap">${skills.length ? html`<div class="calc-layout">
    <form class="panel" novalidate data-assess-form>
      <div class="field full" style="margin-bottom:18px"><label for="as-target">${c.L("Compare with a role (optional)", "একটি পদের সঙ্গে তুলনা (ঐচ্ছিক)")}</label><select id="as-target" name="target"><option value="">${c.L("No comparison", "তুলনা নয়")}</option>
        ${d.levels.map((l) => html`<optgroup label="${pk(c, l, "title")}">${d.roles.filter((r) => r.level_slug === l.slug).map((r) => html`<option value="${r.slug}">${c.pick(r.title_en, r.title_bn)}</option>`)}</optgroup>`)}</select></div>
      <p class="help">${c.L("Rate each statement: 1 = not yet, 3 = sometimes, 5 = always and confidently.", "প্রতিটি বাক্য রেটিং দিন: ১ = এখনো না, ৩ = মাঝে মাঝে, ৫ = সবসময় ও আত্মবিশ্বাসের সঙ্গে।")}</p>
      ${skills.map((x) => html`<div class="form-section"><h3>${c.pick(x.name_en, x.name_bn)}</h3><p class="help">${c.pick(x.desc_en, x.desc_bn)}</p>
        ${lines(pk(c, x, "statements")).map((st, i) => html`<div class="rating-row"><div><span>${st}</span></div><div class="rating" role="radiogroup" aria-label="${st}">${[1, 2, 3, 4, 5].map((v) => html`<label><input type="radio" name="${x.slug}__${i}" value="${v}"><span>${c.d(v)}</span></label>`)}</div></div>`)}</div>`)}
      <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">${c.L("See my results", "আমার ফলাফল দেখুন")}</button></div>
    </form>
    <div class="results-col"><div data-assess-result aria-live="polite"><div class="result-empty"><p style="margin:0">${c.L("Answer the statements to see your strong skills and improvement areas.", "শক্তিশালী দক্ষতা ও উন্নয়নের ক্ষেত্র দেখতে বাক্যগুলোর উত্তর দিন।")}</p></div></div></div></div>` : preparing(c)}</div></section>`;
  const data = { lang: c.lang, root: c.p(""), skills, roleSkills: d.roleSkills, roles: d.roles.map((r) => ({ slug: r.slug, title_en: r.title_en, title_bn: r.title_bn })),
    articles: Object.fromEntries(skills.map((x) => [x.slug, posts.filter((p) => String(p.tags || "").split(",").map((t) => t.trim()).includes(x.slug) || (SKILL_CATS[x.slug] || []).includes(p.category)).slice(0, 3).map((p) => ({ title: c.pick(p.title_en, p.title_bn), url: c.p(`${SP[p.section] || "/blog"}/${p.slug}`) }))])),
    tools: tools.map((t) => ({ name: c.pick(t.name_en, t.name_bn), url: c.p(t.kind === "link" && t.url ? t.url : "/career/tools/" + t.slug) })) };
  return page(c, { key: "skills-assessment", title: c.L("Skills & Competency Assessment", "দক্ষতা ও সক্ষমতা মূল্যায়ন"), lead: c.L("Ten procurement competencies, three statements each. See your strengths, improvement areas and what to learn next.", "দশটি প্রকিউরমেন্ট দক্ষতা, প্রতিটিতে তিনটি বাক্য। নিজের শক্তি, উন্নয়নের ক্ষেত্র এবং এরপর কী শিখবেন দেখুন।"), body, data });
}

// ------------------------------------------------------------------ certifications
async function certList(c) {
  await guard(c, "certifications");
  const list = await all(c.env, "SELECT slug, kind, name_en, name_bn, issuer FROM certifications WHERE status='published' ORDER BY sort, id");
  const kinds = Object.keys(CERT_KINDS).filter((k) => list.some((x) => x.kind === k));
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap">
    <div class="grid grid-3" style="margin-bottom:36px">${["qualification", "certification", "designation"].map((k) => html`<div class="card surface"><h3 style="font-size:18px">${c.pick(CERT_KINDS[k][0], CERT_KINDS[k][1])}</h3><p>${c.pick(CERT_KINDS[k][2], CERT_KINDS[k][3])}</p></div>`)}</div>
    ${list.length ? kinds.map((k) => html`<h2 class="hub-h">${c.pick(CERT_KINDS[k][0], CERT_KINDS[k][1])}</h2><div class="grid grid-3">${list.filter((x) => x.kind === k).map((x) => certCard(c, x))}</div>`) : preparing(c)}
    <p class="small muted" style="margin-top:28px">${icon("info", 15)} ${c.L("No qualification guarantees a promotion or a salary increase. Always confirm details on the official website.", "কোনো যোগ্যতাই পদোন্নতি বা বেতন বৃদ্ধির নিশ্চয়তা দেয় না। বিস্তারিত সবসময় অফিসিয়াল ওয়েবসাইটে নিশ্চিত হয়ে নিন।")}</p>
  </div></section>`;
  return page(c, { key: "certifications", title: c.L("Certification Guide", "সার্টিফিকেশন গাইড"), lead: c.L("CIPS, CPSM, CSCP, CPIM, MBA, PMP and more — what each one is, who it suits and how it fits your career stage.", "CIPS, CPSM, CSCP, CPIM, MBA, PMP ও আরও — প্রতিটি কী, কার জন্য উপযুক্ত এবং আপনার ক্যারিয়ারের কোন পর্যায়ে মানানসই।"), body });
}
async function certPage(c) {
  await guard(c, "certifications");
  const x = await one(c.env, "SELECT * FROM certifications WHERE slug=? AND status='published'", c.params.slug);
  if (!x) throw new HttpError(404);
  const d = await careerData(c, false);
  const roles = await all(c.env, "SELECT rc.priority, r.slug, r.title_en, r.title_bn FROM role_certifications rc JOIN job_roles r ON r.slug=rc.role_slug AND r.status='published' WHERE rc.cert_slug=? ORDER BY r.sort", x.slug);
  const stages = String(x.stages || "").split(",").map((k) => d.levels.find((l) => l.slug === k.trim())).filter(Boolean);
  const row = (label, v) => (v ? html`<section class="role-sec"><h2>${label}</h2>${v}</section>` : "");
  const p = (f) => (pk(c, x, f) ? html`<p>${pk(c, x, f)}</p>` : "");
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap split role-split" style="align-items:start;gap:48px"><div>
    ${row(c.L("Overview", "সংক্ষিপ্ত বিবরণ"), html`<p class="lead" style="font-size:18px">${pk(c, x, "overview")}</p>`)}
    ${row(c.L("Eligibility", "যোগ্যতার শর্ত"), p("eligibility"))}
    ${row(c.L("Qualification levels / structure", "লেভেল / কাঠামো"), UL(lines(pk(c, x, "levels"))))}
    ${row(c.L("Syllabus", "সিলেবাস"), p("syllabus"))}
    ${row(c.L("Approximate duration", "আনুমানিক সময়"), p("duration"))}
    ${row(c.L("Cost", "খরচ"), x.cost_verified && pk(c, x, "cost") ? html`<p><strong>${pk(c, x, "cost")}</strong></p><p class="small muted">${c.L("Verified on", "যাচাইয়ের তারিখ")} ${c.date(x.cost_checked)} — ${c.L("fees can change; confirm before paying.", "ফি বদলাতে পারে; পরিশোধের আগে নিশ্চিত হোন।")}</p>`
      : html`<p class="muted">${pk(c, x, "cost") || c.L("Check the official website for current fees.", "বর্তমান ফি অফিসিয়াল ওয়েবসাইটে দেখুন।")}</p><p class="small muted">${c.L("We only show a fee after we have verified it.", "আমরা যাচাই করার পরই ফি দেখাই।")}</p>`)}
    ${row(c.L("Career relevance", "ক্যারিয়ারে প্রাসঙ্গিকতা"), html`${p("relevance")}<p class="small muted">${c.L("No certification guarantees a promotion or a salary increase.", "কোনো সার্টিফিকেশনই পদোন্নতি বা বেতন বৃদ্ধির নিশ্চয়তা দেয় না।")}</p>`)}
    ${row(c.L("Suitable career stages", "উপযুক্ত ক্যারিয়ার পর্যায়"), stages.length ? html`<div class="chips">${stages.map((l) => html`<span class="chip">${pk(c, l, "title")}</span>`)}</div>` : "")}
    ${row(c.L("Roles where it is relevant", "যে পদগুলোতে প্রাসঙ্গিক"), roles.length ? html`<ul class="cr-list">${roles.map((r) => html`<li><a href="${c.p("/career/job-roles/" + r.slug)}">${c.pick(r.title_en, r.title_bn)}</a> <span class="tag ${r.priority === "core" ? "dark" : ""}">${r.priority === "core" ? c.L("Often requested", "প্রায়ই চাওয়া হয়") : c.L("Useful", "সহায়ক")}</span></li>`)}</ul>` : "")}
  </div><aside class="panel role-aside"><span class="tag outline">${CERT_KINDS[x.kind] ? c.pick(CERT_KINDS[x.kind][0], CERT_KINDS[x.kind][1]) : x.kind}</span>
    <ul class="details-list"><li><span>${c.L("Issuing organisation", "প্রদানকারী সংস্থা")}</span><span>${x.issuer}</span></li></ul>
    ${x.url ? html`<a class="btn btn-primary" style="width:100%;margin-top:18px" href="${x.url}" target="_blank" rel="noopener nofollow">${c.L("Official website", "অফিসিয়াল ওয়েবসাইট")} ${icon("external", 15)}</a>` : ""}
    <a class="btn btn-ghost" style="width:100%;margin-top:10px" href="${c.p("/career/tools/certification-comparison?c=" + x.slug)}">${c.L("Compare with others", "অন্যগুলোর সঙ্গে তুলনা")}</a></aside></div></section>`;
  return page(c, { key: "certifications", title: c.pick(x.name_en, x.name_bn), lead: x.issuer, body, description: plain(pk(c, x, "overview"), 160) });
}

// ------------------------------------------------------------------ tools
async function toolsPage(c) {
  await guard(c, "tools");
  const tools = await all(c.env, "SELECT * FROM career_tools WHERE status='published' AND grp='tools' ORDER BY sort, id");
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap">${tools.length ? html`<div class="grid grid-3">${tools.map((t) => toolCard(c, t))}</div>` : preparing(c)}</div></section>`;
  return page(c, { key: "tools", title: c.L("Career Tools", "ক্যারিয়ার টুলস"), lead: c.L("Lightweight, free tools that run in your browser. Your ticks and answers stay on your device.", "হালকা, ফ্রি টুল যা আপনার ব্রাউজারে চলে। আপনার টিক ও উত্তর আপনার ডিভাইসেই থাকে।"), body });
}
async function toolPage(c) {
  const t = await one(c.env, "SELECT * FROM career_tools WHERE slug=? AND status='published'", c.params.slug);
  if (!t) throw new HttpError(404);
  await guard(c, t.grp === "cv" ? "cv-linkedin" : "tools");
  if (t.kind === "link" && t.url) return c.redirect(c.p(t.url), 302);
  let content = "", data = null;
  if (t.kind === "checklist") {
    const items = lines(pk(c, t, "items"));
    content = html`<div class="panel checklist" data-checklist="${t.slug}"><div class="row between" style="margin-bottom:12px"><span class="small muted" data-check-count></span>
      <div class="row" style="gap:8px"><button class="btn btn-ghost btn-sm" type="button" data-print>${icon("print", 15)} ${c.L("Print", "প্রিন্ট")}</button><button class="btn btn-ghost btn-sm" type="button" data-check-reset>${c.L("Reset", "রিসেট")}</button></div></div>
      ${items.map((x, i) => html`<label class="check check-item"><input type="checkbox" data-i="${i}"> <span>${x}</span></label>`)}
      <div class="progress" style="max-width:none;margin-top:16px"><i data-check-bar style="width:0%"></i></div></div>`;
  } else if (t.kind === "guide") content = html`<div class="panel prose" style="font-size:16px">${raw(markdown(pk(c, t, "items")))}</div>`;
  else if (t.kind === "compare") {
    const list = await all(c.env, "SELECT * FROM certifications WHERE status='published' ORDER BY sort, id");
    const d = await careerData(c, false);
    const lvName = Object.fromEntries(d.levels.map((l) => [l.slug, pk(c, l, "title")]));
    data = { certs: list.map((x) => ({ slug: x.slug, name: pk(c, x, "name"), kind: CERT_KINDS[x.kind] ? c.pick(CERT_KINDS[x.kind][0], CERT_KINDS[x.kind][1]) : x.kind, issuer: x.issuer, eligibility: pk(c, x, "eligibility"), levels: lines(pk(c, x, "levels")).join(" · "),
      duration: pk(c, x, "duration"), cost: x.cost_verified ? pk(c, x, "cost") : c.L("Check the official website", "অফিসিয়াল ওয়েবসাইট দেখুন"), stages: String(x.stages || "").split(",").map((k) => lvName[k.trim()]).filter(Boolean).join(", "), relevance: pk(c, x, "relevance"), url: x.url })),
      pre: (c.url.searchParams.get("c") || "").split(",").filter(Boolean),
      t: { kind: c.L("Type", "ধরন"), issuer: c.L("Issuer", "প্রদানকারী"), eligibility: c.L("Eligibility", "যোগ্যতার শর্ত"), levels: c.L("Levels", "লেভেল"), duration: c.L("Duration", "সময়"), cost: c.L("Cost", "খরচ"), stages: c.L("Career stages", "ক্যারিয়ার পর্যায়"), relevance: c.L("Career relevance", "প্রাসঙ্গিকতা"), pick: c.L("Choose…", "বেছে নিন…") } };
    content = html`<div class="panel" data-compare><div class="form-grid">${[0, 1, 2].map((i) => html`<div class="field third"><label for="cmp-${i}">${c.L(`Option ${i + 1}`, `বিকল্প ${i + 1}`)}</label><select id="cmp-${i}" data-cmp="${i}"></select></div>`)}</div>
      <div class="table-wrap" style="margin-top:18px"><table class="cmp-table" data-cmp-table></table></div></div>`;
  }
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap wrap-narrow">${content}</div></section>`;
  return page(c, { key: t.grp === "cv" ? "cv-linkedin" : "tools", title: pk(c, t, "name"), lead: pk(c, t, "desc"), body, data });
}

async function cvPage(c) {
  await guard(c, "cv-linkedin");
  const [tools, items, posts] = await Promise.all([
    all(c.env, "SELECT * FROM career_tools WHERE status='published' AND grp='cv' ORDER BY sort, id"),
    all(c.env, "SELECT slug, type, title_en, title_bn, summary_en, summary_bn, price, cover_id FROM items WHERE status='published' AND type='cv' ORDER BY sort, id DESC"),
    all(c.env, `SELECT slug, title_en, title_bn, summary_en, summary_bn, category, cover_id FROM posts WHERE section='career' AND category IN ('cv','interview') AND ${visiblePosts} ORDER BY published_at DESC LIMIT 6`),
  ]);
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap">
    <h2 class="hub-h" style="margin-top:0">${c.L("Procurement CV templates & examples", "প্রকিউরমেন্ট সিভি টেমপ্লেট ও উদাহরণ")}</h2>
    ${items.length ? html`<div class="grid grid-3">${items.map((it) => itemCard(c, it))}</div>` : html`<p class="muted">${c.L("CV templates are being added to the Library. Meanwhile, use the checklist and examples below.", "সিভি টেমপ্লেট লাইব্রেরিতে যোগ করা হচ্ছে। ততক্ষণ নিচের চেকলিস্ট ও উদাহরণ ব্যবহার করুন।")}</p>`}
    ${tools.length ? html`<h2 class="hub-h">${c.L("Guides & checklists", "গাইড ও চেকলিস্ট")}</h2><div class="grid grid-3">${tools.map((t) => toolCard(c, t))}</div>` : ""}
    ${posts.length ? html`<h2 class="hub-h">${c.L("Articles", "আর্টিকেল")}</h2><div class="grid grid-3">${posts.map((p) => careerPostCard(c, p))}</div>` : ""}
  </div></section>`;
  return page(c, { key: "cv-linkedin", title: c.L("CV & LinkedIn Toolkit", "সিভি ও লিংকডইন টুলকিট"), lead: c.L("Templates, examples and checklists to present your procurement experience clearly.", "আপনার প্রকিউরমেন্ট অভিজ্ঞতা স্পষ্টভাবে তুলে ধরতে টেমপ্লেট, উদাহরণ ও চেকলিস্ট।"), body });
}

// ------------------------------------------------------------------ interview preparation
async function interviewPage(c) {
  await guard(c, "interview-preparation");
  const d = await careerData(c);
  const level = c.url.searchParams.get("level") || "", topic = c.url.searchParams.get("topic") || "", kind = c.url.searchParams.get("kind") || "";
  const qs = await all(c.env, "SELECT * FROM career_questions WHERE status='published' ORDER BY sort, id");
  const shown = qs.filter((q) => (!level || q.level_slug === level) && (!topic || q.topic === topic) && (!kind || q.kind === kind));
  const lvName = Object.fromEntries(d.levels.map((l) => [l.slug, pk(c, l, "title")]));
  const skName = Object.fromEntries(d.skills.map((x) => [x.slug, pk(c, x, "name")]));
  const sel = (name, label, val, opts) => html`<div class="field third"><label for="iq-${name}">${label}</label><select id="iq-${name}" name="${name}" data-filter="${name}"><option value="">${c.t("dir.all")}</option>${opts.map(([v, l]) => html`<option value="${v}" ${v === val ? raw("selected") : ""}>${l}</option>`)}</select></div>`;
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap wrap-narrow">
    <form class="panel" method="get" style="margin-bottom:24px" data-live-filter><div class="form-grid">
      ${sel("level", c.L("Career level", "ক্যারিয়ার স্তর"), level, d.levels.map((l) => [l.slug, pk(c, l, "title")]))}
      ${sel("topic", c.L("Topic", "বিষয়"), topic, d.skills.map((x) => [x.slug, pk(c, x, "name")]))}
      ${sel("kind", c.L("Type", "ধরন"), kind, Object.entries(Q_KINDS).map(([k, v]) => [k, c.pick(...v)]))}</div>
      <noscript><button class="btn btn-primary btn-sm" style="margin-top:12px">${c.L("Filter", "ফিল্টার")}</button></noscript></form>
    <p class="small muted" data-filter-count data-total="${qs.length}">${c.L(`${c.num(shown.length)} of ${c.num(qs.length)} questions`, `${c.num(qs.length)}টির মধ্যে ${c.num(shown.length)}টি প্রশ্ন`)}</p>
    ${qs.map((q, n) => {
      const opts = lines(String(c.pick(q.options_en, q.options_bn)).replace(/\|/g, "\n"));
      return html`<article class="panel iq" data-iq data-f-level="${q.level_slug}" data-f-topic="${q.topic}" data-f-kind="${q.kind}" ${shown.includes(q) ? "" : raw("hidden")} ${q.kind === "mcq" ? raw(`data-correct="${q.correct_index}"`) : ""}>
        <div class="row" style="gap:6px;margin-bottom:10px"><span class="tag dark">${c.pick(...(Q_KINDS[q.kind] || [q.kind]))}</span>${lvName[q.level_slug] ? html`<span class="tag">${lvName[q.level_slug]}</span>` : ""}${skName[q.topic] ? html`<span class="tag outline">${skName[q.topic]}</span>` : ""}</div>
        <h3 style="font-size:18px">${pk(c, q, "q")}</h3>
        ${q.kind === "mcq" && opts.length ? html`<div class="iq-opts">${opts.map((o, i) => html`<button type="button" class="iq-opt" data-opt="${i}">${String.fromCharCode(65 + i)}. ${o}</button>`)}</div>` : ""}
        <details class="disclosure iq-ans"><summary>${q.kind === "mcq" ? c.L("Show answer & explanation", "উত্তর ও ব্যাখ্যা দেখুন") : c.L("Show model answer", "মডেল উত্তর দেখুন")}</summary><div>
          ${q.kind === "mcq" && opts[q.correct_index] ? html`<p><strong>${c.L("Correct answer:", "সঠিক উত্তর:")} ${String.fromCharCode(65 + q.correct_index)}. ${opts[q.correct_index]}</strong></p>` : ""}
          <div class="prose" style="font-size:16px">${raw(markdown(pk(c, q, "answer")))}</div></div></details></article>`;
    })}
    ${qs.length ? "" : preparing(c)}
    <div class="panel center" style="margin-top:28px"><h3>${c.L("Ready for a timed test?", "সময়ভিত্তিক পরীক্ষার জন্য প্রস্তুত?")}</h3><p class="muted">${c.L("Take a ProcureBest exam and earn a verifiable certificate.", "ProcureBest পরীক্ষা দিন এবং যাচাইযোগ্য সার্টিফিকেট অর্জন করুন।")}</p><a class="btn btn-primary" href="${c.p("/exams")}">${c.L("Go to exams", "পরীক্ষায় যান")}</a></div>
  </div></section>`;
  return page(c, { key: "interview-preparation", title: c.L("Interview Preparation", "ইন্টারভিউ প্রস্তুতি"), lead: c.L("Interview questions, multiple-choice practice, negotiation scenarios, supplier evaluation cases and practical problems — with model answers.", "ইন্টারভিউ প্রশ্ন, বহুনির্বাচনী অনুশীলন, দর-কষাকষির পরিস্থিতি, সাপ্লায়ার মূল্যায়নের কেস ও ব্যবহারিক সমস্যা — মডেল উত্তরসহ।"), body });
}

// ------------------------------------------------------------------ salary benchmark
async function salaryPage(c) {
  await guard(c, "salary-benchmark");
  const d = await careerData(c, false);
  const [rows, inds] = await Promise.all([all(c.env, "SELECT * FROM salary_benchmarks WHERE status='published' ORDER BY country, min_amount"), all(c.env, "SELECT slug, name_en, name_bn FROM industries ORDER BY sort")]);
  const q = Object.fromEntries(["country", "industry", "role", "level"].map((k) => [k, c.url.searchParams.get(k) || ""]));
  const roleBy = Object.fromEntries(d.roles.map((r) => [r.slug, r]));
  const indBy = Object.fromEntries(inds.map((x) => [x.slug, x]));
  const shown = rows.filter((r) => (!q.country || r.country === q.country) && (!q.industry || r.industry_slug === q.industry || (q.industry && !r.industry_slug)) && (!q.role || r.role_slug === q.role) && (!q.level || r.level_slug === q.level));
  const countries = [...new Set(rows.map((r) => r.country))];
  const sel = (name, label, opts) => html`<div class="field"><label for="sb-${name}">${label}</label><select id="sb-${name}" name="${name}" data-filter="${name}"><option value="">${c.t("dir.all")}</option>${opts.map(([v, l]) => html`<option value="${v}" ${v === q[name] ? raw("selected") : ""}>${l}</option>`)}</select></div>`;
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap">
    <div class="alert alert-warn" style="margin-bottom:20px">${icon("alert", 18)}<div>${c.L("Every row shows its basis (estimate, survey or job ads), its source and when it was last updated. Estimates are not verified market averages.", "প্রতিটি সারিতে ভিত্তি (আনুমানিক, জরিপ বা চাকরির বিজ্ঞাপন), উৎস এবং সর্বশেষ হালনাগাদের তারিখ দেখানো হয়। আনুমানিক সংখ্যা যাচাইকৃত বাজার-গড় নয়।")}</div></div>
    <form class="panel" method="get" style="margin-bottom:24px" data-live-filter><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      ${sel("country", c.L("Country", "দেশ"), countries.map((x) => [x, x]))}
      ${sel("industry", c.L("Industry", "খাত"), inds.map((x) => [x.slug, c.pick(x.name_en, x.name_bn)]))}
      ${sel("role", c.L("Job position", "পদ"), d.roles.map((r) => [r.slug, c.pick(r.title_en, r.title_bn)]))}
      ${sel("level", c.L("Experience level", "অভিজ্ঞতার স্তর"), d.levels.map((l) => [l.slug, `${pk(c, l, "title")} (${pk(c, l, "years")})`]))}</div>
      <noscript><button class="btn btn-primary btn-sm" style="margin-top:12px">${c.L("Filter", "ফিল্টার")}</button></noscript></form>
    ${rows.length ? html`<div class="table-wrap"><table><thead><tr><th>${c.L("Position", "পদ")}</th><th>${c.L("Country / industry", "দেশ / খাত")}</th><th class="num">${c.L("Range", "সীমা")}</th><th>${c.L("Basis & source", "ভিত্তি ও উৎস")}</th></tr></thead><tbody>
      ${rows.map((r) => html`<tr data-f-country="${r.country}" data-f-industry="${r.industry_slug || "*"}" data-f-role="${r.role_slug}" data-f-level="${r.level_slug}" ${shown.includes(r) ? "" : raw("hidden")}><td>${roleBy[r.role_slug] ? html`<a href="${c.p("/career/job-roles/" + r.role_slug)}">${c.pick(roleBy[r.role_slug].title_en, roleBy[r.role_slug].title_bn)}</a>` : r.role_slug}</td>
        <td>${r.country}<div class="small muted">${indBy[r.industry_slug] ? c.pick(indBy[r.industry_slug].name_en, indBy[r.industry_slug].name_bn) : c.L("All industries", "সব খাত")}</div></td>
        <td class="num"><strong>${r.currency} ${c.num(r.min_amount)}–${c.num(r.max_amount)}</strong><div class="small muted">${r.period === "year" ? c.L("per year", "প্রতি বছর") : c.L("per month", "প্রতি মাস")}</div></td>
        <td class="small"><span class="tag ${r.basis === "estimate" ? "warn" : "ok"}">${c.pick(...(BASIS[r.basis] || [r.basis]))}</span> ${r.source_url ? html`<a href="${r.source_url}" target="_blank" rel="noopener nofollow">${r.source}</a>` : r.source}
          <div class="muted">${c.L("Updated", "হালনাগাদ")}: ${r.updated_on ? c.date(r.updated_on) : "—"}${pk(c, r, "note") ? html` · ${pk(c, r, "note")}` : ""}</div></td></tr>`)}</tbody></table></div>`
      : ""}<p class="empty" data-filter-empty ${rows.length && shown.length ? raw("hidden") : ""}>${rows.length ? c.L("No salary data matches these filters.", "এই ফিল্টারে কোনো বেতনের তথ্য নেই।") : c.L("Salary data is being prepared.", "বেতনের তথ্য তৈরি হচ্ছে।")}</p>
  </div></section>`;
  return page(c, { key: "salary-benchmark", title: c.L("Salary Benchmark", "বেতন বেঞ্চমার্ক"), lead: c.L("Indicative procurement salary ranges by country, industry, position and experience level — always with source and date.", "দেশ, খাত, পদ ও অভিজ্ঞতার স্তর অনুযায়ী আনুমানিক প্রকিউরমেন্ট বেতন-সীমা — সবসময় উৎস ও তারিখসহ।"), body });
}

// ------------------------------------------------------------------ opportunities
async function opportunities(c) {
  const s = await guard(c, "opportunities");
  const d = await careerData(c, false);
  const inds = await all(c.env, "SELECT * FROM industries WHERE status='published' ORDER BY sort, id");
  const roleBy = Object.fromEntries(d.roles.map((r) => [r.slug, r]));
  const sources = lines(s.career_job_sources).map((l) => l.split("|").map((x) => x.trim())).filter((x) => /^https:\/\//.test(x[1] || ""));
  const body = html`<section class="section-sm" style="padding-top:0"><div class="wrap">
    <div class="alert alert-info" style="margin-bottom:24px">${icon("info", 18)}<div>${c.L("ProcureBest does not list job vacancies. Below are the industries that hire procurement people, the roles they hire for, and trusted external job sites.", "ProcureBest চাকরির শূন্যপদ তালিকাভুক্ত করে না। নিচে আছে যে খাতগুলো প্রকিউরমেন্ট পেশাজীবী নিয়োগ দেয়, তারা কোন পদে নিয়োগ দেয় এবং বিশ্বস্ত বাইরের চাকরির সাইট।")}</div></div>
    ${inds.length ? html`<div class="grid grid-3">${inds.map((x) => html`<div class="card"><h3 style="font-size:19px">${c.pick(x.name_en, x.name_bn)}</h3><p>${pk(c, x, "desc")}</p>
      ${pk(c, x, "employers") ? html`<p class="small" style="margin-top:12px"><strong>${c.L("Typical employers:", "সাধারণ নিয়োগকর্তা:")}</strong> ${pk(c, x, "employers")}</p>` : ""}
      ${x.role_slugs ? html`<div class="chips" style="margin-top:12px">${String(x.role_slugs).split(",").map((r) => roleBy[r.trim()]).filter(Boolean).map((r) => html`<a class="chip" href="${c.p("/career/job-roles/" + r.slug)}">${c.pick(r.title_en, r.title_bn)}</a>`)}</div>` : ""}</div>`)}</div>` : preparing(c)}
    ${sources.length ? html`<h2 class="hub-h">${c.L("Where to find procurement jobs", "প্রকিউরমেন্ট চাকরি কোথায় খুঁজবেন")}</h2>
      <div class="grid grid-2">${sources.map(([name, url, en, bn]) => html`<a class="card hover" href="${url}" target="_blank" rel="noopener nofollow"><h3 style="font-size:18px">${name} ${icon("external", 15)}</h3><p>${c.pick(en, bn)}</p><div class="card-foot muted small">${url.replace(/^https:\/\//, "")}</div></a>`)}</div>
      <p class="small muted" style="margin-top:14px">${c.L("External sites are not run by ProcureBest. Never pay a fee to apply for a job.", "বাইরের সাইটগুলো ProcureBest পরিচালনা করে না। চাকরির আবেদনের জন্য কখনো টাকা দেবেন না।")}</p>` : ""}
  </div></section>`;
  return page(c, { key: "opportunities", title: c.L("Career Opportunities", "ক্যারিয়ার সুযোগ"), lead: c.L("Industries, employer types and verified external job sources for procurement professionals.", "প্রকিউরমেন্ট পেশাজীবীদের জন্য খাত, নিয়োগকর্তার ধরন ও যাচাইকৃত বাইরের চাকরির উৎস।"), body });
}

// ------------------------------------------------------------------ routes
export function registerCareer(r) {
  const L = "/:lang(en|bn)";
  const blogOn = async (c, fn) => { await guard(c, "blog"); return fn(); };
  r.get(`${L}/career`, careerHome);
  r.get(`${L}/career/blog`, (c) => blogOn(c, () => postList(c, "career")));
  r.get(`${L}/career/blog/:slug`, (c) => blogOn(c, () => postPage(c, "career")));
  r.get(`${L}/career/roadmap`, roadmap);
  r.get(`${L}/career/job-roles`, rolesList);
  r.get(`${L}/career/job-roles/:slug`, roleProfile);
  r.get(`${L}/career/career-analysis`, analysis);
  r.get(`${L}/career/skills-assessment`, assessment);
  r.get(`${L}/career/certifications`, certList);
  r.get(`${L}/career/certifications/:slug`, certPage);
  r.get(`${L}/career/tools`, toolsPage);
  r.get(`${L}/career/tools/:slug`, toolPage);
  r.get(`${L}/career/cv-linkedin`, cvPage);
  r.get(`${L}/career/interview-preparation`, interviewPage);
  r.get(`${L}/career/salary-benchmark`, salaryPage);
  r.get(`${L}/career/opportunities`, opportunities);
  // Old career article addresses (/career/<slug>) keep working.
  r.get(`${L}/career/:slug`, (c) => c.redirect(c.p("/career/blog/" + c.params.slug), 301));
}
export const CAREER_SITEMAP = ["/career", ...HUB.filter(([k]) => k !== "home").map(([, p]) => "/career" + p)];
