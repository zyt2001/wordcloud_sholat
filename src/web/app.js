const state = {
  dataset: null,
  keywords: null,
  activeIndex: 0,
};

const CLOUD_LAYOUT = {
  width: 760,
  height: 540,
  centerX: 380,
  centerY: 270,
  paddingX: 20,
  paddingY: 20,
  scaleX: 1.28,
  scaleY: 1.04,
};

const WORD_LAYOUT = {
  sizeMin: 11,
  sizeMax: 42,
  minGap: 10,
  rotateChance: 0.18,
  clusterOffsets: [
    [-136, -82],
    [134, -74],
    [-118, 74],
    [122, 78],
    [0, -96],
    [0, 96],
  ],
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
  academySampleNote: document.querySelector("#academy-sample-note"),
  websiteSampleNote: document.querySelector("#website-sample-note"),
  academyStats: document.querySelector("#academy-stats"),
  websiteStats: document.querySelector("#website-stats"),
  academyTopics: document.querySelector("#academy-topics"),
  websiteTopics: document.querySelector("#website-topics"),
  academyCloud: document.querySelector("#academy-cloud"),
  websiteCloud: document.querySelector("#website-cloud"),
  timeline: document.querySelector("#timeline"),
  statTemplate: document.querySelector("#stat-template"),
  cloudTooltip: document.querySelector("#cloud-tooltip"),
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
  renderSampleNote(elements.academySampleNote, summary.academySampleWarningLevel, summary.academySampleNote);
  renderSampleNote(elements.websiteSampleNote, summary.websiteSampleWarningLevel, summary.websiteSampleNote);

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

   hideTooltip();

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
    const keywordLimit = share >= 0.22 ? 0 : share >= 0.12 ? 2 : 3;
    const subKeywords = (kwData?.keywords ?? [])
      .filter((keyword) => !topic.text.includes(keyword))
      .slice(0, keywordLimit);

    if (value > 0) {
      words.push({
        text: topic.text,
        weight: share,
        topicKey,
        color,
        isCategory: true,
        rotated: false,
        isMuted: false,
        topic,
        rawValue: value,
        rawShare: share,
        state: topic.state,
        parentTopicText: topic.text,
      });
    }

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
          rawValue: value,
          rawShare: share,
          state: topic.state,
          parentTopicText: topic.text,
          keywordIndex: rank,
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

  const groupedWords = new Map();
  for (const word of wordList) {
    const list = groupedWords.get(word.topicKey) ?? [];
    list.push(word);
    groupedWords.set(word.topicKey, list);
  }

  for (const group of groupedWords.values()) {
    const categoryWord = group.find((word) => word.isCategory);
    if (!categoryWord) {
      continue;
    }

    const anchor = mapTopicAnchor(categoryWord.topic);
    const orderedWords = [categoryWord, ...group.filter((word) => !word.isCategory).sort((left, right) => (left.keywordIndex ?? 0) - (right.keywordIndex ?? 0))];

    orderedWords.forEach((word, index) => {
      const fontSize = wordToFontSize(word, maxWeight);
      const textWidth = estimateTopicWidth(word.text, fontSize);
      const textHeight = fontSize * 1.4;
      const bboxW = word.rotated ? textHeight : textWidth;
      const bboxH = word.rotated ? textWidth : textHeight;
      const candidateCenter = index === 0 ? anchor : {
        x: anchor.x + (WORD_LAYOUT.clusterOffsets[index - 1]?.[0] ?? 0),
        y: anchor.y + (WORD_LAYOUT.clusterOffsets[index - 1]?.[1] ?? 0),
      };
      const result = placeNearAnchor(candidateCenter, bboxW, bboxH, placedBounds);
      if (!result) {
        return;
      }

      placedBounds.push(result);
      layouts.push({
        word,
        fontSize,
        x: result.cx,
        y: result.cy,
        rotated: word.rotated,
      });
    });
  }

  return layouts;
}

function wordToFontSize(word, maxWeight) {
  if (word.isMuted) return WORD_LAYOUT.sizeMin;
  const ratio = word.weight / maxWeight;
  const span = WORD_LAYOUT.sizeMax - WORD_LAYOUT.sizeMin;
  const size = WORD_LAYOUT.sizeMin + Math.pow(ratio, 0.6) * span;

  if (word.isCategory) {
    return Math.round(Math.min(34, Math.max(18, size * 0.88)));
  }

  return Math.round(Math.max(WORD_LAYOUT.sizeMin, size * 0.78));
}

