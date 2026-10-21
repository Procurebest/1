// Calculator page: renders the form from its definition, validates input,
// calculates in the browser, shows results and exports Excel / PDF reports.
import { BY_SLUG, tr, CalcError, CS_SUPPLIER_FIELDS, CS_ITEM_FIELDS } from "./defs.js";
import { formatNumber, formatMoney, formatPercent, formatDate, parseNumber, digits } from "../fmt.js";
import { buildXlsx } from "./xlsx.js";

const root = document.querySelector("[data-calc]");
const def = root && BY_SLUG[root.dataset.slug];

function init() {
  const lang = document.documentElement.lang === "bn" ? "bn" : "en";
  const T = JSON.parse(document.getElementById("calc-i18n").textContent);
  const formBox = root.querySelector("[data-form]");
  const resultBox = root.querySelector("[data-result]");
  const formError = root.querySelector("[data-form-error]");
  const t = (k) => T[k] || k;
  const L = (o) => tr(o, lang);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dg = (n) => digits(n, lang);
  const storeKey = "pb_calc_" + def.slug;

  // ------------------------------------------------------------ state
  const blank = (fields) => Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""]));
  function defaults() {
    const s = blank(def.fields);
    for (const g of def.groups || []) s[g.key] = Array.from({ length: g.defaultCount || g.min }, () => blank(g.fields));
    if (def.custom === "cs") {
      s.suppliers = Array.from({ length: def.suppliers.defaultCount }, () => blank(CS_SUPPLIER_FIELDS));
      s.items = Array.from({ length: def.items.defaultCount }, () => ({ ...blank(CS_ITEM_FIELDS), prices: s.suppliers.map(() => "") }));
    }
    return s;
  }
  function exampleState() {
    const s = { ...defaults(), ...JSON.parse(JSON.stringify(def.example)) };
    if (def.custom === "cs") s.items.forEach((it) => { it.prices = it.prices.map((p) => (p === null ? "" : p)); });
    return s;
  }
  let state;
  let loadedExample = false, hadSaved = false;
  const params = new URLSearchParams(location.search);
  if (params.has("example")) { state = exampleState(); loadedExample = true; }
  else {
    try { const saved = JSON.parse(localStorage.getItem(storeKey) || "null"); if (saved && typeof saved === "object") { state = { ...defaults(), ...saved }; hadSaved = true; } } catch { /* storage unavailable */ }
    if (!state) state = defaults();
  }

  // ------------------------------------------------------------ rendering inputs
  const inputVal = (v, f) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number" && f && f.type !== "text") return lang === "bn" ? dg(v) : String(v);
    return String(v);
  };
  function fieldHtml(f, value, path, attrs = "") {
    const w = f.width === "full" ? "full" : f.width === "third" ? "third" : "";
    const show = f.showIf ? ` data-show-if='${esc(JSON.stringify(f.showIf))}'` : "";
    const id = "i-" + path.replace(/\./g, "-");
    let control;
    if (f.type === "checkbox") {
      return `<div class="field ${w}" data-path="${esc(path)}"${show}><span class="label" aria-hidden="true">&nbsp;</span>
        <label class="check"><input type="checkbox" data-key="${f.key}" ${attrs} ${value === true || value === "true" ? "checked" : ""}><span>${esc(L(f.label))}</span></label>
        <span class="err-text" data-err hidden></span></div>`;
    }
    if (f.type === "select") {
      control = `<select id="${id}" data-key="${f.key}" ${attrs}>${f.required === false ? '<option value="">—</option>' : ""}${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(value) === String(ov) ? "selected" : ""}>${esc(L(ol))}</option>`).join("")}</select>`;
    } else if (f.type === "text") {
      control = `<input id="${id}" type="text" data-key="${f.key}" ${attrs} value="${esc(value ?? "")}" maxlength="${f.maxlength || 120}" autocomplete="off">`;
    } else {
      control = `<div class="${f.type === "percent" ? "input-unit" : ""}"><input id="${id}" type="text" inputmode="${f.type === "integer" ? "numeric" : "decimal"}" data-key="${f.key}" ${attrs} value="${esc(inputVal(value, f))}" autocomplete="off">${f.type === "percent" ? "<span>%</span>" : ""}</div>`;
    }
    const opt = f.required === false && f.type === "text" ? ` <span class="muted small">(${esc(t("optional"))})</span>` : "";
    return `<div class="field ${w}" data-path="${esc(path)}"${show}><label for="${id}">${esc(L(f.label))}${opt}</label>${control}
      ${f.help ? `<span class="help">${esc(L(f.help))}</span>` : ""}<span class="err-text" data-err hidden></span></div>`;
  }

  function groupHtml(g) {
    const items = state[g.key] || [];
    return `<div class="group" data-group="${g.key}" data-path="${g.key}">
      <div class="row between" style="margin:8px 0 14px"><h3 style="font-size:17px;margin:0">${esc(L(g.label))}</h3>
        <span class="small muted">${esc(t("rows_limit").replace("{min}", dg(g.min)).replace("{max}", dg(g.max)))}</span></div>
      <span class="err-text" data-err hidden></span>
      <div data-items>${items.map((item, i) => `<div class="group-item" data-item>
        <div class="group-item-head"><strong>${esc(L(g.itemLabel))} ${dg(i + 1)}</strong>
          <button type="button" class="icon-btn" data-remove="${g.key}" data-index="${i}" ${items.length <= g.min ? "disabled" : ""}>${ICON_TRASH} ${esc(t("remove"))}</button></div>
        <div class="form-grid">${g.fields.map((f) => fieldHtml(f, item[f.key], `${g.key}.${i}.${f.key}`)).join("")}</div></div>`).join("")}</div>
      <button type="button" class="btn btn-ghost btn-sm" data-add="${g.key}" ${items.length >= g.max ? "disabled" : ""}>${ICON_PLUS} ${esc(t("add_row").replace("{item}", L(g.itemLabel)))}</button>
    </div>`;
  }

  function csHtml() {
    const S = state.suppliers, I = state.items;
    const supName = (s, j) => s.name || (lang === "bn" ? `সাপ্লায়ার ${dg(j + 1)}` : `Supplier ${j + 1}`);
    const supRows = CS_SUPPLIER_FIELDS.map((f) => {
      const show = f.showIf ? ` data-show-if='${esc(JSON.stringify(f.showIf))}'` : "";
      return `<tr${show}><th scope="row" style="white-space:normal;min-width:150px">${esc(L(f.label))}</th>${S.map((s, j) => {
        const path = `suppliers.${j}.${f.key}`;
        let ctl;
        if (f.type === "checkbox") ctl = `<label class="check" style="justify-content:center"><input type="checkbox" data-sup="${j}" data-key="${f.key}" ${s[f.key] !== false && s[f.key] !== "false" ? "checked" : ""}></label>`;
        else ctl = `<div class="${f.type === "percent" ? "input-unit" : ""}"><input type="text" data-sup="${j}" data-key="${f.key}" value="${esc(inputVal(s[f.key], f))}" ${f.type === "text" ? `maxlength="${f.maxlength || 60}"` : 'inputmode="decimal"'} aria-label="${esc(L(f.label) + " — " + supName(s, j))}" autocomplete="off">${f.type === "percent" ? "<span>%</span>" : ""}</div>`;
        return `<td data-path="${path}">${ctl}<span class="err-text" data-err hidden></span></td>`;
      }).join("")}</tr>`;
    }).join("");
    const head = `<tr><th></th>${S.map((s, j) => `<th style="min-width:150px"><div class="row between" style="gap:6px;flex-wrap:nowrap"><span>${esc(lang === "bn" ? `সাপ্লায়ার ${dg(j + 1)}` : `Supplier ${j + 1}`)}</span>
      <button type="button" class="icon-btn" data-remove="suppliers" data-index="${j}" ${S.length <= def.suppliers.min ? "disabled" : ""} aria-label="${esc(t("remove"))}">${ICON_TRASH}</button></div></th>`).join("")}</tr>`;
    const itemHead = `<tr><th>#</th><th style="min-width:220px">${esc(L(CS_ITEM_FIELDS[0].label))}</th><th style="min-width:70px">${esc(L(CS_ITEM_FIELDS[1].label))}</th><th style="min-width:80px">${esc(L(CS_ITEM_FIELDS[2].label))}</th>
      ${S.map((s, j) => `<th class="num" style="min-width:120px">${esc(supName(s, j))}<div class="tiny muted" style="font-weight:400">${esc(t("unit_price"))}</div></th>`).join("")}<th></th></tr>`;
    const itemRows = I.map((it, i) => `<tr>
      <td class="muted">${dg(i + 1)}</td>
      ${CS_ITEM_FIELDS.map((f) => `<td data-path="items.${i}.${f.key}"><input type="text" data-item="${i}" data-key="${f.key}" value="${esc(inputVal(it[f.key], f))}" ${f.type === "text" ? `maxlength="${f.maxlength}"` : 'inputmode="decimal"'} aria-label="${esc(L(f.label))} ${dg(i + 1)}" autocomplete="off"><span class="err-text" data-err hidden></span></td>`).join("")}
      ${S.map((s, j) => `<td data-path="items.${i}.prices.${j}"><input type="text" inputmode="decimal" data-item="${i}" data-price="${j}" value="${esc(inputVal(it.prices[j], { type: "number" }))}" aria-label="${esc(supName(s, j))} — ${esc(t("unit_price"))} ${dg(i + 1)}" autocomplete="off" style="text-align:right"><span class="err-text" data-err hidden></span></td>`).join("")}
      <td><button type="button" class="icon-btn" data-remove="items" data-index="${i}" ${I.length <= def.items.min ? "disabled" : ""} aria-label="${esc(t("remove"))}">${ICON_TRASH}</button></td></tr>`).join("");
    return `<div class="form-section"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">${esc(t("cs_suppliers"))}</h3>
        <button type="button" class="btn btn-ghost btn-sm" data-add="suppliers" ${S.length >= def.suppliers.max ? "disabled" : ""}>${ICON_PLUS} ${esc(t("cs_add_supplier"))}</button></div>
        <div class="table-wrap cs-table" data-path="suppliers"><table><thead>${head}</thead><tbody>${supRows}</tbody></table></div><span class="err-text" data-err hidden></span></div>
      <div class="form-section"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">${esc(t("cs_items"))}</h3>
        <button type="button" class="btn btn-ghost btn-sm" data-add="items" ${I.length >= def.items.max ? "disabled" : ""}>${ICON_PLUS} ${esc(t("cs_add_item"))}</button></div>
        <p class="help" style="margin:-4px 0 12px">${esc(t("cs_blank_help"))}</p>
        <div class="table-wrap cs-table" data-path="items"><table><thead>${itemHead}</thead><tbody>${itemRows}</tbody></table></div><span class="err-text" data-err hidden></span></div>`;
  }

  function renderForm() {
    let out = "";
    const sections = def.sections || [];
    const used = new Set();
    for (const s of sections) {
      out += `<div class="form-section"><h3>${esc(L(s.title))}</h3>${s.note ? `<p class="help">${esc(L(s.note))}</p>` : '<div style="height:12px"></div>'}
        <div class="form-grid">${def.fields.filter((f) => f.section === s.key).map((f) => { used.add(f.key); return fieldHtml(f, state[f.key], f.key); }).join("")}</div></div>`;
    }
    const loose = def.fields.filter((f) => !used.has(f.key));
    if (loose.length) out += `<div class="form-section"><div class="form-grid">${loose.map((f) => fieldHtml(f, state[f.key], f.key)).join("")}</div></div>`;
    for (const g of def.groups || []) out += `<div class="form-section">${groupHtml(g)}</div>`;
    if (def.custom === "cs") out += csHtml();
    formBox.innerHTML = out;
    applyShowIf();
  }

  // ------------------------------------------------------------ reading inputs
  const readEl = (el) => (el.type === "checkbox" ? el.checked : el.value);
  function collect() {
    const s = { ...state };
    formBox.querySelectorAll("[data-key]").forEach((el) => {
      if (el.closest("[data-group]") || el.dataset.sup !== undefined || el.dataset.item !== undefined) return;
      s[el.dataset.key] = readEl(el);
    });
    for (const g of def.groups || []) {
      const box = formBox.querySelector(`[data-group="${g.key}"]`);
      s[g.key] = [...box.querySelectorAll("[data-items] > [data-item]")].map((item) => {
        const row = {};
        item.querySelectorAll("[data-key]").forEach((el) => { row[el.dataset.key] = readEl(el); });
        return row;
      });
    }
    if (def.custom === "cs") {
      const S = state.suppliers.map(() => ({}));
      formBox.querySelectorAll("[data-sup]").forEach((el) => { S[+el.dataset.sup][el.dataset.key] = readEl(el); });
      const I = state.items.map(() => ({ prices: S.map(() => "") }));
      formBox.querySelectorAll("[data-item]").forEach((el) => {
        const it = I[+el.dataset.item];
        if (el.dataset.price !== undefined) it.prices[+el.dataset.price] = el.value; else it[el.dataset.key] = el.value;
      });
      s.suppliers = S; s.items = I;
    }
    return s;
  }

  function applyShowIf() {
    const s = collect();
    formBox.querySelectorAll("[data-show-if]").forEach((el) => {
      const c = JSON.parse(el.dataset.showIf);
      const v = String(s[c.field]);
      el.hidden = c.in ? !c.in.map(String).includes(v) : c.notIn ? c.notIn.map(String).includes(v) : false;
    });
  }

  // ------------------------------------------------------------ validation
  function clean(f, raw) {
    if ((raw === undefined || raw === null) && f.default !== undefined) raw = f.default;
    if (f.type === "checkbox") return [raw === true || raw === "true" || raw === "on" || raw === 1 || raw === "1", null];
    if (f.type === "text") {
      const v = String(raw ?? "").trim();
      if (!v) return f.required === false ? [f.default ?? "", null] : [null, T.msg.required];
      return v.length > (f.maxlength || 120) ? [null, T.msg.too_long] : [v, null];
    }
    if (f.type === "select") {
      const v = String(raw ?? "");
      if (v === "" && f.required === false) return [f.default ?? "", null];
      return f.options.some(([o]) => String(o) === v) ? [v, null] : [null, T.msg.choice];
    }
    let v = parseNumber(raw);
    if (Number.isNaN(v)) return [null, T.msg.number];
    if (v === null) return f.required === false ? [f.default ?? null, null] : [null, T.msg.required];
    if (f.type === "integer") { if (Math.abs(v - Math.round(v)) > 1e-9) return [null, T.msg.integer]; v = Math.round(v); }
    if (f.min !== undefined && v < f.min) return [null, T.msg.min.replace("{v}", dg(f.min))];
    if (f.gt !== undefined && v <= f.gt) return [null, T.msg.gt.replace("{v}", dg(f.gt))];
    if (f.max !== undefined && v > f.max) return [null, T.msg.max.replace("{v}", dg(f.max))];
    return [v, null];
  }
  const visible = (f, s) => !f.showIf || (f.showIf.in ? f.showIf.in.map(String).includes(String(s[f.showIf.field])) : !(f.showIf.notIn || []).map(String).includes(String(s[f.showIf.field])));
  const isBlankRow = (row, fields) => fields.every((f) => row[f.key] === undefined || row[f.key] === null || row[f.key] === "" || row[f.key] === false);

  function validate(s) {
    const values = {}, errors = {};
    for (const f of def.fields) {
      if (!visible(f, s)) { values[f.key] = f.default ?? null; continue; }
      const [v, e] = clean(f, s[f.key]);
      values[f.key] = v; if (e) errors[f.key] = e;
    }
    for (const g of def.groups || []) {
      const rows = (s[g.key] || []).map((r, i) => [r, i]).filter(([r]) => !isBlankRow(r, g.fields.filter((f) => f.type !== "checkbox" && f.key !== "name")));
      if (rows.length < g.min) errors[g.key] = T.msg.few_items.replace("{v}", dg(g.min));
      values[g.key] = rows.map(([r, i]) => {
        const out = {};
        for (const f of g.fields) { const [v, e] = clean(f, r[f.key]); out[f.key] = v; if (e) errors[`${g.key}.${i}.${f.key}`] = e; }
        return out;
      });
    }
    if (def.custom === "cs") {
      values.suppliers = s.suppliers.map((sp, j) => {
        const out = {};
        for (const f of CS_SUPPLIER_FIELDS) {
          if (!visible(f, s)) { out[f.key] = f.default ?? null; continue; }
          const [v, e] = clean(f, sp[f.key]); out[f.key] = v; if (e) errors[`suppliers.${j}.${f.key}`] = e;
        }
        return out;
      });
      const rows = s.items.map((it, i) => [it, i]).filter(([it]) => (it.desc || "").trim() || String(it.qty ?? "").trim() || it.prices.some((p) => String(p ?? "").trim()));
      if (!rows.length) errors.items = T.msg.few_items.replace("{v}", dg(1));
      values.items = rows.map(([it, i]) => {
        const out = { prices: [] };
        for (const f of CS_ITEM_FIELDS) { const [v, e] = clean(f, it[f.key]); out[f.key] = v; if (e) errors[`items.${i}.${f.key}`] = e; }
        it.prices.forEach((p, j) => {
          const v = parseNumber(p);
          if (Number.isNaN(v)) errors[`items.${i}.prices.${j}`] = T.msg.number;
          else if (v !== null && v < 0) errors[`items.${i}.prices.${j}`] = T.msg.min.replace("{v}", dg(0));
          out.prices[j] = Number.isNaN(v) ? null : v;
        });
        return out;
      });
    }
    return { values, errors };
  }

  function clearErrors() {
    formBox.querySelectorAll("[data-path]").forEach((f) => {
      f.classList.remove("invalid");
      const e = f.querySelector(":scope > [data-err]") || (f.nextElementSibling && f.nextElementSibling.matches("[data-err]") ? f.nextElementSibling : null);
      if (e) { e.hidden = true; e.textContent = ""; }
      f.querySelectorAll("[aria-invalid]").forEach((i) => i.removeAttribute("aria-invalid"));
    });
    formError.hidden = true; formError.textContent = "";
  }
  function showErrors(errors) {
    clearErrors();
    let first = null;
    for (const [path, msgObj] of Object.entries(errors)) {
      const text = typeof msgObj === "string" ? msgObj : L(msgObj);
      const f = formBox.querySelector(`[data-path="${CSS.escape(path)}"]`);
      if (!f) { formError.hidden = false; formError.textContent = text; continue; }
      f.classList.add("invalid");
      if (f.hidden) f.hidden = false;
      const e = f.querySelector(":scope > [data-err]") || (f.nextElementSibling && f.nextElementSibling.matches("[data-err]") ? f.nextElementSibling : null);
      if (e) { e.hidden = false; e.textContent = text; }
      const inp = f.querySelector("input,select");
      if (inp) inp.setAttribute("aria-invalid", "true");
      if (!first) first = f;
    }
    return first;
  }

  // ------------------------------------------------------------ formatting results
  const isL = (v) => v && typeof v === "object" && "en" in v;
  function fmt(v, f, cur, dec) {
    if (v === null || v === undefined || v === "") return "—";
    if (isL(v)) return L(v);
    if (typeof v === "object" && "v" in v) return fmt(v.v, f, cur, dec);
    if (typeof v === "string") return v;
    if (f === "money") return formatMoney(v, cur || "BDT", lang, dec ?? 2);
    if (f === "percent") return formatPercent(v, lang, dec ?? 2);
    if (f === "int") return formatNumber(v, lang, 0);
    if (f === "number") return formatNumber(v, lang, dec ?? 2);
    if (f === "qty") return formatNumber(v, lang, Number.isInteger(v) ? 0 : 2);
    return String(v);
  }
  const fmtMetric = (m) => fmt(m.value, m.fmt, m.currency, m.fmt === "int" ? 0 : m.decimals);

  let last = null; // {values, result}

  function resultHtml(r) {
    const [first, ...rest] = r.headline;
    let h = `<div class="result-card"><div class="label">${esc(L(first.label))}</div><div class="big">${esc(fmtMetric(first))}</div>${first.note ? `<div class="note">${esc(L(first.note))}</div>` : ""}
      ${rest.length ? `<div class="kpis">${rest.map((m) => `<div><div class="label">${esc(L(m.label))}</div><div class="val">${esc(fmtMetric(m))}</div>${m.note ? `<div class="note">${esc(L(m.note))}</div>` : ""}</div>`).join("")}</div>` : ""}</div>
      <div class="result-actions no-print" role="group" aria-label="${esc(t("result_actions"))}">
        <button type="button" class="btn btn-primary" data-export="xlsx">${ICON_SHEET} ${esc(t("download_excel"))}</button>
        <button type="button" class="btn btn-primary" data-export="pdf">${ICON_PDF} ${esc(t("download_pdf"))}</button>
        ${T.wa ? `<div class="wa"><a class="btn wa-btn" style="width:100%" href="${esc(T.wa.url)}" target="_blank" rel="noopener noreferrer"><span style="color:#25d366;display:inline-flex">${ICON_CHAT}</span> ${esc(T.wa.label)}</a></div>` : ""}
      </div>
      ${T.wa && T.wa.note ? `<p class="wa-note no-print">${esc(T.wa.note)}</p>` : ""}
      <p class="tiny muted no-print" style="margin:8px 0 0">${esc(t("download_note"))}</p>`;
    for (const w of r.warnings) h += `<div class="alert alert-warn" style="margin-top:16px">${ICON_ALERT}<div>${esc(L(w))}</div></div>`;
    if (r.details.length) h += `<ul class="details-list">${r.details.map((d) => `<li class="${d.highlight ? "hl" : ""}"><span>${esc(L(d.label))}${d.note ? `<small>${esc(L(d.note))}</small>` : ""}</span><span>${esc(fmtMetric(d))}</span></li>`).join("")}</ul>`;
    if (r.chart && r.chart.rows.length) {
      const max = Math.max(...r.chart.rows.map(([, v]) => Math.abs(v)), 1e-9);
      h += `<div class="bar-chart" aria-hidden="true">${r.chart.rows.map(([lbl, v]) => `<div class="bar-row"><span class="lbl" title="${esc(L(lbl))}">${esc(L(lbl))}</span><div class="bar"><i style="width:${(Math.abs(v) / max * 100).toFixed(1)}%"></i></div></div>`).join("")}</div>`;
    }
    for (const tb of r.tables) h += tableHtml(tb);
    if (r.notes.length) h += `<div style="margin-top:22px">${r.notes.map((n) => `<p class="small muted">${esc(L(n))}</p>`).join("")}</div>`;
    return h;
  }
  function tableHtml(tb) {
    return `<h3 style="font-size:17px;margin:28px 0 10px">${esc(L(tb.title))}</h3><div class="table-wrap"><table>
      <thead><tr>${tb.columns.map((c, k) => `<th class="${c.fmt !== "text" ? "num" : ""}"${c.fmt === "text" && k < 2 ? ' style="min-width:140px"' : ""}>${esc(L(c.label))}</th>`).join("")}</tr></thead>
      <tbody>${tb.rows.map((row, i) => `<tr class="${tb.highlightRow === i ? "hl" : ""} ${tb.totalRow && i === tb.rows.length - 1 ? "total" : ""}">${row.map((cell, k) => {
        const c = tb.columns[k] || { fmt: "text" };
        const best = cell && typeof cell === "object" && cell.best;
        return `<td class="${c.fmt !== "text" ? "num" : ""}">${best ? "<strong>" : ""}${esc(fmt(cell, c.fmt, c.currency, c.decimals))}${best ? "</strong>" : ""}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  // ------------------------------------------------------------ calculate
  let touched = loadedExample || hadSaved;
  function calculate(manual) {
    const s = collect();
    state = s;
    try { localStorage.setItem(storeKey, JSON.stringify(s)); } catch { /* ignore */ }
    const { values, errors } = validate(s);
    if (Object.keys(errors).length) {
      last = null;
      if (manual || touched) {
        const first = showErrors(errors);
        if (!formError.textContent) { formError.hidden = false; formError.textContent = t("fix_errors"); }
        if (manual && first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    let r;
    try { r = def.compute(values); }
    catch (e) {
      last = null;
      if (e instanceof CalcError) { if (manual || touched) showErrors({ [e.path]: e.msg }); return; }
      if (manual || touched) showErrors({ _form: { en: T.msg.generic_en, bn: T.msg.generic_bn } });
      console.error(e);
      return;
    }
    clearErrors();
    last = { values, result: r, at: new Date() };
    resultBox.innerHTML = resultHtml(r);
    if (manual && window.innerWidth < 1040) resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  let timer = null;
  function schedule() {
    applyShowIf();
    const auto = root.querySelector("[data-auto]");
    clearTimeout(timer);
    timer = setTimeout(() => { if (!auto || auto.checked) calculate(false); else { state = collect(); try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch { /* ignore */ } } }, 450);
  }

  root.querySelector("[data-calc-form]").addEventListener("submit", (e) => { e.preventDefault(); touched = true; calculate(true); });
  formBox.addEventListener("input", schedule);
  formBox.addEventListener("change", schedule);
  formBox.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const rem = e.target.closest("[data-remove]");
    if (!add && !rem) return;
    state = collect();
    if (add) {
      const k = add.dataset.add;
      if (k === "suppliers") { state.suppliers.push(blank(CS_SUPPLIER_FIELDS)); state.items.forEach((it) => it.prices.push("")); }
      else if (k === "items") state.items.push({ ...blank(CS_ITEM_FIELDS), prices: state.suppliers.map(() => "") });
      else state[k].push(blank(def.groups.find((g) => g.key === k).fields));
    } else {
      const k = rem.dataset.remove, i = +rem.dataset.index;
      if (k === "suppliers") { state.suppliers.splice(i, 1); state.items.forEach((it) => it.prices.splice(i, 1)); }
      else state[k].splice(i, 1);
    }
    renderForm();
    schedule();
  });
  document.querySelector("[data-calc-clear]").addEventListener("click", () => {
    state = defaults(); touched = false; renderForm(); clearErrors(); last = null;
    resultBox.innerHTML = resultBox.dataset.empty;
    try { localStorage.removeItem(storeKey); } catch { /* ignore */ }
  });
  document.querySelector("[data-calc-example]").addEventListener("click", () => {
    state = exampleState(); touched = true; renderForm(); calculate(false);
    const note = document.querySelector("[data-example-note]"); if (note) note.hidden = false;
  });

  // ------------------------------------------------------------ exports
  resultBox.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-export]");
    if (!btn || !last) return;
    const kind = btn.dataset.export;
    const ok = await window.PB.requireEmail();
    if (!ok) return;
    window.PB.post("/api/calc-export", { slug: def.slug, format: kind }).catch(() => {});
    if (kind === "xlsx") downloadXlsx(); else printReport();
  });

  function inputRows(values) {
    const rows = [];
    const show = (f, v) => {
      if (f.type === "checkbox") return v ? t("yes") : t("no");
      if (f.type === "select") { const o = f.options.find(([k]) => String(k) === String(v)); return o ? L(o[1]) : v; }
      return v;
    };
    const sectionTitle = (f) => { const s = (def.sections || []).find((x) => x.key === f.section); return s ? L(s.title) : ""; };
    for (const f of def.fields) if (visible(f, values) && values[f.key] !== null && values[f.key] !== "") rows.push([sectionTitle(f), L(f.label), show(f, values[f.key])]);
    for (const g of def.groups || []) values[g.key].forEach((item, i) => g.fields.forEach((f) => { if (item[f.key] !== null && item[f.key] !== "") rows.push([`${L(g.itemLabel)} ${i + 1}`, L(f.label), show(f, item[f.key])]); }));
    if (def.custom === "cs") {
      values.suppliers.forEach((s, j) => CS_SUPPLIER_FIELDS.forEach((f) => { if (visible(f, values) && s[f.key] !== null && s[f.key] !== "") rows.push([`${t("supplier")} ${j + 1}`, L(f.label), show(f, s[f.key])]); }));
      values.items.forEach((it, i) => {
        rows.push([`${t("item")} ${i + 1}`, `${it.desc || ""} (${it.qty} ${it.unit || ""})`, ""]);
        it.prices.forEach((p, j) => rows.push([`${t("item")} ${i + 1}`, `${t("unit_price")} — ${values.suppliers[j].name || t("supplier") + " " + (j + 1)}`, p === null ? "—" : p]));
      });
    }
    return rows;
  }

  function cellStyle(f, cur, { bold = false, hl = false } = {}) {
    if (f === "money") return cur === "BDT" ? (hl ? "hlBdt" : bold ? "bdtB" : "bdt") : (hl ? "hlMoney" : bold ? "moneyB" : "money");
    if (f === "percent") return hl ? "hlPct" : bold ? "pctB" : "pct";
    if (f === "int") return hl ? "hlInt" : bold ? "bold" : "int";
    if (f === "number" || f === "qty") return hl ? "hlNum" : bold ? "numB" : "num";
    return hl ? "hl" : bold ? "bold" : undefined;
  }
  const xcell = (v, f, cur, opts = {}) => {
    if (v === null || v === undefined) return { v: "—", s: opts.hl ? "hl" : undefined };
    if (isL(v)) return { v: L(v), s: opts.hl ? "hl" : opts.bold ? "bold" : undefined };
    if (typeof v === "object" && "v" in v) return { v: v.v, s: v.best && !opts.hl ? (cur === "BDT" ? "bestBdt" : "best") : cellStyle(f, cur, opts) };
    if (typeof v === "number") return { v: f === "money" || f === "percent" ? Math.round(v * 10000) / 10000 : v, s: cellStyle(f, cur, opts) };
    return { v: String(v), s: opts.hl ? "hl" : opts.bold ? "bold" : undefined };
  };

  function downloadXlsx() {
    const { values, result: r, at } = last;
    const title = L(def.title);
    const summary = [[{ v: title, s: "title" }], [{ v: `${t("report_subtitle")} · ProcureBest.com`, s: "subtitle" }],
      [{ v: `${t("generated")}: ${formatDate(at, lang, true)}`, s: "subtitle" }], [],
      [{ v: t("key_results"), s: "head" }, { v: t("value"), s: "head" }, { v: "", s: "head" }]];
    for (const m of [...r.headline, ...r.details]) summary.push([{ v: L(m.label), s: m.highlight ? "bold" : undefined }, xcell(m.value, m.fmt, m.currency, { bold: m.highlight }), m.note ? { v: L(m.note), s: "muted" } : null]);
    if (r.warnings.length) { summary.push([], [{ v: t("warnings"), s: "bold" }]); r.warnings.forEach((w) => summary.push([{ v: L(w), s: "wrap" }])); }
    const sheets = [{ name: t("sheet_summary"), widths: [52, 24, 44], rows: summary }];
    const inputs = [[{ v: t("section"), s: "head" }, { v: t("input"), s: "head" }, { v: t("value"), s: "head" }],
      ...inputRows(values).map(([a, b, c]) => [a, b, typeof c === "number" ? { v: c, s: "num" } : c])];
    sheets.push({ name: t("sheet_inputs"), widths: [30, 52, 26], rows: inputs, freeze: 1 });
    for (const tb of r.tables) {
      const rows = [tb.columns.map((c) => ({ v: L(c.label), s: "head" }))];
      tb.rows.forEach((row, i) => {
        const hl = tb.highlightRow === i, bold = tb.totalRow && i === tb.rows.length - 1;
        rows.push(row.map((cell, k) => { const c = tb.columns[k] || { fmt: "text" }; return xcell(cell, c.fmt, c.currency, { hl, bold }); }));
      });
      sheets.push({ name: L(tb.title), widths: tb.columns.map((c, k) => (k === 0 || c.fmt === "text" ? 30 : 18)), rows, freeze: 1 });
    }
    const method = [[{ v: t("method_title"), s: "title" }], []];
    def.method.forEach((m, i) => method.push([{ v: `${i + 1}. ${L(m)}`, s: "wrap" }]));
    if (r.notes.length) { method.push([], [{ v: t("notes"), s: "bold" }]); r.notes.forEach((n) => method.push([{ v: L(n), s: "wrap" }])); }
    if (def.disclaimer) method.push([], [{ v: L(def.disclaimer), s: "wrap" }]);
    method.push([], [{ v: t("footer_disclaimer"), s: "muted" }]);
    sheets.push({ name: t("sheet_method"), widths: [120], rows: method });
    const bytes = buildXlsx(sheets, { title });
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    const d = at.toISOString().slice(0, 10).replace(/-/g, "");
    a.href = URL.createObjectURL(blob);
    a.download = `procurebest-${def.slug}-${d}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function printReport() {
    const { values, result: r, at } = last;
    let box = document.getElementById("print-report");
    if (!box) { box = document.createElement("div"); box.id = "print-report"; document.body.appendChild(box); }
    const inputs = inputRows(values);
    box.innerHTML = `<div class="pr-head"><img src="/img/logo.svg" alt="ProcureBest" style="height:22px"><div class="pr-meta">${esc(t("report_subtitle"))} · ${esc(formatDate(at, lang, true))}</div></div>
      <h1 class="pr-title">${esc(L(def.title))}</h1>
      <div class="pr-result">${resultHtml(r)}</div>
      <h3 style="font-size:17px;margin:28px 0 10px">${esc(t("your_inputs"))}</h3>
      <div class="table-wrap"><table><thead><tr><th>${esc(t("section"))}</th><th>${esc(t("input"))}</th><th class="num">${esc(t("value"))}</th></tr></thead>
      <tbody>${inputs.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td class="num">${esc(typeof c === "number" ? formatNumber(c, lang, Number.isInteger(c) ? 0 : 2) : c)}</td></tr>`).join("")}</tbody></table></div>
      <h3 style="font-size:17px;margin:28px 0 10px">${esc(t("method_title"))}</h3><ol class="method-list">${def.method.map((m) => `<li>${esc(L(m))}</li>`).join("")}</ol>
      ${def.disclaimer ? `<p class="small muted">${esc(L(def.disclaimer))}</p>` : ""}<p class="tiny muted">${esc(t("footer_disclaimer"))}</p>`;
    document.body.classList.add("printing");
    const done = () => { document.body.classList.remove("printing"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 50);
  }

  // ------------------------------------------------------------ start
  resultBox.dataset.empty = resultBox.innerHTML;
  renderForm();
  if (loadedExample) { const note = document.querySelector("[data-example-note]"); if (note) note.hidden = false; }
  if (touched) calculate(false);
}

const svg = (p, s = 17) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON_TRASH = svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 16);
const ICON_PLUS = svg('<path d="M12 5v14M5 12h14"/>', 16);
const ICON_SHEET = svg('<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 9h16M4 15h16M10 3v18"/>');
const ICON_PDF = svg('<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>');
const ICON_CHAT = svg('<path d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-5A8 8 0 1121 12z"/>', 18);
const ICON_ALERT = svg('<path d="M12 3l9.5 17h-19L12 3z"/><path d="M12 10v4.5M12 17.5v.3"/>', 18);

if (root && def) init();
