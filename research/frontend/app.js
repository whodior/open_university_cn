const schoolLogos = {
  清华大学: './assets/logos/tsinghua.ico',
  北京大学: './assets/logos/pku.ico',
  浙江大学: './assets/logos/zju.png',
  上海交通大学: './assets/logos/sjtu.png',
  复旦大学: './assets/logos/fudan.ico',
  南京大学: './assets/logos/nju.png',
  中国科学技术大学: './assets/logos/ustc.ico',
  华中科技大学: './assets/logos/hust.ico',
  西安交通大学: './assets/logos/xjtu.ico',
};

const state = {
  data: null,
  query: '',
  school: '',
  nature: '',
  credibility: '',
  visibleLimit: 96,
};

const pageSize = 96;

const archiveEngineLabels = {
  baidu: '百度',
  bing: '必应',
  sogou: '搜狗',
  nsfc: '国家自然科学基金委',
};

const sourceLabelTranslations = new Map([
  ['Retraction Watch', '撤稿观察'],
  ['Nature撤稿说明', '《自然》撤稿说明'],
  ['DW', '德国之声'],
  ['SCMP', '南华早报'],
  ['Los Angeles Times旧报道', '《洛杉矶时报》旧报道'],
  ['The Gazette回顾', '《公报》回顾'],
  ['UPI判决', '合众国际社判决报道'],
  ['CBS定罪', '哥伦比亚广播公司定罪报道'],
  ['Wisconsin Court of Appeals案件文本', '威斯康星州上诉法院案件文本'],
  ['DOJ起诉公告', '美国司法部起诉公告'],
  ['DOJ认罪公告', '美国司法部认罪公告'],
  ['DOJ判决公告', '美国司法部判决公告'],
  ['MIT Media Lab道歉', '麻省理工媒体实验室道歉'],
  ['MIT诉讼公开页', '麻省理工诉讼公开页'],
  ['STAT教育经历', 'STAT 新闻教育经历'],
  ['CAS新闻稿', '科学院新闻稿'],
  ['CAS裁决PDF', '科学院裁决文档'],
]);

