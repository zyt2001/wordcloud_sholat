const state = {
  dataset: null,
  keywords: null,
  activeIndex: 0,
};

const CLOUD_LAYOUT = {
  width: 640,
  height: 480,
  centerX: 320,
  centerY: 240,
  paddingX: 16,
  paddingY: 16,
};

const WORD_LAYOUT = {
  sizeMin: 11,
  sizeMax: 42,
  minGap: 4,
  spiralStep: 0.15,
  spiralGrowth: 0.45,
  maxIterations: 4000,
  rotateChance: 0.3,
};

const STATE_LABELS = {
  new: "新出现",
  rise: "升温",
  fall: "回落",
  stable: "稳定",
};

const elements = {
  academyTitle: document.querySelector("#academy-title"),
  websiteTitle: document.querySelector("#website-title"),
  academyStats: document.querySelector("#academy-stats"),
  websiteStats: document.querySelector("#website-stats"),
  academyTopics: document.querySelector("#academy-topics"),
  websiteTopics: document.querySelector("#website-topics"),
  academyCloud: document.querySelector("#academy-cloud"),
  websiteCloud: document.querySelector("#website-cloud"),
  timeline: document.querySelector("#timeline"),
  statTemplate: document.querySelector("#stat-template"),
};

void initialize();

async function initialize() {
  try {
    const [timelineResponse, keywordsResponse] = await Promise.all([
      fetch("./data/comparison_timeline.json"),
      fetch("./data/topic_keywords.json"),
    ]);

    if (!timelineResponse.ok) {
      throw new Error(`HTTP ${timelineResponse.status}`);
    }
    if (!keywordsResponse.ok) {
      throw new Error(`Keywords HTTP ${keywordsResponse.status}`);
    }

    const dataset = await timelineResponse.json();
    const keywords = await keywordsResponse.json();
    const segments = Array.isArray(dataset.segments) ? dataset.segments : [];
    if (segments.length === 0) {
      throw new Error("comparison_timeline.json 中没有可用 segment");
    }

    state.dataset = dataset;
    state.keywords = keywords;
    state.activeIndex = 0;

    renderTimeline();
    renderActiveSegment();
  } catch (error) {
    renderError(error instanceof Error ? error.message : "页面初始化失败");
  }
}

function renderTimeline() {
  const segments = state.dataset?.segments ?? [];

  elements.timeline.replaceChildren(
    ...segments.map((segment, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(index === state.activeIndex));
      button.dataset.index = String(index);

      const label = document.createElement("span");
      label.className = "timeline-label";
      label.textContent = segment.label;

      const count = document.createElement("span");
      count.className = "timeline-count";
      count.textContent = buildTimelineCount(segment);

      button.append(label, count);
      button.addEventListener("click", () => {
        state.activeIndex = index;
        renderActiveSegment();
        syncTimelineState();
      });
      return button;
    })
  );

  syncTimelineState();
}

