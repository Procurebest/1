// Career progression strip on the Career Home. The server renders the text (see progressionStrip in
// src/routes/career.js); this file only moves the highlight. It pauses on hover or focus, when the
// strip is off-screen, and never auto-plays for visitors who prefer reduced motion.
const root = document.querySelector("[data-pj]");
const dataEl = document.getElementById("pj-data");

if (root && dataEl) {
  const stages = JSON.parse(dataEl.textContent).stages;
  const n = stages.length;
  const steps = [...root.querySelectorAll("[data-pj-step]")];
  const fill = root.querySelector("[data-pj-fill]");
  const role = root.querySelector("[data-pj-role]");
  const years = root.querySelector("[data-pj-years]");
  const desc = root.querySelector("[data-pj-desc]");
  const next = root.querySelector("[data-pj-next]");
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INTERVAL = 3200;
  let idx = 0;
  let timer = null;

  function show(k) {
    idx = k;
    steps.forEach((el, i) => {
      el.classList.toggle("is-active", i === k);
      el.classList.toggle("is-done", i < k);
    });
    fill.style.width = `${(k / (n - 1)) * 100}%`;
    const s = stages[k];
    role.textContent = s.title;
    years.textContent = s.years;
    desc.textContent = s.desc;
    next.textContent = s.next;
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  function start() {
    if (reduced || timer || n < 2) return;
    timer = setInterval(() => show((idx + 1) % n), INTERVAL);
  }

  steps.forEach((el, i) => {
    el.addEventListener("click", () => {
      stop();
      show(i);
      start();
    });
  });

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", start);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(root);
  } else {
    start();
  }
}
