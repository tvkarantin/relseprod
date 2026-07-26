const icons = {
  menu: '☰', close: '×', home: '⌂', reels: '▦', scripts: '▤', calendar: '□', analytics: '⌁',
  competitors: '♙', topics: '◇', trends: '♨', library: '▷', templates: '▣', media: '▧',
  profile: '♙', plan: '◆', integrations: '⌘', play: '▶', refresh: '↻', search: '⌕',
  filter: '▽', more: '•••', bookmark: '♧', back: '‹', settings: '⚙', magic: '✦',
  save: '▣', download: '⇩', send: '➤', plus: '+', instagram: '◎', bell: '•', spark: '✦'
}

const reels = [
  { id: 1, author: '@username1', image: './assets/reel1.jpg', title: 'Это изменит твой год', views: '1,2M', likes: '95K', engagement: '3,2%', topic: 'Мотивация, личный рост', tags: 'мотивация, личный рост, продуктивность' },
  { id: 2, author: '@envoy.reels', image: './assets/reel2.jpg', title: 'Мозг любит простоту', views: '980K', likes: '75K', engagement: '1,8%', topic: 'Мышление, привычки', tags: 'мышление, привычки, саморазвитие' },
  { id: 3, author: '@pro_marketing', image: './assets/reel3.jpg', title: 'Клиенты на автопилоте', views: '1,1M', likes: '62K', engagement: '2,7%', topic: 'Бизнес, маркетинг', tags: 'бизнес, маркетинг, продажи' },
  { id: 4, author: '@za_idea', image: './assets/reel4.jpg', title: 'Идея на миллион', views: '870K', likes: '56K', engagement: '2,1%', topic: 'Бизнес, идеи', tags: 'бизнес, идеи, предпринимательство' },
  { id: 5, author: '@username1', image: './assets/reel5.jpg', title: 'Не делай этого утром', views: '1,3M', likes: '98K', engagement: '3,6%', topic: 'Продуктивность', tags: 'продуктивность, ошибки, режим дня' },
  { id: 6, author: '@envoy.reels', image: './assets/reel6.jpg', title: '5 минут — и тревога уйдет', views: '760K', likes: '41K', engagement: '1,4%', topic: 'Психология', tags: 'психология, эмоции, спокойствие' },
]

const state = {
  page: ['competitors', 'editor'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'reels',
  selectedReel: reels[0],
  query: '',
  mobileOpen: false,
  activeTab: 'editor',
  competitors: [
    { name: '@username1', category: 'Онлайн-предприниматель', followers: '1,2M', avg: '12 млн (+14%)', image: reels[0].image },
    { name: '@envoy.reels', category: 'Ниша | Образование', followers: '826K', avg: '2,5 млн (+8%)', image: reels[5].image },
    { name: '@pro_ux.reels', category: 'Производство', followers: '642K', avg: '1,1 млн', image: reels[1].image },
    { name: '@za_idea', category: 'Бизнес, маркетинг', followers: '723K', avg: '2,3 млн', image: reels[3].image },
  ],
  hook: 'Большинство людей не готовы услышать правду об успехе.',
  body: 'Пока ты ищешь мотивацию, другие создают систему. Успех — это не удача, а ежедневные действия.\n\nСфокусируйся на 3 вещах: план, дисциплина, анализ. Действуй — и результат придёт.',
  cta: 'Начни с малого, но начни сегодня. Твоё будущее — в твоих руках.',
}

const navSections = [
  ['Панель', [['Главная', icons.home], ['Рилсы', icons.reels, 'reels'], ['Сценарии', icons.scripts], ['Календарь', icons.calendar], ['Аналитика', icons.analytics]]],
  ['Анализ', [['Конкуренты', icons.competitors, 'competitors'], ['Темы', icons.topics], ['Тренды', icons.trends]]],
  ['Библиотека', [['Мои рилсы', icons.library], ['Шаблоны', icons.templates], ['Медиа', icons.media]]],
  ['Настройки', [['Профиль', icons.profile], ['Подписка', icons.plan], ['Интеграции', icons.integrations]]],
]

const app = document.querySelector('#app')

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
}

