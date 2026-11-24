// "Career jump" skateboard animation, drawn in the site's own line style (black strokes, dashed rails),
// so it sits naturally next to the existing hero animation.
//
// LICENSED VIDEO: the iStock clip (istockphoto.com/video/jump-with-a-skateboard-gm1221261992-357909283) is a
// paid stock asset and is NOT included. When you have the licensed file, upload it in
// Admin → Career Management → Hub settings → "Licensed skateboard video" (MP4 or WebM, ideally < 3 MB,
// no sound) plus a poster picture. The video then replaces the drawing below automatically.
// Until then this drawing is the placeholder.
import { html, raw } from "../lib/util.js";

// One skater: board on the ground at (0,0), facing right.
const SKATER = `<g class="sk-rider">
  <circle cx="3" cy="-63" r="7.5" class="sk-fill"/>
  <path d="M1 -55 L-2 -31" class="sk-line"/>
  <path d="M0 -49 L13 -42 L20 -46" class="sk-line"/><path d="M0 -49 L-12 -43 L-19 -46" class="sk-line"/>
  <path d="M-2 -31 L-11 -19 L-13 -9" class="sk-line"/><path d="M-2 -31 L8 -20 L11 -9" class="sk-line"/>
</g>
<g class="sk-board"><path d="M-24 -7 Q-26 -7 -27 -10 M27 -10 Q26 -7 24 -7 M-24 -7 H24" class="sk-line sk-deck"/>
  <circle cx="-14" cy="-2.5" r="3.2" class="sk-fill"/><circle cx="14" cy="-2.5" r="3.2" class="sk-fill"/></g>`;

// Builds CSS keyframes for riding along flat segments and jumping between them.
function keyframes(name, segs, apex) {
  const RIDE = 1, JUMP = 0.75, END = 0.6;
  const total = segs.reduce((t, s, i) => t + RIDE + (i < segs.length - 1 ? JUMP : 0), 0) + END;
  const move = [], board = [], rider = [];
  let t = 0;
  const pct = (x) => (x / total * 100).toFixed(2) + "%";
  const pos = (x, y, o = 1) => `transform: translate(${x.toFixed(1)}px, ${y.toFixed(1)}px); opacity: ${o}`;
  segs.forEach((s, i) => {
    move.push(`${pct(t)} { ${pos(s.x1, s.y, i === 0 ? 0 : 1)} }`);
    if (i === 0) move.push(`${pct(t + 0.08)} { ${pos(s.x1 + 6, s.y)} }`);
    board.push(`${pct(t)} { transform: rotate(0deg) }`);
    rider.push(`${pct(t)} { transform: scaleY(1) }`, `${pct(t + RIDE * 0.8)} { transform: scaleY(1) }`, `${pct(t + RIDE)} { transform: scaleY(.84) }`);
    t += RIDE;
    move.push(`${pct(t)} { ${pos(s.x2, s.y)} }`);
    const n = segs[i + 1];
    if (!n) return;
    const steps = 8;
    for (let k = 1; k <= steps; k++) {
      const f = k / steps;
      const x = s.x2 + (n.x1 - s.x2) * f;
      const y = s.y + (n.y - s.y) * f - apex * 4 * f * (1 - f);
      move.push(`${pct(t + JUMP * f)} { ${pos(x, y)} }`);
    }
    board.push(`${pct(t + JUMP * 0.25)} { transform: rotate(-16deg) }`, `${pct(t + JUMP * 0.6)} { transform: rotate(8deg) }`, `${pct(t + JUMP)} { transform: rotate(0deg) }`);
    rider.push(`${pct(t + JUMP * 0.3)} { transform: scaleY(1.04) }`, `${pct(t + JUMP)} { transform: scaleY(.9) }`, `${pct(t + JUMP + 0.12)} { transform: scaleY(1) }`);
    t += JUMP;
  });
  const last = segs[segs.length - 1];
  move.push(`${pct(t + END * 0.6)} { ${pos(last.x2 + 12, last.y, 0)} }`, `100% { ${pos(last.x2 + 12, last.y, 0)} }`);
  board.push("100% { transform: rotate(0deg) }");
  rider.push("100% { transform: scaleY(1) }");
  const dur = (total * 1.25).toFixed(2);
  return { css: `@keyframes ${name}-m { ${move.join(" ")} } @keyframes ${name}-b { ${board.join(" ")} } @keyframes ${name}-r { ${rider.join(" ")} }
.${name} .sk { animation: ${name}-m ${dur}s linear infinite; }
.${name} .sk-board { animation: ${name}-b ${dur}s linear infinite; }
.${name} .sk-rider { animation: ${name}-r ${dur}s linear infinite; }`, start: segs[0] };
}

