// Career Roadmap: pure data and maths (no DOM). Imported by the browser to calculate
// and by the Worker for the admin editor. All figures are indicative estimates that the
// site owner can change in Admin → Calculators → Career roadmap.

export const DEFAULT_ROADMAP = {
  // years = typical years spent in this role before the next promotion
  // min / max = typical gross monthly salary in BDT at a large local company
  levels: [
    { key: "trainee", en: "Trainee / Entry level", bn: "ট্রেইনি / এন্ট্রি লেভেল", years: 1, min: 18000, max: 30000 },
    { key: "executive", en: "Procurement Executive", bn: "প্রকিউরমেন্ট এক্সিকিউটিভ", years: 2.5, min: 28000, max: 45000 },
    { key: "senior_executive", en: "Senior Executive", bn: "সিনিয়র এক্সিকিউটিভ", years: 2.5, min: 40000, max: 65000 },
    { key: "assistant_manager", en: "Assistant Manager", bn: "অ্যাসিস্ট্যান্ট ম্যানেজার", years: 3, min: 55000, max: 90000 },
    { key: "manager", en: "Procurement Manager", bn: "প্রকিউরমেন্ট ম্যানেজার", years: 4, min: 85000, max: 150000 },
    { key: "head", en: "Head of Procurement / Senior Manager", bn: "হেড অব প্রকিউরমেন্ট / সিনিয়র ম্যানেজার", years: 0, min: 150000, max: 300000 },
  ],
  // factor = salary multiplier; certValue = how much employers in this sector reward certifications
  industries: [
    { key: "local_sme", en: "Local company (SME)", bn: "স্থানীয় প্রতিষ্ঠান (এসএমই)", factor: 0.85, certValue: 0.7 },
    { key: "local_large", en: "Large local group", bn: "বড় স্থানীয় গ্রুপ", factor: 1, certValue: 1 },
    { key: "rmg", en: "RMG / manufacturing", bn: "আরএমজি / উৎপাদন", factor: 1.05, certValue: 0.9 },
    { key: "ngo", en: "NGO / development sector", bn: "এনজিও / উন্নয়ন খাত", factor: 1.3, certValue: 1.2 },
    { key: "mnc", en: "Multinational company", bn: "বহুজাতিক কোম্পানি", factor: 1.5, certValue: 1.25 },
  ],
  // time = % less time per promotion, salary = % higher salary, from = level index where the effect is full
  credentials: [
    { key: "cips", en: "CIPS (Level 4–6 / MCIPS)", bn: "CIPS (লেভেল ৪–৬ / MCIPS)", time: 20, salary: 15, months: 24, from: 1 },
    { key: "mba", en: "MBA (SCM or general)", bn: "এমবিএ (এসসিএম বা সাধারণ)", time: 12, salary: 12, months: 24, from: 3 },
    { key: "cscp", en: "ASCM CSCP", bn: "ASCM CSCP", time: 10, salary: 10, months: 9, from: 2 },
    { key: "cpim", en: "ASCM CPIM", bn: "ASCM CPIM", time: 8, salary: 8, months: 12, from: 1 },
    { key: "cpsm", en: "ISM CPSM", bn: "ISM CPSM", time: 10, salary: 10, months: 9, from: 2 },
    { key: "cscm", en: "ISCEA CSCM", bn: "ISCEA CSCM", time: 6, salary: 6, months: 4, from: 1 },
  ],
};

