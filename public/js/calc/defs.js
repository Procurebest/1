// Calculator definitions: inputs (bilingual labels), validation rules, formulas.
// Pure JavaScript with no DOM access — imported by the browser (to calculate) and by
// the Worker (to render page text for search engines). A formula is written once.

export const L = (en, bn) => ({ en, bn });
export const tr = (label, lang) => (label && typeof label === "object" ? (lang === "bn" ? label.bn || label.en : label.en) : String(label ?? ""));

export class CalcError extends Error {
  constructor(path, message) { super(message.en); this.path = path; this.msg = message; }
}

export const metric = (label, value, fmt = "number", currency = null, decimals = 2, highlight = false, note = null) =>
  ({ label, value, fmt, currency, decimals, highlight, note });
export const col = (label, fmt = "text", currency = null, decimals = 2) => ({ label, fmt, currency, decimals });
export const table = (title, columns, rows, opts = {}) => ({ title, columns, rows, highlightRow: opts.highlightRow ?? null, totalRow: !!opts.totalRow, collapsed: !!opts.collapsed });
export const result = (headline, { details = [], tables = [], notes = [], warnings = [], chart = null, charts = [] } = {}) =>
  ({ headline, details, tables, notes, warnings, chart, charts });
const safeDiv = (a, b, d = null) => (b ? a / b : d);

const CURRENCIES = [
  ["BDT", L("BDT — Bangladeshi taka", "BDT — বাংলাদেশি টাকা")],
  ["USD", L("USD — US dollar", "USD — মার্কিন ডলার")],
  ["CNY", L("CNY — Chinese yuan", "CNY — চীনা ইউয়ান")],
  ["EUR", L("EUR — Euro", "EUR — ইউরো")],
  ["INR", L("INR — Indian rupee", "INR — ভারতীয় রুপি")],
];

// =================================================================== 1. TCO
// The industry / product category sets the output unit (km, hour, page…) and the tips in the form.
// The formula is the same for every category:
//   TCO = Acquisition + Operating + Maintenance + Other costs + Disposal − Resale/Salvage value
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bnNum = (n) => String(n).replace(/\d/g, (d) => BN_DIGITS[d]);
const toNum = (x) => {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const n = Number(String(x).replace(/[০-৯]/g, (d) => BN_DIGITS.indexOf(d)).replace(/[,\s]/g, "").replace(/^−/, "-"));
  return Number.isFinite(n) ? n : null;
};
// Joins plain strings and {en, bn} labels into one bilingual label.
const Lc = (...p) => L(p.map((x) => (typeof x === "string" ? x : x.en)).join(""), p.map((x) => (typeof x === "string" ? x : x.bn || x.en)).join(""));
const HOURS = { unit: L("operating hour", "পরিচালন ঘণ্টা"), per: L("Cost per operating hour", "প্রতি পরিচালন ঘণ্টায় খরচ"),
  output: L("Total operating hours over the analysis period", "বিশ্লেষণকালে মোট পরিচালন ঘণ্টা") };

export const TCO_CATEGORIES = [
  { key: "vehicle", label: L("Vehicle", "যানবাহন"), unit: L("km", "কিমি"), per: L("Cost per km", "প্রতি কিমি খরচ"),
    output: L("Total kilometres over the analysis period", "বিশ্লেষণকালে মোট কিলোমিটার"),
    outHelp: L("e.g. 20,000 km a year × 5 years = 100,000", "যেমন বছরে ২০,০০০ কিমি × ৫ বছর = ১,০০,০০০"),
    opHelp: L("Fuel or electricity, driver and tolls", "জ্বালানি বা বিদ্যুৎ, ড্রাইভার ও টোল"),
    guide: L("Operating: fuel or electricity, driver and tolls. Maintenance: servicing, tyres and battery. Other costs: insurance, tax token, fitness and route permit. Output: total km the vehicle will run in the analysis period.",
      "Operating: জ্বালানি বা বিদ্যুৎ, ড্রাইভার ও টোল। Maintenance: সার্ভিসিং, টায়ার ও ব্যাটারি। Other costs: ইন্স্যুরেন্স, ট্যাক্স টোকেন, ফিটনেস ও রুট পারমিট। Output: বিশ্লেষণকালে গাড়িটি মোট যত কিমি চলবে।") },
  { key: "generator", label: L("Generator", "জেনারেটর"), ...HOURS,
    outHelp: L("e.g. 2,000 hours a year × 5 years = 10,000", "যেমন বছরে ২,০০০ ঘণ্টা × ৫ বছর = ১০,০০০"),
    opHelp: L("Fuel (litres per hour × hours × price per litre), lube oil and operator", "জ্বালানি (প্রতি ঘণ্টায় লিটার × ঘণ্টা × প্রতি লিটারের দাম), লুব অয়েল ও অপারেটর"),
    guide: L("Operating: fuel (litres per hour × hours a year × price per litre), lube oil and operator. Maintenance: filters, servicing and overhaul. Output: total running hours in the analysis period.",
      "Operating: জ্বালানি (প্রতি ঘণ্টায় লিটার × বছরে ঘণ্টা × প্রতি লিটারের দাম), লুব অয়েল ও অপারেটর। Maintenance: ফিল্টার, সার্ভিসিং ও ওভারহলিং। Output: বিশ্লেষণকালে মোট চালানোর ঘণ্টা।") },
  { key: "machine", label: L("Manufacturing machine", "উৎপাদন মেশিন"), unit: L("production unit", "উৎপাদিত ইউনিট"), per: L("Cost per production unit", "প্রতি উৎপাদিত ইউনিটে খরচ"),
    output: L("Total production units over the analysis period", "বিশ্লেষণকালে মোট উৎপাদিত ইউনিট"),
    outHelp: L("Count good (saleable) units only", "শুধু ভালো (বিক্রয়যোগ্য) ইউনিট গুনুন"),
    opHelp: L("Power, consumables and operator wages", "বিদ্যুৎ, কনজিউমেবলস ও অপারেটরের বেতন"),
    guide: L("Operating: power, consumables and operator wages. Maintenance: spare parts, servicing and tooling. Downtime: production lost when the machine stops. Output: good units produced in the analysis period.",
      "Operating: বিদ্যুৎ, কনজিউমেবলস ও অপারেটরের বেতন। Maintenance: স্পেয়ার পার্টস, সার্ভিসিং ও টুলিং। Downtime: মেশিন বন্ধ থাকায় হারানো উৎপাদন। Output: বিশ্লেষণকালে মোট ভালো ইউনিট।") },
  { key: "printer", label: L("Printer", "প্রিন্টার"), unit: L("printed page", "প্রিন্ট পৃষ্ঠা"), per: L("Cost per printed page", "প্রতি প্রিন্ট পৃষ্ঠায় খরচ"),
    output: L("Total printed pages over the analysis period", "বিশ্লেষণকালে মোট প্রিন্ট পৃষ্ঠা"),
    outHelp: L("e.g. 3,000 pages a month × 12 × 3 years = 108,000", "যেমন মাসে ৩,০০০ পৃষ্ঠা × ১২ × ৩ বছর = ১,০৮,০০০"),
    opHelp: L("Toner or ink, paper and electricity", "টোনার বা কালি, কাগজ ও বিদ্যুৎ"),
    guide: L("Operating: toner or ink, paper and electricity. Maintenance: drum, fuser and service visits. Output: total pages printed in the analysis period.",
      "Operating: টোনার বা কালি, কাগজ ও বিদ্যুৎ। Maintenance: ড্রাম, ফিউজার ও সার্ভিস ভিজিট। Output: বিশ্লেষণকালে মোট প্রিন্ট পৃষ্ঠা।") },
  { key: "ac", label: L("Air conditioner", "এয়ার কন্ডিশনার"), ...HOURS,
    outHelp: L("e.g. 8 hours a day × 300 days × 5 years = 12,000", "যেমন দিনে ৮ ঘণ্টা × ৩০০ দিন × ৫ বছর = ১২,০০০"),
    opHelp: L("Electricity: kW × hours × tariff per kWh", "বিদ্যুৎ: kW × ঘণ্টা × প্রতি ইউনিটের দাম"),
    guide: L("Operating: electricity (kW × hours a year × tariff per kWh). Maintenance: cleaning, gas refill and repairs. Output: total running hours in the analysis period.",
      "Operating: বিদ্যুৎ (kW × বছরে ঘণ্টা × প্রতি ইউনিটের দাম)। Maintenance: ক্লিনিং, গ্যাস রিফিল ও মেরামত। Output: বিশ্লেষণকালে মোট চালানোর ঘণ্টা।") },
  { key: "equipment", label: L("Industrial equipment", "শিল্প যন্ত্রপাতি"), ...HOURS,
    outHelp: L("Hours a year × number of years", "বছরে ঘণ্টা × বছরের সংখ্যা"),
    opHelp: L("Energy, consumables and operator", "জ্বালানি বা বিদ্যুৎ, কনজিউমেবলস ও অপারেটর"),
    guide: L("Operating: energy, consumables and operator. Maintenance: spares, servicing and inspections. Output: total running hours in the analysis period.",
      "Operating: জ্বালানি বা বিদ্যুৎ, কনজিউমেবলস ও অপারেটর। Maintenance: স্পেয়ার পার্টস, সার্ভিসিং ও ইন্সপেকশন। Output: বিশ্লেষণকালে মোট চালানোর ঘণ্টা।") },
  { key: "other", label: L("Other product TCO", "অন্যান্য পণ্যের TCO"), unit: L("unit", "ইউনিট"), per: L("Cost per unit", "প্রতি ইউনিটে খরচ"),
    output: L("Total output units over the analysis period", "বিশ্লেষণকালে মোট আউটপুট ইউনিট"),
    outHelp: L("Optional — leave empty to compare total cost only", "ঐচ্ছিক — শুধু মোট খরচ তুলনা করতে ফাঁকা রাখুন"),
    opHelp: L("Energy, consumables, labour and other running costs", "জ্বালানি বা বিদ্যুৎ, কনজিউমেবলস, শ্রম ও অন্যান্য চলতি খরচ"),
    guide: L("Use this for any other product. Type your own output unit (piece, tonne, trip, user…) or leave the output empty to compare total cost only.",
      "অন্য যেকোনো পণ্যের জন্য। নিজের আউটপুট ইউনিট লিখুন (পিস, টন, ট্রিপ, ইউজার…), অথবা শুধু মোট খরচ তুলনা করতে আউটপুট ফাঁকা রাখুন।") },
];
const TCO_CAT = Object.fromEntries(TCO_CATEGORIES.map((k) => [k.key, k]));
export const tcoCat = (s) => TCO_CAT[s && s.category] || TCO_CAT.other;
// Output unit: the category default, or the user's own unit name (saved with the calculation).
export function tcoUnit(s) {
  const own = String((s && s.unit_name) || "").trim().slice(0, 30);
  if (!own) return tcoCat(s);
  return { unit: L(own, own), per: L(`Cost per ${own}`, `প্রতি ${own} খরচ`), output: L(`Total output over the analysis period (${own})`, `বিশ্লেষণকালে মোট আউটপুট (${own})`) };
}

