// Site settings editable from Admin → Settings. Stored as key/value rows in D1.
import { all, run } from "./db.js";

export const DEFAULTS = {
  site_name: "ProcureBest",
  default_lang: "en",
  tagline_en: "Smarter Procurement. Better Decisions.",
  tagline_bn: "স্মার্ট প্রকিউরমেন্ট। আরও ভালো সিদ্ধান্ত।",
  hero_title_en: "Procurement, made precise.",
  hero_title_bn: "নির্ভুল প্রকিউরমেন্ট, সহজ উপায়ে।",
  hero_subtitle_en: "Calculators, exams, books and ready-to-use templates — built for sourcing professionals who decide with numbers.",
  hero_subtitle_bn: "ক্যালকুলেটর, পরীক্ষা, বই ও ব্যবহারযোগ্য টেমপ্লেট — যাঁরা সংখ্যা দিয়ে সিদ্ধান্ত নেন, সেই সোর্সিং পেশাজীবীদের জন্য।",
  seo_description_en: "Free procurement calculators, MCQ exams with certificates, books, Excel templates, CV samples and guides for sourcing professionals.",
  seo_description_bn: "সোর্সিং পেশাজীবীদের জন্য বিনামূল্যে প্রকিউরমেন্ট ক্যালকুলেটর, সার্টিফিকেটসহ এমসিকিউ পরীক্ষা, বই, এক্সেল টেমপ্লেট, সিভি নমুনা ও গাইড।",
  contact_email: "",
  contact_phone: "",
  contact_address: "",
  whatsapp_enabled: "1",
  whatsapp_url: "",
  whatsapp_label_en: "Join Our WhatsApp Group",
  whatsapp_label_bn: "আমাদের WhatsApp গ্রুপে যোগ দিন",
  whatsapp_note_en: "Discuss results with fellow procurement professionals.",
  whatsapp_note_bn: "অন্যান্য প্রকিউরমেন্ট পেশাজীবীদের সঙ্গে ফলাফল নিয়ে আলোচনা করুন।",
  pay_bkash_number: "",
  pay_bkash_type: "Personal",
  pay_nagad_number: "",
  pay_nagad_type: "Personal",
  pay_note_en: "Use \"Send Money\" from your bKash or Nagad app. After sending, enter the Transaction ID below. We check every payment by hand, usually within a few hours (9am–10pm).",
  pay_note_bn: "আপনার bKash বা Nagad অ্যাপ থেকে \"Send Money\" করুন। পাঠানোর পর নিচে Transaction ID লিখুন। আমরা প্রতিটি পেমেন্ট নিজে যাচাই করি, সাধারণত কয়েক ঘণ্টার মধ্যে (সকাল ৯টা–রাত ১০টা)।",
  mail_from_email: "",
  mail_from_name: "ProcureBest",
  notify_email: "",
  free_exam_note_en: "",
  free_exam_note_bn: "",
};

export const WHATSAPP_RE = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/;

export async function loadSettings(env) {
  const rows = await all(env, "SELECT k, v FROM settings");
  const s = { ...DEFAULTS };
  for (const r of rows) if (r.k in DEFAULTS) s[r.k] = r.v ?? "";
  return s;
}

export async function saveSettings(env, values) {
  const stmts = [];
  for (const [k, v] of Object.entries(values)) {
    if (!(k in DEFAULTS)) continue;
    stmts.push(env.DB.prepare("INSERT INTO settings(k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(k, String(v ?? "")));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

export function whatsapp(s, lang) {
  const url = (s.whatsapp_url || "").trim();
  return {
    enabled: s.whatsapp_enabled === "1",
    configured: WHATSAPP_RE.test(url),
    url,
    label: lang === "bn" ? s.whatsapp_label_bn || s.whatsapp_label_en : s.whatsapp_label_en,
    note: lang === "bn" ? s.whatsapp_note_bn || s.whatsapp_note_en : s.whatsapp_note_en,
  };
}

export function paymentMethods(s) {
  const out = [];
  if ((s.pay_bkash_number || "").trim()) out.push({ code: "bkash", name: "bKash", number: s.pay_bkash_number.trim(), type: s.pay_bkash_type || "Personal" });
  if ((s.pay_nagad_number || "").trim()) out.push({ code: "nagad", name: "Nagad", number: s.pay_nagad_number.trim(), type: s.pay_nagad_type || "Personal" });
  return out;
}

export async function setMeta(env, k, v) {
  await run(env, "INSERT INTO meta(k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", k, String(v));
}
