// Career Hub: shared data loading, feature switches and the starter-data installer.
import { all, one, scalar } from "./db.js";
import { nowIso } from "./util.js";
import * as SEED from "../seed/career-hub.js";

// Feature keys (Admin → Career Management → Hub settings can switch each off).
export const CAREER_FEATURES = ["blog", "roadmap", "job-roles", "career-analysis", "skills-assessment", "certifications", "tools", "cv-linkedin", "interview-preparation", "salary-benchmark", "opportunities"];
// Sections of the Career Home page, in display order. A leading "-" hides a section.
export const HOME_SECTIONS = ["journey", "roadmap", "calculator", "articles", "roles", "certifications", "tools", "interview", "resources"];

export const careerOff = (s) => new Set(String(s.career_off || "").split(",").map((x) => x.trim()).filter(Boolean));
export function homeOrder(s) {
  const list = String(s.career_sections || "").split(",").map((x) => x.trim()).filter(Boolean);
  const seen = new Set(list.map((x) => x.replace(/^-/, "")));
  for (const k of HOME_SECTIONS) if (!seen.has(k)) list.push(k);
  return list.filter((x) => HOME_SECTIONS.includes(x.replace(/^-/, "")));
}

export const TRACKS = {
  operations: ["Procurement operations", "প্রকিউরমেন্ট অপারেশনস"], sourcing: ["Sourcing", "সোর্সিং"], analytics: ["Analytics (specialist)", "অ্যানালিটিক্স (বিশেষজ্ঞ)"],
  contract: ["Contracts (specialist)", "চুক্তি (বিশেষজ্ঞ)"], project: ["Project procurement", "প্রজেক্ট প্রকিউরমেন্ট"], category: ["Category management", "ক্যাটাগরি ব্যবস্থাপনা"],
  management: ["Management", "ব্যবস্থাপনা"], leadership: ["Executive leadership", "নির্বাহী নেতৃত্ব"],
};
export const CERT_KINDS = {
  qualification: ["Qualification", "যোগ্যতা (কোয়ালিফিকেশন)", "A course of study with assessed levels.", "লেভেলভিত্তিক মূল্যায়নসহ পাঠক্রম।"],
  certification: ["Certification", "সার্টিফিকেশন", "An exam-based credential, often with renewal rules.", "পরীক্ষাভিত্তিক স্বীকৃতি, প্রায়ই নবায়নের নিয়মসহ।"],
  designation: ["Professional designation", "পেশাদার পদবি", "A title from a professional body after qualification plus experience.", "যোগ্যতা ও অভিজ্ঞতার পর পেশাদার সংস্থার দেওয়া উপাধি।"],
  degree: ["Academic degree", "একাডেমিক ডিগ্রি", "A university degree.", "বিশ্ববিদ্যালয়ের ডিগ্রি।"],
  training: ["Training programme", "প্রশিক্ষণ কর্মসূচি", "Short or long training, usually with a certificate of completion.", "ছোট বা দীর্ঘ প্রশিক্ষণ, সাধারণত সমাপনী সনদসহ।"],
};
export const Q_KINDS = { mcq: ["Multiple choice", "বহুনির্বাচনী"], open: ["Interview question", "ইন্টারভিউ প্রশ্ন"], scenario: ["Negotiation & workplace scenario", "দর-কষাকষি ও কর্মক্ষেত্রের পরিস্থিতি"], case: ["Case study & practical problem", "কেস স্টাডি ও ব্যবহারিক সমস্যা"] };
export const BASIS = { estimate: ["Estimate", "আনুমানিক"], survey: ["Salary survey", "বেতন জরিপ"], job_ads: ["Job advertisements", "চাকরির বিজ্ঞাপন"] };

