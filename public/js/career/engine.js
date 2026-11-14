// Career Hub engine: pure functions (no DOM), used by the browser and by the tests.
// Every recommendation comes from a visible rule, so the result can always explain itself.
// The readiness score is an assessment-based development indicator — never a job probability.

export const DEFAULT_WEIGHTS = { skills: 60, experience: 25, certs: 15 };

export function parseWeights(text) {
  const n = String(text || "").split(",").map((x) => Number(x.trim()));
  if (n.length !== 3 || n.some((x) => !Number.isFinite(x) || x < 0) || n[0] + n[1] + n[2] <= 0) return { ...DEFAULT_WEIGHTS };
  return { skills: n[0], experience: n[1], certs: n[2] };
}

const pair = (en, bn) => ({ en, bn: bn || en });
const byKey = (list, key = "slug") => Object.fromEntries((list || []).map((x) => [x[key], x]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Required skills of a role: { skill_slug: level }
export function requiredSkills(data, roleSlug) {
  const out = {};
  for (const r of data.roleSkills || []) if (r.role_slug === roleSlug) out[r.skill_slug] = Number(r.level) || 0;
  return out;
}

// Next roles (usual promotion and alternatives) from a role.
export function nextRoles(data, slug) {
  return (data.paths || []).filter((p) => p.from_slug === slug).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "next" ? -1 : 1));
}

// Shortest path through the career tree (breadth first). Returns role slugs, or [] when not reachable.
export function findPath(data, from, to) {
  if (!from || !to) return [];
  if (from === to) return [from];
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const p of nextRoles(data, cur)) {
      if (p.to_slug in prev) continue;
      prev[p.to_slug] = cur;
      if (p.to_slug === to) {
        const path = [to];
        let x = cur;
        while (x) { path.unshift(x); x = prev[x]; }
        return path;
      }
      queue.push(p.to_slug);
    }
  }
  return [];
}

// Skill match of a person against a role (0–100) plus the gaps.
export function skillMatch(data, ratings, roleSlug) {
  const req = requiredSkills(data, roleSlug);
  const skills = (data.skills || []).filter((s) => s.in_calc && req[s.slug]);
  if (!skills.length) return { score: 100, gaps: [], strengths: [] };
  let sum = 0;
  const gaps = [], strengths = [];
  for (const s of skills) {
    const need = req[s.slug];
    const have = clamp(Number(ratings[s.slug]) || 0, 0, 5);
    sum += Math.min(have / need, 1);
    const row = { slug: s.slug, name: pair(s.name_en, s.name_bn), need, have, gap: Math.max(0, need - have) };
    (row.gap > 0 ? gaps : strengths).push(row);
  }
  gaps.sort((a, b) => b.gap - a.gap || b.need - a.need);
  strengths.sort((a, b) => b.have - a.have);
  return { score: Math.round((sum / skills.length) * 100), gaps, strengths };
}

export function readinessBand(score) {
  if (score >= 85) return { key: "strong", label: pair("Strong match with the role's requirements", "ভূমিকার শর্তের সঙ্গে শক্ত মিল") };
  if (score >= 65) return { key: "near", label: pair("Close — a few gaps to work on", "কাছাকাছি — কয়েকটি ঘাটতি নিয়ে কাজ করতে হবে") };
  if (score >= 40) return { key: "developing", label: pair("Developing — a clear plan will help", "উন্নয়নশীল — স্পষ্ট পরিকল্পনা সাহায্য করবে") };
  return { key: "early", label: pair("Early stage — build the foundations first", "প্রাথমিক পর্যায় — আগে ভিত্তি গড়ুন") };
}

/**
 * Full career analysis.
 * input = { current, target, procExp, totalExp, education, background, certs: [], skills: {slug: 1–5}, industry, targetIndustry, country, targetCountry, goal }
 */
