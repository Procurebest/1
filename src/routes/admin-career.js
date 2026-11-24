// Admin → Career Management. One generic editor serves every Career Hub table, so routine content
// (roles, skills, certifications, salaries, questions, rules, tools, industries) never needs a developer.
import { html, raw, clip, slugify, toInt, nowIso } from "../lib/util.js";
import { one, all, run } from "../lib/db.js";
import { icon } from "../views/icons.js";
import { saveSettings } from "../lib/settings.js";
import { getFile } from "../lib/files.js";
import { HttpError } from "../app.js";
import { adminLayout, csrfInput, fld, sel, statusTag, back, errBack, uploadField, guard } from "./admin.js";
import { CAREER_FEATURES, HOME_SECTIONS, CAREER_STEPS, careerStatus, careerOff, homeOrder, TRACKS, CERT_KINDS, Q_KINDS, BASIS } from "../lib/career.js";
import { HUB } from "./career.js";

const STATUS = (c) => [["published", c.L("Published", "প্রকাশিত")], ["draft", c.L("Hidden", "লুকানো")]];
// Field: [name, label_en, label_bn, type, opts]; type: text | area | num | sel | bi (EN+BN text) | biarea (EN+BN textarea)
function entities(c, lists) {
  const L = c.L;
  const levelOpts = lists.levels.map((l) => [l.slug, c.pick(l.title_en, l.title_bn)]);
  const skillOpts = lists.skills.map((x) => [x.slug, c.pick(x.name_en, x.name_bn)]);
  const roleOpts = lists.roles.map((x) => [x.slug, c.pick(x.title_en, x.title_bn)]);
  const indOpts = [["", L("All industries", "সব খাত")], ...lists.industries.map((x) => [x.slug, c.pick(x.name_en, x.name_bn)])];
  return {
    levels: { table: "career_levels", title: L("Career levels", "ক্যারিয়ার স্তর"), name: (r) => r.title_en, sub: (r) => `${r.years_en} · ${r.slug}`, order: "sort, id",
      fields: [["slug", "Key (web address)", "কী (ওয়েব ঠিকানা)", "slug"], ["title", "Level name", "স্তরের নাম", "bi"], ["years", "Indicative years", "আনুমানিক বছর", "bi"], ["desc", "Description", "বিবরণ", "biarea"], ["sort", "Display order", "ক্রম", "num"], ["status", "Status", "অবস্থা", "sel", STATUS(c)]] },
    roles: { table: "job_roles", title: L("Job roles (roadmap & library)", "জব রোল (রোডম্যাপ ও লাইব্রেরি)"), name: (r) => r.title_en, sub: (r) => `${r.level_slug} · ${r.track} · /career/job-roles/${r.slug}`, order: "sort, id", view: (r) => "/career/job-roles/" + r.slug,
      fields: [["slug", "Key (web address)", "কী (ওয়েব ঠিকানা)", "slug"], ["title", "Job title", "পদের নাম", "bi"], ["level_slug", "Career level", "ক্যারিয়ার স্তর", "sel", levelOpts],
        ["track", "Career track", "ক্যারিয়ার ট্র্যাক", "sel", Object.entries(TRACKS).map(([k, v]) => [k, c.pick(...v)])], ["exp_min", "Indicative experience from (years)", "আনুমানিক অভিজ্ঞতা থেকে (বছর)", "num"], ["exp_max", "to (years)", "পর্যন্ত (বছর)", "num"],
        ["overview", "1. Job overview", "১. পদের বিবরণ", "biarea"], ["resp", "2. Key responsibilities (one per line)", "২. প্রধান দায়িত্ব (প্রতি লাইনে একটি)", "biarea"],
        ["skills", "3. Required skills (one per line)", "৩. প্রয়োজনীয় দক্ষতা (প্রতি লাইনে একটি)", "biarea"], ["tech", "4. Technical skills (one per line)", "৪. কারিগরি দক্ষতা", "biarea"],
        ["edu", "5. Educational requirements", "৫. শিক্ষাগত যোগ্যতা", "biarea"], ["industries", "9. Relevant industries (one per line)", "৯. প্রাসঙ্গিক খাত", "biarea"],
        ["companies", "10. Types of companies (one per line)", "১০. প্রতিষ্ঠানের ধরন", "biarea"], ["resources", "12. Learning resources (one per line)", "১২. শেখার রিসোর্স", "biarea"],
        ["sort", "Display order", "ক্রম", "num"], ["status", "Status", "অবস্থা", "sel", STATUS(c)]] },
    skills: { table: "skills", title: L("Skills & competencies", "দক্ষতা ও সক্ষমতা"), name: (r) => r.name_en, sub: (r) => `${r.slug}${r.in_calc ? " · calculator" : ""}${r.in_assess ? " · assessment" : ""}`, order: "sort, id",
      fields: [["slug", "Key", "কী", "slug"], ["name", "Skill name", "দক্ষতার নাম", "bi"], ["desc", "Short description", "সংক্ষিপ্ত বিবরণ", "biarea"],
        ["statements", "Assessment statements (one per line, rated 1–5)", "মূল্যায়নের বাক্য (প্রতি লাইনে একটি, ১–৫ রেটিং)", "biarea"], ["learn", "Recommended training (one per line)", "প্রস্তাবিত প্রশিক্ষণ (প্রতি লাইনে একটি)", "biarea"],
        ["in_calc", "Use in Career Analysis", "ক্যারিয়ার অ্যানালাইসিসে ব্যবহার", "sel", [["1", L("Yes", "হ্যাঁ")], ["0", L("No", "না")]]], ["in_assess", "Use in Skills Assessment", "স্কিলস অ্যাসেসমেন্টে ব্যবহার", "sel", [["1", L("Yes", "হ্যাঁ")], ["0", L("No", "না")]]],
        ["sort", "Display order", "ক্রম", "num"], ["status", "Status", "অবস্থা", "sel", STATUS(c)]] },
    certifications: { table: "certifications", title: L("Certifications", "সার্টিফিকেশন"), name: (r) => r.name_en, sub: (r) => `${r.kind} · ${r.issuer}`, order: "sort, id", view: (r) => "/career/certifications/" + r.slug,
      fields: [["slug", "Key (web address)", "কী (ওয়েব ঠিকানা)", "slug"], ["name", "Name", "নাম", "bi"], ["kind", "Type", "ধরন", "sel", Object.entries(CERT_KINDS).map(([k, v]) => [k, c.pick(v[0], v[1])])],
        ["issuer", "Issuing organisation", "প্রদানকারী সংস্থা", "text"], ["url", "Official website (https://…)", "অফিসিয়াল ওয়েবসাইট (https://…)", "text"],
        ["overview", "Overview", "বিবরণ", "biarea"], ["eligibility", "Eligibility", "যোগ্যতার শর্ত", "biarea"], ["levels", "Qualification levels (one per line)", "লেভেল (প্রতি লাইনে একটি)", "biarea"],
        ["syllabus", "Syllabus", "সিলেবাস", "biarea"], ["duration", "Approximate duration", "আনুমানিক সময়", "bi"], ["cost", "Cost", "খরচ", "bi"],
        ["cost_verified", "Cost verified on the official website?", "খরচ অফিসিয়াল ওয়েবসাইটে যাচাই করা?", "sel", [["0", L("No — show 'check the official website'", "না — 'অফিসিয়াল ওয়েবসাইট দেখুন' দেখাবে")], ["1", L("Yes — show the amount", "হ্যাঁ — পরিমাণ দেখাবে")]]],
        ["cost_checked", "Date the cost was verified", "খরচ যাচাইয়ের তারিখ", "date"], ["relevance", "Career relevance", "ক্যারিয়ারে প্রাসঙ্গিকতা", "biarea"],
        ["stages", "Suitable career stages (level keys, comma-separated)", "উপযুক্ত পর্যায় (স্তরের কী, কমা দিয়ে)", "text", null, levelOpts.map((x) => x[0]).join(", ")],
        ["skill_slugs", "Skills it develops (skill keys, comma-separated)", "যে দক্ষতা গড়ে (দক্ষতার কী, কমা দিয়ে)", "text", null, skillOpts.map((x) => x[0]).join(", ")],
        ["sort", "Display order", "ক্রম", "num"], ["status", "Status", "অবস্থা", "sel", STATUS(c)]] },
    industries: { table: "industries", title: L("Company & industry", "প্রতিষ্ঠান ও খাত"), name: (r) => r.name_en, sub: (r) => r.slug, order: "sort, id",
      fields: [["slug", "Key", "কী", "slug"], ["name", "Industry", "খাত", "bi"], ["desc", "Description", "বিবরণ", "biarea"], ["employers", "Typical employers / employer categories", "সাধারণ নিয়োগকর্তা / ধরন", "biarea"],
        ["role_slugs", "Relevant job roles (role keys, comma-separated)", "প্রাসঙ্গিক পদ (পদের কী, কমা দিয়ে)", "text", null, roleOpts.map((x) => x[0]).join(", ")], ["sort", "Display order", "ক্রম", "num"], ["status", "Status", "অবস্থা", "sel", STATUS(c)]] },
    salaries: { table: "salary_benchmarks", title: L("Salary database", "বেতন ডাটাবেস"), name: (r) => `${r.role_slug} — ${r.currency} ${r.min_amount}–${r.max_amount}`, sub: (r) => `${r.country} · ${r.industry_slug || "all"} · ${r.basis} · ${r.updated_on}`, order: "country, role_slug",
      fields: [["role_slug", "Job position", "পদ", "sel", roleOpts], ["level_slug", "Experience level", "অভিজ্ঞতার স্তর", "sel", levelOpts], ["country", "Country", "দেশ", "text"], ["currency", "Currency (e.g. BDT, USD)", "মুদ্রা (যেমন BDT, USD)", "text"],
        ["industry_slug", "Industry", "খাত", "sel", indOpts], ["min_amount", "Minimum", "সর্বনিম্ন", "num"], ["max_amount", "Maximum", "সর্বোচ্চ", "num"],
        ["period", "Period", "সময়কাল", "sel", [["month", L("Per month", "প্রতি মাস")], ["year", L("Per year", "প্রতি বছর")]]], ["basis", "Basis", "ভিত্তি", "sel", Object.entries(BASIS).map(([k, v]) => [k, c.pick(...v)])],
        ["source", "Source (required)", "উৎস (আবশ্যক)", "text"], ["source_url", "Source link (optional)", "উৎসের লিংক (ঐচ্ছিক)", "text"], ["updated_on", "Last updated", "সর্বশেষ হালনাগাদ", "date"],
        ["note", "Note", "নোট", "bi"], ["status", "Status", "অবস্থা", "sel", STATUS(c)]] },
    questions: { table: "career_questions", title: L("Interview questions", "ইন্টারভিউ প্রশ্ন"), name: (r) => r.q_en, sub: (r) => `${r.kind} · ${r.level_slug} · ${r.topic}`, order: "sort, id",
      fields: [["kind", "Type", "ধরন", "sel", Object.entries(Q_KINDS).map(([k, v]) => [k, c.pick(...v)])], ["level_slug", "Career level", "ক্যারিয়ার স্তর", "sel", levelOpts], ["topic", "Topic", "বিষয়", "sel", skillOpts],
        ["q", "Question", "প্রশ্ন", "biarea"], ["options", "Options for multiple choice (separate with |)", "বহুনির্বাচনীর অপশন (| দিয়ে আলাদা)", "biarea"], ["correct_index", "Correct option (0 = first)", "সঠিক অপশন (০ = প্রথম)", "num"],
        ["answer", "Model answer / explanation (Markdown)", "মডেল উত্তর / ব্যাখ্যা (Markdown)", "biarea"], ["sort", "Display order", "ক্রম", "num"], ["status", "Status", "অবস্থা", "sel", STATUS(c)]] },
    rules: { table: "recommendation_rules", title: L("Calculator recommendation rules", "ক্যালকুলেটরের সুপারিশের নিয়ম"), name: (r) => r.text_en, sub: (r) => `${r.trigger} ${r.key} ${r.threshold}`, order: "sort, id",
      fields: [["trigger", "When", "কখন", "sel", [["skill_below", L("A skill rating is below the threshold (or below the target role's level)", "দক্ষতার রেটিং সীমার নিচে (বা লক্ষ্য পদের স্তরের নিচে)")], ["exp_below", L("Procurement experience is below the threshold (years)", "প্রকিউরমেন্ট অভিজ্ঞতা সীমার নিচে (বছর)")],
          ["no_cert", L("The person does not hold a certification", "ব্যক্তির নির্দিষ্ট সার্টিফিকেশন নেই")], ["field", L("Academic background equals the key", "শিক্ষাগত পটভূমি কী-এর সমান")], ["always", L("Always", "সবসময়")]]],
        ["key", "Key (skill key, cert key or background: business, engineering, science, arts, law, other)", "কী (দক্ষতা, সার্টিফিকেশন বা পটভূমির কী)", "text"], ["threshold", "Threshold", "সীমা", "num"],
        ["text", "Recommendation", "সুপারিশ", "biarea"], ["link_url", "Link (e.g. /exams)", "লিংক (যেমন /exams)", "text"], ["link", "Link text", "লিংকের লেখা", "bi"], ["sort", "Priority (lower first)", "অগ্রাধিকার (কম আগে)", "num"], ["status", "Status", "অবস্থা", "sel", STATUS(c)]] },
    tools: { table: "career_tools", title: L("Career tools & CV toolkit", "ক্যারিয়ার টুলস ও সিভি টুলকিট"), name: (r) => r.name_en, sub: (r) => `${r.grp} · ${r.kind}`, order: "grp, sort, id",
      fields: [["slug", "Key (web address)", "কী (ওয়েব ঠিকানা)", "slug"], ["name", "Name", "নাম", "bi"], ["desc", "Short description", "সংক্ষিপ্ত বিবরণ", "biarea"],
        ["grp", "Shown on", "কোথায় দেখাবে", "sel", [["tools", L("Career Tools", "ক্যারিয়ার টুলস")], ["cv", L("CV & LinkedIn Toolkit", "সিভি ও লিংকডইন টুলকিট")]]],
        ["kind", "Type", "ধরন", "sel", [["checklist", L("Checklist (items one per line)", "চেকলিস্ট (প্রতি লাইনে একটি)")], ["guide", L("Guide (Markdown text)", "গাইড (Markdown লেখা)")], ["compare", L("Certification comparison", "সার্টিফিকেশন তুলনা")], ["link", L("Link to a page", "একটি পাতার লিংক")]]],
        ["items", "Checklist items or guide text", "চেকলিস্টের আইটেম বা গাইডের লেখা", "biarea"], ["url", "Link (for type Link, e.g. /career/salary-benchmark)", "লিংক (Link ধরনের জন্য)", "text"],
        ["icon", "Icon", "আইকন", "sel", ["file", "bars", "award", "check-circle", "chat", "wallet", "calendar", "cv", "text", "user", "doc", "check", "briefcase", "book"].map((x) => [x, x])],
        ["sort", "Display order", "ক্রম", "num"], ["status", "Status (enable / disable)", "অবস্থা (চালু / বন্ধ)", "sel", [["published", L("Enabled", "চালু")], ["draft", L("Disabled", "বন্ধ")]]]] },
  };
}
const ORDER = ["roles", "levels", "skills", "certifications", "questions", "salaries", "rules", "tools", "industries"];
async function lists(c) {
  const [levels, skills, roles, industries] = await Promise.all([
    all(c.env, "SELECT slug, title_en, title_bn FROM career_levels ORDER BY sort, id"), all(c.env, "SELECT slug, name_en, name_bn FROM skills ORDER BY sort, id"),
    all(c.env, "SELECT slug, title_en, title_bn, level_slug FROM job_roles ORDER BY sort, id"), all(c.env, "SELECT slug, name_en, name_bn FROM industries ORDER BY sort, id")]);
  return { levels, skills, roles, industries };
}
const tabs = (c, active, E) => html`<div class="chips" style="margin-bottom:20px"><a class="chip ${active === "hub" ? "on" : ""}" href="/admin/career">${c.L("Overview & hub settings", "সারসংক্ষেপ ও হাব সেটিংস")}</a>
  ${ORDER.map((k) => html`<a class="chip ${active === k ? "on" : ""}" href="/admin/career/${k}">${E[k].title}</a>`)}<a class="chip" href="/admin/posts?section=career">${c.L("Career Blog", "ক্যারিয়ার ব্লগ")}</a><a class="chip" href="/admin/library?type=cv">${c.L("CV templates", "সিভি টেমপ্লেট")}</a></div>`;

