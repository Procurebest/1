// Local test server — runs the Worker in Node.js with a SQLite-backed stand-in for D1,
// an in-memory KV and the /public folder as static assets. For development only;
// the real site runs on Cloudflare (see docs/SETUP-GUIDE-BN.md).
//
//   node --experimental-sqlite dev/server.mjs        (then open http://localhost:8787)
//
// Environment: ADMIN_PASSWORD (default "local-admin-password"), PORT, DEV_DB (file path),
// DEV_MAIL=1 to capture emails at /__dev/mail instead of using collect-only mode,
// DEV_STORAGE=kv|d1 to choose the file store.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

// ---------------------------------------------------------------- D1 stand-in
const conv = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v instanceof ArrayBuffer ? new Uint8Array(v) : v);
const plain = (r) => (r ? { ...r } : r);
export class D1 {
  constructor(file) { this.db = new DatabaseSync(file); this.queries = 0; }
  prepare(sql) {
    const d1 = this;
    const st = {
      sql, args: [],
      bind(...a) { const s = Object.create(st); s.args = a.map(conv); return s; },
      async first(col) { d1.queries++; const r = d1.db.prepare(this.sql).get(...this.args); if (!r) return null; return col ? r[col] : plain(r); },
      async all() { d1.queries++; return { results: d1.db.prepare(this.sql).all(...this.args).map(plain), success: true, meta: {} }; },
      async run() { d1.queries++; const r = d1.db.prepare(this.sql).run(...this.args); return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
      _exec() {
        const p = d1.db.prepare(this.sql);
        if (/^\s*(select|with)/i.test(this.sql) || /returning/i.test(this.sql)) return { results: p.all(...this.args).map(plain), success: true, meta: {} };
        const r = p.run(...this.args);
        return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
    };
    return st;
  }
  async batch(stmts) {
    this.queries += stmts.length;
    this.db.exec("BEGIN");
    try { const out = stmts.map((s) => s._exec()); this.db.exec("COMMIT"); return out; }
    catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
}

// ---------------------------------------------------------------- KV stand-in
export class KV {
  constructor() { this.map = new Map(); }
  async put(k, v) { this.map.set(k, v instanceof Uint8Array ? new Uint8Array(v) : typeof v === "string" ? new TextEncoder().encode(v) : new Uint8Array(v)); }
  async get(k, opts) {
    const v = this.map.get(k);
    if (!v) return null;
    const type = typeof opts === "string" ? opts : opts && opts.type;
    if (type === "stream") return new Blob([v]).stream();
    if (type === "arrayBuffer") return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
    return new TextDecoder().decode(v);
  }
  async delete(k) { this.map.delete(k); }
}

const MIME = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon", ".txt": "text/plain" };
async function asset(pathname) {
  const p = path.normalize(path.join(PUBLIC, decodeURIComponent(pathname)));
  if (!p.startsWith(PUBLIC)) return null;
  try {
    const s = await stat(p);
    if (!s.isFile()) return null;
    return new Response(await readFile(p), { headers: { "Content-Type": MIME[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-cache" } });
  } catch { return null; }
}

export function makeEnv({ dbFile = ":memory:", storage = "kv", mail = false } = {}) {
  const outbox = [];
  const env = {
    DB: new D1(dbFile),
    ASSETS: { fetch: async (req) => (await asset(new URL(req.url).pathname)) || new Response("Not found", { status: 404 }) },
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "local-admin-password",
  };
  if (storage === "kv") env.FILES_KV = new KV();
  if (mail) env.DEV_MAIL_SINK = (m) => { outbox.push(m); console.log(`\n[mail] to=${m.to} subject=${m.subject}\n${m.text}\n`); };
  return { env, outbox };
}

export async function handle(env, req) {
  const url = new URL(req.url);
  if (req.method === "GET" || req.method === "HEAD") {
    const a = await asset(url.pathname);
    if (a) return a;
  }
  const waits = [];
  const res = await worker.fetch(req, env, { waitUntil: (p) => waits.push(Promise.resolve(p).catch((e) => console.error(e))), passThroughOnException() {} });
  await Promise.all(waits);
  return res;
}

// ---------------------------------------------------------------- HTTP server
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { env, outbox } = makeEnv({ dbFile: process.env.DEV_DB || path.join(ROOT, "dev", ".data", "local.sqlite"), storage: process.env.DEV_STORAGE || "kv", mail: process.env.DEV_MAIL === "1" });
  const port = Number(process.env.PORT || 8787);
  http.createServer(async (nreq, nres) => {
    try {
      const url = `http://localhost:${port}${nreq.url}`;
      if (nreq.url === "/__dev/mail") { nres.writeHead(200, { "Content-Type": "application/json" }); nres.end(JSON.stringify(outbox)); return; }
      const body = ["GET", "HEAD"].includes(nreq.method) ? undefined : nreq;
      const req = new Request(url, { method: nreq.method, headers: nreq.headers, body, duplex: "half" });
      const res = await handle(env, req);
      const headers = {};
      res.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
      const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      if (cookies.length) headers["set-cookie"] = cookies;
      nres.writeHead(res.status, headers);
      if (res.body) { for await (const chunk of res.body) nres.write(chunk); }
      nres.end();
    } catch (e) {
      console.error(e);
      nres.writeHead(500); nres.end("dev server error");
    }
  }).listen(port, () => console.log(`ProcureBest local server on http://localhost:${port}  (admin password: ${env.ADMIN_PASSWORD})`));
}
