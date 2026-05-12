const state = {
  data: null,
  query: '',
  school: '',
  nature: '',
  credibility: '',
};

const els = {
  totalEntries: document.querySelector('#totalEntries'),
  visibleEntries: document.querySelector('#visibleEntries'),
  archiveCount: document.querySelector('#archiveCount'),
  searchInput: document.querySelector('#searchInput'),
  schoolFilter: document.querySelector('#schoolFilter'),
  natureFilter: document.querySelector('#natureFilter'),
  credibilityFilter: document.querySelector('#credibilityFilter'),
  resetFilters: document.querySelector('#resetFilters'),
  schoolStrip: document.querySelector('#schoolStrip'),
  archiveList: document.querySelector('#archiveList'),
  cards: document.querySelector('#cards'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shortHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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
  els.totalEntries.textContent = data.totalEntries;
  els.visibleEntries.textContent = filtered.length;
  els.archiveCount.textContent = data.searchArchive.length;

  els.schoolStrip.innerHTML = data.schools
    .map((school) => {
      const visible = filtered.filter((entry) => entry.school === school).length;
      const total = data.bySchool[school] || 0;
      return `<span class="school-chip">${escapeHtml(school)} <strong>${visible}</strong><span>/ ${total}</span></span>`;
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
          <a href="${escapeHtml(item.path)}">${escapeHtml(item.engine.toUpperCase())}: ${escapeHtml(item.query)}</a>
          <p>${Math.round(item.sizeBytes / 1024)} KB</p>
        </div>
      `,
    )
    .join('');
}

function credibilityClass(value) {
  if (value === '较强') return 'strong';
  if (value === '候选待补强') return 'danger';
  return 'warn';
}

function renderLinks(entry) {
  const links = entry.links.slice(0, 8);
  if (!links.length) return '';
  return `
    <div class="links">
      ${links
        .map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label || shortHost(link.url))}</a>`)
        .join('')}
    </div>
  `;
}

function renderCards(entries) {
  if (!entries.length) {
    els.cards.innerHTML = '<div class="empty">没有匹配记录。</div>';
    return;
  }

  els.cards.innerHTML = entries
    .map((entry) => {
      const eventTitle = entry.eventName ? `：${escapeHtml(entry.eventName)}` : '';
      return `
        <article class="card">
          <div class="card-head">
            <div>
              <h3>${escapeHtml(entry.name)}${eventTitle}</h3>
              <div class="tags">
                <span class="tag strong">${escapeHtml(entry.school)}</span>
                <span class="tag">${escapeHtml(entry.nature || '性质待核')}</span>
                <span class="tag ${credibilityClass(entry.credibility)}">${escapeHtml(entry.credibility)}</span>
              </div>
            </div>
          </div>
          <p class="summary">${escapeHtml(entry.summary)}</p>
          ${entry.impact ? `<p class="meta">舆论影响：${escapeHtml(entry.impact)}</p>` : ''}
          ${entry.identity ? `<p class="meta">身份/专业：${escapeHtml(entry.identity)}</p>` : ''}
          ${entry.year ? `<p class="meta">年份：${escapeHtml(entry.year)}</p>` : ''}
          ${entry.paperLinks.length ? `<p class="meta">论文：${escapeHtml(entry.paperLinks.map((link) => link.label).join('；'))}</p>` : ''}
          ${renderLinks(entry)}
        </article>
      `;
    })
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

function render() {
  const filtered = getFilteredEntries();
  renderStats(state.data, filtered);
  renderCards(filtered);
}

function bindEvents() {
  els.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });

  els.schoolFilter.addEventListener('change', (event) => {
    state.school = event.target.value;
    render();
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
