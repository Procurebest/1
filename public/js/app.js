/* ProcureBest — shared front-end behaviour (no external libraries).
   Mobile menu, search filters, the one-time email gate, library downloads and orders. */
(function () {
  "use strict";
  const cfg = JSON.parse((document.getElementById("pb-config") || {}).textContent || "{}");
  const lang = cfg.lang || document.documentElement.lang || "en";
  const T = (en, bn) => (lang === "bn" ? bn : en);

  async function post(url, data) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PB": "1", Accept: "application/json" },
      body: JSON.stringify(data || {}),
      credentials: "same-origin",
    });
    let body = {};
    try { body = await res.json(); } catch (e) { body = { ok: false }; }
    body.httpStatus = res.status;
    return body;
  }

  async function me() {
    try {
      const res = await fetch("/api/me", { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
      return await res.json();
    } catch (e) { return { ok: false }; }
  }

  // ------------------------------------------------------------ email gate
  const modal = document.querySelector('[data-modal="gate"]');
  let pending = null; // {resolve}
  let pendingEmail = "";
  let pollTimer = null;

  function closeGate(result) {
    if (!modal) return;
    modal.classList.remove("open");
    modal.hidden = true;
    clearInterval(pollTimer);
    if (pending) { const p = pending; pending = null; p.resolve(result); }
  }

  function openGate() {
    return new Promise((resolve) => {
      if (!modal) { resolve(false); return; }
      pending = { resolve };
      const form = modal.querySelector("[data-gate-form]");
      const msg = modal.querySelector("[data-gate-msg]");
      msg.hidden = true;
      const cf = modal.querySelector("[data-code-form]");
      if (cf) { cf.hidden = true; cf.reset(); cf.querySelector("[data-code-msg]").hidden = true; }
      form.querySelector("[data-gate-submit]").hidden = false;
      form.querySelector(".form-actions").hidden = false;
      form.querySelector("[data-gate-submit]").disabled = false;
      modal.hidden = false;
      modal.classList.add("open");
      setTimeout(() => form.querySelector('input[name="email"]').focus(), 30);
    });
  }

  function startPolling() {
    clearInterval(pollTimer);
    const started = Date.now();
    pollTimer = setInterval(async () => {
      if (Date.now() - started > 30 * 60 * 1000) { clearInterval(pollTimer); return; }
      const m = await me();
      if (m.ok) { cfg.email = m.email; closeGate(true); }
    }, 3000);
  }
  window.addEventListener("storage", async (e) => {
    if (e.key === "pb_verified" && pending) { const m = await me(); if (m.ok) { cfg.email = m.email; closeGate(true); } }
  });

  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-modal-close]")) closeGate(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) closeGate(false); });
    const form = modal.querySelector("[data-gate-form]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector("[data-gate-submit]");
      const msg = modal.querySelector("[data-gate-msg]");
      btn.disabled = true;
      const label = btn.textContent;
      btn.innerHTML = '<span class="spin"></span> ' + T("Sending…", "পাঠানো হচ্ছে…");
      const body = await post("/api/verify/start", {
        email: (fd.get("email") || "").trim(), consent: !!fd.get("consent"), subscribe: !!fd.get("subscribe"),
        lang, next: location.pathname + location.search,
      }).catch(() => ({ ok: false, error: T("Connection problem. Check your internet and try again.", "সংযোগে সমস্যা। ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।") }));
      btn.disabled = false;
      btn.textContent = label;
      msg.hidden = false;
      msg.className = "alert " + (body.ok ? "alert-ok" : "alert-err");
      msg.textContent = body.message || body.error || T("Something went wrong. Please try again.", "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      if (body.ok && body.status === "collected") { cfg.email = body.email; setTimeout(() => closeGate(true), 600); }
      if (body.ok && body.status === "sent") {
        btn.hidden = true;
        form.querySelector(".form-actions").hidden = true;
        pendingEmail = (fd.get("email") || "").trim();
        const cf = modal.querySelector("[data-code-form]");
        cf.hidden = false;
        setTimeout(() => cf.querySelector("input").focus(), 30);
        startPolling();
      }
    });
  }

  // Resolves true once this browser has a usable email (already confirmed, or just confirmed).
  if (modal) {
    const cf = modal.querySelector("[data-code-form]");
    cf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = (cf.querySelector("input").value || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/\D/g, "");
      const err = cf.querySelector("[data-code-msg]");
      const b = cf.querySelector('button[type="submit"]');
      b.disabled = true;
      const r = await post("/api/verify/code", { email: pendingEmail, code, lang }).catch(() => ({ ok: false }));
      b.disabled = false;
      if (r.ok) { cfg.email = r.email; try { localStorage.setItem("pb_verified", String(Date.now())); } catch (x) { /* ignore */ } closeGate(true); return; }
      err.hidden = false;
      err.textContent = r.error || T("Something went wrong. Please try again.", "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    });
  }

  async function requireEmail() {
    const m = await me();
    if (m.ok) { cfg.email = m.email; return true; }
    if (m.email && modal) { const input = modal.querySelector('input[name="email"]'); if (input) input.value = m.email; }
    return openGate();
  }

  window.PB = { post, me, requireEmail, lang };

  // ------------------------------------------------------------ mobile menu
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.getElementById("mobile-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("open")) toggle.click(); });
  }

  // ------------------------------------------------------------ searchable lists
  document.querySelectorAll("[data-directory]").forEach((dir) => {
    const input = dir.querySelector("[data-dir-search]");
    const chips = dir.querySelectorAll("[data-dir-cat]");
    const items = dir.querySelectorAll("[data-search]");
    const empty = dir.querySelector("[data-dir-empty]");
    let cat = (dir.querySelector("[data-dir-cat].on") || {}).dataset ? (dir.querySelector("[data-dir-cat].on") || { dataset: {} }).dataset.dirCat || "" : "";
    const norm = (t) => String(t || "").toLowerCase().normalize("NFC").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d)).replace(/\s+/g, " ").trim();
    const baseText = empty ? empty.textContent : "";
    let clearBtn = null;
    if (empty && input) {
      clearBtn = document.createElement("button");
      clearBtn.type = "button"; clearBtn.className = "btn btn-ghost btn-sm"; clearBtn.style.marginTop = "14px";
      clearBtn.textContent = T("Clear search", "খোঁজা মুছুন");
      clearBtn.addEventListener("click", () => { input.value = ""; cat = ""; chips.forEach((c) => c.classList.toggle("on", !c.dataset.dirCat)); apply(); input.focus(); });
    }
    const apply = () => {
      const words = norm(input ? input.value : "").split(" ").filter(Boolean);
      let shown = 0;
      items.forEach((el) => {
        const hay = norm(el.dataset.search);
        const ok = words.every((w) => hay.includes(w)) && (!cat || el.dataset.cat === cat);
        el.hidden = !ok;
        if (ok) shown++;
      });
      dir.querySelectorAll("[data-letter-group]").forEach((g) => { g.hidden = !g.querySelector("[data-search]:not([hidden])"); });
      if (empty) {
        empty.hidden = shown !== 0;
        if (shown === 0) {
          const q = input ? input.value.trim() : "";
          empty.textContent = q ? `${baseText} (“${q}”)` : baseText;
          if (clearBtn) { empty.appendChild(document.createElement("br")); empty.appendChild(clearBtn); }
        }
      }
    };
    if (input) input.addEventListener("input", apply);
    chips.forEach((chip) => chip.addEventListener("click", (e) => {
      if (chip.tagName === "A") return;
      e.preventDefault();
      chips.forEach((c) => c.classList.remove("on"));
      chip.classList.add("on");
      cat = chip.dataset.dirCat;
      apply();
    }));
    if ((input && input.value) || cat) apply();
  });

  // ------------------------------------------------------------ library downloads
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-download]");
    if (!btn) return;
    e.preventDefault();
    const ok = await requireEmail();
    if (!ok) return;
    const status = btn.parentElement.querySelector("[data-dl-status]");
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> ' + T("Preparing…", "প্রস্তুত হচ্ছে…");
    const body = await post(`/api/library/${encodeURIComponent(btn.dataset.download)}/link`, { lang });
    btn.disabled = false;
    btn.innerHTML = label;
    if (body.ok && body.url) {
      window.location.href = body.url;
      if (status) { status.hidden = false; status.className = "alert alert-ok"; status.textContent = body.message || T("Your download has started.", "ডাউনলোড শুরু হয়েছে।"); }
    } else if (body.buy) {
      window.location.href = body.buy;
    } else if (status) {
      status.hidden = false; status.className = "alert alert-err"; status.textContent = body.error || T("Something went wrong. Please try again.", "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  });

  // ------------------------------------------------------------ JSON forms (orders, exam start, contact)
  document.querySelectorAll("form[data-json-form]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector("[data-form-msg]");
      if (form.hasAttribute("data-needs-email")) {
        const ok = await requireEmail();
        if (!ok) { if (msg) { msg.hidden = false; msg.className = "alert alert-warn"; msg.textContent = cfg.closedNote || T("Confirm your email first — then press the button again.", "আগে ইমেইল নিশ্চিত করুন — তারপর আবার বাটন চাপুন।"); } return; }
      }
      const btn = form.querySelector('button[type="submit"]');
      const data = {};
      new FormData(form).forEach((v, k) => { data[k] = typeof v === "string" ? v.trim() : v; });
      data.lang = lang;
      form.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
      btn.disabled = true;
      const label = btn.innerHTML;
      btn.innerHTML = '<span class="spin"></span> ' + T("Working…", "কাজ চলছে…");
      const body = await post(form.getAttribute("action"), data).catch(() => ({ ok: false, error: T("Connection problem. Check your internet and try again.", "সংযোগে সমস্যা। ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।") }));
      btn.disabled = false;
      btn.innerHTML = label;
      if (body.ok && body.redirect) { window.location.href = body.redirect; return; }
      if (body.need_email) {
        cfg.email = null;
        const ok = await openGate();
        if (ok) form.requestSubmit();
        else if (msg) { msg.hidden = false; msg.className = "alert alert-warn"; msg.textContent = cfg.closedNote || ""; }
        return;
      }
      if (msg) {
        msg.hidden = false;
        msg.className = "alert " + (body.ok ? "alert-ok" : "alert-err");
        msg.textContent = body.message || body.error || T("Something went wrong. Please try again.", "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        msg.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (body.field) { const f = form.querySelector(`[name="${body.field}"]`); if (f) { f.closest(".field") && f.closest(".field").classList.add("invalid"); f.focus(); } }
      if (body.ok && form.hasAttribute("data-reset-on-ok")) form.reset();
      if (body.ok && form.hasAttribute("data-hide-on-ok")) form.querySelectorAll(".form-grid, .form-actions, [data-hide]").forEach((el) => { el.hidden = true; });
    });
  });

  // Newsletter: one click. If this browser has no email yet, a small email box appears.
  async function subscribe(b, email) {
    const body = await post("/api/subscribe", email ? { email, lang } : { lang }).catch(() => ({ ok: false }));
    if (body.ok) {
      b.textContent = b.dataset.done || "✓"; b.disabled = true; b.hidden = false;
      const f = b.parentElement.querySelector(".sub-inline"); if (f) f.remove();
      cfg.email = body.email || cfg.email;
      return true;
    }
    return body;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-subscribe]");
    if (!b) return;
    const r = await subscribe(b);
    if (r === true || !r.ask_email) return;
    if (b.parentElement.querySelector(".sub-inline")) return;
    const f = document.createElement("form");
    f.className = "sub-inline"; f.noValidate = true;
    f.innerHTML = `<input type="email" required autocomplete="email" placeholder="${T("Your email", "আপনার ইমেইল")}" aria-label="${T("Your email", "আপনার ইমেইল")}">
      <button class="btn btn-primary" type="submit">${b.textContent.trim()}</button><span class="err-text" hidden></span>`;
    b.hidden = true;
    b.insertAdjacentElement("afterend", f);
    const input = f.querySelector("input");
    input.focus();
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const err = f.querySelector(".err-text");
      const res = await subscribe(b, input.value.trim());
      if (res !== true) { err.hidden = false; err.textContent = res.error || T("Enter a valid email address.", "একটি সঠিক ইমেইল ঠিকানা লিখুন।"); input.focus(); }
    });
  });

  // "Use a different email"
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-forget-email]");
    if (!b) return;
    e.preventDefault();
    await post("/api/forget-email", {});
    location.reload();
  });

  // Show / hide a section (e.g. the review form)
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-toggle-target]");
    if (!b) return;
    const el = document.getElementById(b.dataset.toggleTarget);
    if (!el) return;
    el.hidden = !el.hidden;
    if (!el.hidden) { const f = el.querySelector("input, textarea"); if (f) f.focus(); }
  });

  // Share: native share sheet on phones, otherwise copy the link
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-share-copy]");
    if (!b) return;
    const box = b.closest("[data-share]");
    const url = box.dataset.url, text = box.dataset.text;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { try { await navigator.share({ title: text, text, url }); return; } catch (x) { /* cancelled */ } }
    try { await navigator.clipboard.writeText(url); } catch (x) { window.prompt("", url); return; }
    const old = b.textContent; b.textContent = "✓ " + (b.dataset.done || ""); setTimeout(() => { b.textContent = old; }, 2200);
  });

  // Print buttons and confirmation prompts
  document.addEventListener("click", (e) => { if (e.target.closest("[data-print]")) window.print(); });
  document.addEventListener("submit", (e) => {
    const m = e.target.getAttribute && e.target.getAttribute("data-confirm");
    if (m && !window.confirm(m)) e.preventDefault();
  });
})();
