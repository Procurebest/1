// Starter content, installed from Admin → Dashboard in small steps (each step stays
// well inside the free plan's per-request limits). Every step is safe to run twice.
import QUESTIONS from "./questions.js";
import ARTICLES from "./articles.js";
import FILES, { INSTRUCTIONS_EN, INSTRUCTIONS_BN } from "./files.js";
import GLOSSARY from "./glossary.js";
import CAREER from "./career.js";
import { scalar } from "../lib/db.js";
import { nowIso, b64ToBytes, slugify } from "../lib/util.js";
import { storeBytes } from "../lib/files.js";

export const STEPS = ["questions", "blog", "glossary", "files", "files2"];

function multiInsert(env, sql, cols, rows, perStmt) {
  const stmts = [];
  for (let i = 0; i < rows.length; i += perStmt) {
    const chunk = rows.slice(i, i + perStmt);
    const values = chunk.map(() => "(" + cols.map(() => "?").join(",") + ")").join(",");
    stmts.push(env.DB.prepare(`${sql} (${cols.join(",")}) VALUES ${values}`).bind(...chunk.flat()));
  }
  return stmts;
}

export async function installStep(env, step) {
  const now = nowIso();
  if (step === "questions") {
    const have = Number(await scalar(env, "SELECT COUNT(*) FROM questions WHERE source='starter'"));
    if (have) return { step, added: 0, note: "already installed" };
    const cols = ["level_code", "topic", "text_en", "text_bn", "options_json", "correct_index", "explanation_en", "explanation_bn", "status", "source", "updated_at"];
    const rows = QUESTIONS.map((q) => [q.level, q.topic, q.en, q.bn, JSON.stringify(q.options), q.correct, q.xen, q.xbn, "published", "starter", now]);
    await env.DB.batch(multiInsert(env, "INSERT INTO questions", cols, rows, 9));
    return { step, added: rows.length };
  }
  if (step === "blog") {
    const cols = ["section", "slug", "category", "title_en", "title_bn", "summary_en", "summary_bn", "body_en", "body_bn", "author", "refs_json", "status", "published_at", "updated_at"];
    const day = 86400000;
    const rows = [
      ...ARTICLES.map((a, i) => ["blog", a.slug, a.category, a.en.title, a.bn.title, a.en.summary, a.bn.summary, a.en.body, a.bn.body, "ProcureBest Editorial", JSON.stringify(a.refs || []), "published", new Date(Date.now() - (3 + i * 4) * day).toISOString().slice(0, 10), now]),
      ...CAREER.map((a, i) => ["career", a.slug, a.category, a.en.title, a.bn.title, a.en.summary, a.bn.summary, a.en.body, a.bn.body, "ProcureBest Editorial", "[]", "published", new Date(Date.now() - (2 + i * 5) * day).toISOString().slice(0, 10), now]),
    ];
    await env.DB.batch(multiInsert(env, "INSERT OR IGNORE INTO posts", cols, rows, 7));
    return { step, added: rows.length };
  }
  if (step === "glossary") {
    const cols = ["slug", "term_en", "term_bn", "def_en", "def_bn", "status", "updated_at"];
    const rows = GLOSSARY.map(([en, bn, den, dbn]) => [slugify(en), en, bn, den, dbn, "published", now]);
    await env.DB.batch(multiInsert(env, "INSERT OR IGNORE INTO glossary", cols, rows, 14));
    return { step, added: rows.length };
  }
  if (step === "files" || step === "files2") {
    // two halves, to keep each request well under the free plan's 50 queries
    const half = Math.ceil(FILES.length / 2);
    let added = 0;
    for (const f of step === "files" ? FILES.slice(0, half) : FILES.slice(half)) {
      const exists = await scalar(env, "SELECT COUNT(*) FROM items WHERE slug=?", f.slug);
      if (Number(exists)) continue;
      const fileId = await storeBytes(env, f.file_name, b64ToBytes(f.data));
      const body = (en) => (en ? `${f.summary_en}\n\n**What's inside**\n\n${f.points_en.split("\n").map((p) => "- " + p).join("\n")}\n\n**How to use it**\n\n${INSTRUCTIONS_EN}`
        : `${f.summary_bn}\n\n**ভেতরে যা আছে**\n\n${f.points_bn.split("\n").map((p) => "- " + p).join("\n")}\n\n**কীভাবে ব্যবহার করবেন**\n\n${INSTRUCTIONS_BN}`);
      await env.DB.prepare(`INSERT OR IGNORE INTO items(slug,type,title_en,title_bn,summary_en,summary_bn,body_en,body_bn,price,file_id,status,sort,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,'published',?,?,?)`).bind(f.slug, "excel", f.title_en, f.title_bn, f.summary_en, f.summary_bn, body(true), body(false), f.price, fileId, f.sort, now, now).run();
      added++;
    }
    return { step, added };
  }
  throw new Error("Unknown step");
}

export async function starterStatus(env) {
  const [q, p, g, f] = await Promise.all([
    scalar(env, "SELECT COUNT(*) FROM questions WHERE source='starter'"),
    scalar(env, "SELECT COUNT(*) FROM posts"),
    scalar(env, "SELECT COUNT(*) FROM glossary"),
    scalar(env, "SELECT COUNT(*) FROM items"),
  ]);
  return { questions: Number(q), posts: Number(p), glossary: Number(g), items: Number(f) };
}
