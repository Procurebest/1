// Public site layout — the same header, footer and design as the original ProcureBest.
import { html, raw, jsonScript } from "../lib/util.js";
import { icon } from "./icons.js";
import { whatsapp } from "../lib/settings.js";

export const ASSET_V = "3";
const asset = (p) => `${p}?v=${ASSET_V}`;

const NAV = [
  ["/calculators", "nav.calculators"],
  ["/exams", "nav.exams"],
  ["/library", "nav.library"],
  ["/blog", "nav.blog"],
  ["/glossary", "nav.glossary"],
  ["/career", "nav.career"],
];

function langSwitchUrl(c, lang) {
  const parts = c.url.pathname.split("/");
  if (parts[1] === "en" || parts[1] === "bn") parts[1] = lang;
  else return `/${lang}/`;
  return parts.join("/") + (c.url.search || "");
}

export async function layout(c, { title, description, body, pageType = "page", noindex = false, scripts = [], head = "", alternates = true, gate = false }) {
  const s = await c.settings();
  const v = await c.visitor();
  const lang = c.lang;
  const pageTitle = title ? `${title} — ProcureBest` : (lang === "bn" ? "ProcureBest — প্রকিউরমেন্ট ক্যালকুলেটর, পরীক্ষা ও লাইব্রেরি" : "ProcureBest — Procurement calculators, exams and library");
  const desc = description || s["seo_description_" + lang];
  const here = c.url.pathname;
  const enUrl = c.siteUrl + langSwitchUrl(c, "en").split("?")[0];
  const bnUrl = c.siteUrl + langSwitchUrl(c, "bn").split("?")[0];
  const navLink = ([p, key]) => {
    const href = c.p(p);
    const on = here === href || here.startsWith(href + "/");
    return html`<li><a href="${href}" ${on ? raw('aria-current="page"') : ""}>${c.t(key)}</a></li>`;
  };
  const wa = whatsapp(s, lang);
  const gateCfg = { lang, email: v ? v.email : null, verified: v ? v.verified : false };
  return html`<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${pageTitle}</title>
  <meta name="description" content="${desc}">
  ${noindex ? raw('<meta name="robots" content="noindex, nofollow">') : ""}
  ${alternates && !noindex ? html`<link rel="canonical" href="${lang === "bn" ? bnUrl : enUrl}">
  <link rel="alternate" hreflang="en" href="${enUrl}">
  <link rel="alternate" hreflang="bn" href="${bnUrl}">
  <link rel="alternate" hreflang="x-default" href="${enUrl}">` : ""}
  <meta property="og:site_name" content="ProcureBest">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="${pageType === "article" ? "article" : "website"}">
  <meta property="og:locale" content="${lang === "bn" ? "bn_BD" : "en_US"}">
  <meta property="og:image" content="${c.siteUrl}/img/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/img/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
  <meta name="theme-color" content="#ffffff">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="${asset("/css/app.css")}">
  ${pageType === "home" ? html`<script type="application/ld+json">${jsonScript({ "@context": "https://schema.org", "@type": "WebSite", name: "ProcureBest", url: c.siteUrl, inLanguage: lang })}</script>` : ""}
  ${head}
</head>
<body>
<a class="skip" href="#main">${c.t("nav.skip")}</a>
<header class="nav" role="banner">
  <div class="wrap">
    <a class="brand" href="${c.p("/")}" aria-label="ProcureBest — ${c.t("nav.home")}"><img src="/img/logo.svg" alt="ProcureBest" width="138" height="24"></a>
    <ul class="nav-links">${NAV.map(navLink)}</ul>
    <div class="nav-tools">
      <div class="lang-switch" role="group" aria-label="${c.t("nav.language")}">
        <a href="${langSwitchUrl(c, "en")}" class="${lang === "en" ? "on" : ""}" hreflang="en" lang="en">EN</a>
        <a href="${langSwitchUrl(c, "bn")}" class="${lang === "bn" ? "on" : ""}" hreflang="bn" lang="bn">বাংলা</a>
      </div>
      <a class="nav-icon" href="${c.p("/my")}" title="${c.t("nav.my")}" aria-label="${c.t("nav.my")}">${icon("user", 19)}</a>
      <button class="nav-icon menu-btn" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle aria-label="${c.t("nav.menu")}">${icon("menu", 20)}</button>
    </div>
  </div>
</header>
<nav class="mobile-menu" id="mobile-menu" aria-label="${c.t("nav.menu")}">
  <a href="${c.p("/")}">${c.t("nav.home")}</a>
  ${NAV.map(([p, key]) => html`<a href="${c.p(p)}">${c.t(key)}</a>`)}
  <a href="${c.p("/my")}">${c.t("nav.my")}</a>
  <div class="lang-switch" role="group" aria-label="${c.t("nav.language")}">
    <a href="${langSwitchUrl(c, "en")}" class="${lang === "en" ? "on" : ""}" lang="en">English</a>
    <a href="${langSwitchUrl(c, "bn")}" class="${lang === "bn" ? "on" : ""}" lang="bn">বাংলা</a>
  </div>
</nav>

<main id="main">
${body}
</main>

<footer class="footer" role="contentinfo">
  <div class="wrap">
    <div class="cols">
      <div>
        <img src="/img/logo.svg" alt="ProcureBest" width="138" height="24" style="height:24px;width:auto">
        <p style="margin-top:14px;max-width:340px">${s["tagline_" + lang]} ${c.t("footer.about_line")}</p>
        ${wa.enabled && wa.configured ? html`<a class="btn wa-btn btn-sm" style="margin-top:6px" href="${wa.url}" target="_blank" rel="noopener noreferrer"><span style="color:#25d366;display:inline-flex">${icon("chat", 16)}</span> ${wa.label}</a>` : ""}
      </div>
      <div>
        <h4>${c.t("footer.tools")}</h4>
        <ul>
          <li><a href="${c.p("/calculators/total-cost-of-ownership")}">${c.L("TCO calculator", "টিসিও ক্যালকুলেটর")}</a></li>
          <li><a href="${c.p("/calculators/shipping-import-cost")}">${c.L("Shipping & import cost", "শিপিং ও আমদানি খরচ")}</a></li>
          <li><a href="${c.p("/calculators/comparative-statement")}">${c.L("Comparative statement", "তুলনামূলক বিবরণী (CS)")}</a></li>
          <li><a href="${c.p("/library")}">${c.t("nav.library")}</a></li>
        </ul>
      </div>
      <div>
        <h4>${c.t("footer.learn")}</h4>
        <ul>
          <li><a href="${c.p("/exams")}">${c.t("nav.exams")}</a></li>
          <li><a href="${c.p("/certificates/verify")}">${c.t("footer.verify_cert")}</a></li>
          <li><a href="${c.p("/blog")}">${c.t("nav.blog")}</a></li>
          <li><a href="${c.p("/glossary")}">${c.t("nav.glossary")}</a></li>
          <li><a href="${c.p("/career")}">${c.t("nav.career")}</a></li>
        </ul>
      </div>
      <div>
        <h4>${c.t("footer.company")}</h4>
        <ul>
          <li><a href="${c.p("/about")}">${c.t("nav.about")}</a></li>
          <li><a href="${c.p("/contact")}">${c.t("footer.contact")}</a></li>
          <li><a href="${c.p("/help")}">${c.t("footer.help")}</a></li>
          <li><a href="${c.p("/privacy")}">${c.t("footer.privacy")}</a></li>
          <li><a href="${c.p("/terms")}">${c.t("footer.terms")}</a></li>
          <li><a href="${c.p("/disclaimer")}">${c.t("footer.disclaimer")}</a></li>
        </ul>
      </div>
    </div>
    <div class="legal">
      <span>${c.t("footer.copyright", { year: c.d(new Date().getUTCFullYear()) })}</span>
      <span>${c.t("footer.estimate_note")}</span>
    </div>
  </div>
</footer>
${gate ? gateModal(c, s) : ""}
<script type="application/json" id="pb-config">${jsonScript(gateCfg)}</script>
<script src="${asset("/js/app.js")}" defer></script>
${scripts.map((src) => src.endsWith(".mjs") || src.includes("/calc/") ? html`<script type="module" src="${asset(src)}"></script>` : html`<script src="${asset(src)}" defer></script>`)}
</body>
</html>`;
}

