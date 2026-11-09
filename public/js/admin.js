/* ProcureBest admin: menu, confirmations, chunked file uploads, starter-content installer. */
(function () {
  "use strict";
  const csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || "";
  const bn = document.documentElement.lang === "bn";
  const T = (en, b) => (bn ? b : en);

  const side = document.querySelector("[data-adm-side]");
  const tog = document.querySelector("[data-adm-toggle]");
  if (side && tog) tog.addEventListener("click", () => side.classList.toggle("open"));

  document.addEventListener("submit", (e) => {
    const m = e.target.getAttribute && e.target.getAttribute("data-confirm");
    if (m && !window.confirm(m)) e.preventDefault();
  });

  async function api(url, opts) {
    const res = await fetch(url, Object.assign({ credentials: "same-origin" }, opts, { headers: Object.assign({ "X-CSRF": csrf }, (opts || {}).headers || {}) }));
    let body = {};
    try { body = await res.json(); } catch (e) { body = { ok: false, error: "HTTP " + res.status }; }
    if (!res.ok && body.ok === undefined) body.ok = false;
    return body;
  }

  // ---------------------------------------------------------------- picture size advice (never blocks the upload)
  const ratioText = (w, h) => { const g = (a, b) => (b ? g(b, a % b) : a), d = g(w, h) || 1; return w / d <= 32 && h / d <= 32 ? `${w / d}:${h / d}` : `${(w / h).toFixed(2)}:1`; };
  function imageAdvice(box, file) {
    const out = box.querySelector("[data-img-check]");
    if (!out || !/^image\//.test(file.type || "")) return;
    const w0 = +box.dataset.imgW || 0, h0 = +box.dataset.imgH || 0, kb0 = +box.dataset.imgKb || 0, fit = box.dataset.imgFit || "cover";
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight, kb = Math.round(file.size / 1024), notes = [];
      URL.revokeObjectURL(url);
      if (h0 && fit !== "width" && Math.abs(w / h - w0 / h0) / (w0 / h0) > 0.04) notes.push(fit === "contain"
        ? T(`The frame is ${ratioText(w0, h0)}; this picture is ${ratioText(w, h)}, so there will be empty space around it.`, `ফ্রেম ${ratioText(w0, h0)}; এই ছবি ${ratioText(w, h)}, তাই চারপাশে ফাঁকা জায়গা থাকবে।`)
        : T(`The frame is ${ratioText(w0, h0)}; this picture is ${ratioText(w, h)}, so its edges will be trimmed.`, `ফ্রেম ${ratioText(w0, h0)}; এই ছবি ${ratioText(w, h)}, তাই কিনারা কেটে ফ্রেমে বসানো হবে।`));
      if (w0 && w < w0 * 0.75) notes.push(T(`Only ${w} px wide — it may look blurry. Recommended: ${w0}${h0 ? " × " + h0 : ""} px.`, `মাত্র ${w} পিক্সেল চওড়া — ঝাপসা দেখাতে পারে। সুপারিশ: ${w0}${h0 ? " × " + h0 : ""} পিক্সেল।`));
      if (kb0 && kb > kb0 * 1.5) notes.push(T(`${kb} KB is more than the recommended ${kb0} KB, so the page loads slower. Compress it first (for example with squoosh.app).`, `${kb} KB — সুপারিশকৃত ${kb0} KB-এর চেয়ে বেশি, তাই পাতা ধীরে খুলবে। আগে কমপ্রেস করে নিন (যেমন squoosh.app দিয়ে)।`));
      out.hidden = false;
      out.classList.toggle("ok", !notes.length);
      out.textContent = `${notes.length ? "⚠" : "✓"} ${w} × ${h} px, ${kb} KB — ` + (notes.length ? notes.join(" ") : T("matches the recommended size.", "সুপারিশকৃত মাপের সাথে মিলেছে।"));
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  // ---------------------------------------------------------------- automatic picture fitting
  // Any photo (even a large phone photo, a PNG or a different shape) is resized and cropped in the
  // browser to the exact frame before upload, saved as a light JPG. No more "wrong shape" or "too large".
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }
  const toBlob = (cv, q) => new Promise((res) => cv.toBlob(res, "image/jpeg", q));
  async function fitImage(box, file) {
    const w0 = +box.dataset.imgW || 0, h0 = +box.dataset.imgH || 0, kb = +box.dataset.imgKb || 300, fit = box.dataset.imgFit || "cover";
    if (!w0 || !/^image\//.test(file.type || "") || /svg|gif/.test(file.type)) return { file, note: "" };
    let img;
    try { img = await loadImage(file); } catch (e) { return { file, note: "" }; }
    const W = img.naturalWidth, H = img.naturalHeight;
    let cw, ch, sx = 0, sy = 0, sw = W, sh = H, dx = 0, dy = 0, dw, dh;
    if (!h0 || fit === "width") { cw = Math.min(w0, W); ch = Math.round(H * cw / W); dw = cw; dh = ch; }
    else if (fit === "contain") {
      cw = w0; ch = h0; const k = Math.min(cw / W, ch / H); dw = Math.round(W * k); dh = Math.round(H * k); dx = Math.round((cw - dw) / 2); dy = Math.round((ch - dh) / 2);
    } else {
      cw = w0; ch = h0; dw = cw; dh = ch; const r = cw / ch;
      if (W / H > r) { sw = Math.round(H * r); sx = Math.round((W - sw) / 2); } else { sh = Math.round(W / r); sy = Math.round((H - sh) / 2); }
    }
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const g = cv.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, cw, ch);
    g.imageSmoothingQuality = "high";
    g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    let blob = null;
    for (const q of [0.88, 0.8, 0.72, 0.64, 0.56]) { blob = await toBlob(cv, q); if (blob && blob.size <= kb * 1024 * 1.2) break; }
    if (!blob) return { file, note: "" };
    const name = (file.name || "image").replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "-").slice(0, 60) + ".jpg";
    const out = new File([blob], name, { type: "image/jpeg" });
    let pv = box.querySelector(".img-preview");
    if (!pv) { pv = document.createElement("img"); pv.className = "img-preview"; pv.alt = ""; (box.querySelector(".upload-box") || box).appendChild(pv); }
    pv.src = URL.createObjectURL(out);
    return { file: out, note: T(`✓ Fitted automatically: ${cw} × ${ch} px, ${Math.round(out.size / 1024)} KB.`, `✓ নিজে থেকেই মাপে বসানো হয়েছে: ${cw} × ${ch} পিক্সেল, ${Math.round(out.size / 1024)} KB।`) };
  }
  function showNote(box, note) {
    const out = box.querySelector("[data-img-check]");
    if (!out || !note) return;
    out.hidden = false; out.classList.add("ok"); out.textContent = note;
  }
  // Any picture format the browser can open is accepted (it is converted to JPG).
  document.querySelectorAll("[data-upload][data-img-w] [data-upload-input], [data-md-image] input[type=file]").forEach((i) => { i.accept = "image/*"; });

  // ---------------------------------------------------------------- uploads
  document.querySelectorAll("[data-upload]").forEach((box) => {
    const input = box.querySelector("[data-upload-input]");
    const value = box.querySelector("[data-upload-value]");
    const nameEl = box.querySelector("[data-upload-name]");
    const status = box.querySelector("[data-upload-status]");
    const bar = box.querySelector("[data-upload-progress]");
    const form = box.closest("form");
    input.addEventListener("change", async () => {
      let file = input.files && input.files[0];
      if (!file) return;
      const fitted = await fitImage(box, file);
      file = fitted.file;
      if (fitted.note) showNote(box, fitted.note); else imageAdvice(box, file);
      const submit = form && form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      bar.hidden = false;
      bar.firstElementChild.style.width = "2%";
      status.textContent = T("Uploading…", "আপলোড হচ্ছে…");
      try {
        const init = await api("/admin/api/files/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, kind: box.dataset.kind }) });
        if (!init.ok) throw new Error(init.error || "init failed");
        for (let i = 0; i < init.chunks; i++) {
          const part = file.slice(i * init.chunkSize, Math.min(file.size, (i + 1) * init.chunkSize));
          let ok = false;
          for (let attempt = 0; attempt < 3 && !ok; attempt++) {
            const r = await api(`/admin/api/files/${init.id}/chunk/${i}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: part });
            ok = !!r.ok;
            if (!ok && attempt === 2) throw new Error(r.error || "upload failed");
          }
          bar.firstElementChild.style.width = Math.round(((i + 1) / init.chunks) * 95) + "%";
        }
        const done = await api(`/admin/api/files/${init.id}/complete`, { method: "POST" });
        if (!done.ok) throw new Error(done.error || "complete failed");
        bar.firstElementChild.style.width = "100%";
        value.value = done.id;
        const kb = done.size < 1048576 ? Math.round(done.size / 1024) + " KB" : (done.size / 1048576).toFixed(1) + " MB";
        nameEl.textContent = "✓ " + done.name + " · " + kb;
        status.textContent = T("Uploaded. Press Save to keep it.", "আপলোড হয়েছে। রাখতে সেভ চাপুন।");
        const rm = box.querySelector('input[type="checkbox"]');
        if (rm) rm.checked = false;
      } catch (err) {
        status.textContent = T("Upload failed: ", "আপলোড ব্যর্থ: ") + err.message;
        bar.hidden = true;
      } finally {
        if (submit) submit.disabled = false;
        input.value = "";
      }
    });
  });

  // ---------------------------------------------------------------- "Insert image" under Markdown boxes
  async function uploadFile(file, kind, onProgress) {
    const init = await api("/admin/api/files/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, kind }) });
    if (!init.ok) throw new Error(init.error || "init failed");
    for (let i = 0; i < init.chunks; i++) {
      const part = file.slice(i * init.chunkSize, Math.min(file.size, (i + 1) * init.chunkSize));
      let r = { ok: false };
      for (let a = 0; a < 3 && !r.ok; a++) r = await api(`/admin/api/files/${init.id}/chunk/${i}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: part });
      if (!r.ok) throw new Error(r.error || "upload failed");
      if (onProgress) onProgress((i + 1) / init.chunks);
    }
    const done = await api(`/admin/api/files/${init.id}/complete`, { method: "POST" });
    if (!done.ok) throw new Error(done.error || "complete failed");
    return done;
  }
  document.querySelectorAll("[data-md-image]").forEach((box) => {
    const input = box.querySelector('input[type="file"]');
    const status = box.querySelector("[data-md-image-status]");
    const area = document.getElementById(box.dataset.target);
    input.addEventListener("change", async () => {
      let file = input.files && input.files[0];
      if (!file || !area) return;
      const fitted = await fitImage(box, file);
      file = fitted.file;
      if (fitted.note) showNote(box, fitted.note); else imageAdvice(box, file);
      status.textContent = T("Uploading…", "আপলোড হচ্ছে…");
      try {
        const done = await uploadFile(file, "cover", (p) => { status.textContent = T("Uploading… ", "আপলোড হচ্ছে… ") + Math.round(p * 100) + "%"; });
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[\[\]]/g, "");
        const snippet = `\n\n![${alt}](/media/${done.id})\n\n`;
        const at = typeof area.selectionStart === "number" ? area.selectionStart : area.value.length;
        area.value = area.value.slice(0, at) + snippet + area.value.slice(at);
        area.focus();
        area.selectionStart = area.selectionEnd = at + snippet.length;
        status.textContent = T("Image added. Press Save to keep it.", "ছবি যোগ হয়েছে। রাখতে সেভ চাপুন।");
      } catch (err) {
        status.textContent = T("Upload failed: ", "আপলোড ব্যর্থ: ") + err.message;
      } finally { input.value = ""; }
    });
  });

  // ---------------------------------------------------------------- question CSV import (in small batches)
  // The file is read here in the browser and sent 100 rows at a time, so big files never hit
  // the free plan's time limit. Excel files saved as ANSI or with ";" separators also work.
  function parseCsvText(text, delim) {
    text = String(text || "").replace(/^\uFEFF/, "");
    const rows = []; let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(field); field = ""; if (row.some((v) => v.trim() !== "")) rows.push(row); row = []; }
      else field += ch;
    }
    row.push(field); if (row.some((v) => v.trim() !== "")) rows.push(row);
    return rows;
  }
  document.querySelectorAll("[data-q-import-form]").forEach((form) => {
    const box = form.closest("[data-q-import]");
    const status = box.querySelector("[data-q-status]"), list = box.querySelector("[data-q-errors]"), bar = box.querySelector("[data-q-progress]");
    form.addEventListener("submit", async (e) => {
      const file = form.querySelector('input[type="file"]').files[0];
      if (!file || !window.TextDecoder) return; // falls back to the normal form upload
      e.preventDefault();
      const btn = form.querySelector("button"); btn.disabled = true; list.innerHTML = "";
      try {
        const buf = await file.arrayBuffer();
        let text;
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (err) { text = new TextDecoder("windows-1252").decode(buf); }
        const first = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
        const n = (ch) => first.split(ch).length;
        const delim = n(";") > n(",") && n(";") > n("\t") ? ";" : n("\t") > n(",") ? "\t" : ",";
        const rows = parseCsvText(text, delim);
        const head = (rows.shift() || []).map((h) => h.trim());
        if (!head.length || !rows.length) throw new Error(T("The file has no question rows.", "ফাইলে কোনো প্রশ্নের সারি নেই।"));
        const objs = rows.slice(0, 5000).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] || ""])));
        let added = 0, updated = 0; const errors = [];
        if (rows.length > 5000) errors.push({ line: 5002, msg: T("Only the first 5,000 rows were imported.", "শুধু প্রথম ৫,০০০ সারি ইমপোর্ট হয়েছে।") });
        bar.hidden = false;
        for (let i = 0; i < objs.length; i += 100) {
          status.textContent = T(`Importing… ${Math.min(i + 100, objs.length)} of ${objs.length}`, `ইমপোর্ট হচ্ছে… ${objs.length}টির মধ্যে ${Math.min(i + 100, objs.length)}টি`);
          let r = { ok: false };
          for (let a = 0; a < 3 && !r.ok; a++) r = await api("/admin/api/questions/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: objs.slice(i, i + 100), first_line: i + 2 }) });
          if (!r.ok) throw new Error((r.error || "failed") + T(` (rows ${i + 2}–${i + 101}; earlier rows are already saved)`, ` (সারি ${i + 2}–${i + 101}; আগের সারিগুলো সেভ হয়ে গেছে)`));
          added += r.added; updated += r.updated; errors.push(...r.errors);
          bar.firstElementChild.style.width = Math.round(Math.min(1, (i + 100) / objs.length) * 100) + "%";
        }
        status.textContent = T(`Done. Added ${added}, updated ${updated}, skipped ${errors.length}.`, `শেষ। যোগ হয়েছে ${added}, আপডেট ${updated}, বাদ ${errors.length}।`);
        errors.slice(0, 100).forEach((er) => { const li = document.createElement("li"); li.textContent = T("Line ", "লাইন ") + er.line + ": " + er.msg; list.appendChild(li); });
      } catch (err) {
        status.textContent = T("Import stopped: ", "ইমপোর্ট থেমে গেছে: ") + err.message;
      } finally { btn.disabled = false; }
    });
  });

  // ---------------------------------------------------------------- starter content
  document.querySelectorAll("[data-seed-run]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const status = btn.parentElement.querySelector("[data-seed-status]");
      btn.disabled = true;
      const steps = btn.dataset.steps.split(",");
      for (const step of steps) {
        status.textContent = T("Installing ", "যোগ হচ্ছে: ") + step + "…";
        const r = await api(`/admin/api/seed/${step}`, { method: "POST" });
        if (!r.ok) { status.textContent = T("Failed at ", "ব্যর্থ: ") + step + " — " + (r.error || ""); btn.disabled = false; return; }
      }
      status.textContent = T("Done. Reloading…", "সম্পন্ন। পাতা আবার লোড হচ্ছে…");
      setTimeout(() => location.reload(), 600);
    });
  });
})();
