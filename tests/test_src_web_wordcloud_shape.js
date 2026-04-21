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
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--directory", WEB_ROOT], {
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

      const result = await page.evaluate(() => {
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
        };
      });

      assert.ok(result.academyWordCount >= 30, `学院侧应渲染为词云文本，当前数量 ${result.academyWordCount}`);
      assert.ok(result.websiteWordCount >= 30, `网站侧应渲染为词云文本，当前数量 ${result.websiteWordCount}`);
      assert.equal(result.legacyNodeCount, 0, `不应继续渲染卡片节点，当前数量 ${result.legacyNodeCount}`);
      assert.equal(result.academyOverlapCount, 0, `学院词云存在重叠，重叠对数 ${result.academyOverlapCount}`);
      assert.equal(result.websiteOverlapCount, 0, `网站词云存在重叠，重叠对数 ${result.websiteOverlapCount}`);
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
