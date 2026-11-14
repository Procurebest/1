// Career Hub browser code: roadmap tree, career analysis wizard, skills assessment, checklists,
// certification comparison, interview practice and the licensed skateboard video (when uploaded).
import { analyze, assess, requiredSkills } from "./engine.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const dataEl = document.getElementById("career-data");
const D = dataEl ? JSON.parse(dataEl.textContent) : {};
const bn = (D.lang || document.documentElement.lang) === "bn";
const T = (en, b) => (bn ? b : en);
const P = (pair) => (pair ? (bn ? dg(pair.bn || pair.en) : pair.en) : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const dg = (v) => (bn ? String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]) : String(v));
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- licensed skateboard video (lazy, muted, no autoplay when reduced motion)
$$("[data-skate-video]").forEach((v) => {
  if (reduced) { v.removeAttribute("loop"); return; }
  const start = () => { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); };
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : v.pause())), { rootMargin: "100px" }).observe(v);
  else start();
});

// ---------------------------------------------------------------- roadmap tree
const tree = $("[data-tree]");
if (tree && D.roles) {
  const roles = Object.fromEntries(D.roles.map((r) => [r.slug, r]));
  const panel = $("[data-tree-panel]");
  const svg = $("[data-tree-lines]");
  const canvas = $("[data-tree-canvas]");
  let current = null;
  const links = (slug) => D.paths.filter((p) => p.from_slug === slug);
  const lines = () => {
    svg.innerHTML = "";
    if (!current || window.innerWidth < 900) return;
    const box = canvas.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    const a = $(`[data-role="${current}"]`, canvas).getBoundingClientRect();
    const draw = (from, to, cls) => {
      const x1 = from.right - box.left, y1 = from.top + from.height / 2 - box.top, x2 = to.left - box.left, y2 = to.top + to.height / 2 - box.top;
      const mx = (x1 + x2) / 2;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
      p.setAttribute("class", cls);
      svg.appendChild(p);
    };
    // Lines only between columns; roles on the same level are highlighted instead.
    const lvl = roles[current].level;
    links(current).forEach((p) => { const el = $(`[data-role="${p.to_slug}"]`, canvas); if (el && !el.hidden && roles[p.to_slug].level !== lvl) draw(a, el.getBoundingClientRect(), p.kind === "next" ? "tl-next" : "tl-alt"); });
    D.paths.filter((p) => p.to_slug === current).forEach((p) => { const el = $(`[data-role="${p.from_slug}"]`, canvas); if (el && !el.hidden && roles[p.from_slug].level !== lvl) draw(el.getBoundingClientRect(), a, "tl-prev"); });
  };
  const select = (slug, scroll) => {
    current = slug;
    const r = roles[slug];
    const out = links(slug);
    const prev = D.paths.filter((p) => p.to_slug === slug);
    $$(".tree-role", canvas).forEach((el) => {
      const s = el.dataset.role;
      el.classList.toggle("on", s === slug);
      el.classList.toggle("is-next", out.some((p) => p.to_slug === s && p.kind === "next"));
      el.classList.toggle("is-alt", out.some((p) => p.to_slug === s && p.kind === "alt"));
      el.classList.toggle("is-prev", prev.some((p) => p.from_slug === s));
    });
    const list = (arr, key) => arr.map((p) => `<button type="button" class="chip" data-go="${p[key]}">${esc(roles[p[key]].title)}</button>`).join("");
    const nx = out.filter((p) => p.kind === "next"), al = out.filter((p) => p.kind === "alt");
    panel.innerHTML = `<div class="row" style="gap:6px;margin-bottom:10px"><span class="tag dark">${esc((D.levels.find((l) => l.slug === r.level) || {}).title || "")}</span>${r.trackName ? `<span class="tag">${esc(r.trackName)}</span>` : ""}</div>
      <h3 style="font-size:22px">${esc(r.title)}</h3><p class="muted">${esc(r.overview)}</p>
      <p class="small"><strong>${esc(D.t.exp)}:</strong> ${esc(r.exp)}</p>
      <h4 class="tp-h">${esc(D.t.next)}</h4><div class="chips">${nx.length ? list(nx, "to_slug") : `<span class="small muted">${esc(D.t.top)}</span>`}</div>
      ${al.length ? `<h4 class="tp-h">${esc(D.t.alt)}</h4><div class="chips">${list(al, "to_slug")}</div>` : ""}
      ${prev.length ? `<h4 class="tp-h">${esc(D.t.from)}</h4><div class="chips">${list(prev, "from_slug")}</div>` : ""}
      <div class="row" style="margin-top:18px;gap:8px"><a class="btn btn-primary btn-sm" href="${D.base}/job-roles/${slug}">${esc(D.t.open)}</a><a class="btn btn-ghost btn-sm" href="${D.base}/career-analysis?target=${slug}">${esc(D.t.analyse)}</a></div>`;
    lines();
    if (scroll && window.innerWidth < 900) panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    try { history.replaceState(null, "", "#" + slug); } catch { /* ignore */ }
  };
  canvas.addEventListener("click", (e) => { const a = e.target.closest("[data-role]"); if (!a) return; e.preventDefault(); select(a.dataset.role, true); });
  panel.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) { select(b.dataset.go, false); $(`[data-role="${b.dataset.go}"]`, canvas).focus(); } });
  const filter = (t, btn) => {
    $$("[data-track]", tree).forEach((x) => x.classList.toggle("on", x === btn));
    $$(".tree-role", canvas).forEach((el) => {
      const k = el.dataset.trackKey;
      el.hidden = !(!t || (t === "@mgmt" ? D.mgmt.includes(k) : t === "@spec" ? !D.mgmt.includes(k) : k === t));
    });
    lines();
  };
  $$("[data-track]", tree).forEach((b) => b.addEventListener("click", () => { filter(b.dataset.track, b); const sp = $("[data-track-select]", tree); if (sp) sp.value = ""; }));
  $("[data-track-select]", tree)?.addEventListener("change", (e) => filter(e.target.value, e.target.value ? null : $("[data-track='']", tree)));
  window.addEventListener("resize", lines);
  const start = location.hash.slice(1);
  select(roles[start] ? start : (D.roles.find((r) => r.slug === "procurement-officer") || D.roles[0]).slug, false);
}