// ------------------------------------------------------------------ overview & hub settings
async function overview(c) {
  const s = await c.settings();
  const E = entities(c, await lists(c));
  const st = await careerStatus(c.env);
  const off = careerOff(s);
  const order = homeOrder(s);
  const video = s.skate_video_id ? await getFile(c.env, s.skate_video_id) : null;
  const poster = s.skate_poster_id ? await getFile(c.env, s.skate_poster_id) : null;
  const secName = { journey: c.L("Career journey", "ক্যারিয়ার যাত্রা"), roadmap: c.L("Roadmap preview", "রোডম্যাপ প্রিভিউ"), calculator: c.L("Career Analysis call-to-action", "ক্যারিয়ার অ্যানালাইসিস"), articles: c.L("Popular articles", "জনপ্রিয় আর্টিকেল"), roles: c.L("Popular job roles", "জনপ্রিয় পদ"), certifications: c.L("Certifications", "সার্টিফিকেশন"), tools: c.L("Career tools", "ক্যারিয়ার টুলস"), interview: c.L("Interview preparation", "ইন্টারভিউ প্রস্তুতি"), resources: c.L("Career resources", "ক্যারিয়ার রিসোর্স") };
  const featName = Object.fromEntries(HUB.map(([k, , en, bn]) => [k, c.L(en, bn)]));
  const body = html`${tabs(c, "hub", E)}
  ${!Number(st.roles) ? html`<div class="panel" style="margin-bottom:20px" data-seed><h3>${c.L("Install starter career data", "প্রাথমিক ক্যারিয়ার ডেটা যোগ করুন")}</h3>
    <p class="small muted">${c.L("Adds 5 career levels, 18 job roles with full profiles, 11 competencies, 8 qualifications, career connections, 20 interview questions, salary ESTIMATES for Bangladesh (labelled as estimates), recommendation rules, 11 tools and 2 career articles. Everything can be edited afterwards. Running it twice does not create duplicates.", "৫টি ক্যারিয়ার স্তর, পূর্ণ প্রোফাইলসহ ১৮টি পদ, ১১টি দক্ষতা, ৮টি যোগ্যতা, ক্যারিয়ার সংযোগ, ২০টি ইন্টারভিউ প্রশ্ন, বাংলাদেশের আনুমানিক বেতন (আনুমানিক হিসেবে চিহ্নিত), সুপারিশের নিয়ম, ১১টি টুল ও ২টি ক্যারিয়ার আর্টিকেল যোগ হবে। পরে সব এডিট করা যাবে। দুবার চালালেও দ্বিগুণ হবে না।")}</p>
    <button class="btn btn-primary" type="button" data-seed-run data-steps="${CAREER_STEPS.join(",")}">${icon("sparkle", 16)} ${c.L("Install starter career data", "প্রাথমিক ক্যারিয়ার ডেটা যোগ করুন")}</button><span class="small muted" data-seed-status style="margin-left:10px"></span></div>` : ""}
  <div class="grid grid-4" style="margin-bottom:20px">${[["roles", st.roles, c.L("Job roles", "পদ")], ["skills", st.skills, c.L("Skills", "দক্ষতা")], ["certifications", st.certs, c.L("Certifications", "সার্টিফিকেশন")], ["questions", st.questions, c.L("Interview questions", "ইন্টারভিউ প্রশ্ন")],
    ["salaries", st.salaries, c.L("Salary rows", "বেতনের সারি")], ["rules", st.rules, c.L("Rules", "নিয়ম")], ["tools", st.tools, c.L("Tools", "টুল")], ["industries", st.industries, c.L("Industries", "খাত")]].map(([k, n, l]) => html`<a class="metric" href="/admin/career/${k}" style="text-decoration:none;color:inherit"><div class="v">${c.d(n || 0)}</div><div class="l">${l}</div></a>`)}</div>
  <form method="post" action="/admin/career" class="panel">${await csrfInput(c)}
    <div class="form-section"><h3>${c.L("Career Home text", "ক্যারিয়ার হোমের লেখা")}</h3><div class="form-grid" style="margin-top:12px">
      ${fld("career_title_en", c.L("Headline (English)", "শিরোনাম (ইংরেজি)"), s.career_title_en)}${fld("career_title_bn", c.L("Headline (Bengali)", "শিরোনাম (বাংলা)"), s.career_title_bn)}
      ${fld("career_lead_en", c.L("Introduction (English)", "পরিচিতি (ইংরেজি)"), s.career_lead_en, { rows: 3 })}${fld("career_lead_bn", c.L("Introduction (Bengali)", "পরিচিতি (বাংলা)"), s.career_lead_bn, { rows: 3 })}</div></div>
    <div class="form-section"><h3>${c.L("Career Home sections — show and order", "ক্যারিয়ার হোমের অংশ — দেখানো ও ক্রম")}</h3><p class="help">${c.L("Lower numbers appear first. Untick to hide.", "কম সংখ্যা আগে দেখাবে। লুকাতে টিক তুলে দিন।")}</p>
      <div class="table-wrap" style="margin-top:10px"><table><tbody>${order.map((k, i) => { const key = k.replace(/^-/, ""); return html`<tr><td><label class="check"><input type="checkbox" name="sec_on_${key}" value="1" ${k.startsWith("-") ? "" : raw("checked")}> <span>${secName[key]}</span></label></td>
        <td style="width:120px"><input type="number" name="sec_pos_${key}" value="${(i + 1) * 10}" min="0" max="999" aria-label="${c.L("Order", "ক্রম")}"></td></tr>`; })}</tbody></table></div></div>
    <div class="form-section"><h3>${c.L("Features on / off", "ফিচার চালু / বন্ধ")}</h3><p class="help">${c.L("A switched-off feature disappears from the menu, the Career Home and its page.", "বন্ধ ফিচার মেনু, ক্যারিয়ার হোম ও তার পাতা থেকে সরে যায়।")}</p>
      <input type="hidden" name="feat_form" value="1"><div class="share-checks" style="margin-top:10px">${CAREER_FEATURES.map((k) => html`<label class="check"><input type="checkbox" name="feat_${k}" value="1" ${off.has(k) ? "" : raw("checked")}> <span>${featName[k] || k}</span></label>`)}</div></div>
    <div class="form-section"><h3>${c.L("Career Analysis: readiness weights", "ক্যারিয়ার অ্যানালাইসিস: প্রস্তুতির ওজন")}</h3><div class="form-grid" style="margin-top:12px">
      ${fld("career_weights", c.L("Skills, experience, qualifications (%)", "দক্ষতা, অভিজ্ঞতা, যোগ্যতা (%)"), s.career_weights, { help: c.L("Three numbers separated by commas, e.g. 60,25,15. Shown to users under 'How it is calculated'.", "কমা দিয়ে আলাদা তিনটি সংখ্যা, যেমন 60,25,15। ব্যবহারকারীরা 'কীভাবে হিসাব হয়' অংশে দেখবেন।") })}</div></div>
    <div class="form-section"><h3>${c.L("Verified external job sources", "যাচাইকৃত বাইরের চাকরির উৎস")}</h3><div class="form-grid" style="margin-top:12px">
      ${fld("career_job_sources", c.L("One per line: Name | https://link | note (English) | note (Bengali)", "প্রতি লাইনে একটি: নাম | https://লিংক | নোট (ইংরেজি) | নোট (বাংলা)"), s.career_job_sources, { rows: 6, full: true })}</div></div>
    <div class="form-section"><h3>${c.L("Skateboard “career jump” animation", "স্কেটবোর্ড “ক্যারিয়ার জাম্প” অ্যানিমেশন")}</h3>
      <p class="help">${c.L("By default a lightweight drawing in the site's style is shown (Career Hub hero, and a small strip under the home-page animation). The iStock reference video is a paid stock asset: upload the licensed file here only after you have bought the licence — it then replaces the drawing. MP4 or WebM, no sound, ideally under 3 MB.", "স্বাভাবিকভাবে সাইটের স্টাইলে আঁকা একটি হালকা অ্যানিমেশন দেখায় (ক্যারিয়ার হাবের ওপরে এবং হোমপেজের অ্যানিমেশনের নিচে ছোট পটি)। iStock-এর রেফারেন্স ভিডিওটি পেইড স্টক অ্যাসেট: লাইসেন্স কেনার পরেই লাইসেন্সকৃত ফাইলটি এখানে আপলোড করুন — তখন সেটি আঁকা অ্যানিমেশনের জায়গা নেবে। MP4 বা WebM, শব্দ ছাড়া, ৩ MB-এর কম হলে ভালো।")}</p>
      <div class="form-grid" style="margin-top:12px">
      ${sel("skate_enabled", c.L("Show the animation", "অ্যানিমেশন দেখান"), s.skate_enabled, [["1", c.L("Yes", "হ্যাঁ")], ["0", c.L("No", "না")]], { third: true })}
      ${sel("skate_home", c.L("Also on the home page", "হোমপেজেও"), s.skate_home, [["1", c.L("Yes", "হ্যাঁ")], ["0", c.L("No", "না")]], { third: true })}<div class="field third"></div>
      ${uploadField(c, { name: "skate_video_id", label: c.L("Licensed skateboard video (MP4 / WebM)", "লাইসেন্সকৃত স্কেটবোর্ড ভিডিও (MP4 / WebM)"), file: video, accept: ".mp4,.webm", kind: "video", help: c.L("Leave empty to keep the drawing.", "আঁকা অ্যানিমেশন রাখতে ফাঁকা রাখুন।") })}
      ${uploadField(c, { name: "skate_poster_id", label: c.L("Poster picture for the video (first frame)", "ভিডিওর পোস্টার ছবি (প্রথম ফ্রেম)"), file: poster, accept: ".png,.jpg,.jpeg,.webp", kind: "cover", help: c.L("Shown before the video loads and to visitors who prefer reduced motion.", "ভিডিও লোডের আগে এবং কম মোশন পছন্দকারী দর্শকদের দেখানো হয়।") })}</div></div>
    <div class="form-actions"><button class="btn btn-primary btn-lg" type="submit">${c.L("Save hub settings", "হাব সেটিংস সেভ করুন")}</button><a class="link small" href="/${c.lang}/career" target="_blank">${c.L("Open the Career Hub", "ক্যারিয়ার হাব খুলুন")} ${icon("arrow-right", 14)}</a></div>
  </form>`;
  return adminLayout(c, { title: c.L("Career Management", "ক্যারিয়ার ম্যানেজমেন্ট"), body, active: "career" });
}
async function overviewSave(c) {
  const f = await c.form();
  const v = {};
  for (const k of ["career_title_en", "career_title_bn", "career_lead_en", "career_lead_bn", "career_job_sources", "skate_enabled", "skate_home"]) if (f.has(k)) v[k] = clip(f.get(k), 2000);
  const w = String(f.get("career_weights") || "").split(",").map((x) => Number(x.trim()));
  if (w.length !== 3 || w.some((x) => !Number.isFinite(x) || x < 0) || w[0] + w[1] + w[2] <= 0) return c.redirect(errBack("/admin/career", c.L("Weights must be three numbers like 60,25,15.", "ওজন হবে তিনটি সংখ্যা, যেমন 60,25,15।")));
  v.career_weights = w.join(",");
  v.career_sections = HOME_SECTIONS.map((k) => [k, toInt(f.get("sec_pos_" + k), 999), f.get("sec_on_" + k) ? "" : "-"]).sort((a, b) => a[1] - b[1]).map(([k, , h]) => h + k).join(",");
  if (f.get("feat_form")) v.career_off = CAREER_FEATURES.filter((k) => !f.get("feat_" + k)).join(",");
  for (const k of ["skate_video_id", "skate_poster_id"]) {
    let id = clip(f.get(k), 40);
    if (f.get(k + "_remove")) id = "";
    if (id && !(await one(c.env, "SELECT id FROM files WHERE id=? AND complete=1", id))) return c.redirect(errBack("/admin/career", c.L("The upload did not finish. Please upload it again.", "আপলোড শেষ হয়নি। আবার আপলোড করুন।")));
    v[k] = id;
  }
  await saveSettings(c.env, v);
  return c.redirect(back("/admin/career", "saved"));
}

