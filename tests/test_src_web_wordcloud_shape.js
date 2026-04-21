const assert = require("assert/strict");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const PORT = 8765;
const WEB_ROOT = path.join(__dirname, "..", "src", "web");
const PAGE_URL = `http://127.0.0.1:${PORT}/index.html`;

function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`静态服务器未在 ${timeoutMs}ms 内启动：${url}`));
          return;
        }
        setTimeout(tryConnect, 200);
      });
    };

    tryConnect();
  });
}

async function run() {
  const server = spawn("python", ["-m", "http.server", String(PORT), "--directory", WEB_ROOT], {
    stdio: "ignore",
  });

  try {
    await waitForServer(PAGE_URL);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      await page.goto(PAGE_URL, { waitUntil: "networkidle" });
      await page.waitForFunction(() => {
        const timelineReady = document.querySelectorAll(".timeline-button").length > 0;
        const cloudReady = document.querySelectorAll("#academy-cloud svg text").length > 0;
        return timelineReady && cloudReady;
      });

      const targetTimelineButton = page.locator(".timeline-button", { hasText: "2025" });
      if ((await targetTimelineButton.count()) > 0) {
        await targetTimelineButton.first().click();
        await page.waitForTimeout(120);
      }

      const baseResult = await page.evaluate(() => {
        const countTextOverlapsInPage = (selector) => {
          const nodes = Array.from(document.querySelectorAll(selector));
          const rects = nodes
            .map((node) => node.getBoundingClientRect())
            .filter((rect) => rect.width > 1 && rect.height > 1);
          let overlaps = 0;

          for (let leftIndex = 0; leftIndex < rects.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < rects.length; rightIndex += 1) {
              const leftRect = rects[leftIndex];
              const rightRect = rects[rightIndex];

              const overlapWidth = Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
              const overlapHeight = Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);

              if (overlapWidth > 10 && overlapHeight > 10) {
                overlaps += 1;
              }
            }
          }

          return overlaps;
        };

        return {
          academyWordCount: document.querySelectorAll("#academy-cloud .cloud-word").length,
          websiteWordCount: document.querySelectorAll("#website-cloud .cloud-word").length,
          legacyNodeCount: document.querySelectorAll(".topic-node").length,
          academyOverlapCount: countTextOverlapsInPage("#academy-cloud .cloud-word"),
          websiteOverlapCount: countTextOverlapsInPage("#website-cloud .cloud-word"),
          timelineLabels: Array.from(document.querySelectorAll(".timeline-label"), (node) => node.textContent.trim()),
          academySampleNote: document.querySelector("#academy-sample-note")?.textContent?.trim() ?? "",
          websiteSampleNote: document.querySelector("#website-sample-note")?.textContent?.trim() ?? "",
        };
      });

      const firstWord = page.locator("#academy-cloud .cloud-word").first();
      await firstWord.hover();

      const hoverResult = await page.evaluate(() => {
        return {
          tooltipText: document.querySelector("#cloud-tooltip")?.textContent?.trim() ?? "",
          hoveredWordClass: document.querySelector("#academy-cloud .cloud-word.is-hovered")?.getAttribute("class") ?? "",
          hoveredWordTransform: window.getComputedStyle(document.querySelector("#academy-cloud .cloud-word.is-hovered") ?? document.querySelector("#academy-cloud .cloud-word")).transform,
        };
      });

      assert.ok(baseResult.academyWordCount >= 20, `学院侧应渲染为足量词云文本，当前数量 ${baseResult.academyWordCount}`);
      assert.ok(baseResult.websiteWordCount >= 20, `网站侧应渲染为足量词云文本，当前数量 ${baseResult.websiteWordCount}`);
      assert.equal(baseResult.legacyNodeCount, 0, `不应继续渲染卡片节点，当前数量 ${baseResult.legacyNodeCount}`);
      assert.equal(baseResult.academyOverlapCount, 0, `学院词云存在重叠，重叠对数 ${baseResult.academyOverlapCount}`);
      assert.equal(baseResult.websiteOverlapCount, 0, `网站词云存在重叠，重叠对数 ${baseResult.websiteOverlapCount}`);
      assert.ok(baseResult.timelineLabels.includes("2025"), "时间轴应包含 2025 分段");
      assert.ok(baseResult.academySampleNote.length > 0, "学院侧应存在样本提示文案");
      assert.match(hoverResult.tooltipText, /数量/);
      assert.match(hoverResult.tooltipText, /占比/);
      assert.match(hoverResult.tooltipText, /状态/);
      assert.match(hoverResult.hoveredWordClass, /is-hovered/);
      assert.notEqual(hoverResult.hoveredWordTransform, "none", "hover 时词语应有放大反馈");
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
