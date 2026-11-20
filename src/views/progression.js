// Career progression strip: one compact card that cycles through the stages. It is shown on the
// Career Home (section order in Hub settings) and, optionally, on the main home page ("progress_home").
// Stages are edited in Admin → Career Management → Progression stages. The first stage is rendered on
// the server, so the page reads correctly without JavaScript.
import { html, jsonScript } from "../lib/util.js";
import { icon } from "./icons.js";
import { careerOff } from "../lib/career.js";

const pk = (c, o, f) => c.pick(o[f + "_en"], o[f + "_bn"]);
export const stagesQuery = "SELECT slug, title_en, title_bn, years_en, years_bn, desc_en, desc_bn FROM career_stages WHERE status='published' ORDER BY sort, id";

export function progressionStrip(c, stages, s) {
  if (stages.length < 2) return "";
  const items = stages.map((x, i) => ({
    title: pk(c, x, "title"), years: pk(c, x, "years"), desc: pk(c, x, "desc"),
    next: i < stages.length - 1 ? pk(c, stages[i + 1], "title") : c.L("Your next chapter", "আপনার পরের অধ্যায়"),
  }));
  const first = items[0];
  return html`<section class="section-sm pj-section" aria-label="${c.L("Career progression", "ক্যারিয়ার অগ্রগতি")}"><div class="wrap"><div class="pj-card" data-pj>
    <div class="pj-head"><h2>${c.L("See your path. Make your next jump.", "আপনার পথ দেখুন। পরের ধাপে যান।")}</h2>
      ${careerOff(s).has("career-analysis") ? "" : html`<a class="link" href="${c.p("/career/career-analysis")}">${c.L("Analyze my career", "আমার ক্যারিয়ার বিশ্লেষণ করুন")} ${icon("arrow-right", 16)}</a>`}</div>
    <div class="pj-scroll"><div class="pj-track" style="--n:${items.length}">
      <div class="pj-line" aria-hidden="true"><i class="pj-fill" data-pj-fill></i></div>
      ${items.map((x, i) => html`<button type="button" class="pj-step${i === 0 ? " is-active" : ""}" data-pj-step="${i}">
        <span class="pj-node">${c.d(i + 1)}</span><span class="pj-name">${x.title}</span></button>`)}
    </div></div>
    <div class="pj-focus">
      <div><h3 data-pj-role>${first.title} <span class="pj-years" data-pj-years>${first.years}</span></h3><p class="pj-desc" data-pj-desc>${first.desc}</p></div>
      <p class="pj-next">${c.L("Next:", "পরের ধাপ:")} <b data-pj-next>${first.next}</b></p></div>
    <script type="application/json" id="pj-data">${jsonScript({ stages: items })}</script>
  </div></div></section>`;
}