const TCO_FIELDS = [
  { key: "name", label: L("Option name (product / model / supplier)", "অপশনের নাম (পণ্য / মডেল / সাপ্লায়ার)"), type: "text", default: "", width: "full", required: false },
  { key: "purchase", label: L("Purchase price", "ক্রয়মূল্য"), default: 0, min: 0 },
  { key: "transport_install", label: L("Transport, installation & registration (one-time)", "পরিবহন, স্থাপন ও রেজিস্ট্রেশন (এককালীন)"), default: 0, min: 0 },
  { key: "training", label: L("Training & other one-time costs", "প্রশিক্ষণ ও অন্যান্য এককালীন খরচ"), default: 0, min: 0 },
  { key: "incl_install", label: L("Purchase price already includes transport & installation", "ক্রয়মূল্যেই পরিবহন ও স্থাপন ধরা আছে"), type: "checkbox", default: false },
  { key: "operating", label: L("Operating cost per year", "বার্ষিক পরিচালন খরচ"), default: 0, min: 0, help: (s) => tcoCat(s).opHelp },
  { key: "maintenance", label: L("Maintenance & repairs per year", "বার্ষিক রক্ষণাবেক্ষণ ও মেরামত"), default: 0, min: 0 },
  { key: "service", label: L("Warranty / service contract per year", "বার্ষিক ওয়ারেন্টি / সার্ভিস চুক্তি"), default: 0, min: 0 },
  { key: "incl_service", label: L("Purchase price already includes a warranty / service package", "ক্রয়মূল্যেই ওয়ারেন্টি / সার্ভিস প্যাকেজ ধরা আছে"), type: "checkbox", default: false },
  { key: "downtime", label: L("Downtime cost per year", "বার্ষিক ডাউনটাইম খরচ"), default: 0, min: 0 },
  { key: "other_annual", label: L("Other costs per year (insurance, tax, licence)", "বার্ষিক অন্যান্য খরচ (ইন্স্যুরেন্স, ট্যাক্স, লাইসেন্স)"), default: 0, min: 0 },
  { key: "disposal", label: L("Disposal / decommissioning cost (at the end)", "ডিসপোজাল / ডিকমিশনিং খরচ (মেয়াদ শেষে)"), default: 0, min: 0 },
  { key: "eol_type", label: L("End-of-life value type", "মেয়াদ শেষের মূল্যের ধরন"), type: "select", default: "resale",
    options: [["resale", L("Resale value (sold in working order)", "রিসেল ভ্যালু (চালু অবস্থায় বিক্রি)")], ["salvage", L("Salvage value (scrap / parts)", "স্যালভেজ ভ্যালু (স্ক্র্যাপ / যন্ত্রাংশ)")]] },
  { key: "eol_value", label: L("Resale / salvage value (deducted at the end)", "রিসেল / স্যালভেজ ভ্যালু (মেয়াদ শেষে বাদ যাবে)"), default: 0, min: 0 },
  { key: "units", label: (s) => tcoUnit(s).output, required: false, min: 0, help: (s) => tcoCat(s).outHelp },
];

const GROUPS = {
  acq: L("Acquisition", "ক্রয় ও স্থাপন"), op: L("Operating", "পরিচালন"), mt: L("Maintenance & service", "রক্ষণাবেক্ষণ ও সার্ভিস"),
  ot: L("Other costs", "অন্যান্য খরচ"), dis: L("Disposal", "ডিসপোজাল"), eol: L("Resale / salvage value (−)", "রিসেল / স্যালভেজ মূল্য (−)"),
};
const GROUP_ROWS = [
  ["acq", L("Acquisition — purchase, transport, installation, training", "ক্রয় ও স্থাপন — ক্রয়মূল্য, পরিবহন, স্থাপন, প্রশিক্ষণ")],
  ["op", L("Operating (all years)", "পরিচালন (সব বছর)")],
  ["mt", L("Maintenance, repairs & service contract (all years)", "রক্ষণাবেক্ষণ, মেরামত ও সার্ভিস চুক্তি (সব বছর)")],
  ["ot", L("Other costs — downtime, insurance, tax (all years)", "অন্যান্য খরচ — ডাউনটাইম, ইন্স্যুরেন্স, ট্যাক্স (সব বছর)")],
  ["dis", L("Disposal / decommissioning (end of period)", "ডিসপোজাল / ডিকমিশনিং (মেয়াদ শেষে)")],
];
const POS_KEYS = ["acq", "op", "mt", "ot", "dis"];
const sumOf = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const cumulative = (a) => { let s = 0; return a.map((x) => (s += x)); };

// Per-option totals (nominal, present value, year by year). Also used by the page's worked example.
export function tcoParts(v) {
  const years = v.years, r = (v.discount_rate || 0) / 100;
  const df = (t) => (r ? Math.pow(1 + r, -t) : 1);
  const annuity = r ? (1 - Math.pow(1 + r, -years)) / r : years;
  return (v.alternatives || []).map((o, i) => {
    const n = (k) => Number(o[k]) || 0;
    const acq = n("purchase") + n("transport_install") + n("training");
    const op = n("operating"), mt = n("maintenance") + n("service"), ot = n("downtime") + n("other_annual");
    const annual = op + mt + ot, dis = n("disposal"), eol = n("eol_value");
    const nominal = { acq, op: op * years, mt: mt * years, ot: ot * years, dis, eol: -eol };
    const pv = { acq, op: op * annuity, mt: mt * annuity, ot: ot * annuity, dis: dis * df(years), eol: -eol * df(years) };
    const flows = [acq];
    for (let t = 1; t <= years; t++) flows.push(annual + (t === years ? dis - eol : 0));
    const total = sumOf(nominal), totalPv = sumOf(pv);
    const units = Number(o.units) > 0 ? Number(o.units) : null;
    return {
      i, name: o.name || L(`Option ${i + 1}`, `অপশন ${bnNum(i + 1)}`), acq, annual, dis, eol, units,
      eolType: o.eol_type === "salvage" ? "salvage" : "resale", nominal, pv, flows, flowsPv: flows.map((f, t) => f * df(t)), total, totalPv,
      annualised: r ? totalPv * r / (1 - Math.pow(1 + r, -years)) : total / years,
      perUnit: units ? total / units : null, perUnitPv: units ? totalPv / units : null, raw: o,
    };
  });
}

