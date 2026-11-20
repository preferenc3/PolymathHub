import inbox from "../api/inbox.mjs";
import lessonGroups from "./lesson-groups.cjs";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import catalog from "../api/catalog.mjs";
import account from "../api/account.mjs";
import progress from "../api/progress.mjs";
import adminAccounts from "../api/admin-accounts.mjs";
import { readJson, send, fail } from "../server/auth.mjs";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
const assets = /^(index\.html|styles\.css|studio\.css|app\.js|studio\.js|account\.js|domain-meter\.js|inbox\.js|scroll-nav\.js|profile-avatars\.js|profile\.css|vocabulary\.js|manifest\.json|curriculum(?:-[\w-]+)?\.js|sql-(?:course|progress|university|explore|catalog)\.(?:html|css|js)|language-(?:practice|guide|lessons)\.js|language-guide\.css|assets\/audio\/(?:fr|en|es)-[1-7]\.mp3|assets\/icons\/[a-z-]+\.svg)$/;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/domain-index.json") {
    if (process.env.POLYMATH_SERVE_DIST === "1") {
      const data = await fs.readFile(path.join(root, "dist/domain-index.json"), "utf8");
      return send(res, 200, JSON.parse(data));
    }
    const library = await fs.readFile(path.join(root, "index.html"), "utf8");
    return send(res, 200, lessonGroups.domainIndex(lessonGroups.collect(root, library).groups));
  }
  if (url.pathname === "/api/catalog") return catalog(req, res);
  if (url.pathname === "/api/account") return account(req, res);
  if (url.pathname === "/api/progress") return progress(req, res);
  if (url.pathname === "/api/inbox") return inbox(req,res);
  if (url.pathname === "/api/admin-accounts") return adminAccounts(req, res);
  if (url.pathname === "/api/sql-lab") {
    if (!["GET", "POST"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST");
      return send(res, 405, { error: "Trimite interogarea prin POST." });
    }
    try {
      const body = req.method === "GET" ? "{}" : JSON.stringify(await readJson(req, 80000));
      if (Buffer.byteLength(body) > 80000) return send(res, 413, { error: "Cererea este prea mare." });
      const child = execFile("python3", [path.join(root, "api", "sql-lab.py"), ...(req.method === "GET" ? ["--catalog"] : [])], { timeout: 5000, maxBuffer: 2_000_000 }, (error, stdout) => {
        if (error) return send(res, 503, { error: "Laboratorul SQL nu este disponibil. Verifică instalarea Python 3." });
        try {
          const [status, payload] = req.method === "GET" ? [200, JSON.parse(stdout)] : JSON.parse(stdout);
          send(res, status, payload);
        } catch {
          send(res, 502, { error: "Laboratorul SQL a întors un răspuns invalid." });
        }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(body);
    } catch (error) {
      fail(res, error);
    }
    return;
  }
  if (process.env.POLYMATH_SERVE_DIST === "1") {
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (file === "biblioteca.html" || assets.test(file) || /^lessons\/[a-f0-9]{20}\.json$/.test(file)) {
      try {
        const body = await fs.readFile(path.join(root, "dist", file));
        res.writeHead(200, { "Content-Type": types[path.extname(file)], "Cache-Control": "no-store" });
        return res.end(body);
      } catch { res.writeHead(404); return res.end("Not found"); }
    }
  }
  const requested = url.pathname === "/biblioteca.html" ? "index.html" : url.pathname.slice(1);
  const file = ["/","/index.html"].includes(url.pathname) ? "sql-course.html" : requested;
  if (!assets.test(file)) { res.writeHead(404); return res.end("Not found"); }
  try { const body = await fs.readFile(path.join(root, file)); res.writeHead(200, { "Content-Type": types[path.extname(file)], "Cache-Control": "no-store" }); res.end(body); }
  catch { res.writeHead(404); res.end("Not found"); }
});
server.listen(Number(process.env.PORT) || 8000, "127.0.0.1", () => console.log(`PolymathHub: http://127.0.0.1:${server.address().port}`));
