import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const markdownPath = path.join(root, 'research', 'controversial-alumni-soft-ranking-2026.md');
const dataPath = path.join(root, 'research', 'frontend', 'data.json');
const archiveSnapshotPath = path.join(root, 'research', 'archive', 'research-snapshot.json');
const searchDir = path.join(root, 'research', 'archive', 'searches');
const searchIndexPath = path.join(root, 'research', 'archive', 'search-index.json');

const schools = [
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

const aliases = new Map([
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

function parseRow(line) {
  const trimmed = line.trim();
  return trimmed
    .slice(1, trimmed.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((cell) => cell.trim());
}

function normalizeSchool(text) {
  for (const school of schools) {
    if (text.includes(school)) return school;
  }
  for (const [alias, school] of aliases) {
    if (text.includes(alias)) return school;
  }
  return text || '待核';
}

function stripMarkdown(value) {
  return (value || '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLinks(...values) {
  const links = [];
  const seen = new Set();
  for (const value of values) {
    const text = value || '';
    for (const match of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      const item = { label: match[1], url: match[2] };
      if (!seen.has(item.url)) {
        seen.add(item.url);
        links.push(item);
      }
    }
    for (const match of text.matchAll(/https?:\/\/[^\s)；;，,]+/g)) {
      const url = match[0];
      if (!seen.has(url)) {
        seen.add(url);
        links.push({ label: url, url });
      }
    }
  }
  return links;
}

function credibilityFor(entry) {
  const joined = [
    entry.section,
    entry.subsection,
    entry.name,
    entry.summary,
    entry.nature,
    entry.sourcesMarkdown,
  ].join(' ');

  if (/候选|百科线索|官方源待补强|待补强/.test(joined)) return '候选待补强';
  if (/待核|争议|调查中|待审|指控|涉嫌|撤诉|悬案/.test(joined)) return '需核验';
  return '较强';
}

function buildEntries(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  let section = '';
  let subsection = '';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      section = line.replace(/^##\s+/, '').trim();
      subsection = '';
      continue;
    }
    if (line.startsWith('### ')) {
      subsection = line.replace(/^###\s+/, '').trim();
      continue;
    }
    if (!line.trim().startsWith('|')) continue;
    const next = lines[i + 1] || '';
    if (!next.trim().startsWith('|---')) continue;

    const headers = parseRow(line);
    i += 2;

    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const cells = parseRow(lines[i]);
      const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));

      const name = row['姓名或公开称谓'] || row['姓名'] || '';
      const schoolText = row['学校'] || row['就读学校'] || subsection || '';
      const identity = row['身份/专业/年级/毕业年份'] || row['所学专业/学位'] || '';
      const year = row['毕业年份或就读年份'] || '';
      const eventName = row['事件名称'] || '';
      const summary = row['事件概要'] || '';
      const impact = row['舆论影响'] || row['为何舆论大'] || '';
      const nature = row['事件性质'] || '';
      const sourcesMarkdown = row['信息来源链接'] || row['可靠来源链接'] || '';
      const photoMarkdown = row['照片/含图页'] || row['公开照片页'] || '';
      const paperMarkdown = row['学生时期论文'] || row['论文链接'] || '';

      if (name && schoolText && summary) {
        const entry = {
          id: `e${entries.length + 1}`,
          section,
          subsection,
          name: stripMarkdown(name),
          school: normalizeSchool(stripMarkdown(schoolText)),
          schoolRaw: stripMarkdown(schoolText),
          identity: stripMarkdown(identity),
          year: stripMarkdown(year),
          eventName: stripMarkdown(eventName),
          summary: stripMarkdown(summary),
          impact: stripMarkdown(impact),
          nature: stripMarkdown(nature),
          sourcesMarkdown,
          photoMarkdown,
          paperMarkdown,
          links: extractLinks(sourcesMarkdown, photoMarkdown, paperMarkdown),
          sourceLinks: extractLinks(sourcesMarkdown),
          photoLinks: extractLinks(photoMarkdown),
          paperLinks: extractLinks(paperMarkdown),
        };
        entry.credibility = credibilityFor(entry);
        entries.push(entry);
      }
      i += 1;
    }
    i -= 1;
  }
  return entries;
}

function buildSearchArchiveIndex() {
  if (!fs.existsSync(searchDir)) return [];
  return fs
    .readdirSync(searchDir)
    .filter((file) => file.endsWith('.html'))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    .map((file) => {
      const engine = file.split('_')[0];
      const query = path.basename(file, '.html').replace(/^[^_]+_/, '').replaceAll('_', ' ');
      const fullPath = path.join(searchDir, file);
      return {
        engine,
        query,
        file,
        path: `../archive/searches/${file}`,
        sizeBytes: fs.statSync(fullPath).size,
      };
    });
}

const markdown = fs.readFileSync(markdownPath, 'utf8');
const entries = buildEntries(markdown);
const searchArchive = buildSearchArchiveIndex();

const bySchool = Object.fromEntries(
  schools.map((school) => [school, entries.filter((entry) => entry.school === school).length]),
);

const data = {
  generatedAt: new Date().toISOString(),
  markdownFile: '../controversial-alumni-soft-ranking-2026.md',
  totalEntries: entries.length,
  schools,
  bySchool,
  searchArchive,
  entries,
};

fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
fs.writeFileSync(archiveSnapshotPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
fs.writeFileSync(searchIndexPath, `${JSON.stringify(searchArchive, null, 2)}\n`, 'utf8');

console.log(`Wrote ${entries.length} entries to ${dataPath}`);
console.log(`Archived research snapshot to ${archiveSnapshotPath}`);
console.log(`Indexed ${searchArchive.length} archived search pages to ${searchIndexPath}`);
