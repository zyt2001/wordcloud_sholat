# Wordcloud Sholat

一个面向课程展示/答辩场景的双侧研究主题词云项目，用于对比 `模拟学院用户` 与 `模拟网站用户` 在 `2005-2024` 时间范围内的研究主题演化。

## 项目特点

- 基于原始数据重建可比口径，而不是直接复用旧的局部中间产物
- 使用统一的 8 类公共主题标签，便于双侧对比
- 提供 6 个时间分段，展示主题重心的阶段性变化
- 页面风格简洁，适合课堂展示、答辩讲解和静态导出
- 词云布局做了防重叠控制，避免传统自由排布导致的文字遮挡

## 目录结构

```text
src/
  data/
    build_comparison_data.py
    topic_mapping.json
  web/
    index.html
    styles.css
    app.js
    data/
      comparison_timeline.json

tests/
  test_build_comparison_data.py
  test_src_web_wordcloud_shape.js

docs/
  superpowers/
    specs/
    plans/
```

## 运行方式

### 1. 直接预览前端页面

在项目根目录启动一个静态服务，然后打开 `src/web/index.html`：

```bash
python -m http.server 8000 --directory src/web
```

浏览器访问：

```text
http://127.0.0.1:8000/index.html
```

### 2. 重新生成前端数据

如果本地具备原始数据目录，可以重新生成 `comparison_timeline.json`：

```bash
python src/data/build_comparison_data.py
```

说明：当前展示型仓库默认保留已生成的 `src/web/data/comparison_timeline.json`，即使不重新构建数据，也可以直接运行前端页面。

## 测试

Python 单测：

```bash
python -m unittest tests/test_build_comparison_data.py -v
```

前端词云结构检查：

```bash
node tests/test_src_web_wordcloud_shape.js
```

## 设计说明

核心设计文档位于：

- `docs/superpowers/specs/2026-04-20-comparable-wordcloud-rebuild-design.md`

其中包含：

- 数据口径与时间分段
- 公共主题映射原则
- 页面结构与视觉目标
- 词云防重叠布局策略

## 适用场景

- 课程项目展示
- 论文/课题答辩可视化演示
- 研究兴趣演化对比案例

## 备注

本仓库当前按“展示型仓库”组织，只保留新版实现、测试与设计文档，不包含旧版页面目录和过程产物。