function placeNearAnchor(anchor, width, height, placedBounds) {
  const candidates = [
    [0, 0],
    [0, -28],
    [0, 28],
    [-28, 0],
    [28, 0],
    [-42, -24],
    [42, -24],
    [-42, 24],
    [42, 24],
    [-56, 0],
    [56, 0],
    [0, -52],
    [0, 52],
  ];

  let bestCandidate = null;
  let bestOverlap = Infinity;

  for (const [offsetX, offsetY] of candidates) {
    const candidate = clampTopicBounds({
      cx: anchor.x + offsetX,
      cy: anchor.y + offsetY,
      width,
      height,
    });
    const overlap = computeOverlapArea(candidate, placedBounds);
    if (overlap === 0) {
      return candidate;
    }
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function mapTopicAnchor(topic) {
  const key = topic?.key;
  const yNudge = key === "cv-multimedia" ? -22 : key === "ai-ml" || key === "nlp-speech" ? 18 : 0;

  return {
    x: CLOUD_LAYOUT.centerX + (Number(topic?.x) || 0) * CLOUD_LAYOUT.scaleX,
    y: CLOUD_LAYOUT.centerY + (Number(topic?.y) || 0) * CLOUD_LAYOUT.scaleY + yNudge,
  };
}

function buildWordNode(layout) {
  const { word, fontSize, x, y, rotated } = layout;
  const node = createSvgElement("text");

  node.setAttribute("class", "cloud-word");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("font-size", String(fontSize));
  node.setAttribute("fill", word.color);
  node.setAttribute("tabindex", "0");
  node.textContent = word.text;

  if (rotated) {
    node.setAttribute("transform", `rotate(90, ${x}, ${y})`);
  }

  node.classList.toggle("is-category", word.isCategory);
  node.classList.toggle("is-subkeyword", !word.isCategory);

  if (word.isMuted) {
    node.classList.add("is-muted");
  }

  const tooltip = createSvgElement("title");
  tooltip.textContent = buildTooltipText(word);
  node.append(tooltip);

  node.addEventListener("pointerenter", (event) => activateWord(node, word, event));
  node.addEventListener("pointermove", updateTooltipPosition);
  node.addEventListener("pointerleave", () => deactivateWord(node));
  node.addEventListener("focus", (event) => activateWord(node, word, event));
  node.addEventListener("blur", () => deactivateWord(node));

  return node;
}

function buildTooltipText(word) {
  const lines = [word.text];

  if (!word.isCategory) {
    lines.push(`所属：${word.parentTopicText}`);
  }

  lines.push(`数量：${formatNumber(word.rawValue ?? 0)}`);
  lines.push(`占比：${formatPercent(word.rawShare ?? 0)}`);
  lines.push(`状态：${STATE_LABELS[word.state] ?? "稳定"}`);
  return lines.join("\n");
}

function renderSampleNote(element, level, note) {
  if (!element) {
    return;
  }

  const visible = level === "caution" && Boolean(note);
  element.hidden = !visible;
  element.dataset.level = visible ? level : "none";
  element.textContent = visible ? note : "";
}

function activateWord(node, word, event) {
  clearHoveredWords();
  node.classList.add("is-hovered");
  node.parentNode?.append(node);
  showTooltip(word, event, node);
}

function deactivateWord(node) {
  node.classList.remove("is-hovered");
  hideTooltip();
}

function clearHoveredWords() {
  document.querySelectorAll(".cloud-word.is-hovered").forEach((node) => {
    node.classList.remove("is-hovered");
  });
}

function showTooltip(word, event, node) {
  if (!elements.cloudTooltip) {
    return;
  }

  elements.cloudTooltip.hidden = false;
  elements.cloudTooltip.textContent = buildTooltipText(word);

  if (event?.clientX != null && event?.clientY != null) {
    updateTooltipPosition(event);
    return;
  }

  if (node) {
    const rect = node.getBoundingClientRect();
    updateTooltipPosition({
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
  }
}

function updateTooltipPosition(event) {
  if (!elements.cloudTooltip || elements.cloudTooltip.hidden || !event) {
    return;
  }

  const offset = 18;
  const tooltipRect = elements.cloudTooltip.getBoundingClientRect();
  const maxLeft = Math.max(8, window.innerWidth - tooltipRect.width - 8);
  const maxTop = Math.max(8, window.innerHeight - tooltipRect.height - 8);
  const left = Math.min(maxLeft, Math.max(8, event.clientX + offset));
  const top = Math.min(maxTop, Math.max(8, event.clientY + offset));

  elements.cloudTooltip.style.left = `${left}px`;
  elements.cloudTooltip.style.top = `${top}px`;
}

function hideTooltip() {
  if (!elements.cloudTooltip) {
    return;
  }

  elements.cloudTooltip.hidden = true;
  elements.cloudTooltip.textContent = "";
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
    return total + (/^[\u0000-\u00ff]$/.test(char) ? 0.7 : 1.22);
  }, 0);
  return Math.max(34, widthUnits * fontSize + 18);
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
