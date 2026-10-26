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
  // Calculators switched off by the admin (comma-separated slugs)
  calc_off: "",
  // About us & founder profile (Admin → About & founder)
  about_en: "",
  about_bn: "",
  founder_name_en: "",
  founder_name_bn: "",
  founder_title_en: "",
  founder_title_bn: "",
  founder_bio_en: "",
  founder_bio_bn: "",
  founder_experience_en: "",
  founder_experience_bn: "",
  founder_linkedin: "",
  founder_photo_id: "",
  // Career roadmap figures (JSON, edited in Admin → Calculators)
  roadmap_json: "",
  // Show the blinking "Free" badge next to Exams in the menu
  nav_free_badge: "1",
  // Welcome pop-up (Admin → Settings)
  popup_enabled: "1",
  popup_title_en: "Get your free certificate — take the exam now",
  popup_title_bn: "ফ্রি সার্টিফিকেট পেতে এখনই পরীক্ষা দিন",
  popup_text_en: "Put your procurement knowledge to the test and earn a certificate anyone can verify.",
  popup_text_bn: "আপনার মেধা যাচাই করুন এবং যে কেউ যাচাই করতে পারে এমন সার্টিফিকেট জিতে নিন।",
  popup_features_en: "20 randomised questions, 25 minutes\nInstant server-side scoring\nVerifiable certificate with QR code\nNo account or password needed",
  popup_features_bn: "২০টি এলোমেলো প্রশ্ন, ২৫ মিনিট\nসার্ভারে তাৎক্ষণিক নম্বর\nQR কোডসহ যাচাইযোগ্য সার্টিফিকেট\nকোনো অ্যাকাউন্ট বা পাসওয়ার্ড লাগবে না",
  popup_cta_en: "Take the free exam now",
  popup_cta_bn: "এখনই ফ্রি পরীক্ষা দিন",
  popup_cta_url: "/exams",
  // Moving procurement quotes (one per line)
  quotes_enabled: "1",
  quotes_en: "The lowest price is not always the lowest cost.\nA good buyer negotiates the deal; a great buyer builds the relationship.\nMeasure delivery, quality and cost — the savings will follow.\nNo PO, no payment: control begins before the purchase.\nKnow your BATNA before you start talking.\nA supplier becomes a partner when the numbers are open on both sides.\nTotal cost of ownership starts where the quotation ends.\nA risk you cannot see is a cost you have not priced.",
  quotes_bn: "সবচেয়ে কম দাম মানেই সবচেয়ে কম খরচ নয়।\nভালো ক্রেতা দরদাম করেন; সেরা ক্রেতা সম্পর্ক গড়েন।\nডেলিভারি, গুণমান ও খরচ মাপুন — সাশ্রয় আপনিই আসবে।\nপিও নেই, পেমেন্ট নেই — নিয়ন্ত্রণ শুরু হয় কেনার আগেই।\nআলোচনায় বসার আগে নিজের BATNA জানুন।\nদুই পক্ষের সংখ্যা খোলা থাকলে সাপ্লায়ার অংশীদার হয়ে ওঠে।\nকোটেশন যেখানে শেষ, মোট মালিকানা খরচ সেখানেই শুরু।\nযে ঝুঁকি দেখা যায় না, তার দামও ধরা হয় না।",
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

export const calcOff = (s) => new Set(String(s.calc_off || "").split(",").map((x) => x.trim()).filter(Boolean));