function videoBlock(c, s, cls) {
  return html`<div class="skate-video-wrap ${cls}" aria-hidden="true"><video class="skate-video" muted loop playsinline preload="none" data-skate-video
    ${s.skate_poster_id ? raw(`poster="/media/${s.skate_poster_id}"`) : ""} data-src="/media/${s.skate_video_id}"></video></div>`;
}

// Career Hub hero: the skater jumps up the five career levels.
export function skateHub(c, s, levels) {
  if (s.skate_enabled === "0") return "";
  if (s.skate_video_id) return videoBlock(c, s, "skate-hub-video");
  const names = (levels.length ? levels : [{}, {}, {}, {}, {}]).slice(0, 5).map((l, i) => (l.title_en ? c.pick(l.title_en, l.title_bn) : c.L(["Entry", "Mid", "Manager", "Senior", "Executive"][i], ["এন্ট্রি", "মিড", "ম্যানেজার", "সিনিয়র", "এক্সিকিউটিভ"][i])));
  const n = names.length;
  const W = 960, stepW = 150, gap = (W - 60 - n * stepW) / Math.max(1, n - 1);
  const steps = names.map((name, i) => ({ x: 30 + i * (stepW + gap), y: 262 - i * 44, name }));
  const segs = steps.map((p) => ({ x1: p.x + 28, x2: p.x + 112, y: p.y }));
  const k = keyframes("skh", segs, 46);
  return html`<div class="skate-scene skate-hub skh" aria-hidden="true"><style>${raw(k.css)}</style>
  <svg viewBox="0 0 ${W} 300" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${steps.map((p, i) => html`<path d="M${p.x} ${p.y} H${p.x + stepW}" class="sk-step"/>
      ${i < n - 1 ? html`<path d="M${p.x + stepW} ${p.y} C ${p.x + stepW + gap * 0.6} ${p.y}, ${p.x + stepW + gap * 0.4} ${steps[i + 1].y}, ${steps[i + 1].x} ${steps[i + 1].y}" class="ha-rail"/>` : ""}
      <text x="${p.x + stepW / 2}" y="${p.y + 24}" text-anchor="middle" class="sk-label">${p.name}</text>`)}
    <g transform="translate(${steps[n - 1].x + stepW - 18} ${steps[n - 1].y})"><path d="M0 0 V-44" class="sk-line"/><path d="M0 -44 L22 -37 L0 -30 Z" class="sk-fill"/></g>
    <g class="sk" transform="translate(${k.start.x1} ${k.start.y})">${raw(SKATER)}</g>
  </svg></div>`;
}

// Home page: a compact strip under the existing hero animation — the skater clears three obstacles
// (skills, certification, experience) on the way to the next role, and links to the Career Hub.
export function skateHome(c, s) {
  if (s.skate_enabled === "0" || s.skate_home === "0") return "";
  if (s.skate_video_id) return html`<a class="skate-home-link" href="${c.p("/career")}">${videoBlock(c, s, "skate-home-video")}<span>${c.L("Ready for your next career jump? Open the Career Hub", "পরের ক্যারিয়ার জাম্পের জন্য প্রস্তুত? ক্যারিয়ার হাব খুলুন")} →</span></a>`;
  const y = 92;
  const obs = [[250, c.L("Skills", "দক্ষতা")], [490, c.L("Certification", "সার্টিফিকেশন")], [730, c.L("Experience", "অভিজ্ঞতা")]];
  const segs = [{ x1: 40, x2: 196 }, { x1: 306, x2: 436 }, { x1: 546, x2: 676 }, { x1: 786, x2: 880 }].map((x) => ({ ...x, y }));
  const k = keyframes("sko", segs, 52);
  return html`<a class="skate-home-link" href="${c.p("/career")}" aria-label="${c.L("Open the Career Hub", "ক্যারিয়ার হাব খুলুন")}">
  <div class="skate-scene skate-home sko" aria-hidden="true"><style>${raw(k.css)}</style>
  <svg viewBox="0 0 980 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 ${y} H960" class="ha-rail"/>
    ${obs.map(([x, label]) => html`<g><rect x="${x - 18}" y="${y - 16}" width="36" height="16" rx="4" class="sk-block"/><text x="${x}" y="${y + 22}" text-anchor="middle" class="sk-label">${label}</text></g>`)}
    <g transform="translate(925 ${y})"><path d="M0 0 V-46" class="sk-line"/><path d="M0 -46 L22 -39 L0 -32 Z" class="sk-fill"/><text x="0" y="22" text-anchor="middle" class="sk-label sk-strong">${c.L("Next role", "পরের পদ")}</text></g>
    <g class="sk" transform="translate(${k.start.x1} ${y})">${raw(SKATER)}</g>
  </svg></div>
  <span>${c.L("Ready for your next career jump? Open the Career Hub", "পরের ক্যারিয়ার জাম্পের জন্য প্রস্তুত? ক্যারিয়ার হাব খুলুন")} →</span></a>`;
}
