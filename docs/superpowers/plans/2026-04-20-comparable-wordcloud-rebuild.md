# 双侧可比词云重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the comparison wordcloud under `src/` so it uses truly comparable `2005-2024` raw data, renders a cleaner dual-panel answer-friendly UI, and avoids word overlap through coarser shared topics and fixed slots.

**Architecture:** A new Python data builder in `src/data/` will read both raw datasets, map papers into shared coarse topics, aggregate them into six comparable segments, and emit one browser-ready JSON file under `src/web/data/`. A new static frontend in `src/web/` will render two large slot-based topic clouds plus concise summary cards, using only local assets and no external font dependencies.

**Tech Stack:** Python 3 stdlib (`json`, `pathlib`, `collections`, `re`, `unittest`), static HTML/CSS/JavaScript, local browser verification

---

**Repository note:** The current workspace is not a git repository, so this plan does not include commit steps.

## File Structure

- Create: `src/__init__.py`
- Create: `src/data/__init__.py`
- Create: `src/data/topic_mapping.json`
- Create: `src/data/build_comparison_data.py`
- Create: `tests/test_build_comparison_data.py`
- Create: `src/web/index.html`
- Create: `src/web/styles.css`
- Create: `src/web/app.js`
- Create: `src/web/data/comparison_timeline.json`

## Task 1: Build the new topic mapping and comparable segment pipeline

**Files:**
- Create: `src/__init__.py`
- Create: `src/data/__init__.py`
- Create: `src/data/topic_mapping.json`
- Create: `src/data/build_comparison_data.py`
- Create: `tests/test_build_comparison_data.py`

- [ ] Write failing tests for segment labels, shared topic mapping, and dual-side completeness
- [ ] Run `python -m unittest tests/test_build_comparison_data.py -v` and verify failure
- [ ] Implement the minimal builder that:
  - reads academy raw `*_papers_by_year.json`
  - reads website raw `*_papers.json`
  - maps papers into shared coarse topics using `categories` and keyword rules
  - aggregates into these segments:
    - `2005-2011`
    - `2012-2016`
    - `2017-2019`
    - `2020-2021`
    - `2022-2023`
    - `2024`
  - emits `academy` and `website` sides for every segment
  - exposes names as `模拟学院用户` and `模拟网站用户`
- [ ] Re-run `python -m unittest tests/test_build_comparison_data.py -v` and verify pass

## Task 2: Add fixed-slot topic layout and export the new JSON artifact

**Files:**
- Modify: `src/data/build_comparison_data.py`
- Modify: `tests/test_build_comparison_data.py`
- Create: `src/web/data/comparison_timeline.json`

- [ ] Extend tests to cover:
  - slot-based `x/y` coordinates for rendered topics
  - no duplicate slot occupancy inside one side of one segment
  - state transitions (`new`, `rise`, `fall`, `stable`)
  - every exported segment having both sides present
- [ ] Run `python -m unittest tests/test_build_comparison_data.py -v` and verify failure
- [ ] Implement fixed-slot positions for the 8 shared topics and export `comparison_timeline.json`
- [ ] Run:
  - `python -m unittest tests/test_build_comparison_data.py -v`
  - `python src/data/build_comparison_data.py`
  and verify both pass

## Task 3: Build a new lightweight frontend under `src/web/`

**Files:**
- Create: `src/web/index.html`
- Create: `src/web/styles.css`
- Create: `src/web/app.js`

- [ ] Implement a fresh page shell that includes:
  - title area
  - current segment chip
  - left `模拟学院用户` panel
  - right `模拟网站用户` panel
  - summary block
  - timeline switcher
- [ ] Use a light, answer-friendly visual system with local font stacks only
- [ ] Load `./data/comparison_timeline.json` dynamically rather than hardcoding data
- [ ] Render segment switching, panel names, counts, and summary text
- [ ] Verify via local static server that `src/web/index.html` loads successfully

## Task 4: Render the enlarged non-overlapping dual topic clouds

**Files:**
- Modify: `src/web/styles.css`
- Modify: `src/web/app.js`

- [ ] Render each side’s topics into large fixed-slot cloud stages
- [ ] Scale font size by `share` or `value`
- [ ] Apply state-specific styling for `new`, `rise`, `fall`, `stable`
- [ ] Ensure each slot is spatially separated enough to avoid overlap
- [ ] Add hover/focus tooltip with topic name, weight, share, and state
- [ ] Verify in browser that:
  - topics do not overlap
  - segment switching updates both sides
  - tooltip works on hover/focus

## Task 5: Final polish, local-only verification, and old/new boundary cleanup

**Files:**
- Modify: `src/web/styles.css`
- Modify: `src/web/app.js`
- Modify: `tasks/todo.md`

- [ ] Add print-friendly rules for the new page
- [ ] Verify no external requests are required to load the new page
- [ ] Run final checks:
  - `python -m unittest tests/test_build_comparison_data.py -v`
  - `python src/data/build_comparison_data.py`
  - local static server for `src/web`
  - local browser verification on `src/web/index.html`
- [ ] Confirm the new implementation lives under `src/` and old files remain untouched as legacy references

## Self-Review

### Spec coverage

- Raw-data rebuild for `2005-2024`: covered by Tasks 1-2
- New code under `src/`: covered by all tasks
- Cleaner lightweight UI: covered by Tasks 3-5
- Overlap reduction via coarse topics + fixed slots: covered by Tasks 2 and 4

### Placeholder scan

- No unfinished markers remain in the plan.

### Type consistency

- The plan consistently uses `academy`, `website`, `topics`, `summary`, `label`, and slot-based `x/y` output across builder and frontend tasks.