// The one-time email confirmation dialog used by downloads, exams and orders.
export function gateModal(c, s) {
  return html`
<div class="modal-backdrop" data-modal="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title" hidden>
  <div class="modal">
    <div class="row between" style="margin-bottom:6px">
      <h3 id="gate-title" style="margin:0">${c.t("gate.title")}</h3>
      <button type="button" class="icon-btn" data-modal-close aria-label="${c.t("common.close")}">${icon("x", 20)}</button>
    </div>
    <form data-gate-form novalidate>
      <p class="small muted">${c.t("gate.lead")}</p>
      <div class="field full" style="margin-top:16px">
        <label for="gate-email">${c.t("form.email")}</label>
        <input id="gate-email" type="email" name="email" autocomplete="email" required placeholder="${c.t("form.email_placeholder")}">
      </div>
      <label class="check" style="margin-top:14px"><input type="checkbox" name="consent" value="1"> <span class="small">${c.t("gate.consent")}</span></label>
      <label class="check" style="margin-top:10px"><input type="checkbox" name="subscribe" value="1"> <span class="small">${c.t("gate.subscribe")}</span></label>
      <div class="alert" data-gate-msg hidden style="margin-top:16px"></div>
      <div class="form-actions" style="margin-top:20px">
        <button type="submit" class="btn btn-primary" data-gate-submit>${c.t("gate.send")}</button>
        <button type="button" class="btn btn-ghost" data-modal-close>${c.t("common.close")}</button>
      </div>
      <p class="tiny muted" style="margin-top:14px">${c.t("gate.privacy")} <a href="${c.p("/privacy")}">${c.t("footer.privacy")}</a></p>
    </form>
  </div>
</div>`;
}

