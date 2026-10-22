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

  // ---------------------------------------------------------------- uploads
  document.querySelectorAll("[data-upload]").forEach((box) => {
    const input = box.querySelector("[data-upload-input]");
    const value = box.querySelector("[data-upload-value]");
    const nameEl = box.querySelector("[data-upload-name]");
    const status = box.querySelector("[data-upload-status]");
    const bar = box.querySelector("[data-upload-progress]");
    const form = box.closest("form");
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
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
      const r = await api(`/admin/api/files/${init.id}/chunk/${i}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: part });
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
      const file = input.files && input.files[0];
      if (!file || !area) return;
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
