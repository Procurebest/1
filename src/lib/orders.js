// Manual bKash / Nagad orders: the buyer submits the Transaction ID, an admin checks
// the payment in the bKash/Nagad app and approves; approval creates an entitlement.
import { one, all, run, getSecret } from "./db.js";
import { nowIso, randomCode, signValue, DAY } from "./util.js";
import { sendMail, emailLayout } from "./mail.js";
import { translate } from "./i18n.js";

export const TRX_RE = /^[A-Za-z0-9]{6,20}$/;
export const PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;

export async function ownsFile(env, email, slug) {
  return Boolean(await one(env, "SELECT id FROM entitlements WHERE email=? AND item_type='file' AND item_ref=? LIMIT 1", email, slug));
}
export const pendingOrder = (env, email, type, ref) =>
  one(env, "SELECT * FROM orders WHERE email=? AND item_type=? AND item_ref=? AND status='pending' ORDER BY id DESC LIMIT 1", email, type, ref);

export async function createOrder(env, o) {
  const ref = `PB-${randomCode(6)}`;
  await run(env, `INSERT INTO orders(ref,email,name,phone,item_type,item_ref,item_title,amount,method,sender,trx_id,status,lang,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)`, ref, o.email, o.name, o.phone, o.itemType, o.itemRef, o.itemTitle, o.amount,
    o.method, o.sender, o.trx.toUpperCase(), o.lang, nowIso());
  return ref;
}

// The button in the "approved" email signs the buyer in (their email counts as confirmed,
// because only they receive this email) and opens the item. No separate confirmation step.
async function itemLink(env, siteUrl, order) {
  const lang = order.lang === "bn" ? "bn" : "en";
  const to = order.item_type === "file" ? `/${lang}/library/${order.item_ref}` : order.item_type === "course" ? `/${lang}/courses/${order.item_ref}` : `/${lang}/exams/${order.item_ref}`;
  const token = await signValue(await getSecret(env), JSON.stringify({ e: order.email, to }), 60 * DAY);
  return `${siteUrl}/${lang}/access/${encodeURIComponent(token)}`;
}

export async function approveOrder(env, s, siteUrl, id, note = "") {
  const order = await one(env, "SELECT * FROM orders WHERE id=?", id);
  if (!order || order.status === "approved") return { ok: false, order };
  let attempts = 0;
  if (order.item_type === "exam") {
    const lv = await one(env, "SELECT attempts_per_purchase FROM exam_levels WHERE code=?", order.item_ref);
    attempts = lv ? lv.attempts_per_purchase : 3;
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status='approved', admin_note=?, decided_at=? WHERE id=?").bind(note, nowIso(), id),
    env.DB.prepare("INSERT INTO entitlements(email,item_type,item_ref,attempts_total,attempts_used,order_id,created_at) VALUES (?,?,?,?,0,?,?)")
      .bind(order.email, order.item_type, order.item_ref, attempts, id, nowIso()),
  ]);
  const lang = order.lang === "bn" ? "bn" : "en";
  const T = (k, v) => translate(lang, k, v);
  const mail = emailLayout({
    title: T("order.mail_approved_subject", { ref: order.ref }),
    paragraphs: [T("order.mail_approved", { ref: order.ref, item: order.item_title }), note].filter(Boolean),
    button: { label: T("order.mail_open"), url: await itemLink(env, siteUrl, order) },
    footer: "ProcureBest", siteUrl,
  });
  const sent = await sendMail(env, s, { to: order.email, subject: T("order.mail_approved_subject", { ref: order.ref }), ...mail });
  return { ok: true, order, mailed: sent.ok, mailError: sent.error };
}

export async function rejectOrder(env, s, siteUrl, id, note = "") {
  const order = await one(env, "SELECT * FROM orders WHERE id=?", id);
  if (!order || order.status !== "pending") return { ok: false, order };
  await run(env, "UPDATE orders SET status='rejected', admin_note=?, decided_at=? WHERE id=?", note, nowIso(), id);
  const lang = order.lang === "bn" ? "bn" : "en";
  const T = (k, v) => translate(lang, k, v);
  const mail = emailLayout({
    title: T("order.mail_rejected_subject", { ref: order.ref }),
    paragraphs: [T("order.mail_rejected", { ref: order.ref, item: order.item_title }), note,
      lang === "bn" ? "প্রশ্ন থাকলে এই ইমেইলের উত্তর দিন বা সাইটের যোগাযোগ পাতা ব্যবহার করুন।" : "If you have questions, reply to this email or use the contact page on the site."].filter(Boolean),
    footer: "ProcureBest", siteUrl,
  });
  const sent = await sendMail(env, s, { to: order.email, subject: T("order.mail_rejected_subject", { ref: order.ref }), ...mail });
  return { ok: true, order, mailed: sent.ok, mailError: sent.error };
}

export const ordersFor = (env, email) => all(env, "SELECT * FROM orders WHERE email=? ORDER BY id DESC LIMIT 50", email);
