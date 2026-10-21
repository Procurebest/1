// ProcureBest — Cloudflare Workers edition.
// Static files (CSS, JS, images) are served directly from /public by Cloudflare;
// everything else comes through this Worker: pages, the JSON API and the admin panel.
import { Router, Ctx, HttpError } from "./app.js";
import { ensureSchema } from "./lib/db.js";
import { registerPublic } from "./routes/public.js";
import { registerVisitor } from "./routes/visitor.js";
import { registerApi } from "./routes/api.js";
import { registerAdmin } from "./routes/admin.js";
import { errorPage } from "./views/layout.js";

const router = new Router();
router.get("/", async (c) => {
  const s = await c.settings();
  const pref = (c.req.headers.get("Accept-Language") || "").toLowerCase().startsWith("bn") ? "bn" : s.default_lang;
  return c.redirect(`/${pref === "bn" ? "bn" : "en"}/`, 302);
});
router.get("/healthz", (c) => c.json({ ok: true }));
registerPublic(router);
registerVisitor(router);
registerApi(router);
registerAdmin(router);

export default {
  async fetch(req, env, exec) {
    const c = new Ctx(req, env, exec);
    const path = c.url.pathname;
    // language from the URL (/en/..., /bn/...)
    const seg = path.split("/")[1];
    if (seg === "en" || seg === "bn") c.setLang(seg);
    try {
      if (!env.DB) return new Response("ProcureBest: the D1 database is not connected. See docs/SETUP-GUIDE-BN.md, step 4.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      await ensureSchema(env);
      // Paths without a language prefix, e.g. /calculators → /en/calculators
      if (!["en", "bn", "api", "admin", "dl", "media", "healthz", "sitemap.xml", "robots.txt", ""].includes(seg) && !seg.includes(".")) {
        return c.finish(c.redirect(`/${(await c.settings()).default_lang}${path}${c.url.search}`, 302));
      }
      if (req.method === "POST" || req.method === "PUT") {
        const isApi = path.startsWith("/api/");
        if (isApi && (req.headers.get("X-PB") !== "1" || !c.sameOrigin())) return c.finish(c.json({ ok: false, error: "Forbidden" }, 403));
      }
      const m = router.match(req.method, path);
      if (!m) throw new HttpError(404);
      if (m.methodNotAllowed) return c.finish(new Response("Method not allowed", { status: 405 }));
      c.params = m.params;
      const res = await m.handler(c);
      return c.finish(res);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e && e.stack ? e.stack : e);
      if (path.startsWith("/api/") || path.startsWith("/admin/api/")) return c.finish(c.json({ ok: false, error: c.t("error.generic") }, status));
      try {
        const title = status === 404 ? c.t("error.404_title") : c.t("error.500_title");
        const text = status === 404 ? c.t("error.404_text") : c.t("error.500_text");
        return c.finish(c.html(await errorPage(c, status, title, text), status));
      } catch (e2) {
        console.error(e2);
        return new Response(status === 404 ? "Not found" : "Something went wrong", { status });
      }
    }
  },
};
