import fs from 'node:fs';
import path from 'node:path';

const usage = `
Usage:
  node research/scripts/batch-import-entries.mjs <input.json> [output.json] [--entries-only]

Input:
  A JSON array of raw records, or an object with an "entries" array.

Output:
  By default writes a frontend-compatible data object:
  { generatedAt, sourceEntries, totalEntries, schools, bySchool, entries }

  Use --entries-only to write only the normalized entries array.
`;

const baseSchools = [
  '清华大学',
  '北京大学',
  '浙江大学',
  '上海交通大学',
  '复旦大学',
  '南京大学',
  '中国科学技术大学',
  '华中科技大学',
  '西安交通大学',
];

const schoolAliases = new Map([
  ['清华', '清华大学'],
  ['北大', '北京大学'],
  ['浙大', '浙江大学'],
  ['上海交大', '上海交通大学'],
  ['上交', '上海交通大学'],
  ['复旦', '复旦大学'],
  ['南大', '南京大学'],
  ['中科大', '中国科学技术大学'],
  ['中国科大', '中国科学技术大学'],
  ['华科', '华中科技大学'],
  ['华中工学院', '华中科技大学'],
  ['西安交大', '西安交通大学'],
  ['西交大', '西安交通大学'],
  ['陕西财经学院', '西安交通大学'],
]);

const fieldAliases = {
  name: ['name', '姓名', '姓名或公开称谓', 'displayName'],
  school: ['school', '学校', '就读学校', 'schoolRaw'],
  identity: ['identity', '身份', '专业', '所学专业/学位', '身份/专业/年级/毕业年份'],
  year: ['year', '毕业年份或就读年份', '毕业年份', '就读年份'],
  eventName: ['eventName', '事件名称', 'title'],
  summary: ['summary', '事件概要', '概要', 'description'],
  impact: ['impact', '舆论影响', '为何舆论大'],
  nature: ['nature', '事件性质', 'category'],
  sourcesMarkdown: ['sourcesMarkdown', '信息来源链接', '可靠来源链接', 'sources'],
  photoMarkdown: ['photoMarkdown', '照片/含图页', '公开照片页', 'photos'],
  paperMarkdown: ['paperMarkdown', '学生时期论文', '论文链接', 'papers'],
  section: ['section', '章节'],
  subsection: ['subsection', '小节'],
  credibility: ['credibility', '可信度'],
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function valueFor(record, canonicalName) {
  for (const key of fieldAliases[canonicalName] || [canonicalName]) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return '';
}

function asText(value) {
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join('；');
  }
  if (value && typeof value === 'object') {
    const label = value.label || value.title || value.name || value.url || '';
    const url = value.url || value.href || '';
    return url ? `[${label}](${url})` : JSON.stringify(value);
  }
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdown(value) {
  return asText(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSchool(value) {
  const text = stripMarkdown(value);
  for (const school of baseSchools) {
    if (text.includes(school)) return school;
  }
  for (const [alias, school] of schoolAliases) {
    if (text.includes(alias)) return school;
  }
  return text || '待核';
}

function extractLinks(...values) {
  const links = [];
  const seen = new Set();

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') addLink(links, seen, item.label || item.title || item.url, item.url || item.href);
      }
    }

    const text = asText(value);
    for (const match of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      addLink(links, seen, match[1], match[2]);
    }
    for (const match of text.matchAll(/https?:\/\/[^\s)；;，,]+/g)) {
      addLink(links, seen, match[0], match[0]);
    }
  }

  return links;
}

function addLink(links, seen, label, url) {
  if (!url || seen.has(url)) return;
  seen.add(url);
  links.push({ label: String(label || url).trim(), url: String(url).trim() });
}

function inferEventName(name, summary, nature) {
  const text = `${summary} ${nature}`;
  if (/受贿|贪污|滥用职权|巨额财产来源不明|隐瞒境外存款/.test(text)) return `${name}职务犯罪案`;
  if (/故意杀人|杀人/.test(text)) return `${name}故意杀人案`;
  if (/强奸/.test(text)) return `${name}强奸案及处分争议`;
  if (/学术不端|抄袭|论文造假|撤稿|撤销博士学位/.test(text)) return `${name}学术不端争议`;
  if (/逮捕|起诉|涉嫌/.test(text)) return `${name}司法程序争议`;
  return nature ? `${name}${nature}事件` : `${name}争议事件`;
}

