// File storage for books, templates and cover images. Three options, best first:
//  * R2 bucket bound as FILES      — needs a payment card on the Cloudflare account.
//  * KV namespace bound as FILES_KV — free plan, no card: 1 GB in total, files up to ~95 MB
//                                     (stored as parts of up to 20 MB; KV's limit is 25 MB per value).
//  * D1 (no extra setup)            — fallback for small files (up to 5 MB), stored as base64 text.
// R2 and KV stream files straight to the visitor, so large downloads cost the Worker
// almost no CPU time (important on the free plan's 10 ms limit).
import { Buffer } from "node:buffer";
import { one, run, scalar } from "./db.js";
import { nowIso, randomToken } from "./util.js";

const MB = 1024 * 1024;
const CHUNK_BY_KIND = { r2: 95 * MB, kv: 20 * MB, d1: 1_400_000 };
const MAX_BY_KIND = { r2: 95 * MB, kv: 95 * MB, d1: 5 * MB };

export const storageKind = (env) => (env.FILES ? "r2" : env.FILES_KV ? "kv" : "d1");
export const maxFileSize = (env) => MAX_BY_KIND[storageKind(env)];
export const chunkSize = (kind) => CHUNK_BY_KIND[kind];
export const CHUNK = CHUNK_BY_KIND.d1;

export const MIME_BY_EXT = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  epub: "application/epub+zip",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
export const ext = (name) => (String(name).split(".").pop() || "").toLowerCase();
export const mimeFor = (name) => MIME_BY_EXT[ext(name)] || "application/octet-stream";
export const IMAGE_EXT = ["png", "jpg", "jpeg", "webp"];

export async function createFile(env, name, size) {
  const id = randomToken(12);
  const storage = storageKind(env);
  const cs = chunkSize(storage);
  const chunks = Math.max(1, Math.ceil(size / cs));
  await run(env, "INSERT INTO files(id,name,mime,size,chunks,storage,complete,created_at) VALUES (?,?,?,?,?,?,0,?)",
    id, String(name).slice(0, 200), mimeFor(name), size, chunks, storage, nowIso());
  return { id, storage, chunkSize: cs, chunks };
}

export const expectedChunkSize = (f, idx) => Math.min(chunkSize(f.storage), f.size - idx * chunkSize(f.storage));

export async function putChunk(env, file, idx, bytes) {
  if (file.storage === "r2") return env.FILES.put(file.id, bytes, { httpMetadata: { contentType: file.mime } });
  if (file.storage === "kv") return env.FILES_KV.put(`${file.id}:${idx}`, bytes);
  const b64 = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  await run(env, "INSERT OR REPLACE INTO file_chunks(file_id, idx, data) VALUES (?,?,?)", file.id, idx, b64);
}

export async function completeFile(env, file) {
  if (file.storage === "d1") {
    const n = await scalar(env, "SELECT COUNT(*) FROM file_chunks WHERE file_id=?", file.id);
    if (Number(n) !== file.chunks) return false;
  } else if (file.storage === "r2") {
    if (!(await env.FILES.head(file.id))) return false;
  }
  // KV writes can take a moment to become visible everywhere, so they are not re-read here.
  await run(env, "UPDATE files SET complete=1 WHERE id=?", file.id);
  return true;
}

// Store a whole file at once (used for the starter templates, which are small).
export async function storeBytes(env, name, bytes) {
  const f = await createFile(env, name, bytes.byteLength);
  const file = { id: f.id, storage: f.storage, mime: mimeFor(name), size: bytes.byteLength, chunks: f.chunks };
  for (let i = 0; i < f.chunks; i++) await putChunk(env, file, i, bytes.subarray(i * f.chunkSize, (i + 1) * f.chunkSize));
  await run(env, "UPDATE files SET complete=1 WHERE id=?", file.id);
  return f.id;
}

export const getFile = (env, id) => (id ? one(env, "SELECT * FROM files WHERE id=?", id) : null);

export async function deleteFile(env, id) {
  if (!id) return;
  const f = await getFile(env, id);
  if (!f) return;
  try {
    if (f.storage === "r2" && env.FILES) await env.FILES.delete(f.id);
    if (f.storage === "kv" && env.FILES_KV) for (let i = 0; i < f.chunks; i++) await env.FILES_KV.delete(`${f.id}:${i}`);
  } catch (e) { console.error("delete file", e); }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM file_chunks WHERE file_id=?").bind(id),
    env.DB.prepare("DELETE FROM files WHERE id=?").bind(id),
  ]);
}

function asciiName(name) {
  return String(name).replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
}

// Stream a stored file to the visitor. `disposition` is "attachment" or "inline".
export async function fileResponse(env, f, disposition = "attachment", extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": f.mime,
    "Content-Disposition": `${disposition}; filename="${asciiName(f.name)}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  if (f.size) headers.set("Content-Length", String(f.size));
  const missing = () => new Response("File not available", { status: 404 });
  if (f.storage === "r2") {
    const obj = env.FILES ? await env.FILES.get(f.id) : null;
    return obj ? new Response(obj.body, { headers }) : missing();
  }
  if (f.storage === "kv") {
    if (!env.FILES_KV) return missing();
    if (f.chunks === 1) {
      const body = await env.FILES_KV.get(`${f.id}:0`, { type: "stream" });
      return body ? new Response(body, { headers }) : missing();
    }
    const { readable, writable } = new TransformStream();
    (async () => {
      try {
        for (let i = 0; i < f.chunks; i++) {
          const part = await env.FILES_KV.get(`${f.id}:${i}`, { type: "stream" });
          if (!part) throw new Error("missing part " + i);
          await part.pipeTo(writable, { preventClose: true });
        }
        await writable.close();
      } catch (e) { await writable.abort(e); }
    })();
    return new Response(readable, { headers });
  }
  let idx = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      if (idx >= f.chunks) { controller.close(); return; }
      const row = await env.DB.prepare("SELECT data FROM file_chunks WHERE file_id=? AND idx=?").bind(f.id, idx).first();
      idx++;
      if (!row) { controller.error(new Error("missing chunk")); return; }
      controller.enqueue(new Uint8Array(Buffer.from(String(row.data), "base64")));
    },
  });
  return new Response(stream, { headers });
}

export async function storageUsed(env) {
  const row = await one(env, "SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS bytes FROM files WHERE complete=1");
  return { files: row?.n || 0, bytes: row?.bytes || 0, kind: storageKind(env) };
}