// ------------------------------------------------------------------ generic list / edit
function expand(fields) {
  const out = [];
  for (const [name, en, bn, type, opts, hint] of fields) {
    if (type === "bi" || type === "biarea") { out.push([name + "_en", en + " (English)", bn + " (ইংরেজি)", type === "bi" ? "text" : "area"], [name + "_bn", en + " (Bengali)", bn + " (বাংলা)", type === "bi" ? "text" : "area"]); }
    else out.push([name, en, bn, type, opts, hint]);
  }
  return out;
}
async function listPage(c) {
  const ls = await lists(c);
  const E = entities(c, ls);
  const e = E[c.params.ent];
  if (!e) throw new HttpError(404);
  const rows = await all(c.env, `SELECT * FROM ${e.table} ORDER BY ${e.order}`);
  const body = html`${tabs(c, c.params.ent, E)}<div class="row between" style="margin-bottom:16px"><span class="small muted">${c.d(rows.length)}</span>
    <a class="btn btn-primary" href="/admin/career/${c.params.ent}/new">${icon("plus", 16)} ${c.L("Add new", "নতুন যোগ করুন")}</a></div>
    <div class="table-wrap"><table><tbody>${rows.length ? rows.map((r) => html`<tr><td><strong>${String(e.name(r) || "").slice(0, 120)}</strong><div class="tiny muted">${e.sub(r)}</div></td><td>${r.status ? statusTag(c, r.status) : ""}</td>
      <td class="num"><a class="btn btn-ghost btn-sm" href="/admin/career/${c.params.ent}/${r.id}">${c.L("Edit", "এডিট")}</a></td></tr>`) : html`<tr><td class="muted">${c.L("Nothing yet. Use “Install starter career data” on the overview, or add new.", "এখনো কিছু নেই। সারসংক্ষেপে “প্রাথমিক ক্যারিয়ার ডেটা” ব্যবহার করুন, অথবা নতুন যোগ করুন।")}</td></tr>`}</tbody></table></div>`;
  return adminLayout(c, { title: e.title, body, active: "career" });
}