function tcoCompute(v) {
  const years = v.years, rPct = v.discount_rate || 0, r = rPct / 100, cur = v.currency;
  const u = tcoUnit(v);
  const out = tcoParts(v);
  const basis = r ? "totalPv" : "total";
  const ranked = out.map((_, i) => i).sort((a, b) => out[a][basis] - out[b][basis]);
  const best = out[ranked[0]], second = out.length > 1 ? out[ranked[1]] : null, one = out.length === 1;
  const nameOf = (o) => (typeof o.name === "string" ? L(o.name, o.name) : o.name);
  const pvTag = L(` — present value @ ${rPct}%`, ` — বর্তমান মূল্য @ ${bnNum(rPct)}%`);
  const lowestTag = one ? "" : L(" (lowest option)", " (সর্বনিম্ন অপশন)");

  const headline = [
    metric(Lc(one ? L("Total cost of ownership (TCO)", "মোট মালিকানা খরচ (TCO)") : L("Lowest total cost of ownership (TCO)", "সর্বনিম্ন মোট মালিকানা খরচ (TCO)"), r ? pvTag : ""), best[basis], "money", cur, 2, true, nameOf(best)),
    metric(Lc(L("Annualised cost", "বার্ষিক গড় খরচ"), lowestTag), best.annualised, "money", cur),
  ];
  if (second) headline.push(metric(L("Saving versus next option", "পরবর্তী অপশনের তুলনায় সাশ্রয়"), second[basis] - best[basis], "money", cur, 2, false, Lc(L("vs ", "তুলনা: "), nameOf(second))));
  if (best.perUnit !== null) headline.push(metric(Lc(u.per, lowestTag), best.perUnit, "money", cur, 2, false, r ? L("Nominal TCO ÷ total output", "নামিক TCO ÷ মোট আউটপুট") : null));
  if (r) headline.push(metric(Lc(L("TCO, nominal", "TCO, নামিক"), lowestTag), best.total, "money", cur));

  // Double counting: the system checks and warns.
  const warnings = [];
  for (const o of out) {
    const nm = nameOf(o), raw = o.raw;
    if (raw.incl_service && Number(raw.service) > 0) warnings.push(Lc(nm, L(": the purchase price already includes a warranty / service package, but a yearly service cost is also entered. It may be counted twice — clear one of them.",
      ": ক্রয়মূল্যেই ওয়ারেন্টি / সার্ভিস প্যাকেজ ধরা আছে, আবার বার্ষিক সার্ভিস খরচও লেখা হয়েছে। এটি দুইবার গোনা হতে পারে — যেকোনো একটি মুছে দিন।")));
    if (raw.incl_install && Number(raw.transport_install) > 0) warnings.push(Lc(nm, L(": the purchase price already includes transport & installation, but a separate transport / installation cost is also entered. It may be counted twice — clear one of them.",
      ": ক্রয়মূল্যেই পরিবহন ও স্থাপন ধরা আছে, আবার আলাদা পরিবহন / স্থাপন খরচও লেখা হয়েছে। এটি দুইবার গোনা হতে পারে — যেকোনো একটি মুছে দিন।")));
    if (o.eol > 0 && o.acq > 0 && o.eol >= o.acq) warnings.push(Lc(nm, L(": the resale / salvage value is as high as the whole acquisition cost. Check the figure — an asset is usually worth less at the end.",
      ": রিসেল / স্যালভেজ মূল্য পুরো ক্রয় খরচের সমান বা বেশি। সংখ্যাটি যাচাই করুন — মেয়াদ শেষে সাধারণত দাম কমে।")));
  }

  const withUnits = out.filter((o) => o.units);
  const notes = [
    L("TCO = Acquisition + Operating + Maintenance + Other costs + Disposal − Resale/Salvage value. Cost per unit = Total TCO ÷ Total output units.",
      "TCO = Acquisition + Operating + Maintenance + Other costs + Disposal − Resale/Salvage value। প্রতি ইউনিট খরচ = মোট TCO ÷ মোট আউটপুট ইউনিট।"),
    r ? L("A discount rate is given, so the ranking and the charts use present value; the tables also show nominal totals and cost per unit.", "ডিসকাউন্ট রেট দেওয়া আছে, তাই র‍্যাংক ও গ্রাফ বর্তমান মূল্যে; টেবিলে নামিক মোট ও প্রতি ইউনিট খরচও আছে।")
      : L("Ranking uses nominal totals. Add a discount rate to see present value.", "র‍্যাংক নামিক মোট দিয়ে। বর্তমান মূল্য দেখতে ডিসকাউন্ট রেট দিন।"),
  ];
  if (withUnits.length && withUnits.length < out.length) notes.push(Lc(u.per, L(" is shown only for options with output entered.", " শুধু যেসব অপশনে আউটপুট দেওয়া আছে সেগুলোর জন্য দেখানো হয়েছে।")));
  if (withUnits.length > 1 && new Set(withUnits.map((o) => o.units)).size > 1) notes.push(L("The options have different total output, so compare them on cost per unit, not on total TCO alone.", "অপশনগুলোর মোট আউটপুট আলাদা, তাই শুধু মোট TCO নয়, প্রতি ইউনিট খরচ দিয়ে তুলনা করুন।"));

  // Tables: these are also the sheets of the Excel file (values only, no formulas, no charts).
  const cols = [col(L("Rank", "ক্রম"), "int"), col(L("Option", "অপশন")), col(L("TCO (nominal)", "টিসিও (নামিক)"), "money", cur)];
  if (r) cols.push(col(L("TCO (present value)", "টিসিও (বর্তমান মূল্য)"), "money", cur));
  cols.push(col(L("Annualised", "বার্ষিক গড়"), "money", cur), col(Lc(L("Total output (", "মোট আউটপুট ("), u.unit, ")"), "qty"), col(u.per, "money", cur));
  if (r) cols.push(col(Lc(u.per, L(" (present value)", " (বর্তমান মূল্য)")), "money", cur));
  cols.push(col(L("Above lowest", "সর্বনিম্নের চেয়ে বেশি"), "money", cur));
  const compRows = ranked.map((i, k) => {
    const o = out[i], row = [k + 1, nameOf(o), o.total];
    if (r) row.push(o.totalPv);
    row.push(o.annualised, o.units, o.perUnit);
    if (r) row.push(o.perUnitPv);
    row.push(o[basis] - best[basis]);
    return row;
  });
  const eolTypes = new Set(out.filter((o) => o.eol > 0).map((o) => o.eolType));
  const eolLabel = eolTypes.size !== 1 ? L("Less: resale / salvage value (end of period)", "বাদ: রিসেল / স্যালভেজ মূল্য (মেয়াদ শেষে)")
    : eolTypes.has("salvage") ? L("Less: salvage value (end of period)", "বাদ: স্যালভেজ মূল্য (মেয়াদ শেষে)") : L("Less: resale value (end of period)", "বাদ: রিসেল মূল্য (মেয়াদ শেষে)");
  const breakdown = (key, title, totalLabel, collapsed) => {
    const rows = GROUP_ROWS.map(([k, label]) => [label, ...out.map((o) => o[key][k])]);
    rows.push([eolLabel, ...out.map((o) => o[key].eol)]);
    rows.push([totalLabel, ...out.map((o) => (key === "pv" ? o.totalPv : o.total))]);
    return table(title, [col(L("Cost group", "খরচের খাত")), ...out.map((o) => col(nameOf(o), "money", cur))], rows, { totalRow: true, collapsed });
  };
  const yearTable = (flowKey, title) => {
    const c = [col(L("Year (0 = purchase)", "বছর (০ = ক্রয়)"), "int")];
    out.forEach((o) => c.push(col(Lc(nameOf(o), L(" — cost in the year", " — বছরের খরচ")), "money", cur), col(Lc(nameOf(o), L(" — cumulative", " — ক্রমবর্ধমান")), "money", cur)));
    const cums = out.map((o) => cumulative(o[flowKey]));
    const rows = [];
    for (let t = 0; t <= years; t++) { const row = [t]; out.forEach((o, j) => row.push(o[flowKey][t], cums[j][t])); rows.push(row); }
    return table(title, c, rows, { collapsed: true });
  };
  const tables = [
    table(L("Option comparison", "অপশন তুলনা"), cols, compRows, { highlightRow: 0 }),
    breakdown("nominal", L("Cost breakdown (nominal)", "খরচের ভাঙন (নামিক)"), L("Total TCO (nominal)", "মোট TCO (নামিক)"), false),
  ];
  if (r) tables.push(breakdown("pv", L("Cost breakdown (present value)", "খরচের ভাঙন (বর্তমান মূল্য)"), L("Total TCO (present value)", "মোট TCO (বর্তমান মূল্য)"), true));
  tables.push(yearTable("flows", L("Year-wise cost (nominal)", "বছরভিত্তিক খরচ (নামিক)")));
  if (r) tables.push(yearTable("flowsPv", L("Year-wise cost (present value)", "বছরভিত্তিক খরচ (বর্তমান মূল্য)")));

  // Result-oriented charts (drawn by the page, never put in the Excel file).
  const gross = (o) => POS_KEYS.reduce((a, k) => a + Math.max(0, o.nominal[k]), 0);
  const topKey = POS_KEYS.reduce((a, k) => (best.nominal[k] > best.nominal[a] ? k : a), "acq");
  let payNote = null;
  if (second) {
    const cheap = out.reduce((a, o) => (o.acq < a.acq ? o : a), out[0]);
    if (cheap === best || cheap.acq === best.acq) payNote = { kind: "both", best: nameOf(best) };
    else {
      const cb = cumulative(r ? best.flowsPv : best.flows), cc = cumulative(r ? cheap.flowsPv : cheap.flows);
      let year = null;
      for (let t = 0; t <= years; t++) if (cb[t] <= cc[t] + 1e-6) { year = t; break; }
      payNote = { kind: "payback", best: nameOf(best), other: nameOf(cheap), extra: best.acq - cheap.acq, year };
    }
  }
  const charts = [
    { kind: "bars", tab: L("Total TCO", "মোট TCO"), title: Lc(L("Total TCO by option", "অপশনভিত্তিক মোট TCO"), r ? pvTag : L(" — nominal", " — নামিক")), cur,
      rows: out.map((o) => ({ label: nameOf(o), value: o[basis], color: o.i, best: o === best && !one })),
      note: second ? { kind: "lowest", best: nameOf(best), next: nameOf(second), diff: second[basis] - best[basis] } : null },
    { kind: "stacked", tab: L("Cost breakdown", "খরচের ভাঙন"), title: L("Cost breakdown — nominal", "খরচের ভাঙন — নামিক"), cur,
      keys: POS_KEYS.map((k) => ({ key: k, label: GROUPS[k] })), creditLabel: GROUPS.eol,
      rows: out.map((o) => ({ label: nameOf(o), parts: o.nominal, credit: o.eol, total: o.total })),
      note: gross(best) > 0 ? { kind: "share", group: GROUPS[topKey], name: nameOf(best), pct: best.nominal[topKey] / gross(best) * 100 } : null },
    { kind: "line", tab: L("Year-wise trend", "বছরভিত্তিক প্রবণতা"), title: Lc(L("Cumulative cost by year", "বছরভিত্তিক ক্রমবর্ধমান খরচ"), r ? pvTag : L(" — nominal", " — নামিক")), cur, years,
      series: out.map((o) => ({ label: nameOf(o), color: o.i, values: cumulative(r ? o.flowsPv : o.flows) })), note: payNote },
  ];
  if (withUnits.length) {
    const low = withUnits.reduce((a, o) => (o.perUnit < a.perUnit ? o : a), withUnits[0]);
    charts.push({ kind: "bars", tab: L("Per-unit cost", "প্রতি ইউনিট খরচ"), title: Lc(u.per, L(" — nominal TCO ÷ output", " — নামিক TCO ÷ আউটপুট")), cur, exact: true,
      rows: withUnits.map((o) => ({ label: nameOf(o), value: o.perUnit, color: o.i, best: o === low && withUnits.length > 1 })),
      note: { kind: "unit", per: u.per, name: nameOf(low), value: low.perUnit } });
  }
  return result(headline, { tables, notes, warnings, charts });
}

// Saved calculations from the earlier version had one signed "end_of_life" field.
function tcoMigrate(s) {
  if (!s || !Array.isArray(s.alternatives)) return s;
  for (const o of s.alternatives) {
    if (!o || o.end_of_life === undefined) continue;
    const v = toNum(o.end_of_life);
    if (v !== null && v < 0 && (o.eol_value === undefined || o.eol_value === "")) { o.eol_value = -v; if (!o.eol_type) o.eol_type = "resale"; }
    else if (v !== null && v > 0 && (o.disposal === undefined || o.disposal === "")) o.disposal = v;
    delete o.end_of_life;
  }
  return s;
}

