// Small helpers shared by the whole Worker. No external dependencies.

// ------------------------------------------------------------------ HTML templating
// `html` is a tagged template that escapes every interpolated value unless it was
// produced by `html` itself or wrapped in `raw()`. Arrays are joined.
class Raw {
  constructor(s) { this.s = String(s); }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(s ?? "");

export function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function render(v) {
  if (v === null || v === undefined || v === false) return "";
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join("");
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new Raw(out);
}

// JSON safe to embed inside <script type="application/json">
export const jsonScript = (obj) => raw(JSON.stringify(obj).replace(/</g, "\\u003c"));

// ------------------------------------------------------------------ time
export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
export const isoPlus = (ms) => new Date(Date.now() + ms).toISOString().replace(/\.\d{3}Z$/, "Z");
export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

// ------------------------------------------------------------------ random ids & encoding
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
export function randomCode(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (const b of bytes) s += ALPHA[b % ALPHA.length];
  return s;
}
export function randomToken(bytes = 24) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
export function b64url(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlToBytes(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const textToB64url = (t) => b64url(new TextEncoder().encode(t));
export const b64urlToText = (s) => new TextDecoder().decode(b64urlToBytes(s));
export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ------------------------------------------------------------------ hashing & signing
export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const keyCache = new Map();
async function hmacKey(secret) {
  if (!keyCache.has(secret)) {
    keyCache.set(secret, crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]));
  }
  return keyCache.get(secret);
}
export async function hmac(secret, data) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(data));
  return b64url(sig);
}
// Constant-time comparison of two strings.
export function safeEqual(a, b) {
  a = String(a ?? ""); b = String(b ?? "");
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
// Signed value: payload.expiry.signature
export async function signValue(secret, payload, ttlMs) {
  const exp = Math.floor((Date.now() + ttlMs) / 1000);
  const body = `${textToB64url(payload)}.${exp}`;
  return `${body}.${await hmac(secret, body)}`;
}
export async function readSigned(secret, token) {
  if (!token || typeof token !== "string" || token.length > 2000) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const body = `${parts[0]}.${parts[1]}`;
  if (!safeEqual(await hmac(secret, body), parts[2])) return null;
  if (Number(parts[1]) * 1000 < Date.now()) return null;
  try { return b64urlToText(parts[0]); } catch { return null; }
}

// ------------------------------------------------------------------ cookies
export function getCookie(req, name) {
  const header = req.headers.get("Cookie") || "";
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}
export function cookie(name, value, { maxAge, sameSite = "Lax", httpOnly = true, secure = true, path = "/" } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  if (httpOnly) c += "; HttpOnly";
  if (secure) c += "; Secure";
  return c;
}

// ------------------------------------------------------------------ validation
export const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const isEmail = (e) => EMAIL_RE.test(normEmail(e)) && normEmail(e).length <= 254;
export const clip = (s, n) => String(s ?? "").trim().slice(0, n);
export function slugify(s) {
  const out = String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return out || "item-" + randomCode(5).toLowerCase();
}
export const toInt = (v, d = 0) => {
  const n = parseInt(String(v ?? "").replace(/[০-৯]/g, (c) => "০১২৩৪৫৬৭৮৯".indexOf(c)), 10);
  return Number.isFinite(n) ? n : d;
};
export function parseJson(s, fallback) {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
export function clientIp(req) {
  return req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "local";
}
