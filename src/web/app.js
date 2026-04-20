const state = {
  dataset: null,
  activeIndex: 0,
};

const CLOUD_LAYOUT = {
  width: 640,
  height: 420,
  centerX: 320,
  centerY: 210,
  scaleX: 0.84,
  scaleY: 0.82,
  paddingX: 20,
  paddingY: 24,
};

const WORD_LAYOUT = {
  sizeMin: 13,
  sizeMax: 22,
  sizeForZero: 12,
  minGap: 10,
  candidateOffsets: [
    [0, 0],
    [0, -30],
    [0, 30],
    [-34, 0],
    [34, 0],
    [-42, -24],
    [42, -24],
    [-42, 24],
    [42, 24],
    [-64, 0],
    [64, 0],
    [0, -54],
    [0, 54],
    [-74, -34],
    [74, -34],
    [-74, 34],
    [74, 34],
  ],
};

const STATE_LABELS = {
  new: "新出现",
  rise: "升温",
  fall: "回落",
  stable: "稳定",
};

const elements = {
  pageTitle: document.querySelector("#page-title"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  currentSegment: document.querySelector("#current-segment"),
  academyTitle: document.querySelector("#academy-title"),
  websiteTitle: document.querySelector("#website-title"),
  academyStats: document.querySelector("#academy-stats"),
  websiteStats: document.querySelector("#website-stats"),
  academyTopics: document.querySelector("#academy-topics"),
  websiteTopics: document.querySelector("#website-topics"),
  sharedTopics: document.querySelector("#shared-topics"),
  summaryLede: document.querySelector("#summary-lede"),
  summaryRange: document.querySelector("#summary-range"),
  summaryAcademyCount: document.querySelector("#summary-academy-count"),
  summaryWebsiteCount: document.querySelector("#summary-website-count"),
  academyCloud: document.querySelector("#academy-cloud"),
  websiteCloud: document.querySelector("#website-cloud"),
  timeline: document.querySelector("#timeline"),
  exportButton: document.querySelector("#export-button"),
  statTemplate: document.querySelector("#stat-template"),
};

void initialize();

async function initialize() {
  bindEvents();

  try {
    const response = await fetch("./data/comparison_timeline.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const dataset = await response.json();
    const segments = Array.isArray(dataset.segments) ? dataset.segments : [];
    if (segments.length === 0) {
      throw new Error("comparison_timeline.json 中没有可用 segment");
    }

    state.dataset = dataset;
    state.activeIndex = 0;

    renderTimeline();
    renderActiveSegment();
  } catch (error) {
    renderError(error instanceof Error ? error.message : "页面初始化失败");
  }
}

function bindEvents() {
  elements.exportButton?.addEventListener("click", () => {
    window.print();
  });
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

  elements.pageTitle.textContent = `研究主题演化对比 · ${segment.label}`;
  elements.pageSubtitle.textContent = buildSubtitle(segment.label, sharedTop);
  elements.currentSegment.textContent = segment.label;
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
  renderTopicList(elements.sharedTopics, sharedTop, (topic) => `学院 ${formatPercent(topic.academyShare)} / 网站 ${formatPercent(topic.websiteShare)}`);

  elements.summaryLede.textContent = buildSummary(segment.label, academyTop[0], websiteTop[0], sharedTop[0]);
  elements.summaryRange.textContent = `${state.dataset?.range ?? "-"} · 当前聚焦 ${segment.label}`;
  elements.summaryAcademyCount.textContent = formatNumber(summary.academySampleCount ?? academy.sampleCount ?? 0);
  elements.summaryWebsiteCount.textContent = formatNumber(summary.websiteSampleCount ?? website.sampleCount ?? 0);
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

  renderTopicCloud(elements.academyCloud, academy, segment?.label ?? "当前阶段", "academy");
  renderTopicCloud(elements.websiteCloud, website, segment?.label ?? "当前阶段", "website");
}

function renderTopicCloud(container, sideData, segmentLabel, sideKey) {
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

  const maxValue = Math.max(...topics.map((topic) => Number(topic.value) || 0), 1);
  const maxShare = Math.max(...topics.map((topic) => Number(topic.share) || 0), 0.01);
  const layouts = buildTopicLayouts(topics, { maxValue, maxShare });

  layouts.forEach((layout) => {
    svg.append(buildWordNode(layout, sideKey));
  });

  container.append(svg);
}

function buildTopicLayouts(topics, scale) {
  const placedBounds = [];

  const prioritized = topics
    .map((topic, index) => ({ topic, index }))
    .sort((left, right) => {
      return (Number(right.topic.value) || 0) - (Number(left.topic.value) || 0);
    });

  const layouts = prioritized.map(({ topic, index }) => {
    const point = mapTopicPosition(topic);
    const fontSize = buildTopicFontSize(topic, scale);
    const bounds = placeTopicBounds(topic, point, fontSize, placedBounds);
    placedBounds.push(bounds);

    return {
      topic,
      index,
      fontSize,
      x: bounds.cx,
      y: bounds.cy,
      isMuted: (Number(topic.value) || 0) === 0,
    };
  });

  return layouts.sort((left, right) => left.index - right.index);
}

function buildWordNode(layout, sideKey) {
  const node = createSvgElement("text");
  const { topic, fontSize, x, y, isMuted } = layout;
  const state = topic.state ?? "stable";

  node.setAttribute("class", `cloud-word side-${sideKey} state-${state}`);
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("font-size", String(fontSize));
  node.textContent = topic.text ?? "未命名主题";

  if (isMuted) {
    node.classList.add("is-muted");
  }

  const tooltip = createSvgElement("title");
  tooltip.textContent = `${topic.text}\n数量：${formatNumber(topic.value)}\n占比：${formatPercent(topic.share)}\n状态：${STATE_LABELS[state] ?? "稳定"}`;
  node.append(tooltip);

  return node;
}

function placeTopicBounds(topic, point, fontSize, placedBounds) {
  const width = estimateTopicWidth(topic.text ?? "", fontSize);
  const height = Math.max(fontSize * 1.2, WORD_LAYOUT.sizeMin + 2);
  const baseBounds = clampTopicBounds({ cx: point.x, cy: point.y, width, height });

  let fallback = {
    bounds: baseBounds,
    overlapArea: computeOverlapArea(baseBounds, placedBounds),
  };

  if (fallback.overlapArea === 0) {
    return fallback.bounds;
  }

  for (const [offsetX, offsetY] of WORD_LAYOUT.candidateOffsets) {
    const candidate = clampTopicBounds({
      cx: point.x + offsetX,
      cy: point.y + offsetY,
      width,
      height,
    });
    const overlapArea = computeOverlapArea(candidate, placedBounds);

    if (overlapArea === 0) {
      return candidate;
    }

    if (overlapArea < fallback.overlapArea) {
      fallback = { bounds: candidate, overlapArea };
    }
  }

  return fallback.bounds;
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
    return total + (/^[\u0000-\u00ff]$/.test(char) ? 0.56 : 0.96);
  }, 0);
  return Math.max(58, widthUnits * fontSize + 8);
}