const TCO = {
  slug: "total-cost-of-ownership", icon: "layers",
  title: L("Total Cost of Ownership (TCO) Calculator", "মোট মালিকানা খরচ (টিসিও) ক্যালকুলেটর"),
  short: L("TCO Calculator", "টিসিও ক্যালকুলেটর"),
  summary: L("Compare options on lifetime cost and cost per km, hour or page — not just purchase price.", "শুধু ক্রয়মূল্য নয়, পুরো জীবনকালের খরচ এবং প্রতি কিমি, ঘণ্টা বা পৃষ্ঠার খরচে অপশন তুলনা করুন।"),
  intro: L("Pick a category, then add one to five options. One-time, yearly and end-of-life costs — including disposal and resale or salvage value — are combined over the analysis period, with an optional discount rate for present value.",
    "ক্যাটাগরি বেছে এক থেকে পাঁচটি অপশন যোগ করুন। এককালীন, বার্ষিক ও মেয়াদ শেষের খরচ — ডিসপোজাল এবং রিসেল বা স্যালভেজ মূল্যসহ — বিশ্লেষণকাল জুড়ে যোগ হয়; বর্তমান মূল্যের জন্য ঐচ্ছিক ডিসকাউন্ট রেট দিতে পারেন।"),
  sections: [
    { key: "what", title: L("1. Category & output unit", "১. ক্যাটাগরি ও আউটপুট ইউনিট"), note: L("The category sets the output unit (km, hour, page…) and the tips. The calculation stays the same.", "ক্যাটাগরি অনুযায়ী আউটপুট ইউনিট (কিমি, ঘণ্টা, পৃষ্ঠা…) ও নির্দেশনা বদলায়; হিসাবের পদ্ধতি একই থাকে।") },
    { key: "basis", title: L("2. Currency & analysis period", "২. মুদ্রা ও বিশ্লেষণকাল"), note: L("Add a discount rate to see present value (for example your bank loan rate).", "বর্তমান মূল্য দেখতে ডিসকাউন্ট রেট দিন (যেমন ব্যাংক ঋণের সুদের হার)।") },
  ],
  fields: [
    { key: "category", section: "what", label: L("Industry / product category", "ইন্ডাস্ট্রি / পণ্যের ক্যাটাগরি"), type: "select", default: "other", options: TCO_CATEGORIES.map((k) => [k.key, k.label]) },
    { key: "unit_name", section: "what", label: L("Output unit", "আউটপুট ইউনিট"), type: "text", required: false, default: "", maxlength: 30,
      placeholder: (s) => tcoCat(s).unit, help: (s) => L(`Leave empty to use “${tcoCat(s).unit.en}”. Saved with this calculation.`, `ফাঁকা রাখলে “${tcoCat(s).unit.bn}” ধরা হবে। এই হিসাবের সাথেই সেভ থাকে।`) },
    { key: "_guide", section: "what", type: "note", text: (s) => tcoCat(s).guide },
    { key: "currency", section: "basis", label: L("Currency", "মুদ্রা"), type: "select", default: "BDT", options: CURRENCIES, width: "third" },
    { key: "years", section: "basis", label: L("Analysis period (years)", "বিশ্লেষণকাল (বছর)"), type: "integer", default: 5, min: 1, max: 30, width: "third" },
    { key: "discount_rate", section: "basis", label: L("Discount rate (% per year, optional)", "ডিসকাউন্ট রেট (বার্ষিক %, ঐচ্ছিক)"), type: "percent", default: 0, min: 0, max: 50, required: false, width: "third" },
  ],
  groups: [{ key: "alternatives", label: L("3. Options to compare", "৩. যেসব অপশন তুলনা করবেন"), itemLabel: L("Option", "অপশন"), fields: TCO_FIELDS, min: 1, max: 5, defaultCount: 2 }],
  method: [
    L("TCO = Acquisition + Operating + Maintenance + Other costs + Disposal − Resale/Salvage value.", "TCO = Acquisition (ক্রয় ও স্থাপন) + Operating (পরিচালন) + Maintenance (রক্ষণাবেক্ষণ) + Other costs (অন্যান্য) + Disposal (ডিসপোজাল) − Resale/Salvage value (রিসেল/স্যালভেজ মূল্য)।"),
    L("Acquisition = purchase price + transport, installation & registration + training, paid at the start (year 0).", "Acquisition = ক্রয়মূল্য + পরিবহন, স্থাপন ও রেজিস্ট্রেশন + প্রশিক্ষণ; শুরুতে (বছর ০) দেওয়া হয়।"),
    L("Yearly costs — operating, maintenance & service, downtime, insurance and other — are multiplied by the analysis period.", "বার্ষিক খরচ — পরিচালন, রক্ষণাবেক্ষণ ও সার্ভিস, ডাউনটাইম, ইন্স্যুরেন্স ও অন্যান্য — বিশ্লেষণকাল দিয়ে গুণ করা হয়।"),
    L("At the end of the period the disposal cost is added and the resale or salvage value is subtracted. Enter each cost once; the calculator warns you when something looks counted twice.", "মেয়াদ শেষে Disposal খরচ যোগ হয় এবং Resale বা Salvage মূল্য বাদ যায়। প্রতিটি খরচ একবারই লিখুন; দুইবার গোনা মনে হলে ক্যালকুলেটর সতর্ক করবে।"),
    L("Present value (with a discount rate r): the cost of year t is divided by (1 + r)^t; disposal and resale are discounted by (1 + r)^n.", "বর্তমান মূল্য (ডিসকাউন্ট রেট r দিলে): বছর t-এর খরচকে (১ + r)^t দিয়ে ভাগ করা হয়; Disposal ও Resale-কে (১ + r)^n দিয়ে।"),
    L("Annualised cost = PV × r(1+r)^n ÷ ((1+r)^n − 1); without a discount rate it is TCO ÷ years.", "বার্ষিক গড় খরচ = PV × r(১+r)^n ÷ ((১+r)^n − ১); ডিসকাউন্ট রেট না থাকলে টিসিও ÷ বছর।"),
    L("Cost per unit = Total TCO ÷ total output units (km, operating hours, pages…), using the nominal TCO. With a discount rate the table also shows a present-value version.", "প্রতি ইউনিট খরচ = মোট TCO ÷ মোট আউটপুট ইউনিট (কিমি, পরিচালন ঘণ্টা, পৃষ্ঠা…), নামিক TCO দিয়ে। ডিসকাউন্ট রেট দিলে টেবিলে বর্তমান মূল্যের হিসাবও থাকে।"),
  ],
  howto: [
    L("Choose the category (vehicle, generator, printer…). The output unit and the tips change with it; type your own unit if you need another one.", "ক্যাটাগরি বেছে নিন (যানবাহন, জেনারেটর, প্রিন্টার…)। আউটপুট ইউনিট ও নির্দেশনা সেই অনুযায়ী বদলাবে; অন্য ইউনিট লাগলে নিজে লিখে দিন।"),
    L("Set the currency and the analysis period in years. For present value, add a discount rate such as your bank loan rate.", "মুদ্রা ও বিশ্লেষণকাল (বছর) দিন। বর্তমান মূল্য চাইলে ডিসকাউন্ট রেট দিন, যেমন ব্যাংক ঋণের সুদের হার।"),
    L("Fill in Option 1 — and Option 2 if you are comparing. One option on its own also works. Use quotations and your own running-cost records.", "অপশন ১ পূরণ করুন — তুলনা করলে অপশন ২-ও। একটি অপশন দিয়েও TCO বের করা যায়। কোটেশন ও নিজের চলতি খরচের হিসাব ব্যবহার করুন।"),
    L("For the end of life, enter the disposal cost and the resale or salvage value once. Tick the boxes if the price already includes installation or a service package.", "মেয়াদ শেষের জন্য Disposal খরচ এবং Resale বা Salvage মূল্য একবার লিখুন। ক্রয়মূল্যে স্থাপন বা সার্ভিস প্যাকেজ ধরা থাকলে টিক দিন।"),
    L("Enter the total output (km, hours, pages…) to get the cost per unit.", "প্রতি ইউনিট খরচ পেতে মোট আউটপুট (কিমি, ঘণ্টা, পৃষ্ঠা…) লিখুন।"),
    L("Read the result, the charts and any warning, then download the Excel or PDF report.", "ফলাফল, গ্রাফ ও সতর্কবার্তা দেখুন, তারপর Excel বা PDF রিপোর্ট ডাউনলোড করুন।"),
  ],
  formulas: [
    L("TCO = Acquisition + Operating + Maintenance + Other costs + Disposal − Resale/Salvage value", "TCO = Acquisition + Operating + Maintenance + Other costs + Disposal − Resale/Salvage value"),
    L("Cost per unit = Total TCO ÷ Total output units", "প্রতি ইউনিট খরচ = মোট TCO ÷ মোট আউটপুট ইউনিট"),
  ],
  // Worked example: two well-known 100 kVA diesel generators (market data collected 4 Nov 2026).
  example: {
    category: "generator", unit_name: "", currency: "BDT", years: 5, discount_rate: 10, alternatives: [
      { name: "Cummins 100 kVA", purchase: 1395000, transport_install: 50000, training: 0, incl_install: false, operating: 5238000, maintenance: 150000, service: 0, incl_service: false, downtime: 0, other_annual: 0, disposal: 15000, eol_type: "resale", eol_value: 490000, units: 10000 },
      { name: "Perkins 100 kVA", purchase: 2250000, transport_install: 50000, training: 0, incl_install: false, operating: 4617000, maintenance: 130000, service: 0, incl_service: false, downtime: 0, other_annual: 0, disposal: 15000, eol_type: "resale", eol_value: 900000, units: 10000 }],
  },
  exampleInfo: {
    title: L("Two 100 kVA diesel generators", "দুটি ১০০ kVA ডিজেল জেনারেটর"),
    lead: L("Cummins vs Perkins, both 100 kVA / 80 kW prime, running 2,000 hours a year for 5 years at about 75% load.", "Cummins বনাম Perkins — দুটিই ১০০ kVA / ৮০ kW প্রাইম, বছরে ২,০০০ ঘণ্টা করে ৫ বছর, প্রায় ৭৫% লোডে।"),
    fuel: [19.4, 17.1], fuelPrice: 135, hours: 2000,
    collected: L("Market data collected from the web on 4 November 2026. Prices change — always check current quotations.", "বাজারের তথ্য ওয়েব থেকে নেওয়া: ৪ নভেম্বর ২০২৬। দাম বদলায় — সবসময় বর্তমান কোটেশন যাচাই করুন।"),
    assumptions: L("Assumptions you can change: 2,000 running hours a year, installation ৳50,000, maintenance ৳1,50,000 and ৳1,30,000 a year, resale after 5 years at 35% and 40% of the price, disposal ৳15,000, discount rate 10%.",
      "যেসব অনুমান বদলাতে পারেন: বছরে ২,০০০ ঘণ্টা চালানো, স্থাপন ৳৫০,০০০, বছরে রক্ষণাবেক্ষণ ৳১,৫০,০০০ ও ৳১,৩০,০০০, ৫ বছর পর রিসেল দামের ৩৫% ও ৪০%, ডিসপোজাল ৳১৫,০০০, ডিসকাউন্ট রেট ১০%।"),
    sources: [
      [L("Price: Cummins 100 kVA diesel generator on bdstall.com (৳13,95,000)", "দাম: bdstall.com-এ Cummins ১০০ kVA ডিজেল জেনারেটর (৳১৩,৯৫,০০০)"), "https://www.bdstall.com/details/cummins-canopy-100-kva-80-kw-diesel-generator-48872/"],
      [L("Price: Perkins 100 kVA (1104C-44TAG2) on bdstall.com (৳22,50,000–23,95,000)", "দাম: bdstall.com-এ Perkins ১০০ kVA (1104C-44TAG2) (৳২২,৫০,০০০–২৩,৯৫,০০০)"), "https://www.bdstall.com/details/perkins-100-kva-industrial-diesel-generator-48876"],
      [L("Fuel at 75% load: Cummins C110 D5 data 19.4 L/h; Perkins 1104C-44TAG2 data 17.1 L/h", "৭৫% লোডে জ্বালানি: Cummins C110 D5 ১৯.৪ লি/ঘণ্টা; Perkins 1104C-44TAG2 ১৭.১ লি/ঘণ্টা"), ""],
      [L("Diesel: Tk 135 a litre, government rate kept for November 2026 (bdnews24)", "ডিজেল: লিটারপ্রতি ৳১৩৫, নভেম্বর ২০২৬-এর সরকারি দাম (bdnews24)"), "https://bdnews24.com/business/qisn5cl4qg"],
    ],
  },
  migrate: tcoMigrate,
  summarize: tcoParts,
  unitFor: tcoUnit,
  compute: tcoCompute,
};

