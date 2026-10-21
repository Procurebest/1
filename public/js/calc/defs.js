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
export const table = (title, columns, rows, opts = {}) => ({ title, columns, rows, highlightRow: opts.highlightRow ?? null, totalRow: !!opts.totalRow });
export const result = (headline, { details = [], tables = [], notes = [], warnings = [], chart = null } = {}) =>
  ({ headline, details, tables, notes, warnings, chart });
const safeDiv = (a, b, d = null) => (b ? a / b : d);

const CURRENCIES = [
  ["BDT", L("BDT — Bangladeshi taka", "BDT — বাংলাদেশি টাকা")],
  ["USD", L("USD — US dollar", "USD — মার্কিন ডলার")],
  ["CNY", L("CNY — Chinese yuan", "CNY — চীনা ইউয়ান")],
  ["EUR", L("EUR — Euro", "EUR — ইউরো")],
  ["INR", L("INR — Indian rupee", "INR — ভারতীয় রুপি")],
];

// =================================================================== 1. TCO
const TCO_FIELDS = [
  { key: "name", label: L("Alternative / supplier", "বিকল্প / সাপ্লায়ার"), type: "text", default: "", width: "full", required: false },
  { key: "purchase", label: L("Purchase price", "ক্রয়মূল্য"), default: 0, min: 0 },
  { key: "transport_install", label: L("Transport & installation (one-time)", "পরিবহন ও স্থাপন (এককালীন)"), default: 0, min: 0 },
  { key: "training", label: L("Training (one-time)", "প্রশিক্ষণ (এককালীন)"), default: 0, min: 0 },
  { key: "operating", label: L("Operating cost per year", "বার্ষিক পরিচালন খরচ"), default: 0, min: 0 },
  { key: "maintenance", label: L("Maintenance & repairs per year", "বার্ষিক রক্ষণাবেক্ষণ ও মেরামত"), default: 0, min: 0 },
  { key: "downtime", label: L("Downtime cost per year", "বার্ষিক ডাউনটাইম খরচ"), default: 0, min: 0 },
  { key: "service", label: L("Warranty / service contract per year (not in price)", "বার্ষিক ওয়ারেন্টি / সার্ভিস চুক্তি (মূল্যের বাইরে)"), default: 0, min: 0 },
  { key: "end_of_life", label: L("End-of-life cost (negative = resale value)", "মেয়াদ শেষের খরচ (ঋণাত্মক = পুনর্বিক্রয় মূল্য)"), default: 0 },
  { key: "units", label: L("Output units over the period (optional)", "পুরো সময়ে উৎপাদিত ইউনিট (ঐচ্ছিক)"), required: false, min: 0 },
];
const TCO_CATS = [
  ["purchase", L("Purchase price", "ক্রয়মূল্য"), "once"],
  ["transport_install", L("Transport & installation", "পরিবহন ও স্থাপন"), "once"],
  ["training", L("Training", "প্রশিক্ষণ"), "once"],
  ["operating", L("Operating", "পরিচালন"), "annual"],
  ["maintenance", L("Maintenance & repairs", "রক্ষণাবেক্ষণ ও মেরামত"), "annual"],
  ["downtime", L("Downtime", "ডাউনটাইম"), "annual"],
  ["service", L("Warranty / service", "ওয়ারেন্টি / সার্ভিস"), "annual"],
  ["end_of_life", L("End of life", "মেয়াদ শেষ"), "end"],
];

function tcoCompute(v) {
  const years = v.years, r = (v.discount_rate || 0) / 100, cur = v.currency;
  const out = v.alternatives.map((alt, i) => {
    const nominal = {}, pv = {};
    for (const [key, , timing] of TCO_CATS) {
      const amt = alt[key] || 0;
      if (timing === "once") { nominal[key] = amt; pv[key] = amt; }
      else if (timing === "annual") {
        nominal[key] = amt * years;
        let s = 0; for (let t = 1; t <= years; t++) s += amt / Math.pow(1 + r, t);
        pv[key] = r ? s : nominal[key];
      } else { nominal[key] = amt; pv[key] = r ? amt / Math.pow(1 + r, years) : amt; }
    }
    const total = Object.values(nominal).reduce((a, b) => a + b, 0);
    const totalPv = Object.values(pv).reduce((a, b) => a + b, 0);
    const annual = r ? totalPv * (r * Math.pow(1 + r, years)) / (Math.pow(1 + r, years) - 1) : total / years;
    const name = alt.name || L(`Alternative ${i + 1}`, `বিকল্প ${i + 1}`);
    return { name, total, pv: totalPv, annual, perUnit: alt.units ? total / alt.units : null, cats: nominal };
  });
  const basis = r ? "pv" : "total";
  const ranked = out.map((_, i) => i).sort((a, b) => out[a][basis] - out[b][basis]);
  const best = out[ranked[0]];
  const nameOf = (o) => (typeof o.name === "string" ? L(o.name, o.name) : o.name);
  const headline = [
    metric(L("Lowest total cost of ownership", "সর্বনিম্ন মোট মালিকানা খরচ"), best[basis], "money", cur, 2, true, nameOf(best)),
    metric(L("Annualised cost (lowest option)", "বার্ষিক গড় খরচ (সর্বনিম্ন বিকল্প)"), best.annual, "money", cur),
  ];
  if (out.length > 1) {
    const second = out[ranked[1]];
    headline.push(metric(L("Saving versus next option", "পরবর্তী বিকল্পের তুলনায় সাশ্রয়"), second[basis] - best[basis], "money", cur));
  }
  if (best.perUnit !== null) headline.push(metric(L("Cost per output unit (lowest option)", "প্রতি উৎপাদিত ইউনিটে খরচ (সর্বনিম্ন বিকল্প)"), best.perUnit, "money", cur));
  const compRows = ranked.map((i, k) => {
    const o = out[i];
    return [k + 1, nameOf(o), o.total, r ? o.pv : null, o.annual, o.perUnit, o[basis] - best[basis]];
  });
  const catRows = TCO_CATS.map(([key, label]) => [label, ...out.map((o) => o.cats[key])]);
  catRows.push([L("Total", "মোট"), ...out.map((o) => o.total)]);
  return result(headline, {
    tables: [
      table(L("Supplier comparison", "সাপ্লায়ার তুলনা"), [
        col(L("Rank", "ক্রম"), "int"), col(L("Alternative", "বিকল্প")), col(L("TCO (nominal)", "টিসিও (নামিক)"), "money", cur),
        col(L("TCO (present value)", "টিসিও (বর্তমান মূল্য)"), "money", cur), col(L("Annualised", "বার্ষিক গড়"), "money", cur),
        col(L("Per unit", "প্রতি ইউনিট"), "money", cur), col(L("Above lowest", "সর্বনিম্নের চেয়ে বেশি"), "money", cur)], compRows, { highlightRow: 0 }),
      table(L("Cost by category (nominal)", "খাতভিত্তিক খরচ (নামিক)"),
        [col(L("Category", "খাত")), ...out.map((o) => col(nameOf(o), "money", cur))], catRows, { totalRow: true }),
    ],
    notes: [
      L("Ranking uses present value when a discount rate is given, otherwise nominal totals.", "ডিসকাউন্ট রেট দিলে বর্তমান মূল্য দিয়ে, না দিলে নামিক মোট দিয়ে ক্রম করা হয়।"),
      L("Enter warranty or service costs only if they are not already in the purchase price, to avoid double-counting.", "দ্বৈত গণনা এড়াতে ওয়ারেন্টি বা সার্ভিস খরচ কেবল তখনই লিখুন যখন তা ক্রয়মূল্যে অন্তর্ভুক্ত নয়।"),
    ],
    chart: { rows: out.map((o) => [nameOf(o), o[basis]]) },
  });
}