const els = {
  sourceEntries: document.querySelector('#sourceEntries'),
  totalEntries: document.querySelector('#totalEntries'),
  visibleEntries: document.querySelector('#visibleEntries'),
  archiveCount: document.querySelector('#archiveCount'),
  feedCount: document.querySelector('#feedCount'),
  searchInput: document.querySelector('#searchInput'),
  schoolFilter: document.querySelector('#schoolFilter'),
  natureFilter: document.querySelector('#natureFilter'),
  credibilityFilter: document.querySelector('#credibilityFilter'),
  resetFilters: document.querySelector('#resetFilters'),
  schoolStrip: document.querySelector('#schoolStrip'),
  archiveList: document.querySelector('#archiveList'),
  cards: document.querySelector('#cards'),
  loadMore: document.querySelector('#loadMore'),
  feedCaption: document.querySelector('#feedCaption'),
  detailDialog: document.querySelector('#detailDialog'),
  dialogContent: document.querySelector('#dialogContent'),
  closeDialog: document.querySelector('#closeDialog'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureSentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /[。！？.!?]$/.test(text) ? text : `${text}。`;
}

function archiveEngineLabel(engine) {
  return archiveEngineLabels[String(engine || '').toLowerCase()] || '搜索归档';
}

function hasUsefulText(value) {
  const text = String(value || '').trim();
  return Boolean(text) && !/^(待核|待补强|无可列|暂无|无)$/.test(text);
}

function localizedLinkLabel(label) {
  const text = String(label || '').trim();
  if (sourceLabelTranslations.has(text)) return sourceLabelTranslations.get(text);
  return text
    .replace(/PDF/g, '文档')
    .replace(/PubMed/g, '医学文献库')
    .replace(/SIGS/g, '深圳国际研究生院');
}

function eventProcessHint(entry) {
  const joined = `${entry.eventName} ${entry.summary} ${entry.impact} ${entry.nature}`;

  if (/职务犯罪|受贿|贪污|内幕交易|滥用职权|判决|移送司法|起诉|逮捕|涉嫌/.test(joined)) {
    return '公开信息链条主要包括官方通报、司法程序、审判结果和媒体报道等节点。';
  }
  if (/学术不端|撤稿|论文|抄袭|科研造假|学位撤销|基金委|科研诚信/.test(joined)) {
    return '公开信息链条主要包括论文或项目问题暴露、学校或主管机构处理、撤稿或处分结果等节点。';
  }
  if (/师德|性骚扰|性侵|导师|学术霸凌|举报/.test(joined)) {
    return '公开信息链条主要包括当事人举报、学校或机构调查处理、媒体跟进和网络讨论等节点。';
  }
  if (/刑事|杀人|投毒|强奸|诈骗|危险驾驶|命案|枪击/.test(joined)) {
    return '公开信息链条主要包括案发经过、侦查起诉、法院审理和判决执行等节点。';
  }
  if (/公共言论|舆论|媒体争议|学历|履历|聘任/.test(joined)) {
    return '公开信息链条主要包括争议线索出现、当事方回应、媒体核验和后续处理等节点。';
  }
  return '公开信息链条以详情页列出的来源、事件概要和后续影响为主要核验依据。';
}

function buildEventContext(entry) {
  if (entry.contextNarrative) return entry.contextNarrative;

  const parts = [];
  const name = entry.displayName || entry.name || '该人物';
  if (entry.school) parts.push(`${name}条目关联学校为${entry.school}`);
  if (hasUsefulText(entry.identity)) parts.push(`公开资料中的身份线索为：${entry.identity}`);
  if (hasUsefulText(entry.year)) parts.push(`时间线索为：${entry.year}`);
  if (hasUsefulText(entry.eventName)) parts.push(`该条目指向的核心事件为：${entry.eventName}`);
  if (hasUsefulText(entry.summary)) parts.push(`已收集事实显示：${entry.summary}`);
  parts.push(eventProcessHint(entry));
  if (hasUsefulText(entry.impact)) parts.push(`舆论关注集中在：${entry.impact}`);
  if (entry.sourceLinks?.length) parts.push(`详情页保留 ${entry.sourceLinks.length} 条来源链接，供继续核验原始报道或官方材料`);
  if (entry.credibility) parts.push(`当前可信度标记为：${entry.credibility}`);

  return parts.map(ensureSentence).join('');
}

function buildImpactText(entry) {
  if (hasUsefulText(entry.impact)) return entry.impact;
  if (/论文记录/.test(entry.nature || '')) {
    return '该记录主要用于观察公开撤稿数据库中的论文、作者和机构关联线索，具体责任边界需要结合期刊通知、机构调查和原始论文继续核验。';
  }
  return '该事件已经进入公开资料索引，后续影响需要结合详情页来源、官方通报和媒体报道继续核验。';
}

function logoUrl(school) {
  return schoolLogos[school] || '';
}

function logoMarkup(school, size = 'regular') {
  const url = logoUrl(school);
  const image = url
    ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`
    : '<span class="logo-empty" aria-hidden="true"></span>';
  return `<span class="school-logo ${size}" aria-hidden="true">${image}</span>`;
}

function fillFilters(data) {
  for (const school of data.schools) {
    const option = document.createElement('option');
    option.value = school;
    option.textContent = `${school} (${data.bySchool[school] || 0})`;
    els.schoolFilter.append(option);
  }

  const natures = [...new Set(data.entries.flatMap((entry) => entry.nature.split(/[ /、]+/)))]
    .map((item) => item.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

  for (const nature of natures) {
    const option = document.createElement('option');
    option.value = nature;
    option.textContent = nature;
    els.natureFilter.append(option);
  }
}

function renderStats(data, filtered) {
  if (els.sourceEntries) els.sourceEntries.textContent = data.sourceEntries || data.totalEntries;
  els.totalEntries.textContent = data.totalEntries;
  els.visibleEntries.textContent = filtered.length;
  els.archiveCount.textContent = data.searchArchive.length;
  if (els.feedCount) els.feedCount.textContent = `${filtered.length} / ${data.totalEntries}`;
}

function renderSchoolStrip(data, filtered) {
  const schoolRows = data.schools
    .map((school) => {
      const visible = filtered.filter((entry) => entry.school === school).length;
      const total = data.bySchool[school] || 0;
      return { school, visible, total };
    })
    .sort((a, b) => {
      if (a.school === state.school) return -1;
      if (b.school === state.school) return 1;
      return b.visible - a.visible || b.total - a.total || a.school.localeCompare(b.school, 'zh-Hans-CN');
    });

  els.schoolStrip.innerHTML = schoolRows
    .map(({ school, visible, total }) => {
      const pressed = state.school === school ? 'true' : 'false';
      return `
        <button class="school-chip" type="button" data-school="${escapeHtml(school)}" aria-pressed="${pressed}" aria-label="${escapeHtml(school)}，${visible} / ${total}" title="${escapeHtml(school)} ${visible} / ${total}">
          ${logoMarkup(school, 'tiny')}
          <span class="school-chip-name">${escapeHtml(school)}</span>
          <span class="school-chip-count">${visible}<small>/ ${total}</small></span>
        </button>
      `;
    })
    .join('');
}

function renderArchive(data) {
  if (!data.searchArchive.length) {
    els.archiveList.innerHTML = '<p class="meta">暂无本地搜索归档。</p>';
    return;
  }

  els.archiveList.innerHTML = data.searchArchive
    .map(
      (item) => `
        <div class="archive-item">
          <a href="${escapeHtml(item.path)}">${escapeHtml(archiveEngineLabel(item.engine))}：${escapeHtml(item.query)}</a>
          <p>${Math.round(item.sizeBytes / 1024)} KB</p>
        </div>
      `,
    )
    .join('');
}

function getFilteredEntries() {
  const query = state.query.trim().toLowerCase();

  return state.data.entries.filter((entry) => {
    if (state.school && entry.school !== state.school) return false;
    if (state.nature && !entry.nature.includes(state.nature)) return false;
    if (state.credibility && entry.credibility !== state.credibility) return false;

    if (query) {
      const haystack = [
        entry.name,
        entry.school,
        entry.identity,
        entry.year,
        entry.eventName,
        entry.summary,
        entry.impact,
        entry.nature,
        entry.sourcesMarkdown,
        entry.paperMarkdown,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function renderCards(entries) {
  if (!entries.length) {
    els.cards.innerHTML = '<div class="empty">没有匹配记录。</div>';
    els.loadMore.hidden = true;
    if (els.feedCaption) els.feedCaption.textContent = '调整筛选条件后查看匹配记录';
    return;
  }

  const visibleEntries = entries.slice(0, state.visibleLimit);
  els.cards.innerHTML = visibleEntries
    .map(
      (entry) => `
        <button class="person-card" type="button" data-entry-id="${escapeHtml(entry.id)}">
          <span class="card-top">
            ${logoMarkup(entry.school, 'small')}
            <span class="card-school-wrap">
              <span class="card-school">${escapeHtml(entry.school)}</span>
              <span class="card-nature">${escapeHtml(entry.nature || '待核')}</span>
            </span>
            <span class="credibility-pill">${escapeHtml(entry.credibility)}</span>
          </span>
          <span class="card-body">
            <h3>${escapeHtml(entry.displayName || entry.name)}</h3>
            <p class="event-title">${escapeHtml(entry.eventName || entry.summary)}</p>
          </span>
          <span class="card-foot">
            <span>查看详情</span>
            <span aria-hidden="true">›</span>
          </span>
        </button>
      `,
    )
    .join('');

  const shown = visibleEntries.length;
  if (els.feedCaption) {
    els.feedCaption.textContent = `当前显示 ${shown} / ${entries.length} 条，点击卡片查看详情、来源和论文链接`;
  }
  els.loadMore.hidden = shown >= entries.length;
  els.loadMore.textContent = `显示更多（${shown} / ${entries.length}）`;
}

function renderLinkList(title, links, fallbackText = '') {
  if (!links.length && !fallbackText) return '';
  const linkItems = links
    .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(localizedLinkLabel(link.label))}</a>`)
    .join('');
  const fallback = !links.length ? `<p>${escapeHtml(fallbackText)}</p>` : '';
  return `
    <section class="detail-block full">
      <h3>${escapeHtml(title)}</h3>
      <div class="link-list">${linkItems || fallback}</div>
    </section>
  `;
}

