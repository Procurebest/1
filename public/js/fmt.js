// Locale-aware number, money, percent and date formatting for English and Bengali.
// Shared by the Worker (server-rendered pages) and the browser (calculators, exams).
// Bengali output uses Bengali digits and lakh/crore grouping; taka amounts use
// lakh/crore grouping in both languages, as is customary in Bangladesh.

const BN = "০১২৩৪৫৬৭৮৯";
export const CURRENCY_SYMBOLS = { BDT: "৳", USD: "$", CNY: "¥", EUR: "€", INR: "₹" };
export const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};

export const digits = (text, lang) => (lang === "bn" ? String(text).replace(/\d/g, (d) => BN[d]) : String(text));
export const toEnDigits = (text) => String(text).replace(/[০-৯]/g, (c) => String(BN.indexOf(c)));

function group(intPart, southAsian) {
  if (intPart.length <= 3) return intPart;
  if (!southAsian) return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  const parts = [];
  while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) parts.unshift(rest);
  return parts.concat(last3).join(",");
}

// Round half away from zero, avoiding binary floating point surprises (1.005 → 1.01).
export function roundTo(value, decimals) {
  const f = Math.pow(10, decimals);
  const n = Number(value);
  return Math.sign(n) * Math.round((Math.abs(n) * f) + 1e-9) / f;
}

export function formatNumber(value, lang = "en", decimals = 2, southAsian = null) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
  if (southAsian === null) southAsian = lang === "bn";
  const r = roundTo(value, decimals);
  const negative = r < 0;
  const [i, f] = Math.abs(r).toFixed(decimals).split(".");
  let text = group(i, southAsian) + (decimals > 0 ? "." + f : "");
  if (negative && r !== 0) text = "−" + text;
  return digits(text, lang);
}

export function formatMoney(value, currency = "BDT", lang = "en", decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] || (currency + " ");
  const num = formatNumber(value, lang, decimals, currency === "BDT" || lang === "bn");
  return num.startsWith("−") ? "−" + symbol + num.slice(1) : symbol + num;
}

export function formatPercent(value, lang = "en", decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return formatNumber(value, lang, decimals, false) + "%";
}

// value: ISO string or Date. Dates are shown in Bangladesh time (UTC+6) unless utc=true.
export function formatDate(value, lang = "en", withTime = false) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value).length === 10 ? value + "T00:00:00Z" : value);
  if (isNaN(d)) return String(value);
  const local = new Date(d.getTime() + 6 * 3600 * 1000); // Asia/Dhaka, no DST
  let text = `${local.getUTCDate()} ${MONTHS[lang === "bn" ? "bn" : "en"][local.getUTCMonth()]} ${local.getUTCFullYear()}`;
  if (withTime) {
    text += `, ${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  }
  return digits(text, lang);
}

// Accepts English or Bengali digits, thousands separators and the Unicode minus sign.
export function parseNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const s = toEnDigits(String(raw)).trim().replace(/[,\s]/g, "").replace(/−/g, "-");
  if (s === "") return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}