export function analyze(data, input, weights = DEFAULT_WEIGHTS) {
  const roles = byKey(data.roles);
  const certs = byKey(data.certs);
  const skillsBy = byKey(data.skills);
  const levels = byKey(data.levels);
  const target = roles[input.target];
  if (!target) return { error: "target" };
  const current = roles[input.current] || null;
  const procExp = clamp(Number(input.procExp) || 0, 0, 60);
  const have = new Set(input.certs || []);
  const ratings = input.skills || {};

  // 1. skills
  const match = skillMatch(data, ratings, target.slug);
  // 2. experience (indicative minimum of the target role)
  const needExp = Number(target.exp_min) || 0;
  const expScore = needExp <= 0 ? 100 : Math.round(Math.min(procExp / needExp, 1) * 100);
  const expGap = Math.max(0, Math.round((needExp - procExp) * 10) / 10);
  // 3. certifications marked "core" for the target role
  const links = (data.roleCerts || []).filter((r) => r.role_slug === target.slug);
  const core = links.filter((r) => r.priority === "core").map((r) => r.cert_slug).filter((s) => certs[s]);
  const certScore = core.length ? Math.round((core.filter((s) => have.has(s)).length / core.length) * 100) : 100;

  const w = weights || DEFAULT_WEIGHTS;
  const total = w.skills + w.experience + w.certs || 1;
  const score = Math.round((match.score * w.skills + expScore * w.experience + certScore * w.certs) / total);

  // Career path from where the person is now (students start from the first entry-level roles).
  let path = [];
  if (current) path = findPath(data, current.slug, target.slug);
  else {
    const starts = (data.roles || []).filter((r) => r.level_slug === (data.levels[0] || {}).slug);
    for (const s of starts) { const p = findPath(data, s.slug, target.slug); if (p.length && (!path.length || p.length < path.length)) path = p; }
  }
  const roadmap = path.map((slug, i) => ({ slug, title: pair(roles[slug].title_en, roles[slug].title_bn), level: levels[roles[slug].level_slug] ? pair(levels[roles[slug].level_slug].title_en, levels[roles[slug].level_slug].title_bn) : pair(""),
    expMin: roles[slug].exp_min, expMax: roles[slug].exp_max, now: i === 0 && !!current }));

  // Recommended next moves from the current role, ranked by how well the person's skills already fit.
  const options = current ? nextRoles(data, current.slug) : (data.roles || []).filter((r) => r.level_slug === (data.levels[0] || {}).slug).map((r) => ({ to_slug: r.slug, kind: "next" }));
  const moves = options.filter((p) => roles[p.to_slug]).map((p) => {
    const m = skillMatch(data, ratings, p.to_slug);
    return { slug: p.to_slug, kind: p.kind, title: pair(roles[p.to_slug].title_en, roles[p.to_slug].title_bn), fit: m.score, onPath: path.includes(p.to_slug), topGap: m.gaps[0] ? m.gaps[0].name : null };
  }).sort((a, b) => (b.onPath - a.onPath) || b.fit - a.fit);

  // Certification recommendations, each with its reason.
  const recs = [];
  const add = (slug, reason, extra) => {
    const c = certs[slug];
    if (!c || have.has(slug) || recs.some((r) => r.slug === slug)) return;
    recs.push({ slug, name: pair(c.name_en, c.name_bn), kind: c.kind, reason, ...extra });
  };
  for (const l of links.sort((a, b) => (a.priority === "core" ? -1 : 1) - (b.priority === "core" ? -1 : 1))) add(l.cert_slug, l.priority === "core" ? "core" : "useful");
  for (const g of match.gaps.slice(0, 3)) {
    for (const c of data.certs || []) {
      const covers = String(c.skill_slugs || "").split(",").includes(g.slug);
      const stageOk = !c.stages || String(c.stages).split(",").includes(target.level_slug);
      if (covers && stageOk) add(c.slug, "gap", { skill: g.name });
    }
  }

  // Rules (admin-editable). Each triggered rule says why it fired.
  const rules = [];
  for (const r of data.rules || []) {
    let fired = false, why = null;
    if (r.trigger === "skill_below" && skillsBy[r.key]) {
      const v = Number(ratings[r.key]) || 0;
      const need = requiredSkills(data, target.slug)[r.key] || 0;
      if (v < Number(r.threshold) || (need && v < need)) { fired = true; why = { kind: "skill", skill: pair(skillsBy[r.key].name_en, skillsBy[r.key].name_bn), have: v, need: need || Number(r.threshold) }; }
    } else if (r.trigger === "exp_below") {
      if (procExp < Number(r.threshold)) { fired = true; why = { kind: "exp", have: procExp, need: Number(r.threshold) }; }
    } else if (r.trigger === "no_cert") {
      if (certs[r.key] && !have.has(r.key)) { fired = true; why = { kind: "cert", cert: pair(certs[r.key].name_en, certs[r.key].name_bn) }; }
    } else if (r.trigger === "field") {
      if (input.background === r.key) { fired = true; why = { kind: "field" }; }
    } else if (r.trigger === "always") { fired = true; why = { kind: "always" }; }
    if (fired) rules.push({ text: pair(r.text_en, r.text_bn), link: r.link_url ? { url: r.link_url, label: pair(r.link_en, r.link_bn) } : null, why, skill: r.trigger === "skill_below" ? r.key : null });
  }
  // Skill rules for the biggest gaps first.
  const gapOrder = match.gaps.map((g) => g.slug);
  rules.sort((a, b) => (a.skill ? (gapOrder.indexOf(a.skill) + 1 || 99) : 50) - (b.skill ? (gapOrder.indexOf(b.skill) + 1 || 99) : 50));

  // Learning resources: the "learn" lines of the top gap skills.
  const learning = match.gaps.slice(0, 3).map((g) => ({ skill: g.name, slug: g.slug,
    items: { en: String(skillsBy[g.slug].learn_en || "").split("\n").filter(Boolean), bn: String(skillsBy[g.slug].learn_bn || skillsBy[g.slug].learn_en || "").split("\n").filter(Boolean) } }));

  // 90-day plan in three 30-day blocks.
  const g = match.gaps;
  const firstLearn = (i) => (learning[i] ? pair(learning[i].items.en[0] || "", learning[i].items.bn[0] || "") : null);
  const plan = [
    { days: "1–30", items: [
      g[0] ? pair(`Focus skill: ${g[0].name.en} (from ${g[0].have} to ${g[0].need}).`, `মূল দক্ষতা: ${g[0].name.bn} (${g[0].have} থেকে ${g[0].need})।`) : pair("Keep your strongest skills sharp and document results.", "সবচেয়ে শক্তিশালী দক্ষতাগুলো ধরে রাখুন এবং ফলাফল নথিভুক্ত করুন।"),
      firstLearn(0),
      pair(`Read the full profile of ${target.title_en} and list its responsibilities you already do.`, `${target.title_bn || target.title_en}-এর পূর্ণ প্রোফাইল পড়ুন এবং যে দায়িত্বগুলো আপনি ইতিমধ্যে করেন সেগুলোর তালিকা করুন।`),
    ].filter(Boolean) },
    { days: "31–60", items: [
      g[1] ? pair(`Second skill: ${g[1].name.en} (from ${g[1].have} to ${g[1].need}).`, `দ্বিতীয় দক্ষতা: ${g[1].name.bn} (${g[1].have} থেকে ${g[1].need})।`) : null,
      firstLearn(1),
      recs[0] ? pair(`Check eligibility and plan to start: ${recs[0].name.en}.`, `যোগ্যতা যাচাই করে শুরুর পরিকল্পনা করুন: ${recs[0].name.bn}।`) : null,
      expGap > 0 ? pair("Ask your manager for one responsibility from the target role (for example a tender or a supplier review).", "লক্ষ্য পদের একটি দায়িত্ব চেয়ে নিন (যেমন একটি টেন্ডার বা সাপ্লায়ার পর্যালোচনা)।") : null,
    ].filter(Boolean) },
    { days: "61–90", items: [
      g[2] ? pair(`Third skill: ${g[2].name.en} (from ${g[2].have} to ${g[2].need}).`, `তৃতীয় দক্ষতা: ${g[2].name.bn} (${g[2].have} থেকে ${g[2].need})।`) : null,
      pair("Write two new CV achievements with numbers from the last 90 days.", "গত ৯০ দিনের কাজ থেকে সংখ্যাসহ দুটি নতুন সিভি অর্জন লিখুন।"),
      pair("Practise interview questions for the target level, then repeat this analysis to measure progress.", "লক্ষ্য স্তরের ইন্টারভিউ প্রশ্ন অনুশীলন করুন, তারপর অগ্রগতি মাপতে এই বিশ্লেষণ আবার করুন।"),
    ].filter(Boolean) },
  ];

  return {
    current: current ? { slug: current.slug, title: pair(current.title_en, current.title_bn) } : null,
    target: { slug: target.slug, title: pair(target.title_en, target.title_bn), level: target.level_slug, expMin: target.exp_min, expMax: target.exp_max },
    readiness: { score, skills: match.score, experience: expScore, certs: certScore, weights: w, band: readinessBand(score) },
    gaps: match.gaps, strengths: match.strengths, required: requiredSkills(data, target.slug),
    expGap, procExp, coreCerts: core.map((s) => ({ slug: s, name: pair(certs[s].name_en, certs[s].name_bn), held: have.has(s) })),
    roadmap, reachable: path.length > 0, moves, certRecs: recs.slice(0, 4), rules: rules.slice(0, 6), learning, plan,
  };
}

// Skills assessment: statements rated 1–5 per competency.
export function assess(skills, answers, required = {}) {
  const rows = skills.map((s) => {
    const vals = (answers[s.slug] || []).map(Number).filter((v) => v >= 1 && v <= 5);
    const score = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
    const need = Number(required[s.slug]) || 0;
    return { slug: s.slug, name: pair(s.name_en, s.name_bn), score, need, gap: need ? Math.max(0, Math.round((need - score) * 10) / 10) : 0, answered: vals.length };
  }).filter((r) => r.answered);
  const strong = rows.filter((r) => r.score >= 4).sort((a, b) => b.score - a.score);
  const improve = rows.filter((r) => r.score < 3 || r.gap > 0).sort((a, b) => (b.gap - a.gap) || a.score - b.score);
  const overall = rows.length ? Math.round((rows.reduce((a, r) => a + r.score, 0) / rows.length / 5) * 100) : 0;
  return { rows, strong, improve, overall };
}