// Everything the tree, the library and the calculator share — loaded once per request.
// full = false loads only levels, roles and paths (enough for the Career Home and the tree).
export async function careerData(c, full = true) {
  if (c._career && (c._career.full || !full)) return c._career;
  const base = c._careerBase || (c._careerBase = await Promise.all([
    all(c.env, "SELECT * FROM career_levels WHERE status='published' ORDER BY sort, id"),
    all(c.env, "SELECT id, slug, level_slug, track, sort, exp_min, exp_max, title_en, title_bn, overview_en, overview_bn FROM job_roles WHERE status='published' ORDER BY sort, id"),
    all(c.env, "SELECT from_slug, to_slug, kind FROM career_paths"),
  ]));
  const [levels, roles, paths] = base;
  const roleSet = new Set(roles.map((r) => r.slug));
  if (!full) {
    c._career = { levels, roles, paths: paths.filter((p) => roleSet.has(p.from_slug) && roleSet.has(p.to_slug)), skills: [], certs: [], rules: [], roleSkills: [], roleCerts: [], full: false };
    return c._career;
  }
  const [skills, roleSkills, certs, roleCerts, rules] = await Promise.all([
    all(c.env, "SELECT slug, sort, in_calc, in_assess, name_en, name_bn, desc_en, desc_bn, statements_en, statements_bn, learn_en, learn_bn FROM skills WHERE status='published' ORDER BY sort, id"),
    all(c.env, "SELECT role_slug, skill_slug, level FROM job_role_skills"),
    all(c.env, "SELECT slug, kind, name_en, name_bn, issuer, stages, skill_slugs, url FROM certifications WHERE status='published' ORDER BY sort, id"),
    all(c.env, "SELECT role_slug, cert_slug, priority FROM role_certifications"),
    all(c.env, "SELECT trigger, key, threshold, text_en, text_bn, link_url, link_en, link_bn FROM recommendation_rules WHERE status='published' ORDER BY sort, id"),
  ]);
  c._career = { levels, roles, skills, certs, rules, full: true,
    paths: paths.filter((p) => roleSet.has(p.from_slug) && roleSet.has(p.to_slug)),
    roleSkills: roleSkills.filter((r) => roleSet.has(r.role_slug)), roleCerts: roleCerts.filter((r) => roleSet.has(r.role_slug)) };
  return c._career;
}

// ------------------------------------------------------------------ starter data
export const CAREER_STEPS = ["career1", "career2", "career3"];
function multi(env, sql, cols, rows) {
  const per = Math.max(1, Math.floor(99 / cols.length));
  const out = [];
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    out.push(env.DB.prepare(`${sql} (${cols.join(",")}) VALUES ${chunk.map(() => "(" + cols.map(() => "?").join(",") + ")").join(",")}`).bind(...chunk.flat()));
  }
  return out;
}
const empty = async (env, table) => Number(await scalar(env, `SELECT COUNT(*) FROM ${table}`)) === 0;