async function roleExtras(c, r, ls) {
  const [rs, rc, paths, certs] = await Promise.all([
    all(c.env, "SELECT skill_slug, level FROM job_role_skills WHERE role_slug=?", r.slug), all(c.env, "SELECT cert_slug, priority FROM role_certifications WHERE role_slug=?", r.slug),
    all(c.env, "SELECT to_slug, kind FROM career_paths WHERE from_slug=?", r.slug), all(c.env, "SELECT slug, name_en, name_bn FROM certifications ORDER BY sort, id")]);
  const lv = Object.fromEntries(rs.map((x) => [x.skill_slug, x.level]));
  const pr = Object.fromEntries(rc.map((x) => [x.cert_slug, x.priority]));
  const pk = Object.fromEntries(paths.map((x) => [x.to_slug, x.kind]));
  return html`<input type="hidden" name="extras" value="1">
  <div class="form-section"><h3>${c.L("Competency levels required (used by the calculator and assessment)", "প্রয়োজনীয় দক্ষতার স্তর (ক্যালকুলেটর ও মূল্যায়নে ব্যবহৃত)")}</h3><div class="form-grid" style="margin-top:12px">
    ${ls.skills.map((x) => sel("rs_" + x.slug, c.pick(x.name_en, x.name_bn), String(lv[x.slug] || 0), [["0", c.L("Not needed", "দরকার নেই")], ...[1, 2, 3, 4, 5].map((n) => [String(n), String(n)])], { third: true }))}</div></div>
  <div class="form-section"><h3>${c.L("7. Relevant certifications", "৭. প্রাসঙ্গিক সার্টিফিকেশন")}</h3><div class="form-grid" style="margin-top:12px">
    ${certs.map((x) => sel("rc_" + x.slug, c.pick(x.name_en, x.name_bn), pr[x.slug] || "", [["", "—"], ["useful", c.L("Useful", "সহায়ক")], ["core", c.L("Often requested (counts in readiness)", "প্রায়ই চাওয়া হয় (প্রস্তুতিতে গণনা)")]], { third: true }))}</div></div>
  <div class="form-section"><h3>${c.L("11. Career connections from this role", "১১. এই পদ থেকে ক্যারিয়ার সংযোগ")}</h3><p class="help">${c.L("These lines draw the roadmap tree.", "এই সংযোগগুলো দিয়েই রোডম্যাপ ট্রি আঁকা হয়।")}</p><div class="form-grid" style="margin-top:12px">
    ${ls.roles.filter((x) => x.slug !== r.slug).map((x) => sel("cp_" + x.slug, c.pick(x.title_en, x.title_bn), pk[x.slug] || "", [["", "—"], ["next", c.L("Usual next step", "সাধারণ পরের ধাপ")], ["alt", c.L("Alternative path", "বিকল্প পথ")]], { third: true }))}</div></div>`;
}

