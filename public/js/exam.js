/* Timed MCQ attempt: navigation, autosave to the server, countdown, auto-submit. */
(function () {
  "use strict";
  const root = document.querySelector("[data-exam]");
  if (!root) return;
  const L = JSON.parse(document.getElementById("exam-i18n").textContent);
  const id = root.dataset.attempt;
  const lang = root.dataset.lang;
  const cards = Array.from(root.querySelectorAll("[data-q]"));
  const navBtns = Array.from(root.querySelectorAll("[data-goto]"));
  const timerEl = document.querySelector("[data-timer]");
  const progress = document.querySelector("[data-progress]");
  const answeredEl = root.querySelector("[data-answered]");
  const status = root.querySelector("[data-save-status]");
  const submitBtn = root.querySelector("[data-submit]");
  let current = 0;
  let deadline = Date.now() + parseInt(root.dataset.seconds, 10) * 1000;
  let submitting = false;
  const digits = (s) => (lang === "bn" ? String(s).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]) : String(s));

  function show(i) {
    current = Math.max(0, Math.min(cards.length - 1, i));
    cards.forEach((c, k) => { c.hidden = k !== current; });
    navBtns.forEach((b, k) => b.classList.toggle("current", k === current));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refresh() {
    let n = 0;
    cards.forEach((c, k) => {
      const done = !!c.querySelector("input:checked");
      navBtns[k].classList.toggle("answered", done);
      if (done) n++;
    });
    answeredEl.textContent = digits(n);
    progress.style.width = (n / cards.length * 100).toFixed(1) + "%";
    return n;
  }

  async function save(qid, choice) {
    status.textContent = "…";
    try {
      const body = await window.PB.post(`/api/exams/attempt/${id}/answer`, { question_id: qid, choice });
      if (body.ok) {
        status.textContent = L.saved;
        if (typeof body.seconds_left === "number") deadline = Date.now() + body.seconds_left * 1000;
      } else if (body.closed) { status.textContent = L.closed; submit(true); }
      else status.textContent = L.save_failed;
    } catch (e) { status.textContent = L.save_failed; }
  }

  async function submit(auto) {
    if (submitting) return;
    submitting = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spin"></span>';
    for (let tries = 0; tries < 4; tries++) {
      try {
        const body = await window.PB.post(`/api/exams/attempt/${id}/submit`, { auto: !!auto, lang });
        if (body.ok && body.redirect) { window.location.href = body.redirect; return; }
      } catch (e) { /* retry */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
    submitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = L.save_failed;
  }

  root.addEventListener("change", (e) => {
    const input = e.target;
    if (input.type !== "radio") return;
    save(parseInt(input.closest("[data-q]").dataset.q, 10), parseInt(input.value, 10));
    refresh();
  });
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-next]")) show(current + 1);
    else if (e.target.closest("[data-prev]")) show(current - 1);
    else if (e.target.closest("[data-goto]")) show(parseInt(e.target.closest("[data-goto]").dataset.goto, 10));
    else if (e.target.closest("[data-open-submit]")) { submitBtn.scrollIntoView({ behavior: "smooth", block: "center" }); submitBtn.focus(); }
    else if (e.target.closest("[data-clear-answer]")) {
      const card = cards[current];
      card.querySelectorAll("input:checked").forEach((i) => { i.checked = false; });
      save(parseInt(card.dataset.q, 10), null);
      refresh();
    } else if (e.target.closest("[data-submit]")) {
      const n = refresh();
      const msg = n < cards.length ? L.unanswered.replace("{n}", digits(cards.length - n)) + "\n\n" + L.confirm : L.confirm;
      if (window.confirm(msg)) submit(false);
    }
  });

  function tick() {
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    const m = Math.floor(left / 60), s = left % 60;
    timerEl.textContent = digits(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    timerEl.classList.toggle("low", left <= 120);
    if (left <= 0) { submit(true); return; }
    setTimeout(tick, 1000);
  }

  window.addEventListener("beforeunload", (e) => { if (!submitting) { e.preventDefault(); e.returnValue = ""; } });
  refresh();
  show(0);
  tick();
})();