// =================================================================== 2. Shipping & import (landed) cost
const TAX_BASES = {
  av: L("AV (assessable value)", "AV (শুল্কায়নযোগ্য মূল্য)"),
  av_cd: L("AV + CD", "AV + CD"),
  av_cd_rd: L("AV + CD + RD", "AV + CD + RD"),
  av_cd_rd_sd: L("AV + CD + RD + SD", "AV + CD + RD + SD"),
};
const TAXES = [
  ["cd", L("Customs duty (CD)", "কাস্টমস ডিউটি (CD)"), ["av"], "av", false],
  ["rd", L("Regulatory duty (RD)", "রেগুলেটরি ডিউটি (RD)"), ["av", "av_cd"], "av", false],
  ["sd", L("Supplementary duty (SD)", "সম্পূরক শুল্ক (SD)"), ["av", "av_cd", "av_cd_rd"], "av_cd_rd", false],
  ["vat", L("Import VAT", "আমদানি পর্যায়ের ভ্যাট (VAT)"), Object.keys(TAX_BASES), "av_cd_rd_sd", true],
  ["ait", L("Advance income tax (AIT)", "অগ্রিম আয়কর (AIT)"), Object.keys(TAX_BASES), "av", true],
  ["at", L("Advance tax (AT)", "অগ্রিম কর (AT)"), Object.keys(TAX_BASES), "av_cd_rd_sd", true],
  ["other", L("Other duty / tax", "অন্যান্য শুল্ক / কর"), Object.keys(TAX_BASES), "av", false],
];

const SHIP_FIELDS = [
  { key: "product_name", label: L("Product name", "পণ্যের নাম"), type: "text", default: "", required: false, section: "product", width: "full" },
  { key: "hs_code", label: L("HS code", "এইচএস কোড (HS code)"), type: "text", default: "", required: false, section: "product", maxlength: 20,
    help: L("Use the code confirmed by your C&F agent or the official tariff schedule. ProcureBest does not classify products.", "আপনার সিএন্ডএফ এজেন্ট বা সরকারি ট্যারিফ তালিকা থেকে নিশ্চিত করা কোড ব্যবহার করুন। ProcureBest পণ্যের শ্রেণিবিন্যাস করে না।") },
  { key: "quantity", label: L("Quantity (units)", "পরিমাণ (ইউনিট)"), gt: 0, section: "product" },
  { key: "unit_price", label: L("Unit price (invoice currency)", "একক মূল্য (ইনভয়েস মুদ্রায়)"), gt: 0, section: "product" },
  { key: "currency", label: L("Invoice currency", "ইনভয়েস মুদ্রা"), type: "select", default: "USD", options: CURRENCIES, section: "product" },
  { key: "exchange_rate", label: L("Exchange rate (BDT per 1 unit of invoice currency)", "বিনিময় হার (ইনভয়েস মুদ্রার ১ এককে কত টাকা)"), gt: 0, section: "product",
    showIf: { field: "currency", notIn: ["BDT"] },
    help: L("Enter the rate your bank will apply (for example the LC or TT settlement rate). ProcureBest does not supply live rates.", "আপনার ব্যাংক যে হার প্রয়োগ করবে সেটি লিখুন (যেমন এলসি বা টিটি নিষ্পত্তির হার)। ProcureBest লাইভ হার সরবরাহ করে না।") },
  { key: "freight_mode", label: L("Freight entered as", "ফ্রেইট যেভাবে দেবেন"), type: "select", default: "amount", section: "freight", width: "full",
    options: [["amount", L("Total amount (lump sum)", "মোট অঙ্ক (একসাথে)")], ["cbm", L("Rate per CBM × volume (sea LCL)", "প্রতি সিবিএম হার × আয়তন (সমুদ্র LCL)")], ["kg", L("Rate per kg × chargeable weight (air / courier)", "প্রতি কেজি হার × চার্জেবল ওজন (এয়ার / কুরিয়ার)")]] },
  { key: "freight", label: L("International freight (invoice currency)", "আন্তর্জাতিক ফ্রেইট (ইনভয়েস মুদ্রায়)"), default: 0, min: 0, section: "freight", showIf: { field: "freight_mode", in: ["amount"] } },
  { key: "cbm", label: L("Shipment volume (CBM)", "চালানের আয়তন (সিবিএম)"), default: 0, min: 0, section: "freight", showIf: { field: "freight_mode", in: ["cbm"] } },
  { key: "rate_cbm", label: L("Freight rate per CBM (invoice currency)", "প্রতি সিবিএম ফ্রেইট হার (ইনভয়েস মুদ্রায়)"), default: 0, min: 0, section: "freight", showIf: { field: "freight_mode", in: ["cbm"] } },
  { key: "weight_kg", label: L("Chargeable weight (kg)", "চার্জেবল ওজন (কেজি)"), default: 0, min: 0, section: "freight", showIf: { field: "freight_mode", in: ["kg"] },
    help: L("For air freight, use the higher of actual weight and volumetric weight (L × W × H in cm ÷ 6000 per carton).", "এয়ার ফ্রেইটে প্রকৃত ওজন ও ভলিউমেট্রিক ওজনের (প্রতি কার্টন L × W × H সেমি ÷ ৬০০০) মধ্যে যেটি বেশি সেটি ব্যবহার করুন।") },
  { key: "rate_kg", label: L("Freight rate per kg (invoice currency)", "প্রতি কেজি ফ্রেইট হার (ইনভয়েস মুদ্রায়)"), default: 0, min: 0, section: "freight", showIf: { field: "freight_mode", in: ["kg"] } },
  { key: "insurance_mode", label: L("Insurance entered as", "বিমা যেভাবে দেবেন"), type: "select", default: "amount", section: "freight",
    options: [["amount", L("Amount", "টাকার অঙ্ক")], ["percent", L("% of goods + freight", "পণ্য + ফ্রেইটের %")]] },
  { key: "insurance", label: L("Insurance amount (invoice currency)", "বিমার পরিমাণ (ইনভয়েস মুদ্রায়)"), default: 0, min: 0, section: "freight", showIf: { field: "insurance_mode", in: ["amount"] } },
  { key: "insurance_pct", label: L("Insurance rate (%)", "বিমার হার (%)"), type: "percent", default: 0, min: 0, max: 100, section: "freight", showIf: { field: "insurance_mode", in: ["percent"] } },
  { key: "valuation_basis", label: L("Assessable value basis", "শুল্কায়নযোগ্য মূল্যের ভিত্তি"), type: "select", default: "cif", section: "valuation", width: "full",
    options: [["cif", L("CIF value", "সিআইএফ (CIF) মূল্য")], ["cif_landing", L("CIF + landing charge %", "সিআইএফ + ল্যান্ডিং চার্জ %")], ["manual", L("Enter assessable value manually", "শুল্কায়নযোগ্য মূল্য নিজে লিখুন")]],
    help: L("Customs may assess a value different from your invoice. Use the basis confirmed by your C&F agent.", "কাস্টমস আপনার ইনভয়েস থেকে ভিন্ন মূল্য নির্ধারণ করতে পারে। আপনার সিএন্ডএফ এজেন্টের নিশ্চিত করা ভিত্তি ব্যবহার করুন।") },
  { key: "landing_pct", label: L("Landing charge (%)", "ল্যান্ডিং চার্জ (%)"), type: "percent", default: 0, min: 0, max: 20, section: "valuation", showIf: { field: "valuation_basis", in: ["cif_landing"] } },
  { key: "manual_av", label: L("Assessable value (BDT)", "শুল্কায়নযোগ্য মূল্য (টাকা)"), gt: 0, section: "valuation", showIf: { field: "valuation_basis", in: ["manual"] } },
];
for (const [key, label, bases, defBase, recoverable] of TAXES) {
  SHIP_FIELDS.push({ key: `${key}_rate`, label: L(label.en + " rate (%)", label.bn + " হার (%)"), type: "percent", default: 0, min: 0, max: 1000, section: "taxes", width: "third" });
  if (bases.length > 1) SHIP_FIELDS.push({ key: `${key}_base`, label: L("Calculated on", "যার ওপর হিসাব"), type: "select", default: defBase, options: bases.map((b) => [b, TAX_BASES[b]]), section: "taxes", width: "third" });
  if (recoverable) SHIP_FIELDS.push({ key: `${key}_recoverable`, label: L("Recoverable — exclude from landed cost", "ফেরতযোগ্য — ল্যান্ডেড কস্ট থেকে বাদ দিন"), type: "checkbox", default: false, required: false, section: "taxes", width: "third" });
}
SHIP_FIELDS.push(
  { key: "cnf_charges", label: L("C&F / customs clearance charges (BDT)", "সিএন্ডএফ / কাস্টমস ক্লিয়ারেন্স চার্জ (টাকা)"), default: 0, min: 0, section: "local" },
  { key: "port_charges", label: L("Port & handling charges (BDT)", "বন্দর ও হ্যান্ডলিং চার্জ (টাকা)"), default: 0, min: 0, section: "local" },
  { key: "bank_charges", label: L("Bank / LC charges (BDT)", "ব্যাংক / এলসি চার্জ (টাকা)"), default: 0, min: 0, section: "local" },
  { key: "inland_transport", label: L("Inland transport (BDT)", "অভ্যন্তরীণ পরিবহন (টাকা)"), default: 0, min: 0, section: "local" },
  { key: "other_costs", label: L("Other import costs (BDT)", "অন্যান্য আমদানি খরচ (টাকা)"), default: 0, min: 0, section: "local" },
  { key: "selling_price", label: L("Planned selling price per unit (BDT, optional)", "প্রতি ইউনিট পরিকল্পিত বিক্রয়মূল্য (টাকা, ঐচ্ছিক)"), required: false, min: 0, section: "pricing" },
  { key: "target_margin", label: L("Target gross margin (% of price, optional)", "লক্ষ্য গ্রস মার্জিন (মূল্যের %, ঐচ্ছিক)"), type: "percent", required: false, min: 0, max: 95, section: "pricing" },
);

