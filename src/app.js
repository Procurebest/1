// Tiny router and per-request context. Keeps the Worker free of npm dependencies.
import { i18n, LANGS } from "./lib/i18n.js";
import { loadSettings } from "./lib/settings.js";
import { getSecret } from "./lib/db.js";
import { getCookie, cookie, readSigned, signValue, normEmail, hmac, safeEqual, DAY, HOUR } from "./lib/util.js";

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler) {
    const keys = [];
    const re = new RegExp("^" + pattern.replace(/\/:(\w+)(\([^)]+\))?/g, (m, k, r) => {
      keys.push(k);
      return "/(" + (r ? r.slice(1, -1) : "[^/]+") + ")";
    }) + "/?$");
    this.routes.push({ method, re, keys, handler });
    return this;
  }
  get(p, h) { return this.add("GET", p, h); }
  post(p, h) { return this.add("POST", p, h); }
  put(p, h) { return this.add("PUT", p, h); }
  match(method, path) {
    let allowed = false;
    for (const r of this.routes) {
      const m = r.re.exec(path);
      if (!m) continue;
      if (r.method !== method && !(method === "HEAD" && r.method === "GET")) { allowed = true; continue; }
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
    return allowed ? { methodNotAllowed: true } : null;
  }
}

const VISITOR_COOKIE = "pb_v";
const ADMIN_COOKIE = "pb_admin";

export class Ctx {
  constructor(req, env, exec) {
    this.req = req;
    this.env = env;
    this.exec = exec;
    this.url = new URL(req.url);
    this.params = {};
    this.cookies = [];
    this.setLang(null);
  }
  setLang(lang) {
    this.lang = LANGS.includes(lang) ? lang : "en";
    const h = i18n(this.lang);
    Object.assign(this, h);
  }
  get siteUrl() { return (this.env.SITE_URL || this.url.origin).replace(/\/$/, ""); }
  get secure() { return this.url.protocol === "https:"; }
  p(path = "/", lang = this.lang) { return `/${lang}${path === "/" ? "/" : path}`; }
  async settings() { if (!this._s) this._s = await loadSettings(this.env); return this._s; }
  async secret() { if (!this._secret) this._secret = await getSecret(this.env); return this._secret; }

  // ---------------------------------------------------------------- visitor (email) identity
  async visitor() {
    if (this._visitor !== undefined) return this._visitor;
    this._visitor = null;
    const raw = getCookie(this.req, VISITOR_COOKIE);
    const payload = raw ? await readSigned(await this.secret(), raw) : null;
    if (payload) {
      try {
        const v = JSON.parse(payload);
        if (v && v.e) this._visitor = { email: normEmail(v.e), verified: !!v.v };
      } catch { /* ignore */ }
    }
    return this._visitor;
  }
  async setVisitor(email, verified) {
    const token = await signValue(await this.secret(), JSON.stringify({ e: email, v: verified ? 1 : 0 }), 180 * DAY);
    this.cookies.push(cookie(VISITOR_COOKIE, token, { maxAge: 180 * DAY / 1000, secure: this.secure }));
    this._visitor = { email, verified };
  }
  clearVisitor() {
    this.cookies.push(cookie(VISITOR_COOKIE, "", { maxAge: 0, secure: this.secure }));
    this._visitor = null;
  }

  // ---------------------------------------------------------------- admin session
  async isAdmin() {
    if (this._admin !== undefined) return this._admin;
    const raw = getCookie(this.req, ADMIN_COOKIE);
    this._admin = Boolean(raw && (await readSigned(await this.secret(), raw)) === "admin");
    return this._admin;
  }
  async startAdmin() {
    const token = await signValue(await this.secret(), "admin", 12 * HOUR);
    this.cookies.push(cookie(ADMIN_COOKIE, token, { maxAge: 12 * HOUR / 1000, sameSite: "Strict", secure: this.secure }));
  }
  endAdmin() { this.cookies.push(cookie(ADMIN_COOKIE, "", { maxAge: 0, sameSite: "Strict", secure: this.secure })); }
  async csrfToken() {
    const raw = getCookie(this.req, ADMIN_COOKIE) || "";
    return hmac(await this.secret(), "csrf:" + raw.split(".").pop());
  }
  async checkCsrf(form) {
    const sent = form.get("_csrf");
    return Boolean(sent) && safeEqual(sent, await this.csrfToken());
  }

  // Same-origin check for state-changing requests (defence against CSRF).
  sameOrigin() {
    const origin = this.req.headers.get("Origin");
    if (origin) return origin === this.url.origin;
    const site = this.req.headers.get("Sec-Fetch-Site");
    if (site) return site === "same-origin" || site === "none";
    const ref = this.req.headers.get("Referer");
    if (ref) { try { return new URL(ref).origin === this.url.origin; } catch { return false; } }
    return false;
  }

  // ---------------------------------------------------------------- responses
  finish(res) {
    const headers = new Headers(res.headers);
    for (const c of this.cookies) headers.append("Set-Cookie", c);
    if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
  html(body, status = 200, headers = {}) {
    return new Response("<!doctype html>" + String(body), { status, headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
  }
  json(obj, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  redirect(location, status = 303) {
    return new Response(null, { status, headers: { Location: location } });
  }
  async form() {
    if (!this._form) this._form = await this.req.formData();
    return this._form;
  }
  async body() {
    if (this._body === undefined) {
      try { this._body = await this.req.json(); } catch { this._body = {}; }
      if (!this._body || typeof this._body !== "object") this._body = {};
    }
    return this._body;
  }
}