export async function installCareerStep(env, step) {
  const now = nowIso();
  const st = [];
  if (step === "career1") {
    st.push(...multi(env, "INSERT OR IGNORE INTO career_levels", ["slug", "title_en", "title_bn", "years_en", "years_bn", "desc_en", "desc_bn", "sort"], SEED.LEVELS.map((l, i) => [...l, (i + 1) * 10])));
    st.push(...multi(env, "INSERT OR IGNORE INTO skills", ["slug", "name_en", "name_bn", "in_calc", "in_assess", "desc_en", "desc_bn", "statements_en", "statements_bn", "learn_en", "learn_bn", "sort"], SEED.SKILLS.map((s, i) => [...s, (i + 1) * 10])));
    st.push(...multi(env, "INSERT OR IGNORE INTO career_paths", ["from_slug", "to_slug", "kind"], SEED.PATHS));
    const rs = SEED.ROLES.flatMap((r) => SEED.SKILL_ORDER.map((k, i) => [r.slug, k, Number(r.skills[i]) || 0]).filter((x) => x[2] > 0));
    st.push(...multi(env, "INSERT OR IGNORE INTO job_role_skills", ["role_slug", "skill_slug", "level"], rs));
    const rc = SEED.ROLES.flatMap((r) => [...r.certs.core.map((x) => [r.slug, x, "core"]), ...r.certs.useful.map((x) => [r.slug, x, "useful"])]);
    st.push(...multi(env, "INSERT OR IGNORE INTO role_certifications", ["role_slug", "cert_slug", "priority"], rc));
    st.push(...multi(env, "INSERT OR IGNORE INTO industries", ["slug", "name_en", "name_bn", "desc_en", "desc_bn", "employers_en", "employers_bn", "role_slugs", "sort"], SEED.INDUSTRIES.map((x, i) => [...x, (i + 1) * 10])));
    if (await empty(env, "recommendation_rules")) st.push(...multi(env, "INSERT INTO recommendation_rules", ["trigger", "key", "threshold", "text_en", "text_bn", "link_url", "link_en", "link_bn", "sort"], SEED.RULES.map((x, i) => [...x, (i + 1) * 10])));
    st.push(...multi(env, "INSERT OR IGNORE INTO career_tools", ["slug", "grp", "kind", "icon", "name_en", "name_bn", "desc_en", "desc_bn", "items_en", "items_bn", "url", "sort"], SEED.TOOLS.map((x, i) => [...x, (i + 1) * 10])));
    st.push(env.DB.prepare("INSERT OR IGNORE INTO settings(k,v) VALUES ('career_job_sources', ?)").bind(SEED.JOB_SOURCES));
  } else if (step === "career2") {
    const cols = ["slug", "level_slug", "track", "sort", "exp_min", "exp_max", "updated_at", "title_en", "title_bn", "overview_en", "overview_bn", "resp_en", "resp_bn", "skills_en", "skills_bn",
      "tech_en", "tech_bn", "edu_en", "edu_bn", "industries_en", "industries_bn", "companies_en", "companies_bn", "resources_en", "resources_bn"];
    const f = ["title", "overview", "resp", "skills", "tech", "edu", "industries", "companies", "resources"];
    st.push(...multi(env, "INSERT OR IGNORE INTO job_roles", cols, SEED.ROLES.map((r, i) => [r.slug, r.level, r.track, (i + 1) * 10, r.exp[0], r.exp[1], now, ...f.flatMap((k) => [r.en[k], r.bn[k]])])));
  } else if (step === "career3") {
    const cf = ["name", "overview", "eligibility", "levels", "syllabus", "duration", "relevance"];
    st.push(...multi(env, "INSERT OR IGNORE INTO certifications", ["slug", "kind", "issuer", "url", "stages", "skill_slugs", "sort", "updated_at", "cost_en", "cost_bn", ...cf.flatMap((k) => [k + "_en", k + "_bn"])],
      SEED.CERTS.map((x, i) => [x.slug, x.kind, x.issuer, x.url, x.stages, x.skills, (i + 1) * 10, now, SEED.CERT_FEE[0], SEED.CERT_FEE[1], ...cf.flatMap((k) => [x.en[k], x.bn[k]])])));
    if (await empty(env, "career_questions")) st.push(...multi(env, "INSERT INTO career_questions", ["kind", "level_slug", "topic", "q_en", "q_bn", "options_en", "options_bn", "correct_index", "answer_en", "answer_bn", "sort"], SEED.QUESTIONS.map((x, i) => [...x, (i + 1) * 10])));
    if (await empty(env, "salary_benchmarks")) {
      const lvl = Object.fromEntries(SEED.ROLES.map((r) => [r.slug, r.level]));
      st.push(...multi(env, "INSERT INTO salary_benchmarks", ["country", "currency", "industry_slug", "role_slug", "level_slug", "min_amount", "max_amount", "period", "basis", "source", "updated_on", "note_en", "note_bn"],
        SEED.SALARIES.map(([r, a, b]) => ["Bangladesh", "BDT", "", r, lvl[r], a, b, "month", "estimate", SEED.SALARY_SOURCE, now.slice(0, 10),
          "Gross monthly, large local company. Multinationals and INGOs often pay more; small companies often less.", "মাসিক মোট বেতন, বড় স্থানীয় প্রতিষ্ঠান। বহুজাতিক ও আইএনজিও প্রায়ই বেশি দেয়; ছোট প্রতিষ্ঠান প্রায়ই কম।"])));
    }
    const day = 86400000;
    st.push(...multi(env, "INSERT OR IGNORE INTO posts", ["section", "slug", "category", "title_en", "title_bn", "summary_en", "summary_bn", "body_en", "body_bn", "author", "refs_json", "status", "published_at", "updated_at", "featured"],
      SEED.ARTICLES.map((a, i) => ["career", a.slug, a.category, a.en.title, a.bn.title, a.en.summary, a.bn.summary, a.en.body, a.bn.body, "ProcureBest Editorial", "[]", "published", new Date(Date.now() - (1 + i) * day).toISOString().slice(0, 10), now, 1])));
  } else throw new Error("Unknown step");
  if (st.length) await env.DB.batch(st);
  return { step, statements: st.length };
}

export async function careerStatus(env) {
  const r = await one(env, `SELECT (SELECT COUNT(*) FROM career_levels) AS levels, (SELECT COUNT(*) FROM job_roles) AS roles, (SELECT COUNT(*) FROM skills) AS skills,
    (SELECT COUNT(*) FROM certifications) AS certs, (SELECT COUNT(*) FROM career_questions) AS questions, (SELECT COUNT(*) FROM salary_benchmarks) AS salaries,
    (SELECT COUNT(*) FROM industries) AS industries, (SELECT COUNT(*) FROM career_tools) AS tools, (SELECT COUNT(*) FROM recommendation_rules) AS rules,
    (SELECT COUNT(*) FROM posts WHERE section='career') AS articles`);
  return r || {};
}