function shipCompute(v) {
  const cur = v.currency;
  const rate = cur === "BDT" ? 1 : v.exchange_rate;
  if (cur !== "BDT" && !rate) throw new CalcError("exchange_rate", L("Enter the exchange rate.", "বিনিময় হার লিখুন।"));
  const qty = v.quantity;
  const goodsFc = qty * v.unit_price;
  let freightFc;
  if (v.freight_mode === "cbm") freightFc = (v.cbm || 0) * (v.rate_cbm || 0);
  else if (v.freight_mode === "kg") freightFc = (v.weight_kg || 0) * (v.rate_kg || 0);
  else freightFc = v.freight || 0;
  const insuranceFc = v.insurance_mode === "percent" ? (goodsFc + freightFc) * (v.insurance_pct || 0) / 100 : (v.insurance || 0);
  const cifFc = goodsFc + freightFc + insuranceFc;
  const goods = goodsFc * rate, freight = freightFc * rate, insurance = insuranceFc * rate;
  const cif = goods + freight + insurance;
  let av;
  if (v.valuation_basis === "manual") {
    if (!v.manual_av) throw new CalcError("manual_av", L("Enter the assessable value.", "শুল্কায়নযোগ্য মূল্য লিখুন।"));
    av = v.manual_av;
  } else if (v.valuation_basis === "cif_landing") av = cif * (1 + (v.landing_pct || 0) / 100);
  else av = cif;

  const amounts = {};
  const baseAmount = (code) => ({
    av, av_cd: av + (amounts.cd || 0), av_cd_rd: av + (amounts.cd || 0) + (amounts.rd || 0),
    av_cd_rd_sd: av + (amounts.cd || 0) + (amounts.rd || 0) + (amounts.sd || 0),
  })[code];
  const taxRows = [];
  let totalTax = 0, recoverableTax = 0;
  for (const [key, label, , defBase, canRecover] of TAXES) {
    const pct = v[`${key}_rate`] || 0;
    const baseCode = v[`${key}_base`] || defBase;
    const baseVal = baseAmount(baseCode);
    const amount = baseVal * pct / 100;
    amounts[key] = amount;
    const recovered = Boolean(canRecover && v[`${key}_recoverable`]);
    totalTax += amount;
    if (recovered) recoverableTax += amount;
    if (pct || key === "cd" || key === "vat") taxRows.push([label, pct, TAX_BASES[baseCode], baseVal, amount, recovered ? L("Recoverable", "ফেরতযোগ্য") : L("Cost", "খরচ")]);
  }
  const costTax = totalTax - recoverableTax;
  const localItems = [
    ["cnf_charges", L("C&F / clearance", "সিএন্ডএফ / ক্লিয়ারেন্স")], ["port_charges", L("Port & handling", "বন্দর ও হ্যান্ডলিং")],
    ["bank_charges", L("Bank / LC charges", "ব্যাংক / এলসি চার্জ")], ["inland_transport", L("Inland transport", "অভ্যন্তরীণ পরিবহন")],
    ["other_costs", L("Other costs", "অন্যান্য খরচ")],
  ];
  const localTotal = localItems.reduce((s, [k]) => s + (v[k] || 0), 0);
  const landed = cif + costTax + localTotal;
  const cash = cif + totalTax + localTotal;
  const perUnit = landed / qty;
  const shipping = freight + insurance + (v.port_charges || 0) + (v.inland_transport || 0);
  const breakdown = [
    [L("Goods (purchase cost)", "পণ্য (ক্রয় মূল্য)"), goods], [L("International freight", "আন্তর্জাতিক ফ্রেইট"), freight], [L("Insurance", "বিমা"), insurance],
    [L("Duties & taxes treated as cost", "খরচ হিসেবে ধরা শুল্ক ও কর"), costTax], ...localItems.map(([k, label]) => [label, v[k] || 0]),
  ];
  const rows = breakdown.map(([lbl, amt]) => [lbl, amt, safeDiv(amt * 100, landed, 0), amt / qty]);
  rows.push([L("Total landed cost", "মোট ল্যান্ডেড কস্ট"), landed, 100, perUnit]);

  const headline = [
    metric(L("Total landed cost", "মোট ল্যান্ডেড কস্ট"), landed, "money", "BDT", 2, true),
    metric(L("Landed cost per unit", "প্রতি ইউনিট ল্যান্ডেড কস্ট"), perUnit, "money", "BDT", 2, true),
    metric(L("Shipping & logistics cost", "শিপিং ও লজিস্টিকস খরচ"), shipping, "money", "BDT", 2, false, L("Freight + insurance + port + inland", "ফ্রেইট + বিমা + বন্দর + অভ্যন্তরীণ")),
    metric(L("Total duties & taxes", "মোট শুল্ক ও কর"), totalTax, "money", "BDT"),
  ];
  const details = [
    metric(L("Product purchase cost", "পণ্যের ক্রয় মূল্য"), goods, "money", "BDT"),
    metric(L("Freight per unit", "প্রতি ইউনিট ফ্রেইট"), freight / qty, "money", "BDT"),
    metric(L("CIF value", "সিআইএফ মূল্য"), cif, "money", "BDT"),
    metric(L("CIF value in invoice currency", "ইনভয়েস মুদ্রায় সিআইএফ মূল্য"), cifFc, "money", cur),
    metric(L("Estimated assessable value", "আনুমানিক শুল্কায়নযোগ্য মূল্য"), av, "money", "BDT"),
    metric(L("Exchange rate used", "ব্যবহৃত বিনিময় হার"), rate, "number", null, 4),
    metric(L("Recoverable taxes (excluded from landed cost)", "ফেরতযোগ্য কর (ল্যান্ডেড কস্টে ধরা হয়নি)"), recoverableTax, "money", "BDT"),
    metric(L("Other import expenses (local)", "অন্যান্য আমদানি খরচ (স্থানীয়)"), localTotal, "money", "BDT"),
    metric(L("Total cash needed (incl. recoverable taxes)", "মোট নগদ প্রয়োজন (ফেরতযোগ্য করসহ)"), cash, "money", "BDT"),
  ];
  if (v.selling_price) {
    const revenue = v.selling_price * qty, gp = revenue - landed;
    details.push(
      metric(L("Estimated revenue", "আনুমানিক বিক্রয় আয়"), revenue, "money", "BDT"),
      metric(L("Estimated gross profit", "আনুমানিক গ্রস মুনাফা"), gp, "money", "BDT", 2, true),
      metric(L("Estimated gross margin", "আনুমানিক গ্রস মার্জিন"), safeDiv(gp * 100, revenue, 0), "percent"));
  }
  if (v.target_margin) details.push(metric(L("Selling price per unit for target margin", "লক্ষ্য মার্জিনের জন্য প্রতি ইউনিট বিক্রয়মূল্য"), perUnit / (1 - v.target_margin / 100), "money", "BDT", 2, true));
  const warnings = [];
  if (totalTax === 0) warnings.push(L("All duty and tax rates are zero. Enter the current rates for your HS code, otherwise the landed cost will be understated.", "সব শুল্ক ও করের হার শূন্য। আপনার এইচএস কোডের বর্তমান হার লিখুন, নইলে ল্যান্ডেড কস্ট কম দেখাবে।"));
  if (freightFc === 0) warnings.push(L("Freight is zero. Add the international freight unless the price already includes delivery (CIF/CFR).", "ফ্রেইট শূন্য। মূল্যের মধ্যে ডেলিভারি (CIF/CFR) ধরা না থাকলে আন্তর্জাতিক ফ্রেইট যোগ করুন।"));
  if (v.valuation_basis === "manual" && av < cif * 0.5) warnings.push(L("The manual assessable value is far below the CIF value. Please double-check it.", "নিজে লেখা শুল্কায়নযোগ্য মূল্য সিআইএফ মূল্যের চেয়ে অনেক কম। অনুগ্রহ করে আবার যাচাই করুন।"));
  return result(headline, {
    details,
    tables: [
      table(L("Cost breakdown", "খরচের বিবরণ"), [col(L("Component", "উপাদান")), col(L("Amount", "পরিমাণ"), "money", "BDT"), col(L("Share", "অংশ"), "percent", null, 1), col(L("Per unit", "প্রতি ইউনিট"), "money", "BDT")], rows, { totalRow: true }),
      table(L("Duties & taxes", "শুল্ক ও কর"), [col(L("Tax", "কর")), col(L("Rate", "হার"), "percent"), col(L("Calculated on", "যার ওপর হিসাব")), col(L("Base amount", "ভিত্তি পরিমাণ"), "money", "BDT"), col(L("Amount", "পরিমাণ"), "money", "BDT"), col(L("Treated as", "যেভাবে ধরা হয়েছে"))], taxRows),
    ],
    warnings,
    notes: [
      L("This is an estimate built only from the values you entered. Confirm duties, taxes and valuation with Bangladesh Customs (NBR) or a licensed C&F agent before you commit.", "এটি শুধু আপনার দেওয়া তথ্যের ভিত্তিতে তৈরি একটি আনুমানিক হিসাব। সিদ্ধান্ত নেওয়ার আগে বাংলাদেশ কাস্টমস (এনবিআর) বা লাইসেন্সপ্রাপ্ত সিএন্ডএফ এজেন্টের কাছ থেকে শুল্ক, কর ও মূল্যায়ন নিশ্চিত করুন।"),
      L("The exchange rate, HS code, freight and every rate are user-supplied. ProcureBest does not verify classifications or publish official rates.", "বিনিময় হার, এইচএস কোড, ফ্রেইট ও সব হার ব্যবহারকারীর দেওয়া। ProcureBest শ্রেণিবিন্যাস যাচাই করে না বা সরকারি হার প্রকাশ করে না।"),
    ],
    chart: { rows: breakdown.filter(([, a]) => a > 0) },
  });
}

