import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, normalize, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const pages = ["index.html", "record.html", "quotes.html", "people.html", "person.html", "search.html", "timeline.html", "materials.html", "quiz.html", "credits.html", "map.html", "shop.html", "auth.html", "404.html"];
const types = { ".css": "text/css", ".html": "text/html", ".ico": "image/x-icon", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".ttf": "font/ttf" };

const server = createServer((request, response) => {
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  const relative = pathname === "/" ? "index.html" : normalize(pathname).replace(/^[/\\]+/, "");
  const target = resolve(root, relative);
  if (!target.startsWith(`${root}${sep}`) || !existsSync(target)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream" });
  createReadStream(target).pipe(response);
});

await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const browserPath = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find(existsSync);
const browser = await chromium.launch(browserPath ? { executablePath: browserPath, headless: true } : { headless: true });

try {
  for (const width of [1920, 430, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route("**/js/authGate.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
    for (const file of pages) {
      await page.goto(`${baseUrl}/${file}`, { waitUntil: "load" });
      const report = await page.evaluate(() => ({
        designLoaded: [...document.styleSheets].some((sheet) => sheet.href?.endsWith("/styles/archive-redesign.css")),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        focusOutline: getComputedStyle(document.documentElement).getPropertyValue("--archive-accent").trim()
      }));
      if (!report.designLoaded || report.overflow || !report.focusOutline) {
        throw new Error(`${file} at ${width}px failed visual smoke validation: ${JSON.stringify(report)}`);
      }
    }
    await page.close();
  }
  console.log("Passed archive redesign CSS loading and overflow checks at desktop and mobile widths.");
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}
