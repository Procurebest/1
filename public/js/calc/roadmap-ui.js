// Career Roadmap page: reads the form, runs computeRoadmap and draws the result.
import { computeRoadmap, mergeRoadmap } from "./roadmap.js";

const root = document.querySelector("[data-roadmap]");
if (root) {
  const lang = document.documentElement.lang === "bn" ? "bn" : "en";
  const T = (en, bn) => (lang === "bn" ? bn : en);
  const nm = (o) => (lang === "bn" ? o.bn || o.en : o.en);
  const digits = (s) => (lang === "bn" ? String(s).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]) : String(s));
  const money = (v) => "৳" + digits(new Intl.NumberFormat("en-IN").format(v));
  const yrs = (v) => digits(v.toFixed(1).replace(/\.0$/, "")) + T(v === 1 ? " year" : " years", " বছর");
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const data = mergeRoadmap(JSON.parse(document.getElementById("roadmap-data").textContent || "{}"));
  const form = root.querySelector("form");
  const out = root.querySelector("[data-roadmap-result]");
  const KEY = "pb-roadmap";

  function read() {
    const fd = new FormData(form);
    return {
      current: fd.get("current"), target: fd.get("target"), years_in_role: fd.get("years_in_role"), total_years: fd.get("total_years"),
      previous: fd.get("previous"), education: fd.get("education"), industry: fd.get("industry"), performance: fd.get("performance"),
      have: fd.getAll("have"), plan: fd.getAll("plan"),
    };
  }
  function restore() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { saved = null; }
    if (!saved) return;
    for (const [k, v] of Object.entries(saved)) {
      if (Array.isArray(v)) form.querySelectorAll(`[name="${k}"]`).forEach((el) => { el.checked = v.includes(el.value); });
      else { const el = form.querySelector(`[name="${k}"]`); if (el && v !== null && v !== undefined) el.value = v; }
    }
  }

  function bars(r) {
    const max = Math.max(r.base.years, r.withPlan.years, 0.1);
    const row = (label, v, dark) => `<div class="bar-row"><span class="lbl">${esc(label)}</span><div class="bar"><i style="width:${Math.max(3, (v / max) * 100)}%;${dark ? "" : "background:#a1a1a6"}"></i></div></div>
      <div class="tiny muted" style="margin:-4px 0 6px;text-align:right">${yrs(v)}</div>`;
    return `<div class="bar-chart">${row(T("Without new qualifications", "নতুন যোগ্যতা ছাড়া"), r.base.years, false)}${row(T("With your plan", "আপনার পরিকল্পনাসহ"), r.withPlan.years, true)}</div>`;
  }

  function render() {
    const input = read();
    try { localStorage.setItem(KEY, JSON.stringify(input)); } catch (e) { /* ignore */ }
    const r = computeRoadmap(data, input);
    if (r.errors.includes("target")) {
      out.innerHTML = `<div class="alert alert-warn">${T("Choose a target role above your current role.", "বর্তমান পদের চেয়ে উঁচু একটি লক্ষ্য পদ বেছে নিন।")}</div>`;
      return;
    }
    const L = data.levels;
    const hasPlan = r.plan.length > 0;
    const best = hasPlan ? r.withPlan : r.base;
    const gain = Math.round((r.base.years - r.withPlan.years) * 10) / 10;
    const steps = best.steps.map((s) => `<li><div class="rm-dot"></div><div><strong>${esc(nm(L[s.to]))}</strong>
      <div class="small muted">${T("in about", "প্রায়")} ${yrs(s.cumulative)} · ${T("around", "আনুমানিক")} ${digits(s.year)}</div>
      <div class="small">${money(s.salary.min)} – ${money(s.salary.max)} ${T("per month", "প্রতি মাসে")}</div></div></li>`).join("");
    const rec = r.options.filter((o) => o.saved > 0 || o.extra > 0).slice(0, 3).map((o, i) => `<li><span>${i === 0 ? "★ " : ""}<strong>${esc(nm(o))}</strong> — ${T("saves about", "প্রায়")} ${yrs(Math.max(0, o.saved))}${T("", " সময় বাঁচায়")}${o.extra > 0 ? `, ${T("adds up to", "বেতন বাড়াতে পারে প্রায়")} ${money(o.extra)}${T(" per month at the target role", " (লক্ষ্য পদে, প্রতি মাসে)")}` : ""} · <span class="muted">${T("takes", "সময় লাগে")} ~${digits(o.months)} ${T("months", "মাস")}</span></span></li>`).join("");
    const skills = r.skills.map((s, i) => `<div class="card surface"><h3 style="font-size:16px">${esc(nm(L[r.cur + 1 + i]))}</h3><ul class="method-list" style="margin:8px 0 0">${(lang === "bn" ? s.bn : s.en).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("");
    out.innerHTML = `
      <div class="result-card">
        <div class="label">${T("Estimated time to reach", "যেখানে পৌঁছাতে আনুমানিক সময়")} ${esc(nm(L[r.target]))}</div>
        <div class="big">${yrs(best.years)}</div>
        <div class="note">${hasPlan && gain > 0 ? T(`${gain} years faster than without your plan (${r.base.years} years).`, `পরিকল্পনা ছাড়া লাগত ${digits(r.base.years)} বছর — ${digits(gain)} বছর কম।`) : T("Based on typical promotion timelines in Bangladesh.", "বাংলাদেশে সাধারণ পদোন্নতির সময়ের ভিত্তিতে।")}</div>
        <div class="kpis">
          <div><div class="label">${T("Salary now (typical)", "এখনকার বেতন (সাধারণত)")}</div><div class="val">${money(best.salaryNow.min)} – ${money(best.salaryNow.max)}</div></div>
          <div><div class="label">${T("At the target role", "লক্ষ্য পদে")}</div><div class="val">${money(best.salaryTarget.min)} – ${money(best.salaryTarget.max)}</div></div>
        </div>
      </div>
      ${r.ready ? `<div class="alert alert-ok" style="margin-top:16px">${T("Your experience is already at the level where people are usually promoted. Prepare your case: savings achieved, projects led and the next-level skills below.", "আপনার অভিজ্ঞতা ইতিমধ্যে সাধারণ পদোন্নতির পর্যায়ে। প্রস্তুতি নিন: অর্জিত সাশ্রয়, পরিচালিত প্রকল্প ও নিচের পরবর্তী স্তরের দক্ষতা।")}</div>` : ""}
      <div class="panel" style="margin-top:16px"><h3>${T("Your roadmap", "আপনার রোডম্যাপ")}</h3>
        <ol class="rm-steps"><li><div class="rm-dot on"></div><div><strong>${esc(nm(L[r.cur]))}</strong><div class="small muted">${T("you are here", "আপনি এখানে")}</div></div></li>${steps}</ol>
        ${bars(r)}</div>
      ${rec ? `<div class="panel" style="margin-top:16px"><h3>${T("Qualifications with the biggest impact for you", "আপনার জন্য সবচেয়ে কার্যকর যোগ্যতা")}</h3><ul class="feature-list" style="margin-top:10px">${rec}</ul>
        <p class="tiny muted" style="margin-top:12px">${T("Impact depends on your sector:", "প্রভাব খাতভেদে আলাদা:")} ${esc(nm(r.industry))}.</p></div>` : ""}
      ${skills ? `<h3 style="margin-top:26px">${T("Skills to build for each step", "প্রতিটি ধাপের জন্য যে দক্ষতা গড়বেন")}</h3><div class="grid grid-2" style="margin-top:12px">${skills}</div>` : ""}
      <p class="tiny muted" style="margin-top:16px">${T("Indicative estimates, not a guarantee. Real promotions depend on your employer, performance and openings. Salary figures are gross monthly amounts.", "এগুলো আনুমানিক হিসাব, নিশ্চয়তা নয়। প্রকৃত পদোন্নতি প্রতিষ্ঠান, পারফরম্যান্স ও শূন্যপদের ওপর নির্ভর করে। বেতন মাসিক মোট (গ্রস) হিসাবে দেখানো।")}</p>
      <div class="row no-print" style="margin-top:14px"><button type="button" class="btn btn-ghost btn-sm" data-print>${T("Print / save as PDF", "প্রিন্ট / পিডিএফ সেভ")}</button></div>`;
  }

  // "Plan" boxes for credentials already held are disabled.
  function syncPlan() {
    const have = new Set(new FormData(form).getAll("have"));
    form.querySelectorAll('[name="plan"]').forEach((el) => { el.disabled = have.has(el.value); if (el.disabled) el.checked = false; });
  }
  restore();
  syncPlan();
  form.addEventListener("input", () => { syncPlan(); render(); });
  form.addEventListener("change", () => { syncPlan(); render(); });
  form.addEventListener("submit", (e) => { e.preventDefault(); render(); out.scrollIntoView({ behavior: "smooth", block: "start" }); });
  render();
}
