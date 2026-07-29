import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const pages = ["index.html", "record.html", "quotes.html", "people.html", "person.html", "search.html", "timeline.html", "materials.html", "quiz.html", "credits.html", "map.html", "shop.html", "auth.html", "404.html"];
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 430, height: 932 },
  { width: 390, height: 844 }
];
const screenshotDir = process.env.VISUAL_TEST_OUTPUT_DIR;
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
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
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.route("**/js/authGate.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
    for (const file of pages) {
      await page.goto(`${baseUrl}/${file}`, { waitUntil: "load" });
      if (file === "index.html") {
        await page.evaluate(() => {
          document.querySelectorAll("#guide-highlights, .guide-secondary-panel").forEach((element) => {
            element.hidden = false;
          });
        });
      }
      const report = await page.evaluate(() => {
        const overflowing = [...document.querySelectorAll("*")]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { tag: element.tagName, className: element.className, right: Math.round(rect.right), width: Math.round(rect.width) };
          })
          .filter((element) => element.right > window.innerWidth + 1)
          .slice(0, 6);
        return {
          designLoaded: [...document.styleSheets].some((sheet) => sheet.href?.endsWith("/styles/editorial-refinement.css")),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          focusOutline: getComputedStyle(document.documentElement).getPropertyValue("--editorial-accent").trim(),
          overflowing
        };
      });
      if (!report.designLoaded || report.overflow || !report.focusOutline) {
        throw new Error(`${file} at ${viewport.width}px failed visual smoke validation: ${JSON.stringify(report)}`);
      }
      if (screenshotDir && ["index.html", "auth.html"].includes(file)) {
        await page.screenshot({ path: join(screenshotDir, `${file.replace(".html", "")}-${viewport.width}.png`), fullPage: true });
      }
    }
    await page.close();
  }
  console.log("Passed editorial refinement loading and overflow checks at 1920, 1440, 1366, 430, and 390px.");
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}
