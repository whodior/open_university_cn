import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const markdownPath = path.join(root, 'research', 'controversial-alumni-soft-ranking-2026.md');
const dataPath = path.join(root, 'research', 'frontend', 'data.json');

const targetDisplayCount = 500;
const sectionTitle = '第十一轮官方通报与撤稿数据库批量补充';
const nsfcListUrl = 'https://www.nsfc.gov.cn/p1/2812/2816/cljd.html';
const retractionCsvUrl = 'https://gitlab.com/crossref/retraction-watch-data/-/raw/main/retraction_watch.csv';

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, max = 170) {
  const text = markdownCell(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function normalizeKey(value) {
  return String(value ?? '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[“”"'‘’\s]/g, '')
    .replace(/[，,、；;／/]+/g, '/')
    .toLowerCase()
    .trim();
}

function removeGeneratedSection(markdown) {
  const pattern = new RegExp(`\\n## ${sectionTitle}\\n[\\s\\S]*?(?=\\n## 后续补强方向\\n)`);
  return markdown.replace(pattern, '\n');
}

function baseEntries() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return data.entries.filter((entry) => entry.section !== sectionTitle);
}

function existingNameKeys(entries) {
  const keys = new Set();
  for (const entry of entries) {
    keys.add(normalizeKey(entry.displayName));
    keys.add(normalizeKey(entry.name));
    keys.add(`${normalizeKey(entry.school)}|${normalizeKey(entry.displayName)}`);
    keys.add(`${normalizeKey(entry.school)}|${normalizeKey(entry.name)}`);
  }
  return keys;
}

function splitCases(text) {
  const numbered = text.split(/（[一二三四五六七八九十百]+）/).slice(1);
  if (numbered.length) return numbered;
  return text.split(/(?=关于对[^。]{2,140}?(?:处理决定|通报|处理结果))/).slice(1);
}

const institutionPattern =
  '(?:[\\u4e00-\\u9fa5]{1,12}某(?:两所|三所)?(?:高校附属医院|高校|医院|学院|大学|研究院|单位|机构|科研院所)|[\\u4e00-\\u9fa5]{2,28}(?:大学附属医院|医科大学附属医院|大学医学院附属医院|大学同济医学院附属协和医院|大学|学院|医院|研究院|研究所|中心|公司|学校))';
const institutionAndSubject = new RegExp(`(${institutionPattern})([^，。；、“”]{2,60})`, 'g');
const provinceNames = new Set(
  '北京 上海 天津 重庆 河北 山西 辽宁 吉林 黑龙江 江苏 浙江 安徽 福建 江西 山东 河南 湖北 湖南 广东 海南 四川 贵州 云南 陕西 甘肃 青海 台湾 内蒙 广西 西藏 宁夏 新疆 香港 澳门'.split(
    ' ',
  ),
);

function preprocessNsfcCase(text) {
  return text
    .replace(/国家自然科学基金委员会监督委员会对/g, '')
    .replace(/、(?=[\u4e00-\u9fa5]{1,12}某(?:高校|医院|学院|大学|研究院|单位|机构|科研院所))/g, '，')
    .replace(/、(?=[\u4e00-\u9fa5]{2,20}(?:大学|学院|医院|研究院|研究所|中心|公司|学校))/g, '，');
}

function validChineseName(value) {
  return (
    /^[\u4e00-\u9fa5]{2,4}$/.test(value) &&
    !provinceNames.has(value) &&
    !/高校|医院|学院|大学|项目|基金|论文|申请|研究|附属|主任|问题|存在|作为|涉事|人员|科学|国家|自然|公司|机构|涉嫌|发表|年度/.test(
      value,
    )
  );
}

function namesFromSubject(subject) {
  const clipped = subject
    .replace(/^[\s，、]+/, '')
    .split(
      /(?:等?发表|等?涉嫌|等?存在|存在|作为|在20|20\d{2}|\d{4}|在|的基金|基金项目|申请书|涉事|被撤稿|被通报|问题|，|。|；)/,
    )[0];

  return clipped
    .split(/[、和与]/)
    .map((item) => item.trim().replace(/等人?$/, ''))
    .filter(validChineseName);
}

function firstSentence(text) {
  const sentence = markdownCell(text).split('。')[0];
  return sentence ? `${sentence}。` : markdownCell(text);
}

