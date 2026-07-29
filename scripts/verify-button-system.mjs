import assert from "node:assert/strict";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const screenshotDir = process.env.VISUAL_TEST_OUTPUT_DIR;
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
const types = { ".css": "text/css", ".html": "text/html", ".ico": "image/x-icon", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".ttf": "font/ttf" };
const server = createServer((request, response) => {
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  const target = resolve(root, pathname === "/" ? "auth.html" : normalize(pathname).replace(/^[/\\]+/, ""));
  if (!target.startsWith(`${root}${sep}`) || !existsSync(target)) return response.writeHead(404).end();
  response.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream" });
  createReadStream(target).pipe(response);
});
const unsafeBrowserPorts = new Set([6000, 6665, 6666, 6667, 6668, 6669, 6697]);
const listenOnSafePort = async () => {
  while (true) {
    await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
    const currentAddress = server.address();
    if (!unsafeBrowserPorts.has(currentAddress.port)) return currentAddress;
    await new Promise((done) => server.close(done));
  }
};
const address = await listenOnSafePort();
const baseUrl = `http://127.0.0.1:${address.port}`;
const browserPath = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find(existsSync);
const browser = await chromium.launch(browserPath ? { executablePath: browserPath, headless: true } : { headless: true });

const installFixture = async (page) => {
  await page.goto(`${baseUrl}/auth.html`, { waitUntil: "load" });
  await page.evaluate(() => {
    document.body.className = "feature-page button-audit-page";
    document.body.innerHTML = `
      <main class="feature-shell" style="width:min(780px,100%);margin:0 auto">
        <section class="record-filter"><div class="filter-actions">
          <button class="btn-select filter-dropdown-trigger">2026 <span class="dropdown-arrow">▾</span></button>
          <button class="btn-action filter-option is-active">全部</button>
          <button class="btn-action filter-option">重要记录</button>
          <button class="btn-action filter-option" disabled>不可用</button>
        </div></section>
        <div class="record-switch"><button class="switch-btn active">按条显示</button><button class="switch-btn">书面记录</button></div>
        <div class="sort-controls"><button class="btn-select dropdown-trigger">排序 <span class="dropdown-arrow">▾</span></button><button class="btn-action sort-order-toggle">升序</button></div>
        <button class="btn-action standard-sample">辅助操作</button>
        <div class="search-type-controls"><button class="btn-action search-type is-active">记录</button><button class="btn-action search-type">人物</button></div>
        <div class="people-role-sort"><button class="btn-action people-sort-option is-active">按名称</button><button class="btn-action people-main-toggle">主要老师</button></div>
        <div class="quiz-fill-row"><input class="quiz-fill-input" value="答案"><button class="btn-action quiz-submit">提交答案</button></div>
        <div class="quiz-options"><button class="quiz-option"><span class="quiz-option-label">A</span><span>一段较长的选项文字，用于检查自然换行与内容型按钮比例。</span></button></div>
        <div class="archive-tool-actions"><button class="btn-action">查看全部记录</button></div>
        <div class="timeline-chip-list"><button class="timeline-chip">人物 <span>12 条</span></button></div>
        <div class="materials-list"><button class="material-list-item is-active">资料目录中的较长条目，保持自然换行而不被拉伸</button></div>
        <button class="attach-toggle" aria-label="附件">⌕</button>
        <button class="back-to-guide-btn" aria-label="返回">↩</button>
      </main>`;
  });
};

try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.route("**/js/authGate.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
    await installFixture(page);
    const before = await page.evaluate(() => {
      const info = (selector) => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height, opacity: style.opacity, background: style.backgroundColor };
      };
      return {
        compact: info(".switch-btn"), standard: info(".standard-sample"), primary: info(".quiz-submit"),
        icon: info(".back-to-guide-btn"), selected: info(".search-type.is-active"), idle: info(".search-type:not(.is-active)"),
        disabled: info(".filter-option:disabled"), overflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    assert.ok(before.compact.height >= 31 && before.compact.height < 35, `compact control height failed at ${viewport.width}px`);
    assert.ok(before.standard.height >= 37 && before.standard.height < 41, `standard control height failed at ${viewport.width}px`);
    assert.ok(before.primary.height >= 43 && before.primary.height < 47, `primary control height failed at ${viewport.width}px`);
    assert.ok(Math.abs(before.icon.width - before.icon.height) < 1, `icon control must be square at ${viewport.width}px`);
    assert.notEqual(before.selected.background, before.idle.background, `selected state must differ at ${viewport.width}px`);
    assert.ok(Number(before.disabled.opacity) <= .5, `disabled state must be distinct at ${viewport.width}px`);
    assert.equal(before.overflow, false, `fixture overflow at ${viewport.width}px`);
    await page.hover(".standard-sample");
    const afterHover = await page.locator(".standard-sample").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    assert.deepEqual(afterHover, { width: before.standard.width, height: before.standard.height }, `hover must not change button geometry at ${viewport.width}px`);
    if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `button-system-${viewport.width}.png`), fullPage: true });
    await page.close();
  }
  console.log("Passed desktop and mobile button size, hierarchy, state, hover, wrapping, and overflow checks.");
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