function credibilityFor(record, normalized) {
  const explicit = stripMarkdown(valueFor(record, 'credibility'));
  if (explicit) return explicit;

  const joined = [
    normalized.summary,
    normalized.nature,
    normalized.sourcesMarkdown,
    normalized.photoMarkdown,
    normalized.paperMarkdown,
  ].join(' ');

  if (/候选|待补强/.test(joined)) return '候选待补强';
  if (/待核|争议|调查中|待审|指控|涉嫌|悬案/.test(joined)) return '需核验';
  return normalized.sourceLinks.length ? '较强' : '需核验';
}

function normalizeRecord(record, index) {
  const name = stripMarkdown(valueFor(record, 'name'));
  const schoolRaw = stripMarkdown(valueFor(record, 'school'));
  const identity = stripMarkdown(valueFor(record, 'identity'));
  const year = stripMarkdown(valueFor(record, 'year'));
  const summary = stripMarkdown(valueFor(record, 'summary'));
  const nature = stripMarkdown(valueFor(record, 'nature'));
  const sourcesMarkdown = asText(valueFor(record, 'sourcesMarkdown'));
  const photoMarkdown = asText(valueFor(record, 'photoMarkdown'));
  const paperMarkdown = asText(valueFor(record, 'paperMarkdown'));
  const sourceLinks = extractLinks(valueFor(record, 'sourcesMarkdown'));
  const photoLinks = extractLinks(valueFor(record, 'photoMarkdown'));
  const paperLinks = extractLinks(valueFor(record, 'paperMarkdown'));
  const links = extractLinks(sourcesMarkdown, photoMarkdown, paperMarkdown);
  const eventName = stripMarkdown(valueFor(record, 'eventName')) || inferEventName(name || `条目${index + 1}`, summary, nature);

  const normalized = {
    id: stripMarkdown(record.id) || `e${index + 1}`,
    section: stripMarkdown(valueFor(record, 'section')) || normalizeSchool(schoolRaw),
    subsection: stripMarkdown(valueFor(record, 'subsection')),
    name,
    school: normalizeSchool(schoolRaw),
    schoolRaw: schoolRaw || '待核',
    identity,
    year,
    eventName,
    summary,
    impact: stripMarkdown(valueFor(record, 'impact')),
    nature,
    sourcesMarkdown,
    photoMarkdown,
    paperMarkdown,
    links,
    sourceLinks,
    photoLinks,
    paperLinks,
    displayName: stripMarkdown(record.displayName) || name,
  };

  normalized.credibility = credibilityFor(record, normalized);
  return normalized;
}

function buildSchoolList(entries) {
  const seen = new Set();
  const ordered = [];

  for (const school of baseSchools) {
    if (entries.some((entry) => entry.school === school)) {
      seen.add(school);
      ordered.push(school);
    }
  }

  for (const entry of entries) {
    if (!seen.has(entry.school)) {
      seen.add(entry.school);
      ordered.push(entry.school);
    }
  }

  return ordered;
}

function buildImport(input, entriesOnly = false) {
  const rawEntries = Array.isArray(input) ? input : input.entries;
  if (!Array.isArray(rawEntries)) {
    throw new TypeError('Input must be a JSON array or an object with an entries array.');
  }

  const entries = rawEntries
    .map(normalizeRecord)
    .filter((entry) => entry.name && entry.school && entry.summary);

  if (entriesOnly) return entries;

  const schools = buildSchoolList(entries);
  return {
    generatedAt: new Date().toISOString(),
    sourceEntries: rawEntries.length,
    totalEntries: entries.length,
    schools,
    bySchool: Object.fromEntries(schools.map((school) => [school, entries.filter((entry) => entry.school === school).length])),
    entries,
  };
}

function main() {
  const args = process.argv.slice(2);
  const entriesOnly = args.includes('--entries-only');
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const [inputPath, outputPath] = positional;

  if (!inputPath || args.includes('--help') || args.includes('-h')) {
    console.log(usage.trim());
    process.exit(inputPath ? 0 : 1);
  }

  const input = readJson(inputPath);
  const output = buildImport(input, entriesOnly);

  if (outputPath) {
    writeJson(outputPath, output);
    const count = Array.isArray(output) ? output.length : output.totalEntries;
    console.log(`Wrote ${count} entries to ${outputPath}`);
    return;
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
