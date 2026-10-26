/* ProcureBest v5: welcome pop-up (once per visitor), typed slogan, blue "AI". No libraries. */
(function () {
  "use strict";

  // ------------------------------------------------------------ welcome pop-up
  const pop = document.querySelector("[data-welcome]");
  if (pop) {
    const key = "pb_welcome_" + (pop.dataset.key || "v1");
    let seen = false;
    try { seen = Boolean(localStorage.getItem(key)); } catch (e) { /* storage blocked */ }
    const onKey = (e) => { if (e.key === "Escape") close(); };
    function close() {
      pop.classList.remove("open");
      pop.hidden = true;
      document.removeEventListener("keydown", onKey);
    }
    if (!seen) {
      setTimeout(() => {
        if (document.querySelector('[data-modal="gate"].open')) return;
        try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* ignore */ }
        pop.hidden = false;
        pop.classList.add("open");
        document.addEventListener("keydown", onKey);
        const cta = pop.querySelector("[data-welcome-cta]");
        if (cta) cta.focus();
      }, 900);
    }
    pop.addEventListener("click", (e) => { if (e.target === pop || e.target.closest("[data-welcome-close]")) close(); });
  }

  // ------------------------------------------------------------ typed slogan: types, waits, erases, types again
  document.querySelectorAll("[data-typewriter]").forEach((el) => {
    const text = (el.dataset.typewriter || el.textContent || "").trim();
    if (!text || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    // Bengali letters are built from several characters, so type whole "grapheme" units
    const chars = window.Intl && Intl.Segmenter
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment)
      : Array.from(text);
    el.setAttribute("aria-label", text);
    el.classList.add("typewriter");
    el.textContent = "";
    const out = document.createElement("span");
    out.setAttribute("aria-hidden", "true");
    const caret = document.createElement("span");
    caret.className = "tw-caret";
    caret.setAttribute("aria-hidden", "true");
    el.append(out, caret);
    let i = 0, dir = 1;
    (function tick() {
      out.textContent = chars.slice(0, i).join("");
      let delay;
      if (dir > 0) { if (i < chars.length) { i++; delay = 70; } else { dir = -1; delay = 2200; } }
      else if (i > 0) { i--; delay = 32; }
      else { dir = 1; delay = 600; }
      setTimeout(tick, delay);
    })();
  });

  // ------------------------------------------------------------ the word "AI" (and এআই) in blue
  const FIND = /(\bAI\b|এআই|এ আই)/g;
  const EXACT = /^(AI|এআই|এ আই)$/;
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|SELECT|CODE|PRE|NOSCRIPT)$/;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentNode;
      if (!p || SKIP.test(p.nodeName) || (p.closest && p.closest(".ai-blue"))) return NodeFilter.FILTER_REJECT;
      FIND.lastIndex = 0;
      return FIND.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    const frag = document.createDocumentFragment();
    n.nodeValue.split(FIND).forEach((part) => {
      if (!part) return;
      if (EXACT.test(part)) {
        const s = document.createElement("span");
        s.className = "ai-blue";
        s.textContent = part;
        frag.appendChild(s);
      } else frag.appendChild(document.createTextNode(part));
    });
    n.parentNode.replaceChild(frag, n);
  });
})();
