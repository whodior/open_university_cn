# 批量扩展数据说明

`retractionwatch-china-authors.json` 来自 Crossref Labs 暂存的 Retraction Watch 数据集。

口径：

- 仅抽取 `Country` 或 `Institution` 字段与中国大陆、港澳台或中国城市相关的论文记录。
- 每条记录按论文作者拆分为展示样本，并保留论文题名、期刊、撤稿/更正性质、原因字段、DOI 和 Retraction Watch 线索。
- `school` 字段优先使用记录中的大学名称，其次使用研究院、医院、学院等机构名称。
- `credibility` 统一标为 `需核验`，事实边界为“撤稿/更正数据库记录；不等同于个人责任认定”。

生成命令：

```powershell
curl.exe -L -o research\archive\sources\retractionwatch.csv https://api.labs.crossref.org/data/retractionwatch
$env:RETRACTIONWATCH_TARGET='1400'; node research\scripts\build-retractionwatch-bulk.mjs
node research\frontend\build-data.mjs
```

该数据源用于扩大高校科研诚信相关样本容量，具体个人责任需逐条回看撤稿声明、期刊说明、机构调查或官方处理决定。