function showDetail(entry) {
  els.dialogContent.innerHTML = `
    <header class="detail-title">
      ${logoMarkup(entry.school)}
      <div>
        <h2>${escapeHtml(entry.displayName || entry.name)}</h2>
        <p>${escapeHtml(entry.eventName || '事件标题待核')}</p>
      </div>
    </header>

    <div class="detail-grid">
      <section class="detail-block full">
        <h3>事件脉络</h3>
        <p>${escapeHtml(buildEventContext(entry))}</p>
      </section>
      <section class="detail-block full">
        <h3>舆论影响</h3>
        <p>${escapeHtml(buildImpactText(entry))}</p>
      </section>
      <section class="detail-block">
        <h3>学校</h3>
        <p>${escapeHtml(entry.school)}</p>
      </section>
      <section class="detail-block">
        <h3>身份 / 专业</h3>
        <p>${escapeHtml(entry.identity || '待核')}</p>
      </section>
      <section class="detail-block">
        <h3>年份</h3>
        <p>${escapeHtml(entry.year || '待核')}</p>
      </section>
      <section class="detail-block">
        <h3>事件性质</h3>
        <p>${escapeHtml(entry.nature || '待核')}</p>
      </section>
      <section class="detail-block">
        <h3>可信度</h3>
        <p>${escapeHtml(entry.credibility)}</p>
      </section>
      ${renderLinkList('信息来源', entry.sourceLinks, entry.sourcesMarkdown || '待补强')}
      ${renderLinkList('照片 / 含图页', entry.photoLinks, entry.photoMarkdown || '待补强')}
      ${renderLinkList('毕业设计 / 学生时期论文', entry.paperLinks, entry.paperMarkdown || '待补强')}
    </div>
  `;
  els.detailDialog.showModal();
}