const SHIPPING = {
  slug: "shipping-import-cost", icon: "ship",
  title: L("Shipping & Import Cost Calculator", "শিপিং ও আমদানি খরচ ক্যালকুলেটর"),
  short: L("Shipping & Import Cost", "শিপিং ও আমদানি খরচ"),
  summary: L("Freight by lump sum, CBM or kg, plus duties and local charges — landed cost per unit in taka.", "একসাথে, সিবিএম বা কেজি হিসাবে ফ্রেইট, সঙ্গে শুল্ক ও স্থানীয় খরচ — টাকায় প্রতি ইউনিট ল্যান্ডেড কস্ট।"),
  intro: L("Enter your invoice, the freight (as a lump sum, per CBM or per kg), insurance, the duty rates for your HS code and local charges. Everything is converted to taka with a full cost breakdown.",
    "আপনার ইনভয়েস, ফ্রেইট (একসাথে, প্রতি সিবিএম বা প্রতি কেজি), বিমা, এইচএস কোডের শুল্কহার ও স্থানীয় খরচ লিখুন। সবকিছু টাকায় রূপান্তর করে খরচের পূর্ণ বিবরণ দেখানো হবে।"),
  fields: SHIP_FIELDS,
  sections: [
    { key: "product", title: L("Product & invoice", "পণ্য ও ইনভয়েস") },
    { key: "freight", title: L("Shipping: freight & insurance", "শিপিং: ফ্রেইট ও বিমা") },
    { key: "valuation", title: L("Customs valuation", "কাস্টমস মূল্যায়ন") },
    { key: "taxes", title: L("Duties & taxes (enter current rates for your HS code)", "শুল্ক ও কর (আপনার এইচএস কোডের বর্তমান হার লিখুন)"),
      note: L("Rates start at zero on purpose. Look up the current rates for your HS code in the Bangladesh Customs tariff or ask your C&F agent.", "হারগুলো ইচ্ছাকৃতভাবে শূন্য রাখা হয়েছে। আপনার এইচএস কোডের বর্তমান হার বাংলাদেশ কাস্টমসের ট্যারিফে দেখুন অথবা সিএন্ডএফ এজেন্টকে জিজ্ঞেস করুন।") },
    { key: "local", title: L("Local charges in Bangladesh", "বাংলাদেশে স্থানীয় খরচ") },
    { key: "pricing", title: L("Pricing (optional)", "মূল্য নির্ধারণ (ঐচ্ছিক)") },
  ],
  method: [
    L("Freight = lump sum, or CBM × rate per CBM, or chargeable kg × rate per kg (in the invoice currency).", "ফ্রেইট = একসাথে অঙ্ক, অথবা সিবিএম × প্রতি সিবিএম হার, অথবা চার্জেবল কেজি × প্রতি কেজি হার (ইনভয়েস মুদ্রায়)।"),
    L("Goods = quantity × unit price × exchange rate. CIF = goods + freight + insurance (all converted to BDT).", "পণ্য = পরিমাণ × একক মূল্য × বিনিময় হার। সিআইএফ = পণ্য + ফ্রেইট + বিমা (সব টাকায় রূপান্তরিত)।"),
    L("Assessable value (AV) = CIF, or CIF × (1 + landing charge %), or the value you enter.", "শুল্কায়নযোগ্য মূল্য (AV) = সিআইএফ, অথবা সিআইএফ × (১ + ল্যান্ডিং চার্জ %), অথবা আপনার দেওয়া মূল্য।"),
    L("Each duty = rate × its chosen base. Bases are built in order: CD, RD, SD, then VAT, AIT, AT and other.", "প্রতিটি শুল্ক = হার × নির্বাচিত ভিত্তি। ভিত্তিগুলো ক্রমানুসারে তৈরি হয়: CD, RD, SD, তারপর VAT, AIT, AT ও অন্যান্য।"),
    L("Landed cost = CIF + duties treated as cost + local charges. Taxes marked recoverable are shown separately and excluded.", "ল্যান্ডেড কস্ট = সিআইএফ + খরচ হিসেবে ধরা শুল্ক + স্থানীয় খরচ। ফেরতযোগ্য চিহ্নিত কর আলাদাভাবে দেখানো হয় এবং বাদ দেওয়া হয়।"),
    L("Required selling price for a target margin = landed cost per unit ÷ (1 − margin).", "লক্ষ্য মার্জিনের জন্য প্রয়োজনীয় বিক্রয়মূল্য = প্রতি ইউনিট ল্যান্ডেড কস্ট ÷ (১ − মার্জিন)।"),
  ],
  disclaimer: L("Estimate only. Rates, valuation and classification must be checked against current Bangladesh Customs requirements.", "শুধু আনুমানিক হিসাব। হার, মূল্যায়ন ও শ্রেণিবিন্যাস বাংলাদেশ কাস্টমসের বর্তমান নিয়মের সঙ্গে মিলিয়ে নিতে হবে।"),
  example: {
    product_name: "LED panel light 600×600 (demo)", hs_code: "", quantity: 500, unit_price: 11.5, currency: "USD", exchange_rate: 122,
    freight_mode: "cbm", cbm: 6.5, rate_cbm: 85, insurance_mode: "percent", insurance_pct: 1, valuation_basis: "cif",
    cd_rate: 10, rd_rate: 3, sd_rate: 0, vat_rate: 15, ait_rate: 5, at_rate: 5, vat_recoverable: false,
    cnf_charges: 18000, port_charges: 12000, bank_charges: 6500, inland_transport: 9000, other_costs: 0, selling_price: 2600, target_margin: 25,
  },
  compute: shipCompute,
};

// =================================================================== 3. Comparative statement (CS)
// Custom matrix input: suppliers as columns, items as rows.
export const CS_SUPPLIER_FIELDS = [
  { key: "name", label: L("Supplier name", "সাপ্লায়ারের নাম"), type: "text", default: "", required: false },
  { key: "discount", label: L("Discount (%)", "ছাড় (%)"), type: "percent", default: 0, min: 0, max: 100 },
  { key: "vat", label: L("VAT / tax to add (%)", "যোগ করার ভ্যাট / কর (%)"), type: "percent", default: 0, min: 0, max: 100, showIf: { field: "vat_mode", in: ["add"] } },
  { key: "charges", label: L("Delivery / other charges", "ডেলিভারি / অন্যান্য চার্জ"), default: 0, min: 0 },
  { key: "days", label: L("Delivery time (days)", "ডেলিভারির সময় (দিন)"), required: false, min: 0 },
  { key: "terms", label: L("Payment terms", "পেমেন্টের শর্ত"), type: "text", default: "", required: false, maxlength: 60 },
  { key: "warranty", label: L("Warranty", "ওয়ারেন্টি"), type: "text", default: "", required: false, maxlength: 60 },
  { key: "compliant", label: L("Meets the specification", "স্পেসিফিকেশন পূরণ করে"), type: "checkbox", default: true, required: false },
];
export const CS_ITEM_FIELDS = [
  { key: "desc", label: L("Item / description", "আইটেম / বিবরণ"), type: "text", default: "", required: false, maxlength: 120 },
  { key: "unit", label: L("Unit", "একক"), type: "text", default: "pcs", required: false, maxlength: 12 },
  { key: "qty", label: L("Qty", "পরিমাণ"), gt: 0 },
];

