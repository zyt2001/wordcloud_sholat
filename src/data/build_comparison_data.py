import json
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path


TARGET_SEGMENTS = [
    "2005-2011",
    "2012-2016",
    "2017-2019",
    "2020-2021",
    "2022-2023",
    "2024",
]

SIDE_NAMES = {
    "academy": "模拟学院用户",
    "website": "模拟网站用户",
}

SEGMENT_RULES = (
    (range(2005, 2012), "2005-2011"),
    (range(2012, 2017), "2012-2016"),
    (range(2017, 2020), "2017-2019"),
    (range(2020, 2022), "2020-2021"),
    (range(2022, 2024), "2022-2023"),
    (range(2024, 2025), "2024"),
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ACADEMY_GLOB = "社交网络应用/研究兴趣动态词云/datas/*_papers_by_year.json"
WEBSITE_GLOB = "社交网络应用/研究兴趣动态词云/arxiv_year3/*_papers.json"
WEBSITE_YEAR_PATTERN = re.compile(r"(\d{4})_papers\.json$")
OTHER_TOPIC_NAME = "未分类/其他"
FRONTEND_OUTPUT_PATH = PROJECT_ROOT / "src" / "web" / "data" / "comparison_timeline.json"

# Stable non-overlapping slots reused by both sides across all segments.
TOPIC_SLOT_LAYOUT = {
    "人工智能与机器学习": {"x": -280, "y": -170},
    "计算机视觉与多媒体": {"x": 0, "y": -170},
    "自然语言与语音": {"x": 280, "y": -170},
    "知识计算与数据智能": {"x": -280, "y": 0},
    "系统、软件与体系结构": {"x": 0, "y": 0},
    "网络、通信与安全": {"x": 280, "y": 0},
    "算法理论与形式化": {"x": -140, "y": 170},
    "交叉应用与智能场景": {"x": 140, "y": 170},
}


@lru_cache(maxsize=1)
def load_topic_mapping():
    mapping_path = Path(__file__).with_name("topic_mapping.json")
    with mapping_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


TOPIC_NAMES = list(load_topic_mapping().keys())
TOPIC_KEYS = {topic_name: rules["key"] for topic_name, rules in load_topic_mapping().items()}


def validate_public_topic_contract(mapping=None, slot_layout=None):
    mapping = mapping or load_topic_mapping()
    slot_layout = slot_layout or TOPIC_SLOT_LAYOUT

    mapping_topics = list(mapping.keys())
    slot_topics = list(slot_layout.keys())
    if set(mapping_topics) != set(slot_topics):
        raise ValueError("Public topic slot layout must match the public topic mapping exactly")

    topic_keys = [rules.get("key") for rules in mapping.values()]
    if any(not topic_key for topic_key in topic_keys):
        raise ValueError("Every public topic mapping must define a stable key")
    if len(set(topic_keys)) != len(topic_keys):
        raise ValueError("Public topic keys must be unique")


validate_public_topic_contract()


def validate_side(side):
    if side not in SIDE_NAMES:
        raise ValueError(f"Unsupported side: {side}")


def build_empty_topic_counts():
    return {topic_name: 0 for topic_name in TOPIC_NAMES}


def build_empty_segment_topic_counts():
    return {segment: build_empty_topic_counts() for segment in TARGET_SEGMENTS}


def assign_segment(year):
    for year_range, label in SEGMENT_RULES:
        if year in year_range:
            return label
    return None


def default_file_paths(side):
    validate_side(side)
    pattern = ACADEMY_GLOB if side == "academy" else WEBSITE_GLOB
    return sorted(PROJECT_ROOT.glob(pattern))


def score_topic_match(paper, rules):
    category_tokens = set((paper.get("categories") or "").split())
    text = " ".join([paper.get("title") or "", paper.get("abstract") or ""]).lower()
    category_hits = len(category_tokens.intersection(rules["categories"]))
    keyword_hits = sum(1 for keyword in rules["keywords"] if keyword in text)
    return category_hits, keyword_hits


def categorize_paper(paper):
    mapping = load_topic_mapping()
    best_match = None

    for topic_name, rules in mapping.items():
        category_hits, keyword_hits = score_topic_match(paper, rules)
        if category_hits == 0 and keyword_hits == 0:
            continue

        score = (category_hits, keyword_hits, -rules.get("priority", 1000), topic_name)
        if best_match is None or score > best_match[0]:
            best_match = (score, topic_name)

    if best_match is None:
        return OTHER_TOPIC_NAME

    return best_match[1]


def iter_source_papers(side, file_paths=None):
    validate_side(side)
    source_paths = [Path(path) for path in (file_paths or default_file_paths(side))]

    if side == "academy":
        for file_path in source_paths:
            with file_path.open("r", encoding="utf-8") as handle:
                papers_by_year = json.load(handle)

            for year_text, papers in papers_by_year.items():
                year = int(year_text)
                if assign_segment(year) is None:
                    continue
                for paper in papers:
                    yield year, paper
        return

    for file_path in source_paths:
        match = WEBSITE_YEAR_PATTERN.search(file_path.name)
        if not match:
            continue

        year = int(match.group(1))
        if assign_segment(year) is None:
            continue

        with file_path.open("r", encoding="utf-8") as handle:
            papers = json.load(handle)

        for paper in papers:
            yield year, paper


def build_side_topic_counts(side, file_paths=None):
    return build_side_counts_bundle(side, file_paths=file_paths)["segmentTopicCounts"]


def build_side_other_counts(side, file_paths=None):
    return build_side_counts_bundle(side, file_paths=file_paths)["segmentOtherCounts"]


def build_side_counts_bundle(side, file_paths=None):
    validate_side(side)
    segment_counters = {segment: Counter() for segment in TARGET_SEGMENTS}
    other_counts = {segment: 0 for segment in TARGET_SEGMENTS}
    sample_counts = {segment: 0 for segment in TARGET_SEGMENTS}

    for year, paper in iter_source_papers(side, file_paths=file_paths):
        segment = assign_segment(year)
        if segment is None:
            continue
        sample_counts[segment] += 1
        topic = categorize_paper(paper)

        if topic == OTHER_TOPIC_NAME:
            other_counts[segment] += 1
            continue

        segment_counters[segment][topic] += 1

    stable_counts = build_empty_segment_topic_counts()
    for segment, counter in segment_counters.items():
        for topic_name, value in counter.items():
            stable_counts[segment][topic_name] = value

    return {
        "segmentTopicCounts": stable_counts,
        "segmentOtherCounts": other_counts,
        "segmentSampleCounts": sample_counts,
    }


def build_side_payload(side, file_paths=None):
    counts_bundle = build_side_counts_bundle(side, file_paths=file_paths)
    return {
        "name": SIDE_NAMES[side],
        "segmentTopicCounts": counts_bundle["segmentTopicCounts"],
        "segmentOtherCounts": counts_bundle["segmentOtherCounts"],
        "segmentSampleCounts": counts_bundle["segmentSampleCounts"],
    }


def build_topic_entry(topic_name, value, total, previous_value):
    if value > 0 and previous_value == 0:
        state = "new"
    elif value > previous_value:
        state = "rise"
    elif value < previous_value:
        state = "fall"
    else:
        state = "stable"

    slot = TOPIC_SLOT_LAYOUT[topic_name]
    share = 0 if total == 0 else round(value / total, 4)
    return {
        "key": TOPIC_KEYS[topic_name],
        "text": topic_name,
        "value": value,
        "share": share,
        "state": state,
        "x": slot["x"],
        "y": slot["y"],
    }


def build_segment_side_payload(side_payload, segment, previous_counts):
    total = side_payload["segmentSampleCounts"][segment]
    topics = []

    for topic_name in TOPIC_NAMES:
        value = side_payload["segmentTopicCounts"][segment][topic_name]
        previous_value = previous_counts.get(topic_name, 0)
        topics.append(build_topic_entry(topic_name, value, total, previous_value))

    return {
        "name": side_payload["name"],
        "sampleCount": total,
        "otherCount": side_payload["segmentOtherCounts"][segment],
        "topics": topics,
    }


def build_top_topics(topic_counts, total):
    ranked_topics = sorted(
        topic_counts.items(),
        key=lambda item: (-item[1], TOPIC_NAMES.index(item[0])),
    )
    return [
        {
            "key": TOPIC_KEYS[topic_name],
            "text": topic_name,
            "value": value,
            "share": 0 if total == 0 else round(value / total, 4),
        }
        for topic_name, value in ranked_topics[:3]
        if value > 0
    ]


def build_shared_top_topics(academy_counts, website_counts, academy_total, website_total):
    shared_topics = []

    for topic_name in TOPIC_NAMES:
        academy_value = academy_counts[topic_name]
        website_value = website_counts[topic_name]
        if academy_value == 0 or website_value == 0:
            continue
        academy_share = 0 if academy_total == 0 else round(academy_value / academy_total, 4)
        website_share = 0 if website_total == 0 else round(website_value / website_total, 4)
        balance_score = 0 if academy_share + website_share == 0 else round((2 * academy_share * website_share) / (academy_share + website_share), 4)
        shared_topics.append(
            {
                "key": TOPIC_KEYS[topic_name],
                "text": topic_name,
                "academyValue": academy_value,
                "websiteValue": website_value,
                "academyShare": academy_share,
                "websiteShare": website_share,
                "balanceScore": balance_score,
            }
        )

    return sorted(
        shared_topics,
        key=lambda item: (-item["balanceScore"], -min(item["academyShare"], item["websiteShare"]), TOPIC_NAMES.index(item["text"])),
    )[:3]


def build_segment_summary(academy_payload, website_payload, segment):
    academy_counts = academy_payload["segmentTopicCounts"][segment]
    website_counts = website_payload["segmentTopicCounts"][segment]
    academy_total = academy_payload["segmentSampleCounts"][segment]
    website_total = website_payload["segmentSampleCounts"][segment]

    return {
        "academyTop": build_top_topics(academy_counts, academy_total),
        "websiteTop": build_top_topics(website_counts, website_total),
        "sharedTop": build_shared_top_topics(academy_counts, website_counts, academy_total, website_total),
        "academySampleCount": academy_total,
        "websiteSampleCount": website_total,
        "academyClassifiedCount": academy_total - academy_payload["segmentOtherCounts"][segment],
        "websiteClassifiedCount": website_total - website_payload["segmentOtherCounts"][segment],
        "academyOtherCount": academy_payload["segmentOtherCounts"][segment],
        "websiteOtherCount": website_payload["segmentOtherCounts"][segment],
    }


def build_comparison_payload(academy_file_paths=None, website_file_paths=None):
    validate_public_topic_contract()
    academy_payload = build_side_payload("academy", file_paths=academy_file_paths)
    website_payload = build_side_payload("website", file_paths=website_file_paths)
    segment_payloads = []

    previous_academy_counts = build_empty_topic_counts()
    previous_website_counts = build_empty_topic_counts()

    for segment in TARGET_SEGMENTS:
        academy_segment = build_segment_side_payload(academy_payload, segment, previous_academy_counts)
        website_segment = build_segment_side_payload(website_payload, segment, previous_website_counts)
        segment_payloads.append(
            {
                "label": segment,
                "academy": academy_segment,
                "website": website_segment,
                "summary": build_segment_summary(academy_payload, website_payload, segment),
            }
        )
        previous_academy_counts = academy_payload["segmentTopicCounts"][segment]
        previous_website_counts = website_payload["segmentTopicCounts"][segment]

    return {
        "range": "2005-2024",
        "segments": segment_payloads,
    }


def build_frontend_timeline_json(academy_file_paths=None, website_file_paths=None, output_path=None):
    payload = build_comparison_payload(
        academy_file_paths=academy_file_paths,
        website_file_paths=website_file_paths,
    )
    output_path = Path(output_path) if output_path is not None else FRONTEND_OUTPUT_PATH
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return output_path


if __name__ == "__main__":
    output_path = build_frontend_timeline_json()
    print(output_path)