export function pageHead(c, { title, lead, crumbs = [], extra = "", narrow = false }) {
  return html`<section class="page-head">
  <div class="wrap ${narrow ? "wrap-narrow" : ""}">
    ${crumbs.length ? html`<nav class="crumbs" aria-label="${c.t("common.breadcrumb")}">${crumbs.map(([label, href], i) => html`${i ? html`<span>/</span>` : ""}${href ? html`<a href="${href}">${label}</a>` : html`<span>${label}</span>`}`)}</nav>` : ""}
    <h1>${title}</h1>
    ${lead ? html`<p class="lead">${lead}</p>` : ""}
    ${extra}
  </div>
</section>`;
}

export function waButton(c, s, cls = "") {
  const wa = whatsapp(s, c.lang);
  if (!wa.enabled || !wa.configured) return "";
  return html`<a class="btn wa-btn ${cls}" href="${wa.url}" target="_blank" rel="noopener noreferrer" data-wa-link><span style="color:#25d366;display:inline-flex">${icon("chat", 18)}</span> ${wa.label}</a>`;
}

export function errorPage(c, status, title, text) {
  return layout(c, {
    title, noindex: true, alternates: false,
    body: html`<section class="section"><div class="wrap wrap-narrow center">
      <p class="eyebrow">${c.d(status)}</p><h1 style="font-size:44px">${title}</h1><p class="lead">${text}</p>
      <div class="row" style="justify-content:center;margin-top:24px"><a class="btn btn-primary" href="${c.p("/")}">${c.t("error.go_home")}</a>
      <a class="btn btn-secondary" href="${c.p("/calculators")}">${c.t("nav.calculators")}</a></div></div></section>`,
  });
}