export const SKILLS = [
  { en: ["Purchase requisition to PO process", "RFQ handling and quotation comparison (CS)", "Basic Excel: lookups, pivot tables", "Supplier communication and follow-up"],
    bn: ["রিকুইজিশন থেকে পারচেজ অর্ডার প্রক্রিয়া", "আরএফকিউ ও কোটেশন তুলনা (CS)", "মৌলিক এক্সেল: লুকআপ, পিভট টেবিল", "সাপ্লায়ারের সঙ্গে যোগাযোগ ও ফলো-আপ"] },
  { en: ["Negotiation basics and price analysis", "Incoterms and import documents (LC, B/L, C&F)", "Supplier evaluation and onboarding", "ERP purchasing module (SAP / Oracle / Odoo)"],
    bn: ["দর-কষাকষির মৌলিক কৌশল ও মূল্য বিশ্লেষণ", "ইনকোটার্মস ও আমদানি ডকুমেন্ট (এলসি, বি/এল, সিএন্ডএফ)", "সাপ্লায়ার মূল্যায়ন ও অনবোর্ডিং", "ইআরপি পারচেজিং মডিউল (SAP / Oracle / Odoo)"] },
  { en: ["Total cost of ownership and landed cost", "Contract terms, penalties and warranties", "Procurement KPIs and monthly reporting", "Leading tenders end to end"],
    bn: ["মোট মালিকানা খরচ (টিসিও) ও ল্যান্ডেড কস্ট", "চুক্তির শর্ত, জরিমানা ও ওয়ারেন্টি", "প্রকিউরমেন্ট কেপিআই ও মাসিক রিপোর্টিং", "শুরু থেকে শেষ পর্যন্ত টেন্ডার পরিচালনা"] },
  { en: ["Category strategy and spend analysis", "Supplier risk and business continuity", "Team supervision and coaching", "Budgeting and savings tracking"],
    bn: ["ক্যাটাগরি কৌশল ও ব্যয় বিশ্লেষণ", "সাপ্লায়ার ঝুঁকি ও ব্যবসায়িক ধারাবাহিকতা", "টিম তত্ত্বাবধান ও কোচিং", "বাজেট ও সাশ্রয় ট্র্যাকিং"] },
  { en: ["Strategic sourcing and supplier relationship management", "Policy, compliance and audit readiness", "Stakeholder management with senior leaders", "Digital procurement and data-driven decisions"],
    bn: ["কৌশলগত সোর্সিং ও সাপ্লায়ার সম্পর্ক ব্যবস্থাপনা", "নীতিমালা, কমপ্লায়েন্স ও অডিট প্রস্তুতি", "শীর্ষ নেতৃত্বের সঙ্গে স্টেকহোল্ডার ব্যবস্থাপনা", "ডিজিটাল প্রকিউরমেন্ট ও ডেটাভিত্তিক সিদ্ধান্ত"] },
  { en: ["Procurement strategy aligned with business goals", "Building and developing teams", "Board-level reporting and governance", "Sustainability and ethical sourcing"],
    bn: ["ব্যবসার লক্ষ্যের সঙ্গে সামঞ্জস্যপূর্ণ প্রকিউরমেন্ট কৌশল", "টিম গঠন ও উন্নয়ন", "বোর্ড পর্যায়ে রিপোর্টিং ও সুশাসন", "টেকসই ও নৈতিক সোর্সিং"] },
];

export const EDUCATION = [
  { key: "diploma", en: "Diploma / HSC", bn: "ডিপ্লোমা / এইচএসসি", time: -10, salary: -8 },
  { key: "bachelor", en: "Bachelor's degree", bn: "স্নাতক ডিগ্রি", time: 0, salary: 0 },
  { key: "masters", en: "Master's degree", bn: "স্নাতকোত্তর ডিগ্রি", time: 5, salary: 4 },
];
export const PREVIOUS = [
  { key: "none", en: "No previous role (first job)", bn: "আগের কোনো পদ নেই (প্রথম চাকরি)", time: 0 },
  { key: "procurement", en: "Procurement / purchase (another company)", bn: "প্রকিউরমেন্ট / ক্রয় (অন্য প্রতিষ্ঠানে)", time: 5 },
  { key: "supply_chain", en: "Store, inventory, logistics or commercial", bn: "স্টোর, ইনভেন্টরি, লজিস্টিকস বা কমার্শিয়াল", time: 5 },
  { key: "technical", en: "Engineering / technical", bn: "ইঞ্জিনিয়ারিং / কারিগরি", time: 3 },
  { key: "other", en: "Other function (sales, accounts, admin…)", bn: "অন্য বিভাগ (সেলস, হিসাব, প্রশাসন…)", time: 0 },
];
export const PERFORMANCE = [
  { key: "steady", en: "Steady", bn: "স্থির", factor: 1.15 },
  { key: "good", en: "Good", bn: "ভালো", factor: 1 },
  { key: "outstanding", en: "Outstanding", bn: "অসাধারণ", factor: 0.82 },
];

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1k = (v) => Math.round(v / 1000) * 1000;

