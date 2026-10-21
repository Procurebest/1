// D1 (SQLite) access: schema, small query helpers and one-time initialisation.
// The schema is created automatically on the first request, so nobody needs to run
// migrations by hand. Every statement is idempotent (IF NOT EXISTS / INSERT OR IGNORE).
import { randomToken, nowIso } from "./util.js";

export const SCHEMA_VERSION = 2;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)`,
  // Every email address the site has collected (downloads, exams, orders, newsletter).
  `CREATE TABLE IF NOT EXISTS emails (
     email TEXT PRIMARY KEY, name TEXT, lang TEXT, source TEXT,
     verified_at TEXT, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
     subscribed INTEGER NOT NULL DEFAULT 0, downloads INTEGER NOT NULL DEFAULT 0, note TEXT)`,
  `CREATE TABLE IF NOT EXISTS verifications (
     id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
     purpose TEXT NOT NULL, next TEXT, lang TEXT, subscribe INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT)`,
  // Uploaded files. Stored in R2 or KV when connected, otherwise as base64 chunks in D1.
  `CREATE TABLE IF NOT EXISTS files (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0,
     chunks INTEGER NOT NULL DEFAULT 0, storage TEXT NOT NULL, complete INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS file_chunks (file_id TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (file_id, idx))`,
  // Library: books, Excel files, CV samples, Word/Doc files.
  `CREATE TABLE IF NOT EXISTS items (
     id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
     title_en TEXT NOT NULL DEFAULT '', title_bn TEXT NOT NULL DEFAULT '',
     summary_en TEXT NOT NULL DEFAULT '', summary_bn TEXT NOT NULL DEFAULT '',
     body_en TEXT NOT NULL DEFAULT '', body_bn TEXT NOT NULL DEFAULT '',
     price INTEGER NOT NULL DEFAULT 0, file_id TEXT, cover_id TEXT,
     status TEXT NOT NULL DEFAULT 'draft', sort INTEGER NOT NULL DEFAULT 100,
     downloads INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  // Blog and career posts share one table.
  `CREATE TABLE IF NOT EXISTS posts (
     id INTEGER PRIMARY KEY AUTOINCREMENT, section TEXT NOT NULL, slug TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
     title_en TEXT NOT NULL DEFAULT '', title_bn TEXT NOT NULL DEFAULT '',
     summary_en TEXT NOT NULL DEFAULT '', summary_bn TEXT NOT NULL DEFAULT '',
     body_en TEXT NOT NULL DEFAULT '', body_bn TEXT NOT NULL DEFAULT '',
     author TEXT NOT NULL DEFAULT 'ProcureBest', refs_json TEXT NOT NULL DEFAULT '[]',
     status TEXT NOT NULL DEFAULT 'draft', published_at TEXT, updated_at TEXT NOT NULL, UNIQUE (section, slug))`,
  `CREATE TABLE IF NOT EXISTS glossary (
     id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE,
     term_en TEXT NOT NULL DEFAULT '', term_bn TEXT NOT NULL DEFAULT '',
     def_en TEXT NOT NULL DEFAULT '', def_bn TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'published', updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS exam_levels (
     code TEXT PRIMARY KEY, title_en TEXT NOT NULL, title_bn TEXT NOT NULL,
     desc_en TEXT NOT NULL DEFAULT '', desc_bn TEXT NOT NULL DEFAULT '',
     question_count INTEGER NOT NULL DEFAULT 20, time_limit_min INTEGER NOT NULL DEFAULT 25,
     pass_mark INTEGER NOT NULL DEFAULT 70, price INTEGER NOT NULL DEFAULT 0,
     attempts_per_purchase INTEGER NOT NULL DEFAULT 3, free_attempts_per_day INTEGER NOT NULL DEFAULT 2,
     published INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS questions (
     id INTEGER PRIMARY KEY AUTOINCREMENT, level_code TEXT NOT NULL, topic TEXT NOT NULL DEFAULT '',
     text_en TEXT NOT NULL DEFAULT '', text_bn TEXT NOT NULL DEFAULT '', options_json TEXT NOT NULL,
     correct_index INTEGER NOT NULL, explanation_en TEXT NOT NULL DEFAULT '', explanation_bn TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'published', source TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_level ON questions(level_code, status)`,
  `CREATE TABLE IF NOT EXISTS attempts (
     id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, level_code TEXT NOT NULL, lang TEXT NOT NULL,
     question_ids TEXT NOT NULL, option_orders TEXT NOT NULL, answers_json TEXT NOT NULL DEFAULT '{}',
     pass_mark INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL, deadline_at TEXT NOT NULL,
     submitted_at TEXT, auto_submitted INTEGER NOT NULL DEFAULT 0, correct_count INTEGER, total_count INTEGER,
     score_pct REAL, passed INTEGER, topics_json TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_attempts_email ON attempts(email, level_code, started_at)`,
  `CREATE TABLE IF NOT EXISTS certificates (
     code TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, level_code TEXT NOT NULL,
     score_pct REAL NOT NULL, attempt_id TEXT NOT NULL, issued_at TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'valid', revoked_at TEXT, revoke_reason TEXT)`,
  `CREATE TABLE IF NOT EXISTS orders (
     id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL UNIQUE, email TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
     phone TEXT NOT NULL DEFAULT '', item_type TEXT NOT NULL, item_ref TEXT NOT NULL, item_title TEXT NOT NULL DEFAULT '',
     amount INTEGER NOT NULL DEFAULT 0, method TEXT NOT NULL, sender TEXT NOT NULL DEFAULT '', trx_id TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT NOT NULL DEFAULT '', lang TEXT NOT NULL DEFAULT 'en',
     created_at TEXT NOT NULL, decided_at TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_trx ON orders(method, trx_id)`,
  `CREATE TABLE IF NOT EXISTS entitlements (
     id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, item_type TEXT NOT NULL, item_ref TEXT NOT NULL,
     attempts_total INTEGER NOT NULL DEFAULT 0, attempts_used INTEGER NOT NULL DEFAULT 0,
     order_id INTEGER, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_ent_email ON entitlements(email, item_type, item_ref)`,
  `CREATE TABLE IF NOT EXISTS events (
     id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, email TEXT, ref TEXT, detail TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, created_at)`,
  `CREATE TABLE IF NOT EXISTS messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
     body TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'en', created_at TEXT NOT NULL, read_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL)`,
];

// Exam levels: Beginner and Experienced free, Expert paid (3 attempts per payment).
const LEVELS = [
  ["beginner", "Beginner", "প্রাথমিক", 20, 25, 70, 0, 0,
    "Procurement fundamentals, purchasing cycle, RFQs and RFPs, purchase orders, sourcing, inventory, logistics and terminology.",
    "প্রকিউরমেন্টের মৌলিক বিষয়, ক্রয় চক্র, আরএফকিউ ও আরএফপি, ক্রয়াদেশ, সোর্সিং, ইনভেন্টরি, লজিস্টিকস ও পরিভাষা।"],
  ["experienced", "Experienced", "অভিজ্ঞ", 20, 25, 75, 0, 1,
    "TCO, negotiation, supplier selection, contract management, KPIs, cost savings, sourcing strategy, supplier performance and risk.",
    "টিসিও, দর-কষাকষি, সাপ্লায়ার নির্বাচন, চুক্তি ব্যবস্থাপনা, কেপিআই, খরচ সাশ্রয়, সোর্সিং কৌশল, সাপ্লায়ার পারফরম্যান্স ও ঝুঁকি।"],
  ["expert", "Expert", "বিশেষজ্ঞ", 20, 30, 80, 500, 2,
    "Strategic sourcing, advanced TCO, landed cost, category management, international trade, supplier risk, complex negotiation, spend analytics and scenarios.",
    "কৌশলগত সোর্সিং, উন্নত টিসিও, ল্যান্ডেড কস্ট, ক্যাটাগরি ব্যবস্থাপনা, আন্তর্জাতিক বাণিজ্য, সাপ্লায়ার ঝুঁকি, জটিল দর-কষাকষি, ব্যয় বিশ্লেষণ ও পরিস্থিতিভিত্তিক সিদ্ধান্ত।"],
];

const readyByDb = new WeakMap(); // schema is checked once per database binding (per isolate)

export async function ensureSchema(env) {
  let ready = readyByDb.get(env.DB);
  if (!ready) {
    ready = (async () => {
      let version = null;
      try {
        version = await env.DB.prepare("SELECT v FROM meta WHERE k='schema_version'").first("v");
      } catch { /* meta table missing: first run */ }
      if (Number(version) !== SCHEMA_VERSION) {
        await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
        // v2: 6-digit confirmation codes (for people who open the email on another device)
        const cols = (await env.DB.prepare("PRAGMA table_info(verifications)").all()).results || [];
        if (!cols.some((c) => c.name === "code_hash")) await env.DB.prepare("ALTER TABLE verifications ADD COLUMN code_hash TEXT").run();
        const now = nowIso();
        await env.DB.batch([
          ...LEVELS.map((l) => env.DB.prepare(
            `INSERT OR IGNORE INTO exam_levels(code,title_en,title_bn,question_count,time_limit_min,pass_mark,price,sort,desc_en,desc_bn,attempts_per_purchase,free_attempts_per_day,published)
             VALUES (?,?,?,?,?,?,?,?,?,?,3,2,1)`).bind(...l)),
          env.DB.prepare("INSERT OR IGNORE INTO meta(k,v) VALUES ('secret', ?)").bind(randomToken(32)),
          env.DB.prepare("INSERT OR IGNORE INTO meta(k,v) VALUES ('installed_at', ?)").bind(now),
          env.DB.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES ('schema_version', ?)").bind(String(SCHEMA_VERSION)),
        ]);
      }
    })().catch((e) => { readyByDb.delete(env.DB); throw e; });
    readyByDb.set(env.DB, ready);
  }
  return ready;
}

// The signing secret: the SESSION_SECRET variable if set, otherwise a random value
// generated once and kept in the database (so no manual setup is required).
const secretByDb = new WeakMap();
export async function getSecret(env) {
  if (env.SESSION_SECRET && String(env.SESSION_SECRET).length >= 16) return String(env.SESSION_SECRET);
  if (!secretByDb.has(env.DB)) secretByDb.set(env.DB, await env.DB.prepare("SELECT v FROM meta WHERE k='secret'").first("v"));
  return secretByDb.get(env.DB);
}

// ------------------------------------------------------------------ query helpers
export const one = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
export const all = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results || [];
export const run = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).run();
export const scalar = async (env, sql, ...args) => {
  const row = await env.DB.prepare(sql).bind(...args).first();
  return row ? Object.values(row)[0] : null;
};

// Simple fixed-window rate limit stored in D1. Returns true when allowed.
export async function rateLimit(env, key, limit, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const row = await one(env,
    `INSERT INTO rate(k,n,reset_at) VALUES (?,1,?)
     ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset_at < ? THEN 1 ELSE n + 1 END,
                                  reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END
     RETURNING n`, key, now + windowSec, now, now, now + windowSec);
  return !row || row.n <= limit;
}

export async function logEvent(env, kind, email, ref, detail) {
  await run(env, "INSERT INTO events(kind,email,ref,detail,created_at) VALUES (?,?,?,?,?)",
    kind, email || null, ref || null, detail ? String(detail).slice(0, 500) : null, nowIso());
}