function syncTimelineState() {
  const buttons = elements.timeline.querySelectorAll(".timeline-button");
  buttons.forEach((button, index) => {
    const isActive = index === state.activeIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function renderActiveSegment() {
  const segment = state.dataset?.segments?.[state.activeIndex];
  if (!segment) {
    return;
  }

  const summary = segment.summary ?? {};
  const academy = segment.academy ?? {};
  const website = segment.website ?? {};
  const sharedTop = Array.isArray(summary.sharedTop) ? summary.sharedTop : [];
  const academyTop = Array.isArray(summary.academyTop) ? summary.academyTop : [];
  const websiteTop = Array.isArray(summary.websiteTop) ? summary.websiteTop : [];

  elements.academyTitle.textContent = academy.name ?? "模拟学院用户";
  elements.websiteTitle.textContent = website.name ?? "模拟网站用户";

  renderCloudPanels(segment);

  renderStats(elements.academyStats, [
    ["样本总量", summary.academySampleCount ?? academy.sampleCount ?? 0],
    ["归类条目", summary.academyClassifiedCount ?? Math.max((academy.sampleCount ?? 0) - (academy.otherCount ?? 0), 0)],
    ["其他主题", summary.academyOtherCount ?? academy.otherCount ?? 0],
    ["主导主题", academyTop[0]?.text ?? "暂无"],
  ]);

  renderStats(elements.websiteStats, [
    ["样本总量", summary.websiteSampleCount ?? website.sampleCount ?? 0],
    ["归类条目", summary.websiteClassifiedCount ?? Math.max((website.sampleCount ?? 0) - (website.otherCount ?? 0), 0)],
    ["其他主题", summary.websiteOtherCount ?? website.otherCount ?? 0],
    ["主导主题", websiteTop[0]?.text ?? "暂无"],
  ]);

  renderTopicList(elements.academyTopics, academyTop, (topic) => `${formatPercent(topic.share)} · ${formatNumber(topic.value)}`);
  renderTopicList(elements.websiteTopics, websiteTop, (topic) => `${formatPercent(topic.share)} · ${formatNumber(topic.value)}`);
}

function renderStats(container, stats) {
  container.replaceChildren(
    ...stats.map(([label, value]) => {
      const fragment = elements.statTemplate.content.cloneNode(true);
      fragment.querySelector(".stat-label").textContent = label;
      fragment.querySelector(".stat-value").textContent = typeof value === "number" ? formatNumber(value) : String(value);
      return fragment;
    })
  );
}

function renderTopicList(container, topics, metaBuilder) {
  if (!topics.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "当前阶段暂无可展示主题。";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...topics.map((topic, index) => {
      const item = document.createElement("li");

      const name = document.createElement("span");
      name.className = "summary-name";
      name.textContent = `${index + 1}. ${topic.text}`;

      const meta = document.createElement("span");
      meta.className = "summary-meta";
      meta.textContent = metaBuilder(topic);

      item.append(name, meta);
      return item;
    })
  );
}

function renderCloudPanels(segment) {
  const academy = segment?.academy ?? null;
  const website = segment?.website ?? null;

  renderTopicCloud(elements.academyCloud, academy, segment?.label ?? "当前阶段");
  renderTopicCloud(elements.websiteCloud, website, segment?.label ?? "当前阶段");
}

function renderTopicCloud(container, sideData, segmentLabel) {
  if (!container) {
    return;
  }

  const topics = Array.isArray(sideData?.topics) ? sideData.topics : [];
  container.dataset.segment = segmentLabel;
  container.replaceChildren();

  if (!topics.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `${sideData?.name ?? "当前侧"} 在 ${segmentLabel} 暂无可展示主题。`;
    container.append(empty);
    return;
  }

  const svg = createSvgElement("svg");
  svg.classList.add("cloud-svg");
  svg.setAttribute("viewBox", `0 0 ${CLOUD_LAYOUT.width} ${CLOUD_LAYOUT.height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${sideData?.name ?? "当前侧"} ${segmentLabel} 主题词云`);

  const wordList = expandTopicsToWords(topics, state.keywords);
  const layouts = buildSpiralLayouts(wordList);

  layouts.forEach((layout) => {
    svg.append(buildWordNode(layout));
  });

  container.append(svg);
}

function expandTopicsToWords(topics, keywordMap) {
  const words = [];
  const seededRandom = createSeededRandom(42);

  for (const topic of topics) {
    const share = Number(topic.share) || 0;
    const value = Number(topic.value) || 0;
    const topicKey = topic.key;
    const kwData = keywordMap?.[topicKey];
    const color = kwData?.color ?? "#555";
    const subKeywords = kwData?.keywords ?? [];

    words.push({
      text: topic.text,
      weight: share,
      topicKey,
      color,
      isCategory: true,
      rotated: false,
      isMuted: value === 0,
      topic,
    });

    if (value > 0) {
      subKeywords.forEach((kw, rank) => {
        words.push({
          text: kw,
          weight: share * Math.pow(0.7, rank + 1),
          topicKey,
          color,
          isCategory: false,
          rotated: seededRandom() < WORD_LAYOUT.rotateChance,
          isMuted: false,
          topic,
        });
      });
    }
  }

  words.sort((a, b) => b.weight - a.weight);
  return words;
}

function createSeededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function buildSpiralLayouts(wordList) {
  if (!wordList.length) return [];

  const maxWeight = Math.max(...wordList.map((w) => w.weight), 0.001);
  const placedBounds = [];
  const layouts = [];

  for (const word of wordList) {
    const fontSize = wordToFontSize(word, maxWeight);
    const textWidth = estimateTopicWidth(word.text, fontSize);
    const textHeight = fontSize * 1.4;
    const bboxW = word.rotated ? textHeight : textWidth;
    const bboxH = word.rotated ? textWidth : textHeight;

    const result = spiralPlace(bboxW, bboxH, placedBounds);
    if (!result) continue;

    placedBounds.push(result);

    layouts.push({
      word,
      fontSize,
      x: result.cx,
      y: result.cy,
      rotated: word.rotated,
    });
  }

  return layouts;
}

function wordToFontSize(word, maxWeight) {
  if (word.isMuted) return WORD_LAYOUT.sizeMin;
  const ratio = word.weight / maxWeight;
  const span = WORD_LAYOUT.sizeMax - WORD_LAYOUT.sizeMin;
  return Math.round(WORD_LAYOUT.sizeMin + Math.pow(ratio, 0.6) * span);
}

function spiralPlace(width, height, placedBounds) {
  for (let i = 0; i < WORD_LAYOUT.maxIterations; i++) {
    const theta = i * WORD_LAYOUT.spiralStep;
    const r = WORD_LAYOUT.spiralGrowth * theta;
    const cx = CLOUD_LAYOUT.centerX + r * Math.cos(theta);
    const cy = CLOUD_LAYOUT.centerY + r * Math.sin(theta);

    const candidate = clampTopicBounds({ cx, cy, width, height });
    const overlap = computeOverlapArea(candidate, placedBounds);

    if (overlap === 0) {
      return candidate;
    }
  }

  return null;
}

function buildWordNode(layout) {
  const { word, fontSize, x, y, rotated } = layout;
  const node = createSvgElement("text");

  node.setAttribute("class", "cloud-word");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("font-size", String(fontSize));
  node.setAttribute("fill", word.color);
  node.textContent = word.text;

  if (rotated) {
    node.setAttribute("transform", `rotate(90, ${x}, ${y})`);
  }

  if (word.isMuted) {
    node.classList.add("is-muted");
  }

  const tooltip = createSvgElement("title");
  const topicData = word.topic;
  if (word.isCategory) {
    tooltip.textContent = `${word.text}\n数量：${formatNumber(topicData.value)}\n占比：${formatPercent(topicData.share)}\n状态：${STATE_LABELS[topicData.state] ?? "稳定"}`;
  } else {
    tooltip.textContent = `${word.text}\n所属：${topicData.text}`;
  }
  node.append(tooltip);

  return node;
}

function computeOverlapArea(candidate, placedBounds) {
  const halfGap = WORD_LAYOUT.minGap / 2;

  return placedBounds.reduce((total, current) => {
    const overlapWidth = Math.min(candidate.right + halfGap, current.right + halfGap) - Math.max(candidate.left - halfGap, current.left - halfGap);
    const overlapHeight = Math.min(candidate.bottom + halfGap, current.bottom + halfGap) - Math.max(candidate.top - halfGap, current.top - halfGap);

    if (overlapWidth <= 0 || overlapHeight <= 0) {
      return total;
    }

    return total + overlapWidth * overlapHeight;
  }, 0);
}

function clampTopicBounds(rect) {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const minX = CLOUD_LAYOUT.paddingX + halfWidth;
  const maxX = CLOUD_LAYOUT.width - CLOUD_LAYOUT.paddingX - halfWidth;
  const minY = CLOUD_LAYOUT.paddingY + halfHeight;
  const maxY = CLOUD_LAYOUT.height - CLOUD_LAYOUT.paddingY - halfHeight;
  const cx = Math.min(maxX, Math.max(minX, rect.cx));
  const cy = Math.min(maxY, Math.max(minY, rect.cy));

  return {
    cx,
    cy,
    left: cx - halfWidth,
    right: cx + halfWidth,
    top: cy - halfHeight,
    bottom: cy + halfHeight,
  };
}

function estimateTopicWidth(text, fontSize) {
  const widthUnits = Array.from(String(text)).reduce((total, char) => {
    return total + (/^[\u0000-\u00ff]$/.test(char) ? 0.6 : 1.05);
  }, 0);
  return Math.max(30, widthUnits * fontSize + 10);
}

function createSvgElement(tagName) {
  return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

function renderError(message) {
  const errorBlock = document.createElement("div");
  errorBlock.className = "empty-state";
  errorBlock.textContent = `数据读取失败：${message}`;
  elements.timeline.replaceChildren(errorBlock);
}

function buildTimelineCount(segment) {
  const academyCount = segment.summary?.academySampleCount ?? segment.academy?.sampleCount ?? 0;
  const websiteCount = segment.summary?.websiteSampleCount ?? segment.website?.sampleCount ?? 0;
  return `学院 ${formatNumber(academyCount)} / 网站 ${formatNumber(websiteCount)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value) || 0);
}

function formatPercent(value) {
  return `${((Number(value) || 0) * 100).toFixed(1)}%`;
}
