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
const bulkDataDir = path.join(root, 'research', 'data');

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

const excludedDisplayNamePatterns = [
  /黄洋/,
  /刁爱青/,
  /邱庆枫/,
  /岳昕/,
  /邱占萱/,
  /王丹浩/,
  /胡安明/,
  /陈刚（Gang Chen）/,
  /王擎\s*Qing\s*Wang/i,
  /^周恒$/,
  /清华“彩虹旗事件”两名学生/,
  /孙某\/孙维/,
  /孙维/,
  /朱令/,
  /同济医学院护理学院性别信息公示学生/,
  /上海交大被殴学生/,
  /上海交大融媒体中心/,
  /《东川路800号》参演同学/,
  /施工方/,
];

function parseRow(line) {
  const trimmed = line.trim();
  return trimmed
    .slice(1, trimmed.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((cell) => cell.trim());
}

function normalizeSchool(text) {
  for (const school of baseSchools) {
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

function normalizeText(value) {
  return stripMarkdown(value)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[“”"'‘’\s]/g, '')
    .replace(/[，,、；;／/]+/g, '/')
    .trim();
}

function displayNameFor(entry) {
  const name = entry.name;
  const eventText = `${entry.eventName} ${entry.summary}`;

  if (/韩承轩\s+Chengxuan Han/i.test(name)) return '韩承轩';
  if (/Charles M\. Lieber|查尔斯·利伯/i.test(name)) return '查尔斯·利伯';
  if (/王某某.*萌心涌动NJU/.test(name)) return '王某某';
  if (/^Qiushi Wu$/i.test(name)) return '吴秋实';
  if (/沈阳；高岩/.test(name)) return '沈阳';
  if (/牟林翰；包丽/.test(name)) return '牟林翰';
  if (/王晓龙；江林/.test(name)) return '王晓龙';
  if (/杨宝德\s*\/\s*周筠/.test(name)) return '周筠';
  if (/王牧\s*\/\s*闻海虎/.test(name)) return '闻海虎';
  if (/魏某、邵某/.test(name) && /学术霸凌|教师/.test(eventText)) return '邵某（被举报教师）';
  if (/邵某\s*\/\s*邵某峰/.test(name) && /学术霸凌|教师/.test(eventText)) return '邵某（被举报教师）';
  if (/朱令；孙某\/孙维/.test(name)) return '孙某/孙维（公开报道中的曾被调查对象）';
  if (/复旦十八驴/.test(name)) return '侯盼 / 复旦十八驴';
  return name;
}

function canonicalPersonKey(entry) {
  const eventText = `${entry.eventName} ${entry.summary}`;
  let name = displayNameFor(entry);

  if (entry.sourceRecordId || entry.sourceDataset === '开放撤稿数据库') {
    return `${entry.school}|${entry.sourceRecordId || normalizeText(entry.paperMarkdown)}|${normalizeText(entry.nature)}`;
  }

  if (entry.school === '西安交通大学' && /翻译式抄袭|王建辉/.test(eventText)) name = '王建辉';
  if (entry.school === '上海交通大学' && /学术霸凌/.test(eventText)) name = '邵某';
  if (entry.school === '上海交通大学' && /邵某/.test(name) && /学术霸凌/.test(eventText)) name = '邵某';
  if (entry.school === '华中科技大学' && /陈刚|Gang Chen|MIT/.test(`${entry.name} ${eventText}`)) name = '陈刚MIT案';

  return `${entry.school}|${normalizeText(name)}`;
}

function isDisplayableNegativePerson(entry) {
  const joined = `${entry.name} ${entry.eventName} ${entry.summary} ${entry.nature}`;

  if (excludedDisplayNamePatterns.some((pattern) => pattern.test(entry.name))) return false;
  if (/受害人|遇害案|死亡争议|坠亡|追思会/.test(joined)) return false;
  if (/坠楼|身亡/.test(joined) && !/杀人|故意杀人|投毒|强奸|虐待|受贿|贪污|诈骗|行贿|违法|处分|被判|获刑|犯罪/.test(joined)) return false;
  if (/申请公开|信息公开|佳士声援|社团自治/.test(joined)) return false;
  if (/举报材料存在伪造|未发现论文抄袭|校方澄清/.test(joined) && /周恒/.test(entry.name)) return false;
  if (/撤诉|撤销全部指控|宣告无罪|被法院宣告无罪|政府撤销全部指控/.test(joined)) return false;
  if (/匿名学生，网传照片|隐私保护/.test(entry.photoMarkdown) && /隐私泄露|性别变更/.test(joined)) return false;

  return true;
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

function shouldAddCnkiSearch(entry) {
  const joined = `${entry.displayName} ${entry.name} ${entry.paperMarkdown}`;

  if (entry.sourceRecordId || entry.sourceDataset === '开放撤稿数据库') return false;
  if (/某|匿名|公开称谓|参演|作者|学生物品|无可列|隐私保护/.test(joined)) return false;
  if (entry.paperLinks.some((link) => /cnki\.net/i.test(link.url))) return false;
  return true;
}

function addAcademicSearchLinks(entry) {
  const links = [...entry.paperLinks];
  if (!shouldAddCnkiSearch(entry)) return links;

  const query = `${entry.displayName} ${entry.school}`;
  links.push({
    label: `知网检索：${query}`,
    url: `https://kns.cnki.net/kns8/defaultresult/index?kw=${encodeURIComponent(query)}`,
  });
  return links;
}

function inferEventName(name, summary, nature) {
  const text = `${summary} ${nature}`;

  if (/基因编辑婴儿/.test(text)) return '“基因编辑婴儿”案';
  if (/协助.*司法机关调查|协助调查/.test(text)) return `${name}协助调查争议`;
  if (/撤销博士学位|博士论文.*抄袭|论文.*抄袭/.test(text)) return `${name}论文抄袭/学位争议`;
  if (/学术不端|科研造假|论文造假|撤稿/.test(text)) return `${name}学术不端争议`;
  if (/强奸/.test(text)) return `${name}强奸案及处分争议`;
  if (/故意杀人|杀人/.test(text)) return `${name}故意杀人案`;
  if (/内幕交易/.test(text)) return `${name}内幕交易案`;
  if (/受贿|贪污|滥用职权|巨额财产来源不明|隐瞒境外存款/.test(text)) return `${name}职务犯罪案`;
  if (/撤诉|美国司法|美国司法部/.test(text)) return `${name}美国司法争议`;
  if (/逮捕|起诉|涉嫌/.test(text)) return `${name}司法程序争议`;

  const compactNature = nature
    .split(/[ /、]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('/');

  return compactNature ? `${name}${compactNature}事件` : `${name}争议事件`;
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
      const contextNarrative = row['事件脉络'] || row['来龙去脉'] || '';
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
          eventName: stripMarkdown(eventName) || inferEventName(stripMarkdown(name), stripMarkdown(summary), stripMarkdown(nature)),
          summary: stripMarkdown(summary),
          contextNarrative: stripMarkdown(contextNarrative),
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
        entry.displayName = displayNameFor(entry);
        entry.paperLinks = addAcademicSearchLinks(entry);
        entry.links = extractLinks(sourcesMarkdown, photoMarkdown, paperMarkdown);
        entry.links = [...entry.links, ...entry.paperLinks.filter((link) => !entry.links.some((item) => item.url === link.url))];
        entry.credibility = credibilityFor(entry);
        entries.push(entry);
      }
      i += 1;
    }
    i -= 1;
  }
  return entries;
}

function scoreEntry(entry) {
  const recencyBonus = /第八轮|第七轮|第六轮|第五轮|第四轮|第三轮|第二轮/.test(entry.section) ? 180 : 0;
  return (
    entry.summary.length +
    entry.impact.length +
    entry.sourceLinks.length * 90 +
    entry.photoLinks.length * 30 +
    entry.paperLinks.length * 80 +
    recencyBonus
  );
}

function prepareDisplayEntries(entries) {
  const byKey = new Map();

  for (const entry of entries) {
    if (!isDisplayableNegativePerson(entry)) continue;

    const key = canonicalPersonKey(entry);
    const existing = byKey.get(key);
    if (!existing || scoreEntry(entry) > scoreEntry(existing)) {
      byKey.set(key, entry);
    }
  }

  return [...byKey.values()].map((entry, index) => ({
    ...entry,
    id: `e${index + 1}`,
  }));
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

function normalizeBulkEntry(rawEntry, sourceFile, index) {
  const sourcesMarkdown = rawEntry.sourcesMarkdown || rawEntry.sources || '';
  const photoMarkdown = rawEntry.photoMarkdown || rawEntry.photos || '';
  const paperMarkdown = rawEntry.paperMarkdown || rawEntry.papers || '';
  const sourceLinks = extractLinks(sourcesMarkdown);
  const photoLinks = extractLinks(photoMarkdown);
  const paperLinks = extractLinks(paperMarkdown);
  const name = stripMarkdown(rawEntry.name || rawEntry['姓名或公开称谓'] || rawEntry['姓名'] || '');
  const summary = stripMarkdown(rawEntry.summary || rawEntry['事件概要'] || '');
  const nature = stripMarkdown(rawEntry.nature || rawEntry['事件性质'] || '');

  const entry = {
    id: `bulk-${sourceFile}-${index + 1}`,
    section: stripMarkdown(rawEntry.section || '批量扩展数据'),
    subsection: stripMarkdown(rawEntry.subsection || ''),
    name,
    school: normalizeSchool(stripMarkdown(rawEntry.school || rawEntry['学校'] || rawEntry['就读学校'] || '待核')),
    schoolRaw: stripMarkdown(rawEntry.school || rawEntry['学校'] || rawEntry['就读学校'] || '待核'),
    identity: stripMarkdown(rawEntry.identity || rawEntry['身份/专业/年级/毕业年份'] || rawEntry['所学专业/学位'] || ''),
    year: stripMarkdown(rawEntry.year || rawEntry['毕业年份或就读年份'] || ''),
    eventName: stripMarkdown(rawEntry.eventName || rawEntry['事件名称'] || '') || inferEventName(name, summary, nature),
    summary,
    contextNarrative: stripMarkdown(rawEntry.contextNarrative || rawEntry['事件脉络'] || ''),
    impact: stripMarkdown(rawEntry.impact || rawEntry['舆论影响'] || rawEntry['为何舆论大'] || ''),
    nature,
    sourcesMarkdown,
    photoMarkdown,
    paperMarkdown,
    sourceRecordId: stripMarkdown(rawEntry.sourceRecordId || ''),
    sourceDataset: stripMarkdown(rawEntry.sourceDataset || ''),
    sourceAuthorCount: Number.parseInt(rawEntry.sourceAuthorCount || '0', 10) || 0,
    factBoundary: stripMarkdown(rawEntry.factBoundary || ''),
    links: extractLinks(sourcesMarkdown, photoMarkdown, paperMarkdown),
    sourceLinks,
    photoLinks,
    paperLinks,
  };

  entry.displayName = stripMarkdown(rawEntry.displayName || '') || displayNameFor(entry);
  entry.paperLinks = addAcademicSearchLinks(entry);
  entry.links = [...entry.links, ...entry.paperLinks.filter((link) => !entry.links.some((item) => item.url === link.url))];
  entry.credibility = stripMarkdown(rawEntry.credibility || '') || credibilityFor(entry);
  return entry;
}

function buildBulkEntries() {
  if (!fs.existsSync(bulkDataDir)) return [];

  return fs
    .readdirSync(bulkDataDir)
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    .flatMap((file) => {
      const fullPath = path.join(bulkDataDir, file);
      const payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const rows = Array.isArray(payload) ? payload : payload.entries;
      if (!Array.isArray(rows)) return [];

      return rows
        .map((row, index) => normalizeBulkEntry(row, path.basename(file, '.json'), index))
        .filter((entry) => entry.name && entry.school && entry.summary);
    });
}

const markdown = fs.readFileSync(markdownPath, 'utf8');
const markdownEntries = buildEntries(markdown);
const bulkEntries = buildBulkEntries();
const sourceEntries = [...markdownEntries, ...bulkEntries];
const entries = prepareDisplayEntries(sourceEntries);
const schools = buildSchoolList(entries);
const searchArchive = buildSearchArchiveIndex();

const bySchool = Object.fromEntries(
  schools.map((school) => [school, entries.filter((entry) => entry.school === school).length]),
);

const data = {
  generatedAt: new Date().toISOString(),
  markdownFile: '../controversial-alumni-soft-ranking-2026.md',
  sourceEntries: sourceEntries.length,
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
