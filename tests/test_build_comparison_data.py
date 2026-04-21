import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from src.data.build_comparison_data import (
    OTHER_TOPIC_NAME,
    TARGET_SEGMENTS,
    TOPIC_NAMES,
    assign_segment,
    build_comparison_payload,
    build_frontend_timeline_json,
    build_shared_top_topics,
    build_side_topic_counts,
    categorize_paper,
    validate_public_topic_contract,
)


ROOT = Path(__file__).resolve().parents[1]


class BuildComparisonDataTests(unittest.TestCase):
    def create_sample_sources(self):
        temp_dir = tempfile.TemporaryDirectory()
        root = Path(temp_dir.name)

        academy_path = root / "academy.json"
        academy_payload = {
            "2005": [
                {"categories": "cs.AI", "title": "learning systems", "abstract": ""},
            ],
            "2012": [
                {"categories": "cs.AI", "title": "learning systems", "abstract": ""},
            ],
            "2017": [
                {"categories": "cs.AI", "title": "learning systems", "abstract": ""},
                {"categories": "cs.AI", "title": "learning systems", "abstract": ""},
                {"categories": "cs.CV", "title": "image systems", "abstract": ""},
            ],
            "2020": [
                {"categories": "cs.AI", "title": "learning systems", "abstract": ""},
            ],
            "2022": [
                {"categories": "cs.AI", "title": "learning systems", "abstract": ""},
            ],
            "2024": [
                {"categories": "cs.DB", "title": "database systems", "abstract": ""},
                {"categories": "physics.gen-ph", "title": "unmapped", "abstract": ""},
            ],
            "2025": [
                {"categories": "cs.AI", "title": "foundation learning", "abstract": ""},
                {"categories": "cs.CV", "title": "vision reasoning", "abstract": ""},
            ],
        }
        academy_path.write_text(json.dumps(academy_payload, ensure_ascii=False), encoding="utf-8")

        website_paths = []
        website_payloads = {
            "2012_papers.json": [
                {"categories": "cs.CV", "title": "image systems", "abstract": ""},
            ],
            "2017_papers.json": [
                {"categories": "cs.CV", "title": "image systems", "abstract": ""},
                {"categories": "cs.CV", "title": "image systems", "abstract": ""},
            ],
            "2020_papers.json": [
                {"categories": "cs.CV", "title": "image systems", "abstract": ""},
            ],
            "2022_papers.json": [
                {"categories": "cs.CV", "title": "image systems", "abstract": ""},
            ],
            "2024_papers.json": [
                {"categories": "cs.RO", "title": "robot systems", "abstract": "medical application"},
            ],
            "2025_papers.json": [
                {"categories": "cs.AI", "title": "agent learning", "abstract": ""},
                {"categories": "cs.CV", "title": "vision perception", "abstract": ""},
                {"categories": "cs.CV", "title": "image understanding", "abstract": ""},
            ] + [{"categories": "cs.CV", "title": f"vision sample {index}", "abstract": ""} for index in range(17)],
        }

        for file_name, payload in website_payloads.items():
            file_path = root / file_name
            file_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            website_paths.append(file_path)

        self.addCleanup(temp_dir.cleanup)
        return [academy_path], website_paths

    def build_sample_payload(self):
        academy_paths, website_paths = self.create_sample_sources()
        return build_comparison_payload(
            academy_file_paths=academy_paths,
            website_file_paths=website_paths,
        )

    def find_topic(self, side_payload, topic_name):
        return next(topic for topic in side_payload["topics"] if topic["text"] == topic_name)

    def test_target_segments_match_redesign_spec(self):
        self.assertEqual(
            TARGET_SEGMENTS,
            [
                "2005-2011",
                "2012-2016",
                "2017-2019",
                "2020-2021",
                "2022-2023",
                "2024",
                "2025",
            ],
        )

    def test_academy_year_2005_falls_into_2005_2011(self):
        academy_paths, _ = self.create_sample_sources()
        counts = build_side_topic_counts("academy", file_paths=academy_paths)
        self.assertIn("2005-2011", counts)
        self.assertGreater(sum(counts["2005-2011"].values()), 0)

    def test_website_year_2024_falls_into_2024_segment(self):
        _, website_paths = self.create_sample_sources()
        counts = build_side_topic_counts("website", file_paths=website_paths)
        self.assertIn("2024", counts)
        self.assertGreater(sum(counts["2024"].values()), 0)

    def test_website_year_2025_falls_into_2025_segment(self):
        _, website_paths = self.create_sample_sources()
        counts = build_side_topic_counts("website", file_paths=website_paths)
        self.assertIn("2025", counts)
        self.assertGreater(sum(counts["2025"].values()), 0)

    def test_assign_segment_covers_all_boundaries(self):
        self.assertEqual(assign_segment(2004), None)
        self.assertEqual(assign_segment(2005), "2005-2011")
        self.assertEqual(assign_segment(2011), "2005-2011")
        self.assertEqual(assign_segment(2012), "2012-2016")
        self.assertEqual(assign_segment(2016), "2012-2016")
        self.assertEqual(assign_segment(2017), "2017-2019")
        self.assertEqual(assign_segment(2019), "2017-2019")
        self.assertEqual(assign_segment(2020), "2020-2021")
        self.assertEqual(assign_segment(2021), "2020-2021")
        self.assertEqual(assign_segment(2022), "2022-2023")
        self.assertEqual(assign_segment(2023), "2022-2023")
        self.assertEqual(assign_segment(2024), "2024")
        self.assertEqual(assign_segment(2025), "2025")
        self.assertEqual(assign_segment(2026), None)

    def test_topic_mapping_outputs_public_topics_for_known_matches(self):

        topics = {
            categorize_paper({"categories": "cs.AI cs.LG", "title": "", "abstract": ""}),
            categorize_paper({"categories": "cs.CV", "title": "", "abstract": ""}),
            categorize_paper({"categories": "cs.CL", "title": "", "abstract": ""}),
            categorize_paper({"categories": "cs.DB", "title": "", "abstract": ""}),
            categorize_paper({"categories": "cs.SE", "title": "", "abstract": ""}),
            categorize_paper({"categories": "cs.CR", "title": "", "abstract": ""}),
            categorize_paper({"categories": "cs.DS", "title": "", "abstract": ""}),
            categorize_paper({"categories": "cs.RO", "title": "智能机器人", "abstract": "面向医疗场景"}),
        }

        self.assertTrue(topics)
        self.assertEqual(topics, set(TOPIC_NAMES))

    def test_unmapped_paper_is_not_counted_as_cross_domain_topic(self):
        topic = categorize_paper(
            {
                "categories": "physics.gen-ph",
                "title": "A note on lattice energy",
                "abstract": "General observations without cs topic markers.",
            }
        )

        self.assertEqual(topic, OTHER_TOPIC_NAME)
        self.assertNotEqual(topic, "交叉应用与智能场景")

    def test_categorize_paper_uses_explicit_priority_not_mapping_order(self):
        mock_mapping = {
            "人工智能与机器学习": {
                "priority": 90,
                "categories": ["cs.AI"],
                "keywords": ["learning"],
            },
            "计算机视觉与多媒体": {
                "priority": 10,
                "categories": ["cs.CV"],
                "keywords": ["image"],
            },
        }

        paper = {
            "categories": "cs.AI cs.CV",
            "title": "image learning",
            "abstract": "",
        }

        with patch("src.data.build_comparison_data.load_topic_mapping", return_value=mock_mapping):
            self.assertEqual(categorize_paper(paper), "计算机视觉与多媒体")

    def test_unknown_year_is_skipped_in_side_counts(self):
        with patch(
            "src.data.build_comparison_data.iter_source_papers",
            return_value=iter([(2004, {"categories": "cs.AI", "title": "", "abstract": ""})]),
        ):
            counts = build_side_topic_counts("academy", file_paths=[])

        for segment in TARGET_SEGMENTS:
            self.assertEqual(sum(counts[segment].values()), 0)

    def test_payload_includes_segment_side_summary_structure(self):
        payload = self.build_sample_payload()

        self.assertEqual(payload["range"], "2005-2025")
        self.assertEqual([segment["label"] for segment in payload["segments"]], TARGET_SEGMENTS)

        for segment in payload["segments"]:
            self.assertIn("academy", segment)
            self.assertIn("website", segment)
            self.assertIn("summary", segment)
            self.assertEqual(set(topic["text"] for topic in segment["academy"]["topics"]), set(TOPIC_NAMES))
            self.assertEqual(set(topic["text"] for topic in segment["website"]["topics"]), set(TOPIC_NAMES))
            self.assertEqual(
                set(segment["summary"].keys()),
                {
                    "academyTop",
                    "websiteTop",
                    "sharedTop",
                    "academySampleCount",
                    "websiteSampleCount",
                    "academyClassifiedCount",
                    "websiteClassifiedCount",
                    "academyOtherCount",
                    "websiteOtherCount",
                    "academySampleWarningLevel",
                    "websiteSampleWarningLevel",
                    "academySampleNote",
                    "websiteSampleNote",
                },
            )

    def test_exported_topics_include_stable_key_field(self):
        payload = self.build_sample_payload()

        segment = next(item for item in payload["segments"] if item["label"] == "2017-2019")
        topic = self.find_topic(segment["academy"], "人工智能与机器学习")

        self.assertIn("key", topic)
        self.assertEqual(topic["key"], "ai-ml")

    def test_shared_top_uses_balanced_share_score_not_raw_volume(self):
        academy_counts = {topic_name: 0 for topic_name in TOPIC_NAMES}
        website_counts = {topic_name: 0 for topic_name in TOPIC_NAMES}
        academy_counts["人工智能与机器学习"] = 1
        website_counts["人工智能与机器学习"] = 500
        academy_counts["计算机视觉与多媒体"] = 4
        website_counts["计算机视觉与多媒体"] = 200

        shared_top = build_shared_top_topics(
            academy_counts,
            website_counts,
            academy_total=10,
            website_total=1000,
        )

        self.assertEqual(shared_top[0]["text"], "计算机视觉与多媒体")
        self.assertEqual(shared_top[1]["text"], "人工智能与机器学习")
        self.assertGreater(shared_top[0]["balanceScore"], shared_top[1]["balanceScore"])

    def test_topic_contract_validation_rejects_slot_layout_mismatch(self):
        bad_layout = {"人工智能与机器学习": {"x": 0, "y": 0}}

        with self.assertRaisesRegex(ValueError, "slot layout"):
            validate_public_topic_contract(slot_layout=bad_layout)

    def test_topic_contract_validation_accepts_current_mapping_and_layout(self):
        validate_public_topic_contract()

    def test_summary_includes_explanatory_count_fields(self):
        payload = self.build_sample_payload()

        summary = next(item for item in payload["segments"] if item["label"] == "2024")["summary"]

        self.assertEqual(summary["academySampleCount"], 2)
        self.assertEqual(summary["academyClassifiedCount"], 1)
        self.assertEqual(summary["academyOtherCount"], 1)
        self.assertEqual(summary["websiteSampleCount"], 1)
        self.assertEqual(summary["websiteClassifiedCount"], 1)
        self.assertEqual(summary["websiteOtherCount"], 0)

    def test_summary_top_lists_include_stable_key_field(self):
        payload = self.build_sample_payload()

        summary = next(item for item in payload["segments"] if item["label"] == "2017-2019")["summary"]

        self.assertTrue(summary["academyTop"])
        self.assertTrue(summary["websiteTop"])
        self.assertIn("key", summary["academyTop"][0])
        self.assertIn("key", summary["websiteTop"][0])
        self.assertEqual(summary["academyTop"][0]["key"], "ai-ml")
        self.assertEqual(summary["websiteTop"][0]["key"], "cv-multimedia")

    def test_segment_summary_includes_sample_warning_fields(self):
        payload = self.build_sample_payload()

        summary = next(item for item in payload["segments"] if item["label"] == "2025")["summary"]

        self.assertIn("academySampleWarningLevel", summary)
        self.assertIn("websiteSampleWarningLevel", summary)
        self.assertIn("academySampleNote", summary)
        self.assertIn("websiteSampleNote", summary)
        self.assertEqual(summary["academySampleWarningLevel"], "caution")
        self.assertEqual(summary["websiteSampleWarningLevel"], "none")
        self.assertTrue(summary["academySampleNote"])
        self.assertEqual(summary["websiteSampleNote"], "")

    def test_same_topic_uses_same_coordinates_on_both_sides(self):
        payload = self.build_sample_payload()

        segment = next(item for item in payload["segments"] if item["label"] == "2017-2019")
        academy_topic = self.find_topic(segment["academy"], "人工智能与机器学习")
        website_topic = self.find_topic(segment["website"], "人工智能与机器学习")

        self.assertEqual((academy_topic["x"], academy_topic["y"]), (website_topic["x"], website_topic["y"]))

    def test_side_topics_use_unique_coordinate_slots(self):
        payload = self.build_sample_payload()

        segment = next(item for item in payload["segments"] if item["label"] == "2024")
        coordinates = {(topic["x"], topic["y"]) for topic in segment["academy"]["topics"]}

        self.assertEqual(len(coordinates), len(TOPIC_NAMES))

    def test_topic_state_tracks_adjacent_segment_changes(self):
        payload = self.build_sample_payload()
        segments = {segment["label"]: segment for segment in payload["segments"]}

        self.assertEqual(
            self.find_topic(segments["2012-2016"]["academy"], "人工智能与机器学习")["state"],
            "stable",
        )
        self.assertEqual(
            self.find_topic(segments["2017-2019"]["academy"], "人工智能与机器学习")["state"],
            "rise",
        )
        self.assertEqual(
            self.find_topic(segments["2020-2021"]["academy"], "人工智能与机器学习")["state"],
            "fall",
        )
        self.assertEqual(
            self.find_topic(segments["2022-2023"]["academy"], "人工智能与机器学习")["state"],
            "stable",
        )

    def test_builder_writes_frontend_json_file(self):
        academy_paths, website_paths = self.create_sample_sources()
        temp_dir = tempfile.TemporaryDirectory()
        output_path = Path(temp_dir.name) / "comparison_timeline.json"
        self.addCleanup(temp_dir.cleanup)

        written_path = build_frontend_timeline_json(
            academy_file_paths=academy_paths,
            website_file_paths=website_paths,
            output_path=output_path,
        )

        self.assertEqual(written_path, output_path)
        self.assertTrue(output_path.exists())

        payload = json.loads(output_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["range"], "2005-2025")
        self.assertEqual([segment["label"] for segment in payload["segments"]], TARGET_SEGMENTS)

    def test_invalid_side_raises_clear_error(self):
        with self.assertRaisesRegex(ValueError, "Unsupported side"):
            build_side_topic_counts("invalid-side", file_paths=[])


if __name__ == "__main__":
    unittest.main()
