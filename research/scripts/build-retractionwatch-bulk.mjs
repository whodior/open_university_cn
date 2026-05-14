import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const dataDir = path.join(root, 'research', 'data');
const archiveDir = path.join(root, 'research', 'archive', 'sources');
const outputPath = path.join(dataDir, 'retractionwatch-china-authors.json');
const sourceCsvPath = path.join(archiveDir, 'retractionwatch.csv');
const sourceUrl = 'https://api.labs.crossref.org/data/retractionwatch';
const targetEntries = Number.parseInt(process.env.RETRACTIONWATCH_TARGET || '1800', 10);

const institutionPatterns = [
  /University/i,
  /College/i,
  /Academy/i,
  /Institute/i,
  /Hospital/i,
  /School/i,
  /Center/i,
  /Centre/i,
  /Laboratory/i,
  /医院/,
  /大学/,
  /学院/,
  /研究院/,
  /研究所/,
  /中心/,
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function recordsFromCsv(text) {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim()));
  const headers = rows.shift();
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function compactTitle(value, max = 120) {
  const text = clean(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function splitList(value) {
  return clean(value)
    .split(';')
    .map((item) => clean(item))
    .filter(Boolean);
}

function isChinaRelated(record) {
  const joined = `${record.Country} ${record.Institution}`;
  return /(^|;)China(;|$)|People's Republic of China|Hong Kong|Macau|Taiwan|中国|Beijing|Shanghai|Guangzhou|Shenzhen|Wuhan|Nanjing|Hangzhou|Chengdu|Xi'an|Tianjin|Chongqing/i.test(joined);
}

function pickInstitution(record) {
  const institutions = splitList(record.Institution);
  const chinaInstitutions = institutions.filter((item) =>
    /China|People's Republic of China|Hong Kong|Macau|Taiwan|中国|Beijing|Shanghai|Guangzhou|Shenzhen|Wuhan|Nanjing|Hangzhou|Chengdu|Xi'an|Tianjin|Chongqing/i.test(item),
  );
  const pool = chinaInstitutions.length ? chinaInstitutions : institutions;
  return pool.find((item) => institutionPatterns.some((pattern) => pattern.test(item))) || pool[0] || '中国高校/科研机构（数据库记录）';
}

function institutionDisplayName(institution) {
  const text = clean(institution)
    .replace(/\b\d{5,6}\b/g, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/\s+;/g, ';')
    .trim();
  const parts = text
    .split(',')
    .map((part) => clean(part))
    .filter((part) => part && !/^(People's Republic of China|China|P\.R\. China|PR China)$/i.test(part));
  const schoolLike =
    parts.find((part) => /University|大学/i.test(part)) ||
    parts.find((part) => /Academy|Institute|Hospital|College|研究院|研究所|医院|学院/i.test(part)) ||
    parts.find((part) => institutionPatterns.some((pattern) => pattern.test(part)));
  return schoolLike || parts[0] || text || '中国高校/科研机构（数据库记录）';
}

function sourceMarkdown(record) {
  const links = [];
  if (record.RetractionDOI && record.RetractionDOI !== 'unavailable') {
    links.push(`[撤稿/更正 DOI](https://doi.org/${record.RetractionDOI})`);
  }
  if (record.OriginalPaperDOI && record.OriginalPaperDOI !== 'unavailable') {
    links.push(`[原论文 DOI](https://doi.org/${record.OriginalPaperDOI})`);
  }
  if (record.URLS) {
    for (const [index, url] of splitList(record.URLS).slice(0, 2).entries()) {
      links.push(`[Retraction Watch 线索 ${index + 1}](${url})`);
    }
  }
  links.push(`[Crossref Labs Retraction Watch 数据集](${sourceUrl})`);
  return links.join('；');
}

function recordToEntries(record) {
  const authors = splitList(record.Author).slice(0, 8);
  if (!authors.length) return [];

  const institution = pickInstitution(record);
  const school = institutionDisplayName(institution);
  const title = compactTitle(record.Title);
  const reason = clean(record.Reason).replaceAll(';', '；');
  const nature = clean(record.RetractionNature) || 'Retraction Watch 数据库记录';
  const eventName = `${title} 撤稿/更正记录`;
  const date = clean(record.RetractionDate).split(' ')[0];
  const articleType = clean(record.ArticleType);
  const journal = clean(record.Journal);

  return authors.map((author) => ({
    name: author,
    school,
    identity: `${school} 关联作者；机构字段：${institution}`,
    year: date,
    eventName,
    summary: `Crossref Labs / Retraction Watch 数据库记录显示，论文《${title}》在 ${journal || '期刊待核'} 出现 ${nature} 记录；原因字段为：${reason || '数据库未列明'}。本条按论文作者关联记录展示，事实边界为撤稿/更正数据库记录。`,
    impact: `撤稿数据库记录可用于观察高校科研诚信风险、论文发表规范和机构关联情况；本条不作个人责任认定。`,
    nature: `${nature} / 论文记录`,
    sourcesMarkdown: sourceMarkdown(record),
    photoMarkdown: '无可列',
    paperMarkdown: record.OriginalPaperDOI && record.OriginalPaperDOI !== 'unavailable'
      ? `[原论文 DOI](https://doi.org/${record.OriginalPaperDOI})`
      : `论文题名：${title}`,
    section: '批量扩展：Retraction Watch 中国高校/科研机构关联记录',
    subsection: school,
    credibility: '需核验',
    sourceRecordId: record['Record ID'],
    sourceDataset: 'Crossref Labs Retraction Watch',
    factBoundary: '论文撤稿/更正数据库记录；不等同于个人责任认定',
  }));
}

function uniqueEntries(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const key = `${entry.name}|${entry.school}|${entry.eventName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function main() {
  if (!fs.existsSync(sourceCsvPath)) {
    throw new Error(`Missing ${sourceCsvPath}. Download it with: curl.exe -L -o "${sourceCsvPath}" ${sourceUrl}`);
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const records = recordsFromCsv(fs.readFileSync(sourceCsvPath, 'utf8'));
  const entries = uniqueEntries(
    records
      .filter(isChinaRelated)
      .flatMap(recordToEntries),
  ).slice(0, targetEntries);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: sourceUrl,
    factBoundary: 'Retraction Watch/Crossref Labs 论文撤稿或更正记录；按作者与机构关联展示，不作个人责任认定。',
    entries,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${entries.length} entries to ${outputPath}`);
}

main();