function csCompute(v) {
  const cur = v.currency;
  const S = v.suppliers, I = v.items;
  const nameOf = (s, j) => s.name ? L(s.name, s.name) : L(`Supplier ${j + 1}`, `সাপ্লায়ার ${j + 1}`);
  const sup = S.map((s, j) => {
    let subtotal = 0, quoted = 0;
    I.forEach((it) => { const p = it.prices[j]; if (p !== null && p !== undefined) { subtotal += it.qty * p; quoted++; } });
    const discount = subtotal * (s.discount || 0) / 100;
    const after = subtotal - discount;
    const vat = v.vat_mode === "add" ? after * (s.vat || 0) / 100 : 0;
    const total = after + vat + (s.charges || 0);
    const complete = quoted === I.length;
    return { j, name: nameOf(s, j), subtotal, discount, vat, charges: s.charges || 0, total, quoted, complete, compliant: s.compliant !== false, days: s.days, terms: s.terms, warranty: s.warranty };
  });
  const eligible = sup.filter((s) => s.complete && s.compliant).sort((a, b) => a.total - b.total);
  if (!eligible.length) throw new CalcError("_form", L("No supplier has quoted every item while meeting the specification, so nothing can be ranked. Fill in all prices for at least one compliant supplier.", "কোনো সাপ্লায়ার স্পেসিফিকেশন পূরণ করে সব আইটেমের দাম দেয়নি, তাই র‍্যাংক করা যাচ্ছে না। অন্তত একজন যোগ্য সাপ্লায়ারের সব দাম লিখুন।"));
  eligible.forEach((s, k) => { s.rank = k + 1; });
  const l1 = eligible[0];
  const ordered = [...eligible, ...sup.filter((s) => !s.rank)];
  const summaryRows = ordered.map((s) => [
    s.rank ? L(`L${s.rank}`, `L${s.rank}`) : L("Not ranked", "র‍্যাংক নেই"), s.name, s.quoted, s.subtotal, s.discount, s.vat, s.charges, s.total,
    s.rank ? s.total - l1.total : null, s.rank ? safeDiv((s.total - l1.total) * 100, l1.total, 0) : null,
    s.days ?? null, s.terms ? L(s.terms, s.terms) : L("—", "—"),
  ]);

  // Item-wise comparison among compliant suppliers that quoted the item
  let basket = 0;
  const itemRows = I.map((it, i) => {
    const prices = S.map((s, j) => (sup[j].compliant ? it.prices[j] : null));
    const quoted = prices.map((p, j) => [p, j]).filter(([p]) => p !== null && p !== undefined);
    let low = null, lowNames = L("—", "—");
    if (quoted.length) {
      low = Math.min(...quoted.map(([p]) => p));
      const who = quoted.filter(([p]) => p === low).map(([, j]) => sup[j].name);
      lowNames = L(who.map((w) => w.en).join(", "), who.map((w) => w.bn).join(", "));
      basket += low * it.qty;
    }
    const high = quoted.length ? Math.max(...quoted.map(([p]) => p)) : null;
    const desc = it.desc ? L(it.desc, it.desc) : L(`Item ${i + 1}`, `আইটেম ${i + 1}`);
    return [desc, it.qty, ...S.map((s, j) => (it.prices[j] === null || it.prices[j] === undefined ? null : { v: it.prices[j], best: low !== null && it.prices[j] === low && sup[j].compliant })),
      low, lowNames, low && high ? safeDiv((high - low) * 100, low, 0) : null];
  });
  const headline = [
    metric(L("Lowest evaluated offer (L1)", "সর্বনিম্ন মূল্যায়িত দর (L1)"), l1.total, "money", cur, 2, true, l1.name),
    metric(L("Suppliers ranked", "র‍্যাংক করা সাপ্লায়ার"), eligible.length, "int", null, 0, false, L(`of ${S.length} quoted`, `মোট ${S.length} জনের মধ্যে`)),
  ];
  if (eligible.length > 1) {
    const l2 = eligible[1];
    const gap = safeDiv((l2.total - l1.total) * 100, l1.total, 0).toFixed(1);
    headline.push(metric(L("L1 saving versus L2", "L2-এর তুলনায় L1-এ সাশ্রয়"), l2.total - l1.total, "money", cur, 2, false,
      L(`L2 (${l2.name.en}) is ${gap}% higher`, `L2 (${l2.name.bn}) ${gap}% বেশি`)));
  }
  const splitSaving = l1.subtotal - basket;
  if (splitSaving > 0.005) headline.push(metric(L("Extra saving if split item-wise", "আইটেমভিত্তিক ভাগ করে কিনলে বাড়তি সাশ্রয়"), splitSaving, "money", cur, 2, false, L("Unit prices only, before discount and charges", "শুধু একক মূল্য, ছাড় ও চার্জের আগে")));

  const warnings = [];
  sup.filter((s) => !s.complete).forEach((s) => warnings.push(L(`${s.name.en} did not quote ${I.length - s.quoted} item(s), so it is not ranked.`, `${s.name.bn} ${I.length - s.quoted}টি আইটেমের দাম দেয়নি, তাই র‍্যাংক করা হয়নি।`)));
  sup.filter((s) => !s.compliant).forEach((s) => warnings.push(L(`${s.name.en} does not meet the specification and is excluded from the ranking.`, `${s.name.bn} স্পেসিফিকেশন পূরণ করে না, তাই র‍্যাংকিং থেকে বাদ।`)));
  const slowest = eligible.filter((s) => s.days !== null && s.days !== undefined);
  if (l1.days && slowest.length > 1 && l1.days === Math.max(...slowest.map((s) => s.days)) && l1.days > Math.min(...slowest.map((s) => s.days))) {
    warnings.push(L(`L1 (${l1.name.en}) has the longest delivery time. Check that ${l1.days} days meets your need date.`, `L1 (${l1.name.bn})-এর ডেলিভারির সময় সবচেয়ে বেশি। ${l1.days} দিন আপনার প্রয়োজনের তারিখের মধ্যে কিনা যাচাই করুন।`));
  }
  return result(headline, {
    details: [
      metric(L("L1 subtotal (before discount)", "L1 উপমোট (ছাড়ের আগে)"), l1.subtotal, "money", cur),
      metric(L("L1 discount", "L1 ছাড়"), l1.discount, "money", cur),
      metric(L("L1 VAT / tax added", "L1-এ যোগ করা ভ্যাট / কর"), l1.vat, "money", cur),
      metric(L("L1 delivery / other charges", "L1 ডেলিভারি / অন্যান্য চার্জ"), l1.charges, "money", cur),
      metric(L("Lowest item-wise basket (unit prices only)", "আইটেমভিত্তিক সর্বনিম্ন মোট (শুধু একক মূল্য)"), basket, "money", cur),
    ],
    tables: [
      table(L("Comparative statement — summary", "তুলনামূলক বিবরণী — সারসংক্ষেপ"), [
        col(L("Rank", "র‍্যাংক")), col(L("Supplier", "সাপ্লায়ার")), col(L("Items quoted", "দাম দেওয়া আইটেম"), "int"),
        col(L("Subtotal", "উপমোট"), "money", cur), col(L("Discount", "ছাড়"), "money", cur), col(L("VAT / tax", "ভ্যাট / কর"), "money", cur),
        col(L("Charges", "চার্জ"), "money", cur), col(L("Grand total", "সর্বমোট"), "money", cur), col(L("Above L1", "L1-এর চেয়ে বেশি"), "money", cur),
        col(L("Above L1 %", "L1-এর চেয়ে বেশি %"), "percent", null, 1), col(L("Delivery (days)", "ডেলিভারি (দিন)"), "int"), col(L("Payment terms", "পেমেন্টের শর্ত"))],
        summaryRows, { highlightRow: 0 }),
      table(L("Item-wise unit prices", "আইটেমভিত্তিক একক মূল্য"), [
        col(L("Item", "আইটেম")), col(L("Qty", "পরিমাণ"), "qty"), ...sup.map((s) => col(s.name, "money", cur)),
        col(L("Lowest", "সর্বনিম্ন"), "money", cur), col(L("Lowest by", "সর্বনিম্ন যার")), col(L("Price spread", "দামের পার্থক্য"), "percent", null, 1)], itemRows),
    ],
    warnings,
    notes: [
      L("Ranking uses the grand total of suppliers that quoted every item and meet the specification. Bold prices are the lowest for that item.", "সব আইটেমের দাম দেওয়া ও স্পেসিফিকেশন পূরণকারী সাপ্লায়ারদের সর্বমোট দিয়ে র‍্যাংক করা হয়। মোটা অক্ষরের দাম ওই আইটেমের সর্বনিম্ন।"),
      L("Before award, confirm specifications, validity, delivery and payment terms in writing. The lowest price is not automatically the best value — consider the TCO calculator for equipment.", "অর্ডার দেওয়ার আগে স্পেসিফিকেশন, দরের মেয়াদ, ডেলিভারি ও পেমেন্টের শর্ত লিখিতভাবে নিশ্চিত করুন। সর্বনিম্ন দাম মানেই সেরা মূল্য নয় — যন্ত্রপাতির জন্য টিসিও ক্যালকুলেটর দেখুন।"),
    ],
    chart: { rows: eligible.map((s) => [s.name, s.total]) },
  });
}

const CS = {
  slug: "comparative-statement", icon: "table", custom: "cs",
  title: L("Comparative Statement (CS) Calculator", "তুলনামূলক বিবরণী (CS) ক্যালকুলেটর"),
  short: L("Comparative Statement (CS)", "তুলনামূলক বিবরণী (CS)"),
  summary: L("Compare quotations item by item, rank suppliers L1, L2, L3 and export a ready CS sheet.", "আইটেম ধরে কোটেশন তুলনা করুন, সাপ্লায়ারদের L1, L2, L3 র‍্যাংক করুন এবং তৈরি CS শিট এক্সপোর্ট করুন।"),
  intro: L("Enter up to 5 suppliers and 20 items. Discounts, VAT and delivery charges are applied per supplier; the lowest evaluated offer (L1) and item-wise lowest prices are found automatically.",
    "সর্বোচ্চ ৫ জন সাপ্লায়ার ও ২০টি আইটেম দিন। প্রতিটি সাপ্লায়ারের ছাড়, ভ্যাট ও ডেলিভারি চার্জ হিসাবে ধরা হয়; সর্বনিম্ন মূল্যায়িত দর (L1) ও আইটেমভিত্তিক সর্বনিম্ন দাম নিজে থেকে বের হয়।"),
  fields: [
    { key: "reference", label: L("RFQ / tender reference", "আরএফকিউ / টেন্ডার রেফারেন্স"), type: "text", default: "", required: false, maxlength: 60 },
    { key: "currency", label: L("Currency", "মুদ্রা"), type: "select", default: "BDT", options: CURRENCIES },
    { key: "vat_mode", label: L("Quoted prices", "দেওয়া দাম"), type: "select", default: "included", width: "full",
      options: [["included", L("Include VAT / taxes", "ভ্যাট / করসহ")], ["add", L("Exclude VAT / taxes — add per supplier", "ভ্যাট / কর ছাড়া — প্রতি সাপ্লায়ারে যোগ করুন")]] },
  ],
  suppliers: { min: 2, max: 5, defaultCount: 3 },
  items: { min: 1, max: 20, defaultCount: 3 },
  method: [
    L("Line value = quantity × unit price. Subtotal = sum of line values for the items a supplier quoted.", "লাইন মূল্য = পরিমাণ × একক মূল্য। উপমোট = সাপ্লায়ার যেসব আইটেমের দাম দিয়েছে তার লাইন মূল্যের যোগফল।"),
    L("Grand total = subtotal − discount + VAT/tax (when prices exclude it) + delivery/other charges.", "সর্বমোট = উপমোট − ছাড় + ভ্যাট/কর (দাম ভ্যাট ছাড়া হলে) + ডেলিভারি/অন্যান্য চার্জ।"),
    L("Only suppliers that quoted every item and meet the specification are ranked; L1 is the lowest grand total.", "শুধু সব আইটেমের দাম দেওয়া ও স্পেসিফিকেশন পূরণকারী সাপ্লায়ারদের র‍্যাংক করা হয়; সর্বনিম্ন সর্বমোট হলো L1।"),
    L("Item-wise lowest basket = sum of quantity × lowest compliant unit price for each item (before discounts and charges).", "আইটেমভিত্তিক সর্বনিম্ন মোট = প্রতিটি আইটেমের পরিমাণ × সর্বনিম্ন যোগ্য একক মূল্যের যোগফল (ছাড় ও চার্জের আগে)।"),
    L("Price spread = (highest − lowest) ÷ lowest unit price for that item.", "দামের পার্থক্য = (সর্বোচ্চ − সর্বনিম্ন) ÷ ওই আইটেমের সর্বনিম্ন একক মূল্য।"),
  ],
  example: {
    reference: "RFQ-2026-014 (demo)", currency: "BDT", vat_mode: "add",
    suppliers: [
      { name: "Alpha Office Supplies (demo)", discount: 2, vat: 7.5, charges: 3000, days: 7, terms: "30 days credit", warranty: "1 year", compliant: true },
      { name: "Bengal IT Traders (demo)", discount: 0, vat: 7.5, charges: 0, days: 14, terms: "50% advance", warranty: "1 year", compliant: true },
      { name: "City Tech Solutions (demo)", discount: 5, vat: 7.5, charges: 5000, days: 10, terms: "Cash on delivery", warranty: "6 months", compliant: true },
    ],
    items: [
      { desc: "Laptop, Core i5, 16 GB, 512 GB SSD", unit: "pcs", qty: 10, prices: [78500, 76000, 79000] },
      { desc: "24-inch LED monitor", unit: "pcs", qty: 10, prices: [14200, 14900, 13800] },
      { desc: "Wireless keyboard & mouse set", unit: "set", qty: 10, prices: [1650, 1500, 1580] },
      { desc: "Laser printer, A4, network", unit: "pcs", qty: 2, prices: [32500, 31800, 33900] },
    ],
  },
  compute: csCompute,
};

export const CALCULATORS = [TCO, SHIPPING, CS];
export const BY_SLUG = Object.fromEntries(CALCULATORS.map((c) => [c.slug, c]));
