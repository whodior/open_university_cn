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
};

const archiveEngineLabels = {
  baidu: '百度',
  bing: '必应',
  sogou: '搜狗',
  nsfc: '国家自然科学基金委',
};

const sourceLabelTranslations = new Map([
  ['Retraction Watch', '撤稿观察'],
  ['Retraction Watch撤稿汇总', '撤稿观察撤稿汇总'],
  ['Nature撤稿说明', '《自然》撤稿说明'],
  ['DW', '德国之声'],
  ['SCMP', '南华早报'],
  ['DOJ起诉公告', '美国司法部起诉公告'],
  ['DOJ认罪公告', '美国司法部认罪公告'],
  ['DOJ判决公告', '美国司法部判决公告'],
  ['CAS新闻稿', '国际体育仲裁院新闻稿'],
  ['CAS裁决PDF', '国际体育仲裁院裁决文档'],
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

function archiveEngineLabel(engine) {
  return archiveEngineLabels[String(engine || '').toLowerCase()] || '搜索归档';
}

function localizedLinkLabel(label) {
  const text = String(label || '').trim();
  if (sourceLabelTranslations.has(text)) return sourceLabelTranslations.get(text);
  return text
    .replace(/PDF/g, '文档')
    .replace(/PubMed/g, '医学文献库')
    .replace(/SIGS/g, '深圳国际研究生院');
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
  els.schoolStrip.innerHTML = data.schools
    .map((school) => {
      const visible = filtered.filter((entry) => entry.school === school).length;
      const total = data.bySchool[school] || 0;
      const pressed = state.school === school ? 'true' : 'false';
      return `
        <button class="school-chip" type="button" data-school="${escapeHtml(school)}" aria-pressed="${pressed}" aria-label="${escapeHtml(school)}，${visible} / ${total}" title="${escapeHtml(school)} ${visible} / ${total}">
          ${logoMarkup(school)}
          <span class="school-chip-count">${visible}</span>
          <span class="visually-hidden">${escapeHtml(school)} ${visible} / ${total}</span>
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
    return;
  }

  els.cards.innerHTML = entries
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
        <h3>事件概要</h3>
        <p>${escapeHtml(entry.summary)}</p>
      </section>
      <section class="detail-block full">
        <h3>舆论影响</h3>
        <p>${escapeHtml(entry.impact || '待补强')}</p>
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

function syncSchoolFilter(value) {
  state.school = value;
  els.schoolFilter.value = value;
  render();
}

function bindEvents() {
  els.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });

  els.schoolFilter.addEventListener('change', (event) => {
    syncSchoolFilter(event.target.value);
  });

  els.natureFilter.addEventListener('change', (event) => {
    state.nature = event.target.value;
    render();
  });

  els.credibilityFilter.addEventListener('change', (event) => {
    state.credibility = event.target.value;
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
