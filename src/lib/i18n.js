// Translation lookup. Keys come from the original ProcureBest dictionary
// (strings_base.js) plus the keys added for the Cloudflare edition (strings_extra.js).
import BASE from "./strings_base.js";
import EXTRA from "./strings_extra.js";
import { digits, formatNumber, formatMoney, formatPercent, formatDate } from "../../public/js/fmt.js";

export const LANGS = ["en", "bn"];
const DICT = { ...BASE, ...EXTRA };

export function translate(lang, key, vars) {
  const pair = DICT[key];
  let text = pair ? (lang === "bn" ? pair[1] || pair[0] : pair[0]) : key;
  if (vars) text = text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return text;
}

// Build the per-request i18n helpers used by every view.
export function i18n(lang) {
  lang = lang === "bn" ? "bn" : "en";
  return {
    lang,
    t: (key, vars) => translate(lang, key, vars),
    // Inline pair for text that lives next to its template.
    L: (en, bn) => (lang === "bn" ? bn || en : en),
    pick: (en, bn) => (lang === "bn" ? bn || en || "" : en || bn || ""),
    d: (v) => digits(v, lang),
    num: (v, dec = 0) => formatNumber(v, lang, dec),
    money: (v, cur = "BDT", dec = 0) => formatMoney(v, cur, lang, dec),
    pct: (v, dec = 0) => formatPercent(v, lang, dec),
    date: (v, withTime = false) => formatDate(v, lang, withTime),
    other: lang === "bn" ? "en" : "bn",
  };
}

export { DICT };
