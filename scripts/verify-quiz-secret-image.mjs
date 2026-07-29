import assert from "node:assert/strict";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, normalize, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const imageUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23e8dfd3'/%3E%3C/svg%3E";
const types = { ".css": "text/css", ".html": "text/html", ".ico": "image/x-icon", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".ttf": "font/ttf" };
const stubScripts = new Set(["cacheLoader.js", "recordStore.js", "peopleStore.js", "recordRenderer.js", "quoteStore.js", "bootstrap.js", "backgroundOptions.js", "backgroundSwitcher.js"]);

const server = createServer((request, response) => {
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  const relative = pathname === "/" ? "index.html" : normalize(pathname).replace(/^[/\\]+/, "");
  const target = resolve(root, relative);
  if (!target.startsWith(`${root}${sep}`) || !existsSync(target)) return response.writeHead(404).end();
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

const installImageHarness = async (page) => {
  await page.addInitScript((url) => {
    const mode = new URLSearchParams(location.search).get("mode") || "miss";
    const memory = new Map();
    if (mode === "rapid") {
      const values = [0, 0, 0, 0.9, 0, 0];
      Math.random = () => values.shift() ?? 0.9;
    }
    if (mode === "memory") {
      memory.set("images/quiz/lamian/01.png", { url, width: 1200, height: 800 });
      memory.set("images/quiz/lamian/02.png", { url, width: 1200, height: 800 });
    }
    window.__quizImageHarness = { mode, requests: 0, release: null, failOnce: mode === "error" };
    window.cacheReadyPromise = Promise.resolve();
    window.loadAllRecords = async () => [];
    window.loadAllPeople = async () => [];
    window.loadAllQuotes = async () => [];
    window.stripRecordMarkup = (value) => String(value || "");
    window.formatContent = (value) => String(value || "");
    window.formatTrustedContent = (value) => String(value || "");
    window.ClassRecordSupabase = { hasAdminAccess: async () => true };
    window.ClassRecordData = {
      normalizePrivateStoragePath: (path) => String(path || "").replace(/^\/+/, ""),
      getPreloadedAsset: (path) => memory.get(path) || null,
      loadQuizQuestions: async () => [{
        id: "LAMIAN-01",
        content: "lamian",
        type: "fill",
        prompt: "请根据图片作答。",
        answer: "ab",
        image: "images/quiz/lamian/01.png"
      }, {
        id: "LAMIAN-02",
        content: "lamian",
        type: "fill",
        prompt: "请根据第二张图片作答。",
        answer: "cd",
        image: "images/quiz/lamian/02.png"
      }],
      readCachedAsset: async (path) => mode === "persistent" && path.startsWith("images/quiz/lamian/")
        ? { url, width: 1200, height: 800 }
        : null,
      invalidatePreloadedAsset: async (path) => { memory.delete(path); },
      preloadAsset: async (path) => {
        window.__quizImageHarness.requests += 1;
        if (window.__quizImageHarness.failOnce) {
          window.__quizImageHarness.failOnce = false;
          throw new Error("simulated network failure");
        }
        if (mode !== "rapid" || path.endsWith("01.png")) {
          await new Promise((resolveLoad) => { window.__quizImageHarness.release = resolveLoad; });
        }
        const asset = { url: `${url}#${path}`, width: 1200, height: 800 };
        memory.set(path, asset);
        return asset.url;
      }
    };
  }, imageUrl);
  await page.route("**/js/authGate.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  for (const name of stubScripts) {
    await page.route(`**/js/${name}`, (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  }
};

const openSecretQuestion = async (page, mode) => {
  await page.goto(`${baseUrl}/quiz.html?mode=${mode}`, { waitUntil: "load" });
  await page.waitForSelector("#quiz-filter .filter-option");
  for (const key of "lamian") await page.keyboard.press(key);
  await page.waitForSelector('[data-group="contents"][data-value="lamian"]');
  await page.click('[data-group="contents"][data-value="lamian"]');
  await page.waitForSelector(".quiz-secret-image-frame");
};

try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    for (const mode of ["memory", "persistent"]) {
      const page = await browser.newPage({ viewport });
      await installImageHarness(page);
      await openSecretQuestion(page, mode);
      await page.waitForSelector(".quiz-secret-image-frame.is-ready");
      const result = await page.evaluate(() => ({
        requests: window.__quizImageHarness.requests,
        loaderDisplay: getComputedStyle(document.querySelector(".quiz-secret-image-loader")).display,
        imageVisible: getComputedStyle(document.querySelector(".quiz-secret-image")).display,
        overflow: document.documentElement.scrollWidth > innerWidth
      }));
      assert.equal(result.requests, 0, `${mode} cache hit must not request a new image at ${viewport.width}px`);
      assert.equal(result.loaderDisplay, "none", `${mode} cache hit must not show the loader at ${viewport.width}px`);
      assert.equal(result.imageVisible, "block", `${mode} cache hit must display the image at ${viewport.width}px`);
      assert.equal(result.overflow, false, `${mode} cache hit must not overflow at ${viewport.width}px`);
      await page.close();
    }
  }

  const missPage = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await installImageHarness(missPage);
  await openSecretQuestion(missPage, "miss");
  await missPage.waitForSelector(".quiz-secret-image-frame.is-loading");
  assert.equal(await missPage.locator(".quiz-secret-image-loader .loading-text").textContent(), "正在加载题目图片");
  assert.equal(await missPage.evaluate(() => window.__quizImageHarness.requests), 1, "a cache miss must create one image request");
  await missPage.evaluate(() => window.__quizImageHarness.release());
  await missPage.waitForSelector(".quiz-secret-image-frame.is-ready");
  await missPage.fill("#quiz-fill-input", "ax");
  await missPage.locator(".quiz-fill-form").evaluate((form) => form.requestSubmit());
  await missPage.waitForSelector(".quiz-secret-image-frame.is-ready");
  assert.equal(await missPage.evaluate(() => window.__quizImageHarness.requests), 1, "re-rendering the same question must reuse the in-memory image cache");
  await missPage.close();

  const errorPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await installImageHarness(errorPage);
  await openSecretQuestion(errorPage, "error");
  await errorPage.waitForSelector(".quiz-secret-image-frame .page-state-error");
  assert.equal(await errorPage.locator(".quiz-secret-image-frame img").count(), 0, "a failed image must not leave a browser broken-image element");
  await errorPage.click(".page-state-retry");
  await errorPage.waitForSelector(".quiz-secret-image-frame.is-loading");
  await errorPage.evaluate(() => window.__quizImageHarness.release());
  await errorPage.waitForSelector(".quiz-secret-image-frame.is-ready");
  assert.equal(await errorPage.evaluate(() => window.__quizImageHarness.requests), 2, "retry must invalidate the failed attempt and request a fresh image");
  await errorPage.close();

  const rapidPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await installImageHarness(rapidPage);
  await openSecretQuestion(rapidPage, "rapid");
  await rapidPage.waitForSelector(".quiz-secret-image-frame.is-loading");
  await rapidPage.click("#quiz-next-btn");
  await rapidPage.waitForSelector(".quiz-secret-image-frame.is-ready");
  await rapidPage.evaluate(() => window.__quizImageHarness.release());
  await rapidPage.waitForTimeout(40);
  const rapidResult = await rapidPage.evaluate(() => ({
    requests: window.__quizImageHarness.requests,
    source: document.querySelector(".quiz-secret-image")?.src || ""
  }));
  assert.equal(rapidResult.requests, 2, "rapidly switching hidden questions must request each distinct image only once");
  assert.match(rapidResult.source, /02\.png$/, "a late first-image completion must not overwrite the current question image");
  await rapidPage.close();

  console.log("Passed hidden quiz image browser checks for cache hits, cache misses, retry, repeat render, rapid switching, desktop, and mobile.");
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}