function extractNsfcPeople(caseText) {
  const first = preprocessNsfcCase(caseText.slice(0, 1000));
  const rows = [];

  for (const match of first.matchAll(institutionAndSubject)) {
    const school = match[1].replace(/^.*监督委员会对/, '').trim();
    for (const name of namesFromSubject(match[2])) {
      rows.push({ school, name });
    }
  }

  const parenthetical = first.match(/^\s*([\u4e00-\u9fa5]{2,4})（时为([^）]+)）/);
  if (parenthetical && validChineseName(parenthetical[1])) {
    rows.push({ school: parenthetical[2], name: parenthetical[1] });
  }

  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.school}|${row.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function nsfcCandidates() {
  const listHtml = await (await fetch(nsfcListUrl)).text();
  const start = listHtml.indexOf('<ul class="sciences-content-right-content">');
  const segment = listHtml.slice(start);
  const links = [...segment.matchAll(/<a[^>]+href="([^"]+)"[\s\S]*?<div class="item-right-content">([\s\S]*?)<\/div>[\s\S]*?<div class="date">([\s\S]*?)<\/div>/g)]
    .map((match) => ({
      url: new URL(match[1], nsfcListUrl).href,
      title: stripHtml(match[2]),
      date: stripHtml(match[3]),
    }));

  const candidates = [];
  for (const link of links) {
    const text = stripHtml(await (await fetch(link.url)).text());
    for (const caseText of splitCases(text)) {
      const summary = firstSentence(caseText);
      const people = extractNsfcPeople(caseText);
      for (const person of people) {
        candidates.push({
          sourceKind: 'nsfc',
          name: person.name,
          school: person.school,
          identity: `${person.school}；国家自然科学基金委处理决定所涉人员`,
          eventName: `${person.name}国家自然科学基金委科研诚信通报`,
          summary: `${link.date}，国家自然科学基金委发布《${link.title}》，${person.name}出现在${person.school}相关科研诚信处理决定中。`,
          narrative: `${truncate(summary, 180)}具体责任、处理期限和项目编号以基金委原文为准。`,
          impact: '官方科研诚信通报记录，可作为基金申请诚信、评审纪律、论文数据与署名问题的公开样本。',
          nature: '科研诚信 / 基金委通报',
          sourcesMarkdown: `[国家自然科学基金委：${link.title}](${link.url})`,
          photoMarkdown: '暂无可靠个人照片',
          paperMarkdown: '论文或项目以基金委原文为准',
        });
      }
    }
  }
  return candidates;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function institutionFromRetraction(value) {
  const firstAffiliation = String(value || '').split(';').map((item) => item.trim()).find(Boolean) || '';
  const parts = firstAffiliation.split(',').map((item) => item.trim()).filter(Boolean);
  const preferred = parts.find((part) => /University|College|Hospital|Institute|Academy|School/i.test(part));
  return preferred || parts[0] || '机构待核';
}

function firstRetractionAuthor(value) {
  return String(value || '').split(';').map((item) => item.trim()).find(Boolean) || '';
}

function yearFromDate(value) {
  const match = String(value || '').match(/\b(20\d{2}|19\d{2})\b/);
  return match ? match[1] : '时间待核';
}

async function retractionCandidates() {
  const csv = await (await fetch(retractionCsvUrl)).text();
  return parseCsv(csv)
    .filter((row) => row.Country === 'China' && row.Title && row.Author && row.Institution)
    .map((row) => {
      const name = firstRetractionAuthor(row.Author);
      const school = institutionFromRetraction(row.Institution);
      const year = yearFromDate(row.RetractionDate);
      const retractionDoi = row.RetractionDOI ? `https://doi.org/${row.RetractionDOI}` : '';
      const originalDoi = row.OriginalPaperDOI ? `https://doi.org/${row.OriginalPaperDOI}` : '';
      const sourceLinks = [
        `[Retraction Watch Database CSV](${retractionCsvUrl})`,
        retractionDoi ? `[撤稿 DOI](${retractionDoi})` : '',
        originalDoi ? `[原论文 DOI](${originalDoi})` : '',
      ]
        .filter(Boolean)
        .join('；');

      return {
        sourceKind: 'retraction-watch',
        name,
        school,
        identity: '撤稿观察数据库记录作者；具体单位以原始撤稿记录为准',
        eventName: `${name}撤稿论文记录`,
        summary: `${year}年，Retraction Watch Database 记录 ${name} 参与署名的论文被撤稿，机构字段为 ${school}。`,
        narrative: `撤稿论文题名：${truncate(row.Title, 120)}。撤稿性质：${markdownCell(row.RetractionNature || 'Retraction')}；原因字段：${truncate(row.Reason || '原因以数据库和撤稿说明为准', 140)}。责任边界以撤稿说明、期刊声明和数据库原始记录为准。`,
        impact: '公开撤稿数据库记录，可作为论文可靠性、作者署名、数据图像问题和科研诚信风险样本。',
        nature: '撤稿记录 / 科研诚信 / 责任边界待核',
        sourcesMarkdown: sourceLinks,
        photoMarkdown: '暂无可靠个人照片',
        paperMarkdown: originalDoi ? `[原论文 DOI](${originalDoi})` : '原论文链接以撤稿数据库为准',
      };
    })
    .filter((row) => row.name && row.school && !/^\d+$/.test(row.name));
}

function candidateKey(candidate) {
  return `${normalizeKey(candidate.school)}|${normalizeKey(candidate.name)}`;
}

function selectCandidates(candidates, needed, existingKeys) {
  const selected = [];
  const seen = new Set(existingKeys);

  for (const candidate of candidates) {
    const nameKey = normalizeKey(candidate.name);
    const key = candidateKey(candidate);
    if (!candidate.name || !candidate.school || seen.has(nameKey) || seen.has(key)) continue;
    seen.add(nameKey);
    seen.add(key);
    selected.push(candidate);
    if (selected.length === needed) break;
  }

  if (selected.length < needed) {
    throw new Error(`Only ${selected.length} candidates available; need ${needed}.`);
  }
  return selected;
}

function rowMarkdown(row) {
  return `| ${markdownCell(row.name)} | ${markdownCell(row.school)} | ${markdownCell(row.identity)} | ${markdownCell(row.eventName)} | ${markdownCell(row.summary)} | ${markdownCell(row.narrative)} | ${markdownCell(row.impact)} | ${markdownCell(row.nature)} | ${row.sourcesMarkdown} | ${markdownCell(row.photoMarkdown)} | ${row.paperMarkdown} |`;
}

function buildSection(rows) {
  const nsfcCount = rows.filter((row) => row.sourceKind === 'nsfc').length;
  const retractionCount = rows.length - nsfcCount;

  return `## ${sectionTitle}

本节为可复核的官方通报和公开撤稿数据库批量样本，目标是把前端展示样本扩展到 ${targetDisplayCount} 条。新增 ${rows.length} 条，其中基金委处理决定 ${nsfcCount} 条，Retraction Watch 撤稿数据库 ${retractionCount} 条；对撤稿记录统一采用责任边界说明，避免把论文撤稿直接写成个人定责。

| 姓名或公开称谓 | 学校 | 身份/专业/年级/毕业年份 | 事件名称 | 事件概要 | 事件脉络 | 舆论影响 | 事件性质 | 信息来源链接 | 照片/含图页 | 学生时期论文 |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.map(rowMarkdown).join('\n')}
`;
}

async function main() {
  const markdown = removeGeneratedSection(fs.readFileSync(markdownPath, 'utf8'));
  const entries = baseEntries();
  const needed = targetDisplayCount - entries.length;
  if (needed <= 0) {
    throw new Error(`Base display count is ${entries.length}; target ${targetDisplayCount} requires no generated rows.`);
  }

  const nsfc = await nsfcCandidates();
  const retractions = await retractionCandidates();
  const selected = selectCandidates([...nsfc, ...retractions], needed, existingNameKeys(entries));
  const section = buildSection(selected);
  const nextMarkdown = markdown.replace(/\n## 后续补强方向\n/, `\n${section}\n## 后续补强方向\n`);

  fs.writeFileSync(markdownPath, nextMarkdown, 'utf8');
  console.log(JSON.stringify({
    baseDisplayCount: entries.length,
    targetDisplayCount,
    insertedRows: selected.length,
    nsfcRows: selected.filter((row) => row.sourceKind === 'nsfc').length,
    retractionRows: selected.filter((row) => row.sourceKind === 'retraction-watch').length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
