// Markdown → HTML for articles, career posts, library descriptions and glossary.
// Raw HTML inside the markdown is shown as text (escaped), so content written in
// the admin panel can never inject scripts into the site.
import { Marked } from "../vendor/marked.esm.js";
import { esc } from "./util.js";

const md = new Marked({ gfm: true, breaks: false });
md.use({
  renderer: {
    html(token) { return esc(token.text ?? token.raw ?? ""); },
    link(token) {
      const href = String(token.href || "");
      if (!/^(https?:|mailto:|\/|#)/i.test(href)) return esc(token.text || href);
      const ext = /^https?:/i.test(href);
      const text = this.parser.parseInline(token.tokens || []);
      return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener nofollow"' : ""}>${text}</a>`;
    },
    image(token) {
      const href = String(token.href || "");
      if (!/^(https?:|\/)/i.test(href)) return "";
      return `<img src="${esc(href)}" alt="${esc(token.text || "")}" loading="lazy">`;
    },
  },
});

export const markdown = (text) => md.parse(String(text || ""));

// Plain text excerpt (for meta descriptions and search).
export const plain = (text, n = 160) =>
  String(text || "").replace(/[#>*_`\[\]()!|-]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