// ---------------------------------------------------------------- career analysis wizard
const wiz = $("[data-wizard]");
if (wiz && D.roles) {
  const steps = $$("[data-step]", wiz);
  let i = 0;
  const prev = $("[data-wiz-prev]", wiz), next = $("[data-wiz-next]", wiz), submit = $("[data-wiz-submit]", wiz);
  const show = (n) => {
    i = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach((s, k) => { s.hidden = k !== i; });
    $$("[data-dot]", wiz).forEach((d, k) => { d.classList.toggle("on", k <= i); });
    prev.hidden = i === 0; next.hidden = i === steps.length - 1; submit.hidden = i !== steps.length - 1;
  };
  prev.addEventListener("click", () => show(i - 1));
  next.addEventListener("click", () => { show(i + 1); steps[i].querySelector("select, input")?.focus(); });
  $$("[data-dot]", wiz).forEach((d, k) => d.addEventListener("click", () => show(k)));
  const hashTarget = location.hash.slice(1);
  const tSel = $("[name=target]", wiz);
  const saved = store.get("pb_career_analysis");
  if (saved) for (const [k, v] of Object.entries(saved)) {
    const els = $$(`[name="${k}"]`, wiz);
    els.forEach((el) => { if (el.type === "checkbox") el.checked = [].concat(v).includes(el.value); else if (el.type === "radio") el.checked = String(v) === el.value; else if (!(k === "target" && new URLSearchParams(location.search).get("target"))) el.value = v; });
  }
  if (hashTarget && tSel && [...tSel.options].some((o) => o.value === hashTarget)) tSel.value = hashTarget;
  const result = $("[data-analysis-result]");
  wiz.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(wiz);
    const raw = {};
    for (const [k, v] of fd.entries()) { if (k === "certs") (raw.certs = raw.certs || []).push(v); else raw[k] = v; }
    store.set("pb_career_analysis", raw);
    const skills = {};
    for (const s of D.skills) if (raw["sk_" + s.slug]) skills[s.slug] = Number(raw["sk_" + s.slug]);
    const r = analyze(D, { ...raw, certs: raw.certs || [], skills, procExp: Number(raw.procExp) || 0 }, D.weights);
    if (r.error) { result.innerHTML = `<div class="alert alert-err">${T("Choose a target position.", "লক্ষ্য পদ বেছে নিন।")}</div>`; return; }
    result.innerHTML = renderAnalysis(r);
    result.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
  show(0);
}
function bar(label, v) { return `<div class="meter-row"><span>${esc(label)}</span><span class="meter"><i style="width:${v}%"></i></span><b>${dg(v)}%</b></div>`; }
function renderAnalysis(r) {
  const R = r.readiness;
  const w = R.weights;
  const lvl = (s) => (D.levels.find((l) => l.slug === s) || {});
  const root = D.root || "";
  const reason = (x) => x.reason === "core" ? T("Often requested for the target role", "লক্ষ্য পদের জন্য প্রায়ই চাওয়া হয়") : x.reason === "useful" ? T("Useful for the target role", "লক্ষ্য পদের জন্য সহায়ক") : T(`Covers your gap in ${x.skill.en}`, `আপনার ${x.skill.bn} ঘাটতি পূরণে সহায়ক`);
  const why = (w2) => !w2 ? "" : w2.kind === "skill" ? T(`Because you rated ${w2.skill.en} ${w2.have}/5 (target ${w2.need}).`, `কারণ আপনি ${w2.skill.bn}-এ ${dg(w2.have)}/৫ দিয়েছেন (লক্ষ্য ${dg(w2.need)})।`)
    : w2.kind === "exp" ? T(`Because you have ${w2.have} years of procurement experience.`, `কারণ আপনার প্রকিউরমেন্ট অভিজ্ঞতা ${dg(w2.have)} বছর।`) : w2.kind === "cert" ? T(`Because you do not hold ${w2.cert.en} yet.`, `কারণ আপনার এখনো ${w2.cert.bn} নেই।`)
    : w2.kind === "field" ? T("Because of your academic background.", "আপনার শিক্ষাগত পটভূমির কারণে।") : "";
  return `<div class="panel cr-card">
    <span class="eyebrow">${T("Current career profile", "বর্তমান ক্যারিয়ার প্রোফাইল")}</span>
    <p style="margin:0 0 16px">${r.current ? esc(P(r.current.title)) : T("Student / not yet in procurement", "শিক্ষার্থী / এখনো প্রকিউরমেন্টে নই")} · ${dg(r.procExp)} ${T("years in procurement", "বছর প্রকিউরমেন্টে")} → <strong>${esc(P(r.target.title))}</strong></p>
    <div class="readiness"><div class="ring" style="--v:${R.score}"><span>${dg(R.score)}<small>/${dg(100)}</small></span></div>
      <div><h3 style="margin:0 0 4px">${T("Career readiness indicator", "ক্যারিয়ার প্রস্তুতির সূচক")}</h3><p class="small" style="margin:0 0 8px"><strong>${esc(P(R.band.label))}</strong></p>
      <p class="tiny muted" style="margin:0">${T("An assessment-based development indicator from your answers — not the probability of getting a job.", "আপনার উত্তরের ভিত্তিতে মূল্যায়নভিত্তিক উন্নয়ন সূচক — চাকরি পাওয়ার সম্ভাবনা নয়।")}</p></div></div>
    <div class="meter-list" style="margin-top:14px">${bar(T(`Skills match (${w.skills}%)`, `দক্ষতার মিল (${dg(w.skills)}%)`), R.skills)}${bar(T(`Experience (${w.experience}%)`, `অভিজ্ঞতা (${dg(w.experience)}%)`), R.experience)}${bar(T(`Core qualifications (${w.certs}%)`, `মূল যোগ্যতা (${dg(w.certs)}%)`), R.certs)}</div>
  </div>
  <div class="panel cr-card"><h3>${T("Target position requirements", "লক্ষ্য পদের শর্ত")}</h3>
    <p class="small">${T("Indicative experience", "আনুমানিক অভিজ্ঞতা")}: <strong>${dg(r.target.expMin)}–${dg(r.target.expMax)} ${T("years", "বছর")}</strong> · ${esc(bn ? lvl(r.target.level).title_bn || lvl(r.target.level).title_en || "" : lvl(r.target.level).title_en || "")}</p>
    ${r.coreCerts.length ? `<p class="small">${T("Often requested", "প্রায়ই চাওয়া হয়")}: ${r.coreCerts.map((x) => `${esc(P(x.name))} ${x.held ? "✓" : ""}`).join(", ")}</p>` : ""}
    <a class="link small" href="${root}/career/job-roles/${r.target.slug}">${T("Full role profile", "পূর্ণ পদের প্রোফাইল")} →</a></div>
  <div class="panel cr-card"><h3>${T("Skills gap analysis", "দক্ষতার ঘাটতি বিশ্লেষণ")}</h3>
    ${r.gaps.length ? `<div class="gap-list">${r.gaps.map((g) => `<div class="gap-row"><span>${esc(P(g.name))}</span><span class="gap-dots" aria-label="${g.have}/${g.need}">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= g.have ? "have" : n <= g.need ? "need" : ""}"></i>`).join("")}</span><b>−${dg(g.gap)}</b></div>`).join("")}</div>
      <p class="tiny muted">${T("Filled = your rating, outlined = level expected for the target role.", "ভরা = আপনার রেটিং, রেখা = লক্ষ্য পদের প্রত্যাশিত স্তর।")}</p>` : `<p class="muted">${T("No skill gaps for this role based on your ratings.", "আপনার রেটিং অনুযায়ী এই পদের জন্য দক্ষতার ঘাটতি নেই।")}</p>`}
    ${r.strengths.length ? `<p class="small" style="margin-top:12px"><strong>${T("Strengths", "শক্তির দিক")}:</strong> ${r.strengths.slice(0, 5).map((s) => esc(P(s.name))).join(", ")}</p>` : ""}</div>
  <div class="panel cr-card"><h3>${T("Experience gap", "অভিজ্ঞতার ঘাটতি")}</h3><p style="margin:0">${r.expGap > 0 ? T(`About ${r.expGap} more years of procurement experience is typical for this role (indicative).`, `এই পদের জন্য সাধারণত আরও প্রায় ${dg(r.expGap)} বছরের প্রকিউরমেন্ট অভিজ্ঞতা লাগে (আনুমানিক)।`) : T("Your experience meets the indicative range for this role.", "আপনার অভিজ্ঞতা এই পদের আনুমানিক সীমার মধ্যে।")}</p></div>
  <div class="panel cr-card"><h3>${T("Recommended career paths", "প্রস্তাবিত ক্যারিয়ার পথ")}</h3>
    ${r.moves.length ? `<ul class="cr-list">${r.moves.slice(0, 5).map((m) => `<li><a href="${root}/career/job-roles/${m.slug}">${esc(P(m.title))}</a> <span class="tag ${m.kind === "next" ? "dark" : ""}">${m.kind === "next" ? T("Usual next step", "সাধারণ পরের ধাপ") : T("Alternative", "বিকল্প")}</span>${m.onPath ? ` <span class="tag ok">${T("On your route", "আপনার পথে")}</span>` : ""}
      <div class="tiny muted">${T(`Skills fit ${m.fit}%`, `দক্ষতার মিল ${dg(m.fit)}%`)}${m.topGap ? T(` · biggest gap: ${m.topGap.en}`, ` · সবচেয়ে বড় ঘাটতি: ${m.topGap.bn}`) : ""}</div></li>`).join("")}</ul>` : `<p class="muted">${T("You are at the top of the ladder — focus on scope and impact.", "আপনি সিঁড়ির শীর্ষে — দায়িত্বের পরিধি ও প্রভাবে মনোযোগ দিন।")}</p>`}</div>
  <div class="panel cr-card"><h3>${T("Personalised career roadmap", "ব্যক্তিগত ক্যারিয়ার রোডম্যাপ")}</h3>
    ${r.roadmap.length ? `<ol class="route">${r.roadmap.map((s) => `<li class="${s.now ? "now" : ""}"><strong>${esc(P(s.title))}</strong><span class="tiny muted">${esc(P(s.level))} · ${dg(s.expMin)}–${dg(s.expMax)} ${T("yrs", "বছর")}${s.now ? T(" · you are here", " · আপনি এখানে") : ""}</span></li>`).join("")}</ol>`
      : `<p class="muted">${T("The target is not a usual step forward from your current role. Try a role at a higher level, or explore alternatives on the roadmap.", "লক্ষ্যটি আপনার বর্তমান পদ থেকে সাধারণ সামনের ধাপ নয়। উচ্চতর স্তরের পদ বাছুন, অথবা রোডম্যাপে বিকল্প দেখুন।")} <a href="${root}/career/roadmap">${T("Roadmap", "রোডম্যাপ")}</a></p>`}</div>
  <div class="panel cr-card"><h3>${T("Certification recommendations", "সার্টিফিকেশন সুপারিশ")}</h3>
    ${r.certRecs.length ? `<ul class="cr-list">${r.certRecs.map((x) => `<li><a href="${root}/career/certifications/${x.slug}">${esc(P(x.name))}</a><div class="tiny muted">${T("Why", "কেন")}: ${esc(reason(x))}</div></li>`).join("")}</ul>` : `<p class="muted">${T("No further qualification is linked to this role.", "এই পদের সঙ্গে আর কোনো যোগ্যতা যুক্ত নেই।")}</p>`}
    <p class="tiny muted">${T("No qualification guarantees a promotion or salary increase.", "কোনো যোগ্যতাই পদোন্নতি বা বেতন বৃদ্ধির নিশ্চয়তা দেয় না।")}</p></div>
  <div class="panel cr-card"><h3>${T("Recommended learning resources", "প্রস্তাবিত শেখার রিসোর্স")}</h3>
    ${r.learning.map((l) => `<p class="small" style="margin:10px 0 4px"><strong>${esc(P(l.skill))}</strong></p><ul class="cr-list">${(bn ? l.items.bn : l.items.en).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`).join("")}
    ${r.rules.length ? `<ul class="rule-list">${r.rules.map((x) => `<li>${esc(P(x.text))}${x.link ? ` <a href="${root}${x.link.url}">${esc(P(x.link.label) || "→")}</a>` : ""}<div class="tiny muted">${esc(why(x.why))}</div></li>`).join("")}</ul>` : ""}</div>
  <div class="panel cr-card"><div class="row between"><h3 style="margin:0">${T("90-day development action plan", "৯০ দিনের উন্নয়ন অ্যাকশন প্ল্যান")}</h3><button class="btn btn-ghost btn-sm" type="button" onclick="window.print()">${T("Print", "প্রিন্ট")}</button></div>
    <div class="plan">${r.plan.map((p) => `<div class="plan-col"><span class="tag dark">${T("Days", "দিন")} ${dg(p.days)}</span><ul class="cr-list">${p.items.map((x) => `<li>${esc(P(x))}</li>`).join("")}</ul></div>`).join("")}</div></div>`;
}

// ---------------------------------------------------------------- skills assessment
const af = $("[data-assess-form]");
if (af && D.skills) {
  const result = $("[data-assess-result]");
  const saved = store.get("pb_skills_assessment");
  if (saved) for (const [k, v] of Object.entries(saved)) { const el = $(`[name="${k}"][value="${v}"]`, af) || (k === "target" ? $(`[name="target"]`, af) : null); if (el) { if (el.type === "radio") el.checked = true; else el.value = v; } }
  af.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(af);
    const raw = Object.fromEntries(fd.entries());
    store.set("pb_skills_assessment", raw);
    const answers = {};
    for (const [k, v] of Object.entries(raw)) if (k.includes("__")) (answers[k.split("__")[0]] = answers[k.split("__")[0]] || []).push(v);
    const req = raw.target ? requiredSkills(D, raw.target) : {};
    const a = assess(D.skills, answers, req);
    if (!a.rows.length) { result.innerHTML = `<div class="alert alert-warn">${T("Rate at least one statement.", "অন্তত একটি বাক্যে রেটিং দিন।")}</div>`; return; }
    const sk = Object.fromEntries(D.skills.map((s) => [s.slug, s]));
    const learn = (slug) => (bn ? sk[slug].learn_bn || sk[slug].learn_en : sk[slug].learn_en).split("\n").filter(Boolean);
    const role = D.roles.find((r) => r.slug === raw.target);
    result.innerHTML = `<div class="panel cr-card"><span class="eyebrow">${T("Overall competency", "সামগ্রিক সক্ষমতা")}</span>
      <div class="readiness"><div class="ring" style="--v:${a.overall}"><span>${dg(a.overall)}<small>%</small></span></div><p class="small muted" style="margin:0">${T("Average of your self-ratings. Use it to track progress over time.", "আপনার স্ব-রেটিংয়ের গড়। সময়ের সঙ্গে অগ্রগতি দেখতে ব্যবহার করুন।")}</p></div>
      <div class="meter-list" style="margin-top:14px">${a.rows.map((r) => bar(P(r.name), Math.round(r.score * 20))).join("")}</div></div>
      <div class="panel cr-card"><h3>${T("Strong skills", "শক্তিশালী দক্ষতা")}</h3>${a.strong.length ? `<div class="chips">${a.strong.map((r) => `<span class="chip on">${esc(P(r.name))} · ${dg(r.score)}</span>`).join("")}</div>` : `<p class="muted">${T("No skill rated 4 or above yet.", "এখনো কোনো দক্ষতা ৪ বা তার বেশি নয়।")}</p>`}</div>
      <div class="panel cr-card"><h3>${T("Improvement areas & skill gap", "উন্নয়নের ক্ষেত্র ও দক্ষতার ঘাটতি")}${role ? ` <span class="tag">${esc(bn ? role.title_bn || role.title_en : role.title_en)}</span>` : ""}</h3>
        ${a.improve.length ? a.improve.slice(0, 5).map((r) => `<div class="improve"><div class="row between"><strong>${esc(P(r.name))}</strong><span class="small">${dg(r.score)}/${dg(5)}${r.need ? T(` · target ${r.need}`, ` · লক্ষ্য ${dg(r.need)}`) : ""}</span></div>
          <p class="tiny muted" style="margin:6px 0 4px">${T("Recommended training", "প্রস্তাবিত প্রশিক্ষণ")}</p><ul class="cr-list">${learn(r.slug).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          ${(D.articles[r.slug] || []).length ? `<p class="tiny muted" style="margin:6px 0 4px">${T("Recommended articles", "প্রস্তাবিত আর্টিকেল")}</p><ul class="cr-list">${D.articles[r.slug].map((p) => `<li><a href="${p.url}">${esc(p.title)}</a></li>`).join("")}</ul>` : ""}</div>`).join("")
        : `<p class="muted">${T("No major gaps. Keep building evidence of results.", "বড় কোনো ঘাটতি নেই। ফলাফলের প্রমাণ জমাতে থাকুন।")}</p>`}</div>
      <div class="panel cr-card"><h3>${T("Relevant career tools", "প্রাসঙ্গিক ক্যারিয়ার টুল")}</h3><div class="chips">${D.tools.slice(0, 6).map((t) => `<a class="chip" href="${t.url}">${esc(t.name)}</a>`).join("")}</div>
        <p class="small" style="margin-top:12px"><a class="link" href="${D.root}/career/career-analysis${raw.target ? "?target=" + raw.target : ""}">${T("Get a full career analysis and 90-day plan →", "পূর্ণ ক্যারিয়ার বিশ্লেষণ ও ৯০ দিনের পরিকল্পনা নিন →")}</a></p></div>`;
    result.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
}

// ---------------------------------------------------------------- checklists (progress kept in this browser)
$$("[data-checklist]").forEach((box) => {
  const key = "pb_check_" + box.dataset.checklist;
  const boxes = $$("input[type=checkbox]", box);
  const state = store.get(key) || [];
  boxes.forEach((b) => { b.checked = state.includes(Number(b.dataset.i)); });
  const update = () => {
    const on = boxes.filter((b) => b.checked);
    store.set(key, on.map((b) => Number(b.dataset.i)));
    $("[data-check-count]", box).textContent = T(`${on.length} of ${boxes.length} done`, `${dg(boxes.length)}টির মধ্যে ${dg(on.length)}টি সম্পন্ন`);
    $("[data-check-bar]", box).style.width = (boxes.length ? on.length / boxes.length * 100 : 0) + "%";
  };
  boxes.forEach((b) => b.addEventListener("change", update));
  $("[data-check-reset]", box).addEventListener("click", () => { boxes.forEach((b) => { b.checked = false; }); update(); });
  update();
});
$$("[data-print]").forEach((b) => b.addEventListener("click", () => window.print()));

// ---------------------------------------------------------------- certification comparison
const cmp = $("[data-compare]");
if (cmp && D.certs) {
  const selects = $$("[data-cmp]", cmp);
  const table = $("[data-cmp-table]", cmp);
  const fromHash = location.hash.slice(1);
  const pre = D.pre.length ? D.pre : D.certs.some((x) => x.slug === fromHash) ? [fromHash, D.certs.find((x) => x.slug !== fromHash).slug] : D.certs.slice(0, 2).map((x) => x.slug);
  selects.forEach((s, i) => { s.innerHTML = `<option value="">${esc(D.t.pick)}</option>` + D.certs.map((x) => `<option value="${x.slug}">${esc(x.name)}</option>`).join(""); s.value = pre[i] || ""; });
  const draw = () => {
    const chosen = selects.map((s) => D.certs.find((x) => x.slug === s.value)).filter(Boolean);
    const rows = ["kind", "issuer", "eligibility", "levels", "duration", "cost", "stages", "relevance"];
    table.innerHTML = chosen.length ? `<thead><tr><th></th>${chosen.map((x) => `<th><a href="${x.url || "#"}" ${x.url ? 'target="_blank" rel="noopener nofollow"' : ""}>${esc(x.name)}</a></th>`).join("")}</tr></thead>
      <tbody>${rows.map((k) => `<tr><th scope="row">${esc(D.t[k])}</th>${chosen.map((x) => `<td class="small">${esc(x[k] || "—")}</td>`).join("")}</tr>`).join("")}</tbody>` : "";
  };
  selects.forEach((s) => s.addEventListener("change", draw));
  draw();
}

// ---------------------------------------------------------------- filters without reloading (interview questions, salary table)
$$("[data-live-filter]").forEach((form) => {
  const scope = form.parentElement;
  const items = $$("[data-f-level], [data-f-role]", scope).filter((el) => !form.contains(el));
  const run = () => {
    const want = Object.fromEntries($$("[data-filter]", form).map((s) => [s.dataset.filter, s.value]));
    let n = 0;
    items.forEach((el) => {
      const ok = Object.entries(want).every(([k, v]) => !v || el.dataset["f" + k[0].toUpperCase() + k.slice(1)] === v || el.dataset["f" + k[0].toUpperCase() + k.slice(1)] === "*");
      el.hidden = !ok; if (ok) n++;
    });
    const cnt = $("[data-filter-count]", scope);
    if (cnt) cnt.textContent = T(`${n} of ${cnt.dataset.total} questions`, `${dg(cnt.dataset.total)}টির মধ্যে ${dg(n)}টি প্রশ্ন`);
    const empty = $("[data-filter-empty]", scope);
    if (empty) empty.hidden = n > 0;
  };
  form.addEventListener("change", run);
  form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
});

// ---------------------------------------------------------------- interview practice (multiple choice)
$$("[data-iq][data-correct]").forEach((q) => {
  const right = Number(q.dataset.correct);
  $$("[data-opt]", q).forEach((b) => b.addEventListener("click", () => {
    $$("[data-opt]", q).forEach((x) => { x.disabled = true; x.classList.toggle("right", Number(x.dataset.opt) === right); });
    if (Number(b.dataset.opt) !== right) b.classList.add("wrong");
    $("details", q).open = true;
  }));
});