function render() {
  const filtered = getFilteredEntries();
  renderStats(state.data, filtered);
  renderSchoolStrip(state.data, filtered);
  renderCards(filtered);
}

function resetVisibleLimit() {
  state.visibleLimit = pageSize;
}

function syncSchoolFilter(value) {
  state.school = value;
  els.schoolFilter.value = value;
  resetVisibleLimit();
  render();
}

function bindEvents() {
  els.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    resetVisibleLimit();
    render();
  });

  els.schoolFilter.addEventListener('change', (event) => {
    syncSchoolFilter(event.target.value);
  });

  els.natureFilter.addEventListener('change', (event) => {
    state.nature = event.target.value;
    resetVisibleLimit();
    render();
  });

  els.credibilityFilter.addEventListener('change', (event) => {
    state.credibility = event.target.value;
    resetVisibleLimit();
    render();
  });

  els.resetFilters.addEventListener('click', () => {
    state.query = '';
    state.school = '';
    state.nature = '';
    state.credibility = '';
    els.searchInput.value = '';
    els.schoolFilter.value = '';
    els.natureFilter.value = '';
    els.credibilityFilter.value = '';
    resetVisibleLimit();
    render();
  });

  els.schoolStrip.addEventListener('click', (event) => {
    const button = event.target.closest('[data-school]');
    if (!button) return;
    const school = button.dataset.school;
    syncSchoolFilter(state.school === school ? '' : school);
  });

  els.cards.addEventListener('click', (event) => {
    const button = event.target.closest('[data-entry-id]');
    if (!button) return;
    const entry = state.data.entries.find((item) => item.id === button.dataset.entryId);
    if (entry) showDetail(entry);
  });

  els.loadMore.addEventListener('click', () => {
    state.visibleLimit += pageSize;
    render();
    els.loadMore.focus();
  });

  els.closeDialog.addEventListener('click', () => {
    els.detailDialog.close();
  });

  els.detailDialog.addEventListener('click', (event) => {
    if (event.target === els.detailDialog) els.detailDialog.close();
  });
}

async function init() {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error(`data.json 加载失败：${response.status}`);
  state.data = await response.json();
  fillFilters(state.data);
  renderArchive(state.data);
  bindEvents();
  render();
}

init().catch((error) => {
  els.cards.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