// Merge the admin's saved figures over the defaults (unknown keys are ignored).
export function mergeRoadmap(saved) {
  const d = JSON.parse(JSON.stringify(DEFAULT_ROADMAP));
  if (!saved || typeof saved !== "object") return d;
  for (const group of ["levels", "industries", "credentials"]) {
    const list = Array.isArray(saved[group]) ? saved[group] : [];
    for (const row of d[group]) {
      const s = list.find((x) => x && x.key === row.key);
      if (!s) continue;
      for (const k of Object.keys(row)) if (k !== "key" && s[k] !== undefined && s[k] !== "") row[k] = typeof row[k] === "number" ? num(s[k], row[k]) : String(s[k]);
    }
  }
  return d;
}

// Effect of a set of credentials on promotion time and salary for one level.
function credEffect(data, keys, levelIdx, industry) {
  let time = 0, salary = 0;
  for (const key of keys) {
    const cr = data.credentials.find((x) => x.key === key);
    if (!cr) continue;
    const w = levelIdx >= cr.from ? 1 : 0.5; // half the effect before the level where it really counts
    time += cr.time * w * industry.certValue;
    salary += cr.salary * w * industry.certValue;
  }
  return { time: clamp(time, 0, 40), salary: clamp(salary, 0, 50) };
}

export function computeRoadmap(data, input, now = new Date()) {
  const L = data.levels;
  const cur = clamp(Math.round(num(input.current, 1)), 0, L.length - 1);
  const target = clamp(Math.round(num(input.target, cur + 1)), 0, L.length - 1);
  const industry = data.industries.find((x) => x.key === input.industry) || data.industries[1];
  const edu = EDUCATION.find((x) => x.key === input.education) || EDUCATION[1];
  const prev = PREVIOUS.find((x) => x.key === input.previous) || PREVIOUS[0];
  const perf = PERFORMANCE.find((x) => x.key === input.performance) || PERFORMANCE[1];
  const inRole = clamp(num(input.years_in_role, 0), 0, 40);
  const total = clamp(num(input.total_years, inRole), 0, 50);
  const have = (input.have || []).filter((k) => data.credentials.some((c) => c.key === k));
  const plan = (input.plan || []).filter((k) => !have.includes(k) && data.credentials.some((c) => c.key === k));
  const errors = [];
  if (target <= cur) errors.push("target");

  const salaryAt = (idx, keys) => {
    const e = credEffect(data, keys, idx, industry);
    const f = industry.factor * (1 + (e.salary + edu.salary) / 100);
    return { min: round1k(L[idx].min * f), max: round1k(L[idx].max * f) };
  };
  const stepYears = (idx, keys, first) => {
    const e = credEffect(data, keys, idx, industry);
    let y = L[idx].years * perf.factor * (1 - (e.time + edu.time + (first ? prev.time : 0)) / 100);
    if (first) y = Math.max(0.25, y - inRole);
    return Math.round(y * 10) / 10;
  };
  const scenario = (keys) => {
    const steps = [];
    let years = 0;
    for (let i = cur; i < target; i++) {
      const y = stepYears(i, keys, i === cur);
      years += y;
      steps.push({ from: i, to: i + 1, years: y, cumulative: Math.round(years * 10) / 10, year: now.getFullYear() + Math.ceil(years), salary: salaryAt(i + 1, keys) });
    }
    return { steps, years: Math.round(years * 10) / 10, salaryNow: salaryAt(cur, keys), salaryTarget: salaryAt(target, keys) };
  };
  const base = scenario(have);
  const withPlan = scenario([...have, ...plan]);

  // Which credential (not yet held) helps most on the way to the target?
  const options = data.credentials.filter((c) => !have.includes(c.key)).map((c) => {
    const s = scenario([...have, c.key]);
    const saved = Math.round((base.years - s.years) * 10) / 10;
    const extra = s.salaryTarget.max - base.salaryTarget.max;
    return { key: c.key, en: c.en, bn: c.bn, months: c.months, saved, extra, score: saved * 12 + extra / 5000 };
  }).sort((a, b) => b.score - a.score);

  // Typical experience to reach the current role, to flag people who are ready for promotion.
  let typical = 0;
  for (let i = 0; i < cur; i++) typical += L[i].years;
  const ready = total >= typical + L[cur].years * 0.9 && inRole >= L[cur].years * 0.8 && cur < L.length - 1;

  return { errors, cur, target, industry, edu, prev, perf, have, plan, base, withPlan, options: options.slice(0, 3), ready, skills: SKILLS.slice(cur + 1, target + 1) };
}