const TCO = {
  slug: "total-cost-of-ownership", icon: "layers",
  title: L("Total Cost of Ownership (TCO) Calculator", "মোট মালিকানা খরচ (টিসিও) ক্যালকুলেটর"),
  short: L("TCO Calculator", "টিসিও ক্যালকুলেটর"),
  summary: L("Compare suppliers on lifetime cost, not just purchase price.", "শুধু ক্রয়মূল্য নয়, পুরো জীবনকালের খরচে সাপ্লায়ার তুলনা করুন।"),
  intro: L("Add up to five alternatives. One-time, yearly and end-of-life costs are combined over the analysis period, with an optional discount rate for present value.",
    "সর্বোচ্চ পাঁচটি বিকল্প যোগ করুন। এককালীন, বার্ষিক ও মেয়াদ শেষের খরচ বিশ্লেষণকাল জুড়ে যোগ করা হয়; বর্তমান মূল্যের জন্য ঐচ্ছিক ডিসকাউন্ট রেট দিতে পারেন।"),
  fields: [
    { key: "currency", label: L("Currency", "মুদ্রা"), type: "select", default: "BDT", options: CURRENCIES },
    { key: "years", label: L("Analysis period (years)", "বিশ্লেষণকাল (বছর)"), type: "integer", default: 5, min: 1, max: 30 },
    { key: "discount_rate", label: L("Discount rate (% per year, optional)", "ডিসকাউন্ট রেট (বার্ষিক %, ঐচ্ছিক)"), type: "percent", default: 0, min: 0, max: 50, required: false },
  ],
  groups: [{ key: "alternatives", label: L("Alternatives", "বিকল্পসমূহ"), itemLabel: L("Alternative", "বিকল্প"), fields: TCO_FIELDS, min: 1, max: 5, defaultCount: 2 }],
  method: [
    L("Nominal TCO = one-time costs + (annual costs × years) + end-of-life cost.", "নামিক টিসিও = এককালীন খরচ + (বার্ষিক খরচ × বছর) + মেয়াদ শেষের খরচ।"),
    L("Present value discounts each year's annual costs by (1 + r)^t and the end-of-life cost by (1 + r)^n.", "বর্তমান মূল্যে প্রতি বছরের খরচকে (১ + r)^t এবং মেয়াদ শেষের খরচকে (১ + r)^n দিয়ে ডিসকাউন্ট করা হয়।"),
    L("Annualised cost = PV × r(1+r)^n ÷ ((1+r)^n − 1); without a discount rate it is TCO ÷ years.", "বার্ষিক গড় খরচ = PV × r(১+r)^n ÷ ((১+r)^n − ১); ডিসকাউন্ট রেট না থাকলে টিসিও ÷ বছর।"),
    L("Cost per unit = nominal TCO ÷ output units.", "প্রতি ইউনিট খরচ = নামিক টিসিও ÷ উৎপাদিত ইউনিট।"),
  ],
  example: {
    currency: "BDT", years: 5, discount_rate: 10, alternatives: [
      { name: "Machine A — Demo Supplier Ltd", purchase: 1200000, transport_install: 60000, training: 25000, operating: 180000, maintenance: 40000, downtime: 30000, service: 0, end_of_life: -150000, units: 500000 },
      { name: "Machine B — Sample Traders", purchase: 950000, transport_install: 45000, training: 15000, operating: 220000, maintenance: 65000, downtime: 55000, service: 20000, end_of_life: -60000, units: 500000 }],
  },
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