function mapTopicPosition(topic) {
  return {
    x: CLOUD_LAYOUT.centerX + (Number(topic.x) || 0) * CLOUD_LAYOUT.scaleX,
    y: CLOUD_LAYOUT.centerY + (Number(topic.y) || 0) * CLOUD_LAYOUT.scaleY,
  };
}

function buildTopicFontSize(topic, scale) {
  if ((Number(topic.value) || 0) === 0) {
    return WORD_LAYOUT.sizeForZero;
  }

  const valueRatio = (Number(topic.value) || 0) / scale.maxValue;
  const shareRatio = (Number(topic.share) || 0) / scale.maxShare;
  const emphasis = Math.max(valueRatio * 0.48 + shareRatio * 0.52, 0);
  const span = WORD_LAYOUT.sizeMax - WORD_LAYOUT.sizeMin;
  return Math.round(WORD_LAYOUT.sizeMin + emphasis * span);
}

function createSvgElement(tagName) {
  return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

function buildSubtitle(segmentLabel, sharedTop) {
  if (!sharedTop.length) {
    return `${segmentLabel} 阶段已载入，可继续查看两侧主题统计与后续词云容器。`;
  }

  return `${segmentLabel} 阶段中，${sharedTop[0].text} 是双方最接近的共同焦点，可在下方对比样本规模与高频主题。`;
}

function buildSummary(segmentLabel, academyTop, websiteTop, sharedTop) {
  const academyText = academyTop?.text ?? "学院侧暂无主导主题";
  const websiteText = websiteTop?.text ?? "网站侧暂无主导主题";
  const sharedText = sharedTop?.text ?? "共同主题尚未形成";
  return `${segmentLabel} 阶段里，学院侧以“${academyText}”最突出，网站侧则更偏向“${websiteText}”，双方最有可比性的交集主题为“${sharedText}”。`;
}

function renderError(message) {
  elements.currentSegment.textContent = "加载失败";
  elements.pageSubtitle.textContent = message;
  renderCloudPanels(null);
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