function setPage(page) {
  state.page = page
  location.hash = page
  state.mobileOpen = false
  render()
}

function showToast(text) {
  const old = document.querySelector('.toast')
  old?.remove()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = `${icons.spark} ${text}`
  document.body.append(toast)
  setTimeout(() => toast.remove(), 2200)
}

function sidebar() {
  return `
    ${state.mobileOpen ? '<button class="sidebar-backdrop" data-action="close-menu" aria-label="Закрыть меню"></button>' : ''}
    <aside class="sidebar ${state.mobileOpen ? 'is-open' : ''}">
      <div class="brand">
        <div class="brand-mark">${icons.play}</div>
        <div><strong>ИИ-РИЛС</strong><span>ПЛАТФОРМА</span></div>
        <button class="sidebar-close" data-action="close-menu">${icons.close}</button>
      </div>
      <nav class="nav-scroll">
        ${navSections.map(([title, items]) => `
          <div class="nav-section">
            <div class="nav-title">${title}</div>
            ${items.map(([label, icon, page]) => `<button class="nav-item ${page === state.page ? 'active' : ''}" ${page ? `data-page="${page}"` : ''}><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('')}
          </div>`).join('')}
      </nav>
      <div class="plan-card"><div>${icons.plan} Тариф: <b>PRO</b></div><span>Лимит рилсов</span><strong>2 480 <small>/ 10 000</small></strong><div class="progress"><i></i></div></div>
      <div class="profile-row"><img src="${reels[3].image}" alt="Иван П."><div><strong>Иван П.</strong><span>@ivan.p</span></div><span>${icons.bell}</span></div>
    </aside>`
}

function pageHeader(title, subtitle, actions = '') {
  return `<header class="page-header"><div><h1>${title}</h1><p>${subtitle}</p></div>${actions ? `<div class="header-actions">${actions}</div>` : ''}</header>`
}

function metrics(reel) {
  return `<div class="metrics"><span>${icons.play} ${reel.views}</span><span>♥ ${reel.likes}</span><span>↻ ${reel.engagement}</span></div>`
}

function competitorsPage() {
  return `<div class="page-content">
    ${pageHeader('Конкуренты', 'Отслеживай рилсы конкурентов и изучай их лучшие ролики')}
    <div class="add-row surface"><div class="input-wrap"><span>${icons.instagram}</span><input id="competitor-input" placeholder="https://www.instagram.com/username/"></div><button class="primary-button" data-action="add-competitor">${icons.plus} Добавить</button></div>
    <section class="section-block"><h2>Отслеживаемые конкуренты</h2><div class="competitor-table surface">
      ${state.competitors.slice(0, 4).map(item => `<div class="competitor-row"><img src="${item.image}" alt=""><div class="competitor-person"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)}</span></div><div class="stat"><span>Подписчики</span><strong>${item.followers}</strong></div><div class="stat"><span>Средний охват</span><strong>${item.avg}</strong></div><div class="status"><i></i> Активен</div><span>${icons.more}</span></div>`).join('')}
      <button class="show-more">Показать ещё 4 конкурента</button>
    </div></section>
    <section class="section-block"><h2>Последние 20 рилс — @username1</h2><div class="mini-reels">
      ${reels.slice(0,5).map(reel => `<button class="mini-reel" data-open-reel="${reel.id}"><img src="${reel.image}" alt="${reel.title}"><span>${icons.play} ${reel.views}</span></button>`).join('')}
      <button class="more-reels"><strong>+15</strong><span>Ещё рилсы</span></button>
    </div></section>
    <div class="sync-line">${icons.refresh} Синхронизация и обновление данных каждые 30 минут</div>
  </div>`
}

function reelCard(reel) {
  return `<article class="reel-card surface">
    <div class="reel-card-head"><div><img src="${reel.image}" alt=""> ${reel.author}</div><span>${icons.more}</span></div>
    <button class="reel-cover" data-open-reel="${reel.id}"><img src="${reel.image}" alt="${reel.title}"></button>
    ${metrics(reel)}
    <div class="reel-copy"><span>Тема</span><p>${reel.topic}</p><small>${reel.tags}</small></div>
    <div class="reel-actions"><button data-open-reel="${reel.id}">Рилсить!</button><button data-action="bookmark" aria-label="Сохранить">${icons.bookmark}</button></div>
  </article>`
}

function reelsPage() {
  const q = state.query.toLowerCase()
  const filtered = reels.filter(reel => `${reel.title} ${reel.topic} ${reel.author}`.toLowerCase().includes(q))
  return `<div class="page-content">
    ${pageHeader('Рилсы', 'Библиотека рилс ваших конкурентов', `<button class="ghost-button" data-action="refresh">${icons.refresh} Обновить</button>`)}
    <div class="filters-row"><div class="search-box"><span>${icons.search}</span><input id="reel-search" value="${escapeHtml(state.query)}" placeholder="Найти рилс"></div>
      ${['Все конкуренты','Все темы','Все форматы','7 дней'].map(item => `<button class="filter-button">${item}<span>⌄</span></button>`).join('')}<button class="filter-icon">${icons.filter}</button>
    </div>
    <div class="reels-grid">${filtered.map(reelCard).join('') || '<div class="empty-state">Ничего не найдено</div>'}</div>
    <div class="pagination"><span>‹</span><button class="active">1</button><button>2</button><button>3</button><span>…</span><button>42</button><span>›</span></div>
  </div>`
}

function info(label, value) {
  return `<div class="info-row"><span>${label}</span><strong>${value}</strong></div>`
}

function scriptField(key, title, limit, large = false) {
  const value = state[key]
  return `<div class="surface script-box"><div class="script-title"><h3>${title}</h3><span>${value.length}/${limit}</span></div><textarea data-field="${key}" maxlength="${limit}" class="${large ? 'large' : ''}">${escapeHtml(value)}</textarea><div class="script-tools"><button data-rewrite="${key}">${icons.magic} Рерайт под мой стиль</button><button data-rewrite="${key}">${icons.spark}</button><button data-rewrite="${key}">${icons.refresh}</button></div></div>`
}

function analyticsPage(reel) {
  const bars = [62,82,70,92,76,100,88]
  return `<div class="analytics-grid">
    <div class="surface analytics-card"><span>Просмотры</span><strong>${reel.views}</strong><small>+14,8% к среднему</small></div>
    <div class="surface analytics-card"><span>Вовлечённость</span><strong>${reel.engagement}</strong><small>Выше 78% конкурентов</small></div>
    <div class="surface analytics-card"><span>Сохранения</span><strong>18,2K</strong><small>Сильный полезный контент</small></div>
    <div class="surface chart-card"><h3>Динамика просмотров</h3><div class="chart">${bars.map(height => `<i style="height:${height}%"></i>`).join('')}</div></div>
    <div class="surface insight-card"><span class="insight-icon">${icons.spark}</span><div><h3>Почему сработало</h3><p>Сильный контрастный хук, узнаваемая боль аудитории и короткий практический вывод.</p></div></div>
  </div>`
}

function editorPage() {
  const reel = state.selectedReel
  return `<div class="editor-page">
    <div class="editor-topbar"><button class="back-button" data-page="reels">${icons.back} Назад к рилсам</button><div><button>${icons.more}</button><button>${icons.settings}</button></div></div>
    <div class="tabs"><button class="${state.activeTab === 'editor' ? 'active' : ''}" data-tab="editor">${icons.magic} Редактор сценария</button><button class="${state.activeTab === 'analytics' ? 'active' : ''}" data-tab="analytics">Аналитика</button></div>
    ${state.activeTab === 'editor' ? `<div class="editor-grid"><aside class="preview-column"><div class="surface preview-card"><h3>Превью рилса</h3><img src="${reel.image}" alt="${reel.title}">${metrics(reel)}<button class="ghost-button full">Смотреть оригинал</button></div><div class="surface info-card"><h3>Информация</h3>${info('Тема','Продуктивность')}${info('Формат','Говорящая голова')}${info('Длительность','32 сек')}${info('Оригинал',reel.author)}${info('Дата поиска','2 мая 2025')}</div></aside><section class="script-column">${scriptField('hook','Хук',150)}${scriptField('body','Основная часть',1500,true)}${scriptField('cta','Призыв к действию',100)}<div class="surface style-box"><h3>Стиль и тон</h3><button class="select-like">Мой стиль: Прямой и мотивирующий <span>⌄</span></button></div></section></div>` : analyticsPage(reel)}
    <div class="editor-footer"><button class="ghost-button" data-action="save">${icons.save} Сохранить</button><button class="ghost-button" data-action="export">${icons.download} Экспорт</button><button class="primary-button publish" data-action="publish">${icons.send} Опубликовать <span>⌄</span></button></div>
  </div>`
}

function render() {
  app.innerHTML = `<div class="app-shell"><button class="mobile-menu" data-action="open-menu">${icons.menu}</button>${sidebar()}<main class="main-view">${state.page === 'competitors' ? competitorsPage() : state.page === 'editor' ? editorPage() : reelsPage()}</main></div>`
}

function openReel(id) {
  state.selectedReel = reels.find(reel => reel.id === Number(id)) || reels[0]
  setPage('editor')
}

function addCompetitor() {
  const input = document.querySelector('#competitor-input')
  const value = input?.value.trim()
  if (!value) return
  const handle = value.includes('instagram.com/') ? `@${value.split('instagram.com/')[1].replaceAll('/', '')}` : value.startsWith('@') ? value : `@${value}`
  state.competitors.push({ name: handle, category: 'Новый конкурент', followers: '—', avg: 'Синхронизация', image: reels[2].image })
  showToast('Конкурент добавлен в отслеживание')
  render()
}

function rewrite(key) {
  const variants = {
    hook: 'Ты удивишься, но главный секрет успеха вообще не связан с мотивацией.',
    body: 'Мотивация быстро заканчивается. Система остаётся. Определи одну цель, разбей её на ежедневные действия и каждую неделю анализируй результат. Так прогресс становится предсказуемым.',
    cta: 'Сохрани этот ролик и сделай первый шаг уже сегодня.',
  }
  state[key] = variants[key]
  showToast('Текст переформулирован в выбранном стиле')
  render()
}

document.addEventListener('click', event => {
  const target = event.target.closest('button, [data-page], [data-open-reel], [data-action], [data-tab], [data-rewrite]')
  if (!target) return
  if (target.dataset.page) return setPage(target.dataset.page)
  if (target.dataset.openReel) return openReel(target.dataset.openReel)
  if (target.dataset.tab) { state.activeTab = target.dataset.tab; return render() }
  if (target.dataset.rewrite) return rewrite(target.dataset.rewrite)
  const action = target.dataset.action
  if (action === 'open-menu') { state.mobileOpen = true; return render() }
  if (action === 'close-menu') { state.mobileOpen = false; return render() }
  if (action === 'add-competitor') return addCompetitor()
  if (action === 'refresh') return showToast('Библиотека обновлена')
  if (action === 'bookmark') return showToast('Рилс добавлен в сохранённые')
  if (action === 'save') return showToast('Черновик сохранён')
  if (action === 'export') return showToast('Экспорт подготовлен')
  if (action === 'publish') return showToast('Рилс отправлен на публикацию')
})

document.addEventListener('input', event => {
  if (event.target.id === 'reel-search') {
    state.query = event.target.value
    render()
    const nextInput = document.querySelector('#reel-search')
    nextInput?.focus()
    nextInput?.setSelectionRange(state.query.length, state.query.length)
  }
  if (event.target.dataset.field) {
    state[event.target.dataset.field] = event.target.value
    const count = event.target.closest('.script-box')?.querySelector('.script-title span')
    if (count) count.textContent = `${event.target.value.length}/${event.target.maxLength}`
  }
})

document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.id === 'competitor-input') addCompetitor()
})

window.addEventListener('hashchange', () => {
  const page = location.hash.slice(1)
  if (['competitors','reels','editor'].includes(page) && page !== state.page) {
    state.page = page
    render()
  }
})

render()