async function editPage(c) {
  const ls = await lists(c);
  const E = entities(c, ls);
  const e = E[c.params.ent];
  if (!e) throw new HttpError(404);
  const isNew = c.params.id === "new";
  const r = isNew ? { status: "published", sort: 100 } : await one(c.env, `SELECT * FROM ${e.table} WHERE id=?`, toInt(c.params.id));
  if (!r) throw new HttpError(404);
  const fields = expand(e.fields);
  const body = html`${tabs(c, c.params.ent, E)}<form method="post" action="/admin/career/${c.params.ent}/${isNew ? "new" : r.id}" class="panel">${await csrfInput(c)}<div class="form-grid">
    ${fields.map(([name, en, bn, type, opts, hint]) => type === "sel" ? sel(name, c.L(en, bn), r[name] ?? (opts[0] || [""])[0], opts.map(([a, b]) => [String(a), b]), { third: true })
      : type === "area" ? fld(name, c.L(en, bn), r[name], { rows: /resp|statements|items|answer|overview|options/.test(name) ? 6 : 3 })
      : fld(name, c.L(en, bn), r[name], { type: type === "num" ? "number" : type === "date" ? "date" : "text", third: type === "num" || type === "date", attrs: type === "num" ? 'step="any"' : "",
          help: type === "slug" ? c.L("Lowercase words joined by -. Leave empty to create it from the English name.", "ছোট হাতের শব্দ - দিয়ে যুক্ত। ফাঁকা রাখলে ইংরেজি নাম থেকে তৈরি হবে।") : hint ? c.L("Available: ", "পাওয়া যায়: ") + hint : "" }))}</div>
    ${c.params.ent === "roles" && !isNew ? await roleExtras(c, r, ls) : c.params.ent === "roles" ? html`<p class="help">${c.L("Save first; then set skill levels, certifications and career connections.", "আগে সেভ করুন; তারপর দক্ষতার স্তর, সার্টিফিকেশন ও ক্যারিয়ার সংযোগ ঠিক করুন।")}</p>` : ""}
    <div class="form-actions"><button class="btn btn-primary" type="submit">${c.L("Save", "সেভ করুন")}</button><a class="btn btn-ghost" href="/admin/career/${c.params.ent}">${c.L("Cancel", "বাতিল")}</a>
      ${!isNew && e.view && r.status === "published" ? html`<a class="link small" href="/${c.lang}${e.view(r)}" target="_blank">${c.L("View on site", "সাইটে দেখুন")} ${icon("arrow-right", 14)}</a>` : ""}</div></form>
  ${!isNew ? html`<form method="post" action="/admin/career/${c.params.ent}/${r.id}/delete" style="margin-top:16px" data-confirm="${c.L("Delete permanently?", "স্থায়ীভাবে মুছবেন?")}">${await csrfInput(c)}<button class="btn btn-ghost btn-sm" type="submit" style="color:var(--err)">${icon("trash", 15)} ${c.L("Delete", "মুছুন")}</button></form>` : ""}`;
  return adminLayout(c, { title: `${e.title} — ${isNew ? c.L("new", "নতুন") : String(e.name(r) || "").slice(0, 60)}`, body, active: "career" });
}

