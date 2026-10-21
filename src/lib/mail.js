// Email sending through Brevo's HTTP API (Cloudflare Workers cannot speak SMTP).
// Needed: the BREVO_API_KEY secret and a sender address verified in Brevo
// (Admin → Settings → "Send emails from"). Without them the site runs in
// "collect-only" mode: email addresses are recorded but not verified.
import { esc } from "./util.js";

export function mailConfigured(env, s) {
  return Boolean((env.BREVO_API_KEY || env.DEV_MAIL_SINK) && (s.mail_from_email || "").includes("@"));
}

export async function sendMail(env, s, { to, subject, html, text }) {
  if (!mailConfigured(env, s)) return { ok: false, notConfigured: true, error: "Email is not configured" };
  // Local testing only (dev/server.mjs): capture messages instead of sending them.
  if (typeof env.DEV_MAIL_SINK === "function") { env.DEV_MAIL_SINK({ to, subject, html, text }); return { ok: true }; }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: s.mail_from_email.trim(), name: s.mail_from_name || "ProcureBest" },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (res.ok) return { ok: true };
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch { /* ignore */ }
    return { ok: false, error: `Brevo ${res.status}${detail ? ": " + detail : ""}` };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

// A clean, monochrome email matching the site. `paragraphs` are plain strings;
// `button` is {label, url}.
export function emailLayout({ title, paragraphs = [], button = null, footer = "" , siteUrl = ""}) {
  const ps = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#424245">${esc(p)}</p>`).join("");
  const btn = button ? `<p style="margin:24px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:15px;font-weight:600">${esc(button.label)}</a></p>
    <p style="margin:0 0 14px;font-size:12px;color:#86868b;word-break:break-all">${esc(button.url)}</p>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,'Segoe UI',Roboto,Arial,'Noto Sans Bengali',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:18px;padding:32px">
      <div style="font-weight:700;font-size:18px;letter-spacing:-0.02em;margin-bottom:22px">ProcureBest</div>
      <h1 style="font-size:22px;margin:0 0 16px;color:#000">${esc(title)}</h1>
      ${ps}${btn}
    </div>
    <p style="font-size:12px;color:#86868b;text-align:center;margin-top:16px">${esc(footer)}${siteUrl ? ` · <a href="${esc(siteUrl)}" style="color:#86868b">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a>` : ""}</p>
  </div></body></html>`;
  const text = [title, "", ...paragraphs, button ? `\n${button.label}: ${button.url}` : "", "", footer].join("\n");
  return { html, text };
}