async function saveEntity(c) {
  const ls = await lists(c);
  const E = entities(c, ls);
  const ent = c.params.ent;
  const e = E[ent];
  if (!e) throw new HttpError(404);
  const f = await c.form();
  const isNew = c.params.id === "new";
  const old = isNew ? null : await one(c.env, `SELECT * FROM ${e.table} WHERE id=?`, toInt(c.params.id));
  if (!isNew && !old) throw new HttpError(404);
  const self = `/admin/career/${ent}/${c.params.id}`;
  const vals = {};
  for (const [name, en, , type, opts] of expand(e.fields)) {
    let v = String(f.get(name) ?? "").trim();
    if (type === "num") { v = Number(v.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d))); if (!Number.isFinite(v)) v = 0; }
    else if (type === "sel") { if (!opts.some(([a]) => String(a) === v)) v = String((opts[0] || [""])[0]); if (["in_calc", "in_assess", "cost_verified"].includes(name)) v = v === "1" ? 1 : 0; }
    else if (type === "date") v = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
    else v = clip(v, type === "area" ? 20000 : 400);
    vals[name] = v;
  }
  const titleKey = ["title_en", "name_en", "q_en", "text_en"].find((k) => k in vals);
  if (titleKey && !vals[titleKey]) return c.redirect(errBack(self, c.L("The English name/text is required.", "ইংরেজি নাম/লেখা আবশ্যক।")));
  if ("slug" in vals) {
    vals.slug = slugify(vals.slug || vals[titleKey] || "") || "item-" + Date.now().toString(36);
    if (await one(c.env, `SELECT id FROM ${e.table} WHERE slug=? AND id<>?`, vals.slug, old ? old.id : 0)) vals.slug += "-" + Date.now().toString(36).slice(-4);
  }
  for (const k of ["url", "source_url"]) if (vals[k] && !/^https:\/\//.test(vals[k])) return c.redirect(errBack(self, c.L("Links must start with https://", "লিংক https:// দিয়ে শুরু হতে হবে")));
  for (const k of ["link_url"]) if (vals[k] && !/^\/(?!\/)/.test(vals[k])) return c.redirect(errBack(self, c.L("Use a site address starting with /, e.g. /exams", "/ দিয়ে শুরু সাইটের ঠিকানা দিন, যেমন /exams")));
  if (ent === "tools" && vals.url && !/^\/(?!\/)/.test(vals.url)) return c.redirect(errBack(self, c.L("Use a site address starting with /", "/ দিয়ে শুরু সাইটের ঠিকানা দিন")));
  if (ent === "salaries") {
    if (!vals.source) return c.redirect(errBack(self, c.L("Every salary row needs a source.", "প্রতিটি বেতনের সারিতে উৎস লাগবে।")));
    if (vals.max_amount < vals.min_amount) return c.redirect(errBack(self, c.L("Maximum must not be lower than minimum.", "সর্বোচ্চ সর্বনিম্নের চেয়ে কম হতে পারবে না।")));
    if (!vals.updated_on) vals.updated_on = nowIso().slice(0, 10);
  }
  if (["roles", "certifications"].includes(ent)) vals.updated_at = nowIso();
  const cols = Object.keys(vals);
  let id;
  if (isNew) id = (await run(c.env, `INSERT INTO ${e.table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...cols.map((k) => vals[k]))).meta.last_row_id;
  else { await run(c.env, `UPDATE ${e.table} SET ${cols.map((k) => k + "=?").join(",")} WHERE id=?`, ...cols.map((k) => vals[k]), old.id); id = old.id; }
  // A changed key updates every link to it, so the shared data stays consistent.
  if (old && old.slug && vals.slug && old.slug !== vals.slug) {
    const ren = { roles: [["career_paths", "from_slug"], ["career_paths", "to_slug"], ["job_role_skills", "role_slug"], ["role_certifications", "role_slug"], ["salary_benchmarks", "role_slug"]],
      skills: [["job_role_skills", "skill_slug"], ["career_questions", "topic"]], certifications: [["role_certifications", "cert_slug"]], levels: [["job_roles", "level_slug"], ["salary_benchmarks", "level_slug"], ["career_questions", "level_slug"]],
      industries: [["salary_benchmarks", "industry_slug"]] }[ent] || [];
    if (ren.length) await c.env.DB.batch(ren.map(([t, col]) => c.env.DB.prepare(`UPDATE ${t} SET ${col}=? WHERE ${col}=?`).bind(vals.slug, old.slug)));
  }
  if (ent === "roles" && f.get("extras")) {
    const slug = vals.slug;
    const st = [c.env.DB.prepare("DELETE FROM job_role_skills WHERE role_slug=?").bind(slug), c.env.DB.prepare("DELETE FROM role_certifications WHERE role_slug=?").bind(slug), c.env.DB.prepare("DELETE FROM career_paths WHERE from_slug=?").bind(slug)];
    const rows = { s: [], c: [], p: [] };
    for (const x of ls.skills) { const n = toInt(f.get("rs_" + x.slug), 0); if (n >= 1 && n <= 5) rows.s.push([slug, x.slug, n]); }
    for (const [k, v] of f.entries()) {
      if (k.startsWith("rc_") && ["core", "useful"].includes(v)) rows.c.push([slug, k.slice(3), v]);
      if (k.startsWith("cp_") && ["next", "alt"].includes(v) && ls.roles.some((x) => x.slug === k.slice(3))) rows.p.push([slug, k.slice(3), v]);
    }
    const ins = (sql, list) => { for (let i = 0; i < list.length; i += 30) { const ch = list.slice(i, i + 30); st.push(c.env.DB.prepare(`${sql} VALUES ${ch.map(() => "(?,?,?)").join(",")}`).bind(...ch.flat())); } };
    ins("INSERT OR IGNORE INTO job_role_skills(role_slug,skill_slug,level)", rows.s);
    ins("INSERT OR IGNORE INTO role_certifications(role_slug,cert_slug,priority)", rows.c);
    ins("INSERT OR IGNORE INTO career_paths(from_slug,to_slug,kind)", rows.p);
    await c.env.DB.batch(st);
  }
  return c.redirect(back(`/admin/career/${ent}/${id}`, "saved"));
}
async function deleteEntity(c) {
  const E = entities(c, await lists(c));
  const e = E[c.params.ent];
  if (!e) throw new HttpError(404);
  const r = await one(c.env, `SELECT * FROM ${e.table} WHERE id=?`, toInt(c.params.id));
  if (r) {
    const st = [c.env.DB.prepare(`DELETE FROM ${e.table} WHERE id=?`).bind(r.id)];
    if (c.params.ent === "roles") st.push(c.env.DB.prepare("DELETE FROM career_paths WHERE from_slug=? OR to_slug=?").bind(r.slug, r.slug), c.env.DB.prepare("DELETE FROM job_role_skills WHERE role_slug=?").bind(r.slug), c.env.DB.prepare("DELETE FROM role_certifications WHERE role_slug=?").bind(r.slug));
    if (c.params.ent === "skills") st.push(c.env.DB.prepare("DELETE FROM job_role_skills WHERE skill_slug=?").bind(r.slug));
    if (c.params.ent === "certifications") st.push(c.env.DB.prepare("DELETE FROM role_certifications WHERE cert_slug=?").bind(r.slug));
    await c.env.DB.batch(st);
  }
  return c.redirect(back(`/admin/career/${c.params.ent}`, "deleted"));
}

export function registerCareerAdmin(r) {
  const ENT = "(roles|levels|skills|certifications|questions|salaries|rules|tools|industries)";
  r.get("/admin/career", guard(overview));
  r.post("/admin/career", guard(overviewSave, { form: true }));
  r.get(`/admin/career/:ent${ENT}`, guard(listPage));
  r.get(`/admin/career/:ent${ENT}/:id`, guard(editPage));
  r.post(`/admin/career/:ent${ENT}/:id/delete`, guard(deleteEntity, { form: true }));
  r.post(`/admin/career/:ent${ENT}/:id`, guard(saveEntity, { form: true }));
}
