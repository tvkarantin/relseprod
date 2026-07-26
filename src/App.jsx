import React, { useState, useEffect } from 'react'
import { 
  Home, Play, FileText, Calendar, BarChart3, Users, Compass, TrendingUp, 
  Folder, LayoutGrid, Image as ImageIcon, User, CreditCard, Cpu, 
  Plus, RefreshCw, SlidersHorizontal, Eye, Heart, Share2, 
  Sparkles, Save, Download, Send, Check, AlertCircle, ChevronLeft, ChevronRight,
  EyeOff, Copy, Trash2, Edit2, PlayCircle, Minimize2, Maximize2
} from 'lucide-react'

// Demo data matching the design image precisely
const INITIAL_COMPETITORS = [
  {
    id: 'username1',
    username: '@username1',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    followers: '1.2M',
    avgReach: '12 млн (+14%)',
    status: 'Активен',
    category: 'Охваты подписчиков'
  },
  {
    id: 'envoy_reels',
    username: '@envoy.reels',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    followers: '826K',
    avgReach: '2.5 млн (+8%)',
    status: 'Активен',
    category: 'Ниша | Образование'
  },
  {
    id: 'pro_marketing',
    username: '@pro_marketing',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    followers: '642K',
    avgReach: '1.1 млн',
    status: 'Активен',
    category: 'Производство'
  },
  {
    id: 'za_idea',
    username: '@za_idea',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    followers: '723K',
    avgReach: '2.3 млн',
    status: 'Активен',
    category: 'Бизнес, маркетинг'
  }
]

const INITIAL_REELS = [
  {
    id: 'reel1',
    competitorId: 'username1',
    username: '@username1',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    title: 'ЭТО ИЗМЕНИТ ТВОЙ ГОД',
    cover: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&auto=format&fit=crop&q=80',
    views: '1.2M',
    likes: '95K',
    shares: '3.2%',
    topic: 'Мотивация, личный рост, продуктивность',
    format: 'Говорящая голова',
    duration: '32 сек',
    date: '2 мая 2025',
    hook: 'Большинство людей не готовы услышать правду об успехе.',
    body: 'Пока ты ищешь мотивацию, другие создают систему. Успех — это не удача, а ежедневные действия. Сфокусируйся на 3 вещах: план, дисциплина, анализ. Действуй и результат придёт.',
    cta: 'Начни с малого, но начни сегодня. Твоё будущее — в твоих руках.'
  },
  {
    id: 'reel2',
    competitorId: 'envoy_reels',
    username: '@envoy.reels',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    title: 'МОЗГ ЛЮБИТ ПРОСТОТУ',
    cover: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=600&auto=format&fit=crop&q=80',
    views: '980K',
    likes: '75K',
    shares: '1.8%',
    topic: 'Мышление, привычки, саморазвитие',
    format: 'Анимация с графикой',
    duration: '45 сек',
    date: '12 мая 2025',
    hook: 'Твой мозг ленив, и это его главное эволюционное преимущество.',
    body: 'Если ты хочешь внедрить сложную привычку, обмани мозг: сделай её настолько простой, чтобы на подготовку уходило меньше минуты. Читай ровно 1 страницу или делай 1 приседание.',
    cta: 'Подпишись, чтобы научиться управлять своим мышлением!'
  },
  {
    id: 'reel3',
    competitorId: 'pro_marketing',
    username: '@pro_marketing',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    title: 'КЛИЕНТЫ НА АВТОПИЛОТЕ',
    cover: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
    views: '1.1M',
    likes: '62K',
    shares: '2.7%',
    topic: 'Бизнес, маркетинг, продажи',
    format: 'Динамичный монтаж',
    duration: '28 сек',
    date: '18 мая 2025',
    hook: 'Как получать платежи от клиентов, пока ты отдыхаешь на море?',
    body: 'Внедрите автоворонку из 4 шагов. Запишите пользу в Reels, настройте триггерное слово в ManyChat, высылайте гайд автоответом и ведите лид на мини-продукт по спеццене.',
    cta: 'Пиши слово "ВОРОНКА" в директ, и я вышлю тебе готовую схему.'
  },
  {
    id: 'reel4',
    competitorId: 'za_idea',
    username: '@za_idea',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    title: 'ИДЕЯ НА МИЛЛИОН',
    cover: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80',
    views: '870K',
    likes: '56K',
    shares: '2.1%',
    topic: 'Бизнес, идеи, предпринимательство',
    format: 'Говорящая голова',
    duration: '35 сек',
    date: '20 мая 2025',
    hook: 'Эта простая идея сделает тебя богатым в ближайшие полгода.',
    body: 'Хватит придумывать сложные велосипеды. Посмотри, что прямо сейчас взрывает рынок США или Азии. Возьми эту бизнес-модель, сделай качественную локализацию и запусти в РФ.',
    cta: 'Сохрани это видео, чтобы не потерять готовую стратегию!'
  },
  {
    id: 'reel5',
    competitorId: 'username1',
    username: '@username1',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    title: 'НЕ ДЕЛАЙ ЭТОГО УТРОМ',
    cover: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80',
    views: '1.3M',
    likes: '98K',
    shares: '3.6%',
    topic: 'Продуктивность, ошибки, режим дня',
    format: 'Говорящая голова',
    duration: '40 сек',
    date: '22 мая 2025',
    hook: 'Твоё утро полностью слито, если ты начинаешь его с этого действия.',
    body: 'Первая привычка после звонка будильника — листать соцсети. Твой мозг мгновенно перегружается тонной дешёвого дофамина, и у тебя больше нет энергии на сложные дела дня.',
    cta: 'Убери телефон в другую комнату на ночь и проверь разницу!'
  },
  {
    id: 'reel6',
    competitorId: 'envoy_reels',
    username: '@envoy.reels',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    title: '5 МИНУТ И ТРЕВОГА УЙДЁТ',
    cover: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=600&auto=format&fit=crop&q=80',
    views: '760K',
    likes: '41K',
    shares: '1.4%',
    topic: 'Психология, эмоции, спокойствие',
    format: 'Эстетичное видео с текстом',
    duration: '50 сек',
    date: '24 мая 2025',
    hook: 'Накрывает паника или тревожность? Сделай это дыхание прямо сейчас.',
    body: 'Сделай глубокий вдох через нос на 4 секунды, задержи дыхание на 4 секунды, выдохни медленно ртом на 4 секунды и задержи на 4. Сделай 5 кругов "квадрата" и отпустит.',
    cta: 'Поделись этим Reels с другом, которому прямо сейчас непросто.'
  }
]

// Extra mock reels to fill up "Last 20 reels"
const MOCK_EXTRA_REELS = [
  { id: 'ex1', title: 'ФОКУС 90 ДНЕЙ', views: '961K', cover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80' },
  { id: 'ex2', title: 'ПРАВИЛО 1%', views: '1.1M', cover: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80' },
  { id: 'ex3', title: 'КАК Я ПЕРЕСТАЛ ТЕРЯТЬСЯ', views: '670K', cover: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80' },
  { id: 'ex4', title: '3 ПРИВЫЧКИ МИЛЛИОНЕРА', views: '516K', cover: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80' }
]

// Rewrite suggestions database based on style and tone
const REWRITE_SUGGESTIONS = {
  hook: {
    'direct': "99% людей проиграют в этом году. Вот как войти в 1% и обойти всех конкурентов.",
    'friendly': "Привет! Заметил, что топчешься на месте? У меня есть для тебя одна классная новость...",
    'expert': "Научные исследования за 2025 год доказывают: эта методика увеличивает фокус внимания на 82%.",
    'creative': "Перестань делать эти три ритуала по утрам, если не хочешь слить свой миллионный доход."
  },
  body: {
    'direct': "Дисциплина бьет талант во всех сферах. Наведи жесткий порядок в своем графике, совершай целевые действия ежедневно и обязательно анализируй свои результаты каждую неделю. Мотивация — миф для слабых.",
    'friendly': "Давай будем честны: одна мотивация быстро перегорает. Нам с тобой нужна простая, но четкая система! Давай вместе распишем цели на неделю, уберем все лишнее и будем хвалить себя за каждый маленький шаг вперед.",
    'expert': "Основа высокой производительности кроется в структурной архитектуре дня. Разбейте задачи по матрице Эйзенхауэра, интегрируйте помидорный тайминг для глубокой фокусировки и внедрите сквозной KPI-трекинг.",
    'creative': "Твоя мотивация похожа на спичку — горит ярко, но затухает от первого сквозняка. Сделай из дисциплины бронированный двигатель! Записывай цели на салфетках, делай шаги наперекор лени и кайфуй от процесса."
  },
  cta: {
    'direct': "Сделай свой первый шаг прямо сейчас. Напиши слово 'СТАРТ' в директ или подпишись.",
    'friendly': "Попробуем применить это вместе уже завтра? Подписывайся и делись мыслями в комментах!",
    'expert': "Чтобы получить полный академический разбор воронки, сохраняйте публикацию и подписывайтесь.",
    'creative': "Если ты готов наконец-то разорвать этот год и выйти в топ — жми кнопку подписки и летим!"
  }
}

export default function App() {
  // Page mode: 'presentation' (shows all 3 panels side-by-side) or 'single' (normal workspace tab navigation)
  const [viewMode, setViewMode] = useState('presentation')
  
  // Tab control
  const [activeTab, setActiveTab] = useState('competitors') // 'competitors', 'reels', 'editor'

  // Interactive Competitors State
  const [competitors, setCompetitors] = useState(INITIAL_COMPETITORS)
  const [newCompetitor, setNewCompetitor] = useState('')
  const [selectedCompetitorId, setSelectedCompetitorId] = useState('username1')

  // Interactive Reels State
  const [reels, setReels] = useState(INITIAL_REELS)
  const [filterCompetitor, setFilterCompetitor] = useState('all')
  const [filterTopic, setFilterTopic] = useState('all')
  const [filterFormat, setFilterFormat] = useState('all')

  // Editor / AI Generator State
  const [selectedReel, setSelectedReel] = useState(INITIAL_REELS[0])
  const [scriptHook, setScriptHook] = useState(INITIAL_REELS[0].hook)
  const [scriptBody, setScriptBody] = useState(INITIAL_REELS[0].body)
  const [scriptCta, setScriptCta] = useState(INITIAL_REELS[0].cta)
  const [scriptStyle, setScriptStyle] = useState('direct') // 'direct', 'friendly', 'expert', 'creative'

  // Loading animations for AI rewrites
  const [isRewritingHook, setIsRewritingHook] = useState(false)
  const [isRewritingBody, setIsRewritingBody] = useState(false)
  const [isRewritingCta, setIsRewritingCta] = useState(false)

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState(null)

  const triggerToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  // Handle changing the active edit reel
  const handleSelectReelForEdit = (reel) => {
    setSelectedReel(reel)
    setScriptHook(reel.hook)
    setScriptBody(reel.body)
    setScriptCta(reel.cta)
    setActiveTab('editor')
    triggerToast(`Сценарий "${reel.title}" загружен в редактор!`)
  }

  // Add competitor
  const handleAddCompetitor = (e) => {
    e.preventDefault()
    if (!newCompetitor.trim()) return

    // Clean username
    let cleanUsername = newCompetitor.trim()
    if (!cleanUsername.startsWith('@')) {
      if (cleanUsername.includes('instagram.com/')) {
        const parts = cleanUsername.split('instagram.com/')
        cleanUsername = '@' + parts[1].replace(/\//g, '').split('?')[0]
      } else {
        cleanUsername = '@' + cleanUsername
      }
    }

    // Check duplicates
    if (competitors.some(c => c.username.toLowerCase() === cleanUsername.toLowerCase())) {
      triggerToast('Этот конкурент уже отслеживается!')
      return
    }

    const newComp = {
      id: cleanUsername.replace('@', '').replace('.', '_'),
      username: cleanUsername,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      followers: `${(Math.random() * 500 + 100).toFixed(0)}K`,
      avgReach: `${(Math.random() * 2 + 0.5).toFixed(1)} млн`,
      status: 'Активен',
      category: 'Новый аккаунт'
    }

    setCompetitors([...competitors, newComp])
    setNewCompetitor('')
    triggerToast(`Конкурент ${cleanUsername} успешно добавлен!`)
  }

  // Trigger individual section AI rewrite
  const handleAiRewrite = (section) => {
    if (section === 'hook') {
      setIsRewritingHook(true)
      setTimeout(() => {
        setScriptHook(REWRITE_SUGGESTIONS.hook[scriptStyle])
        setIsRewritingHook(false)
        triggerToast('Хук переписан под ваш стиль! ✨')
      }, 1200)
    } else if (section === 'body') {
      setIsRewritingBody(true)
      setTimeout(() => {
        setScriptBody(REWRITE_SUGGESTIONS.body[scriptStyle])
        setIsRewritingBody(false)
        triggerToast('Основная часть переписана! ✨')
      }, 1500)
    } else if (section === 'cta') {
      setIsRewritingCta(true)
      setTimeout(() => {
        setScriptCta(REWRITE_SUGGESTIONS.cta[scriptStyle])
        setIsRewritingCta(false)
        triggerToast('Призыв к действию переписан! ✨')
      }, 1000)
    }
  }

  // Export options
  const handleExport = (format) => {
    triggerToast(`Сценарий экспортирован в формате ${format}! 💾`)
  }

  const handlePublish = (platform) => {
    triggerToast(`Сценарий запланирован для публикации в ${platform}! 🚀`)
  }

  // Get active competitor info for Screen 1
  const activeCompetitorInfo = competitors.find(c => c.id === selectedCompetitorId) || competitors[0]

  // Filtered Reels
  const filteredReels = reels.filter(reel => {
    const matchComp = filterCompetitor === 'all' || reel.competitorId === filterCompetitor
    const matchTopic = filterTopic === 'all' || reel.topic.toLowerCase().includes(filterTopic.toLowerCase())
    const matchFormat = filterFormat === 'all' || reel.format === filterFormat
    return matchComp && matchTopic && matchFormat
  })

  // Topics extraction helper
  const allTopics = ['Бизнес', 'Продуктивность', 'Мышление', 'Мотивация', 'Психология']
  const allFormats = ['Говорящая голова', 'Анимация с графикой', 'Динамичный монтаж', 'Эстетичное видео с текстом']

  return (
    <div className="min-h-screen bg-[#07080c] text-[#f4f4f6] font-sans flex flex-col antialiased">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#181922] border border-[#3b82f6] text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-slide-in transition-all">
          <Sparkles className="w-5 h-5 text-[#3b82f6] animate-pulse" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Toolbar */}
      <header className="bg-[#0b0c11] border-b border-[#181922] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-[#3b82f6] to-[#60a5fa] p-2 rounded-lg">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-wider uppercase text-white">ИИ-РИЛС ПЛАТФОРМА</h1>
            <p className="text-xs text-zinc-500">Автоматический анализ и нейросети для взрывного роста рилс</p>
          </div>
        </div>

        {/* View Mode Selectors */}
        <div className="flex bg-[#12131a] p-1 rounded-lg border border-[#1f222b] self-start md:self-auto">
          <button 
            onClick={() => setViewMode('presentation')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'presentation' ? 'bg-[#3b82f6] text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Режим макета (3 экрана вместе)
          </button>
          <button 
            onClick={() => setViewMode('single')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'single' ? 'bg-[#3b82f6] text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Полноэкранный воркспейс
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* SIDEBAR - Shown on 'single' workspace mode */}
        {viewMode === 'single' && (
          <aside className="w-64 bg-[#0a0b0f] border-r border-[#15161f] flex flex-col justify-between shrink-0 hidden lg:flex">
            <SidebarContent 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              competitors={competitors}
              selectedCompetitorId={selectedCompetitorId}
            />
          </aside>
        )}

        {/* WORKSPACE AREA */}
        <main className="flex-1 overflow-y-auto bg-[#07080c] p-4 md:p-8">
          
          {/* 1. PRESENTATION VIEW MODE (Perfect Replica of User's Layout) */}
          {viewMode === 'presentation' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-[1800px] mx-auto items-start">
              
              {/* SCREEN 1: COMPETITORS DASHBOARD */}
              <div className="bg-[#090a0f] rounded-2xl border border-[#15161f] shadow-2xl overflow-hidden flex flex-col h-[900px]">
                
                {/* Simulated Header */}
                <div className="border-b border-[#13141f] px-4 py-3 bg-[#0a0b10] flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-semibold tracking-wider">ЭКРАН 1: КОНКУРЕНТЫ</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Simulated Left Sidebar for Screen 1 */}
                  <div className="w-52 bg-[#090a0e] border-r border-[#12131a] flex flex-col justify-between p-3 shrink-0">
                    <MiniSidebar active="competitors" />
                  </div>

                  {/* Main content Area for Screen 1 */}
                  <div className="flex-1 p-5 overflow-y-auto flex flex-col space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-tight">Конкуренты</h2>
                      <p className="text-xs text-zinc-400 mt-1">Отслеживай рилсы конкурентов и изучай их лучшие рилсы</p>
                    </div>

                    {/* Add Competitor Input */}
                    <form onSubmit={handleAddCompetitor} className="flex gap-2">
                      <input 
                        type="text" 
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        placeholder="https://www.instagram.com/username/" 
                        className="bg-[#121319] border border-[#1b1c26] text-zinc-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#3b82f6] flex-1"
                      />
                      <button type="submit" className="bg-[#181923] hover:bg-[#202130] text-zinc-200 border border-[#272936] px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all">
                        <Plus className="w-3.5 h-3.5" />
                        Добавить
                      </button>
                    </form>

                    {/* Tracked Competitors List */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Отслеживаемые конкуренты</h3>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {competitors.map((comp) => (
                          <div 
                            key={comp.id}
                            onClick={() => setSelectedCompetitorId(comp.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${selectedCompetitorId === comp.id ? 'bg-[#12131a] border-[#1e2230]' : 'bg-[#0b0c11] border-[#13141d] hover:border-zinc-800'}`}
                          >
                            <div className="flex items-center gap-3">
                              <img src={comp.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                              <div>
                                <p className="text-xs font-bold text-white">{comp.username}</p>
                                <p className="text-[10px] text-zinc-500">{comp.category}</p>
                              </div>
                            </div>
                            <div className="text-right text-[10px]">
                              <span className="text-zinc-500">Подписчики:</span> <strong className="text-zinc-200 block">{comp.followers}</strong>
                            </div>
                            <div className="text-right text-[10px]">
                              <span className="text-zinc-500">Средний охват:</span> <strong className="text-green-400 block">{comp.avgReach}</strong>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              <span className="text-[9px] text-green-500">Активен</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button type="button" className="w-full py-2 bg-[#0b0c11] border border-[#13141d] hover:bg-[#11121a] text-zinc-400 text-xs font-medium rounded-lg transition-all">
                        Показать ещё 4 конкурента
                      </button>
                    </div>

                    {/* Reels Grid of selected competitor */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Последние 20 рилс - {activeCompetitorInfo.username}
                      </h3>

                      <div className="grid grid-cols-3 gap-2">
                        {reels.filter(r => r.competitorId === selectedCompetitorId).slice(0, 3).map((reel) => (
                          <div 
                            key={reel.id} 
                            onClick={() => handleSelectReelForEdit(reel)}
                            className="group relative rounded-xl overflow-hidden aspect-[9/16] bg-[#121319] border border-[#1c1d29] cursor-pointer"
                          >
                            <img src={reel.cover} alt="" className="absolute inset-0 w-full h-full object-cover brightness-75 group-hover:scale-105 transition-all duration-300" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-between p-2">
                              <span className="self-end bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-bold text-white flex items-center gap-1">
                                <Eye className="w-2.5 h-2.5 text-zinc-300" /> {reel.views}
                              </span>
                              <div>
                                <p className="text-[10px] font-bold text-white leading-tight line-clamp-2 uppercase shadow-sm">{reel.title}</p>
                                <span className="text-[8px] text-zinc-400 block mt-0.5">{reel.duration}</span>
                              </div>
                            </div>
                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-[#3b82f6]/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <div className="bg-[#12131a] p-1.5 rounded-full border border-blue-400">
                                <Sparkles className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Extra mock cards */}
                        {MOCK_EXTRA_REELS.map((mock) => (
                          <div 
                            key={mock.id}
                            className="relative rounded-xl overflow-hidden aspect-[9/16] bg-[#121319] border border-[#1b1c26]"
                          >
                            <img src={mock.cover} alt="" className="absolute inset-0 w-full h-full object-cover brightness-50" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-between p-2">
                              <span className="self-end bg-black/40 px-1.5 py-0.5 rounded text-[8px] text-white flex items-center gap-1">
                                <Eye className="w-2.5 h-2.5 text-zinc-400" /> {mock.views}
                              </span>
                              <p className="text-[9px] font-bold text-zinc-300 uppercase">{mock.title}</p>
                            </div>
                          </div>
                        ))}

                        {/* More Reels Box */}
                        <div className="bg-[#121319] border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center p-2 cursor-pointer hover:border-zinc-700 transition-all">
                          <span className="text-base font-bold text-[#3b82f6]">+15</span>
                          <span className="text-[9px] text-zinc-500 mt-1 font-semibold leading-tight">Ещё рилсы</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 text-center text-[9px] text-zinc-600 border-t border-[#12131c]">
                      Синхронизация и обновление данных каждые 30 минут
                    </div>
                  </div>
                </div>
              </div>

              {/* SCREEN 2: REELS LIBRARY */}
              <div className="bg-[#090a0f] rounded-2xl border border-[#15161f] shadow-2xl overflow-hidden flex flex-col h-[900px]">
                
                {/* Simulated Header */}
                <div className="border-b border-[#13141f] px-4 py-3 bg-[#0a0b10] flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-semibold tracking-wider">ЭКРАН 2: БИБЛИОТЕКА РИЛС</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Simulated Left Sidebar for Screen 2 */}
                  <div className="w-52 bg-[#090a0e] border-r border-[#12131a] flex flex-col justify-between p-3 shrink-0">
                    <MiniSidebar active="reels" />
                  </div>

                  {/* Main content Area for Screen 2 */}
                  <div className="flex-1 p-5 overflow-y-auto flex flex-col space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Рилсы</h2>
                        <p className="text-xs text-zinc-400 mt-1">Библиотека рилс ваших конкурентов</p>
                      </div>
                      <button 
                        onClick={() => triggerToast('Библиотека рилс обновлена!')}
                        className="bg-[#121319] hover:bg-[#181923] text-zinc-300 border border-[#1b1c26] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <RefreshCw className="w-3 h-3 text-zinc-400" />
                        Обновить
                      </button>
                    </div>

                    {/* Simulated Filter Bar */}
                    <div className="grid grid-cols-2 gap-2">
                      <select 
                        value={filterCompetitor}
                        onChange={(e) => setFilterCompetitor(e.target.value)}
                        className="bg-[#121319] border border-[#1b1c26] text-zinc-300 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                      >
                        <option value="all">Все конкуренты</option>
                        {competitors.map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
                      </select>

                      <select 
                        value={filterTopic}
                        onChange={(e) => setFilterTopic(e.target.value)}
                        className="bg-[#121319] border border-[#1b1c26] text-zinc-300 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                      >
                        <option value="all">Все темы</option>
                        {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>

                      <select 
                        value={filterFormat}
                        onChange={(e) => setFilterFormat(e.target.value)}
                        className="bg-[#121319] border border-[#1b1c26] text-zinc-300 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                      >
                        <option value="all">Все форматы</option>
                        {allFormats.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>

                      <div className="flex gap-1.5">
                        <select className="bg-[#121319] border border-[#1b1c26] text-zinc-300 text-xs px-2 py-1.5 rounded-lg focus:outline-none flex-1">
                          <option>7 дней</option>
                          <option>30 дней</option>
                          <option>Все время</option>
                        </select>
                        <button className="bg-[#121319] border border-[#1b1c26] p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Reels Grid */}
                    <div className="grid grid-cols-2 gap-3 flex-1 overflow-y-auto pr-1">
                      {filteredReels.map((reel) => (
                        <div key={reel.id} className="bg-[#101116] border border-[#161722] rounded-xl overflow-hidden flex flex-col justify-between">
                          
                          {/* Image and metrics header */}
                          <div className="relative aspect-[4/3] bg-[#121319]">
                            <img src={reel.cover} alt="" className="w-full h-full object-cover brightness-75" />
                            {/* User details tag */}
                            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-full">
                              <img src={reel.avatar} className="w-3.5 h-3.5 rounded-full object-cover" />
                              <span className="text-[8px] font-semibold text-zinc-200">{reel.username}</span>
                            </div>
                            {/* Overlay Title */}
                            <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-lg">
                              <h4 className="text-[10px] font-bold text-white uppercase leading-tight line-clamp-1">{reel.title}</h4>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="p-2 border-b border-[#151620] bg-[#0c0d12] flex items-center justify-between text-[9px] text-zinc-400">
                            <span className="flex items-center gap-1"><Eye className="w-2.5 h-2.5 text-zinc-500" /> {reel.views}</span>
                            <span className="flex items-center gap-1"><Heart className="w-2.5 h-2.5 text-red-500/80" /> {reel.likes}</span>
                            <span className="flex items-center gap-1"><Share2 className="w-2.5 h-2.5 text-blue-500/80" /> {reel.shares}</span>
                          </div>

                          {/* Details and Actions */}
                          <div className="p-2 bg-[#0c0d12] flex-1 flex flex-col justify-between space-y-2">
                            <div>
                              <span className="text-[8px] text-zinc-500 uppercase font-semibold">Тема</span>
                              <p className="text-[9px] text-zinc-300 leading-snug line-clamp-2 mt-0.5">{reel.topic}</p>
                            </div>

                            <button 
                              onClick={() => handleSelectReelForEdit(reel)}
                              className="w-full py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[10px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-all"
                            >
                              <Sparkles className="w-3 h-3 text-white fill-white" />
                              Рерайтинг
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-center gap-2 pt-2 border-t border-[#12131c]">
                      <button className="p-1 bg-[#121319] border border-[#1b1c26] rounded text-zinc-400 hover:text-zinc-200"><ChevronLeft className="w-3 h-3" /></button>
                      <button className="px-2 py-0.5 bg-[#3b82f6] rounded text-[10px] font-bold text-white">1</button>
                      <button className="px-2 py-0.5 bg-[#121319] hover:bg-zinc-800 rounded text-[10px] text-zinc-400">2</button>
                      <button className="px-2 py-0.5 bg-[#121319] hover:bg-zinc-800 rounded text-[10px] text-zinc-400">3</button>
                      <span className="text-zinc-600 text-[10px]">...</span>
                      <button className="px-2 py-0.5 bg-[#121319] hover:bg-zinc-800 rounded text-[10px] text-zinc-400">42</button>
                      <button className="p-1 bg-[#121319] border border-[#1b1c26] rounded text-zinc-400 hover:text-zinc-200"><ChevronRight className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SCREEN 3: SCRIPT EDITOR & ANALYZER */}
              <div className="bg-[#090a0f] rounded-2xl border border-[#15161f] shadow-2xl overflow-hidden flex flex-col h-[900px]">
                
                {/* Simulated Header */}
                <div className="border-b border-[#13141f] px-4 py-3 bg-[#0a0b10] flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-semibold tracking-wider">ЭКРАН 3: РЕДАКТОР СЦЕНАРИЯ</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Simulated Left Sidebar for Screen 3 */}
                  <div className="w-52 bg-[#090a0e] border-r border-[#12131a] flex flex-col justify-between p-3 shrink-0">
                    <MiniSidebar active="editor" />
                  </div>

                  {/* Main content Area for Screen 3 */}
                  <div className="flex-1 p-4 overflow-y-auto flex flex-col space-y-4">
                    
                    {/* Back header */}
                    <button 
                      onClick={() => triggerToast('Уже в режиме макета!')}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 self-start"
                    >
                      ← Назад к рилсам
                    </button>

                    {/* Tab Navigation inside Script Panel */}
                    <div className="flex bg-[#12131a] p-1 rounded-lg border border-[#1b1c26] max-w-[250px]">
                      <button className="flex-1 text-center py-1 bg-[#181923] text-white rounded text-[10px] font-semibold">Редактор сценария</button>
                      <button onClick={() => triggerToast('Раздел Аналитики откроется в полной версии!')} className="flex-1 text-center py-1 text-zinc-400 hover:text-zinc-200 rounded text-[10px] font-semibold">Аналитика</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 flex-1 overflow-y-auto pr-1">
                      
                      {/* Left: Preview card (cols-2) */}
                      <div className="md:col-span-2 space-y-3">
                        
                        <div className="bg-[#0b0c11] border border-[#13141d] p-3 rounded-xl space-y-3">
                          <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Превью рилса</h3>
                          
                          <div className="relative rounded-xl overflow-hidden aspect-[9/16] bg-[#121319] border border-[#1b1c26] max-w-[150px] mx-auto shadow-lg">
                            <img src={selectedReel.cover} alt="" className="absolute inset-0 w-full h-full object-cover brightness-75" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-between p-2">
                              <span className="self-end bg-black/40 px-1 py-0.5 rounded text-[7px] text-white flex items-center gap-1">
                                <Eye className="w-2 h-2" /> {selectedReel.views}
                              </span>
                              <p className="text-[9px] font-bold text-white leading-tight line-clamp-2 uppercase">{selectedReel.title}</p>
                            </div>
                          </div>

                          <button 
                            onClick={() => triggerToast(`Открываем оригинал от ${selectedReel.username}...`)}
                            className="w-full py-1.5 bg-[#12131a] hover:bg-zinc-800 text-zinc-300 text-[10px] font-semibold rounded-lg border border-[#1c1d29] transition-all"
                          >
                            Смотреть оригинал
                          </button>
                        </div>

                        {/* Info parameters */}
                        <div className="bg-[#0b0c11] border border-[#13141d] p-3 rounded-xl space-y-2">
                          <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Информация</h3>
                          
                          <div className="space-y-1.5 text-[10px]">
                            <div className="flex justify-between py-1 border-b border-[#12131c]">
                              <span className="text-zinc-500">Тема</span>
                              <span className="text-zinc-200 font-medium text-right line-clamp-1 max-w-[100px]">{selectedReel.topic.split(',')[0]}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-[#12131c]">
                              <span className="text-zinc-500">Формат</span>
                              <span className="text-zinc-200 font-medium text-right">{selectedReel.format}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-[#12131c]">
                              <span className="text-zinc-500">Длительность</span>
                              <span className="text-zinc-200 font-medium text-right">{selectedReel.duration}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-[#12131c]">
                              <span className="text-zinc-500">Оригинал</span>
                              <span className="text-[#3b82f6] font-medium text-right">{selectedReel.username}</span>
                            </div>
                            <div className="flex justify-between py-1">
                              <span className="text-zinc-500">Дата поиска</span>
                              <span className="text-zinc-200 font-medium text-right">{selectedReel.date}</span>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Right: AI inputs editor (cols-3) */}
                      <div className="md:col-span-3 space-y-3 flex flex-col">
                        
                        {/* Hook */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-zinc-400 font-bold">Хук</span>
                            <span className="text-zinc-500">{scriptHook.length}/150</span>
                          </div>
                          <textarea 
                            value={scriptHook} 
                            onChange={(e) => setScriptHook(e.target.value)}
                            rows={2}
                            className="w-full bg-[#121319] border border-[#1b1c26] rounded-lg p-2 text-[10px] text-zinc-100 focus:outline-none focus:border-[#3b82f6] resize-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => handleAiRewrite('hook')}
                              disabled={isRewritingHook}
                              className="flex-1 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#3b82f6]/50 text-white text-[9px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-white" />
                              {isRewritingHook ? 'Генерация...' : 'Реинс под мой стиль'}
                            </button>
                            <button onClick={() => triggerToast('Сброшено к оригиналу')} className="p-1.5 bg-[#121319] hover:bg-[#181923] text-zinc-400 border border-[#1b1c26] rounded-lg">
                              <RefreshCw className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Main Body */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-zinc-400 font-bold">Основная часть</span>
                            <span className="text-zinc-500">{scriptBody.length}/1500</span>
                          </div>
                          <textarea 
                            value={scriptBody} 
                            onChange={(e) => setScriptBody(e.target.value)}
                            rows={3}
                            className="w-full bg-[#121319] border border-[#1b1c26] rounded-lg p-2 text-[10px] text-zinc-100 focus:outline-none focus:border-[#3b82f6] resize-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => handleAiRewrite('body')}
                              disabled={isRewritingBody}
                              className="flex-1 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#3b82f6]/50 text-white text-[9px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-white" />
                              {isRewritingBody ? 'Генерация...' : 'Реинс под мой стиль'}
                            </button>
                            <button onClick={() => triggerToast('Сброшено к оригиналу')} className="p-1.5 bg-[#121319] hover:bg-[#181923] text-zinc-400 border border-[#1b1c26] rounded-lg">
                              <RefreshCw className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* CTA */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-zinc-400 font-bold">Призыв к действию</span>
                            <span className="text-zinc-500">{scriptCta.length}/100</span>
                          </div>
                          <textarea 
                            value={scriptCta} 
                            onChange={(e) => setScriptCta(e.target.value)}
                            rows={2}
                            className="w-full bg-[#121319] border border-[#1b1c26] rounded-lg p-2 text-[10px] text-zinc-100 focus:outline-none focus:border-[#3b82f6] resize-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => handleAiRewrite('cta')}
                              disabled={isRewritingCta}
                              className="flex-1 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#3b82f6]/50 text-white text-[9px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-white" />
                              {isRewritingCta ? 'Генерация...' : 'Реинс под мой стиль'}
                            </button>
                            <button onClick={() => triggerToast('Сброшено к оригиналу')} className="p-1.5 bg-[#121319] hover:bg-[#181923] text-zinc-400 border border-[#1b1c26] rounded-lg">
                              <RefreshCw className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Style Select */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-zinc-500 uppercase font-bold">Стиль и тон</label>
                          <select 
                            value={scriptStyle}
                            onChange={(e) => setScriptStyle(e.target.value)}
                            className="w-full bg-[#121319] border border-[#1b1c26] text-zinc-200 text-[10px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#3b82f6]"
                          >
                            <option value="direct">Мой стиль: Прямой и мотивирующий</option>
                            <option value="friendly">Мой стиль: Дружелюбный и вовлекающий</option>
                            <option value="expert">Мой стиль: Экспертный и глубокий</option>
                            <option value="creative">Мой стиль: Яркий и харизматичный</option>
                          </select>
                        </div>

                        {/* Bottom Action buttons */}
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#12131c]">
                          <button 
                            onClick={() => triggerToast('Сценарий успешно сохранён в базу!')}
                            className="py-2 bg-[#121319] hover:bg-[#1a1b26] text-zinc-200 text-[10px] font-bold rounded-lg border border-[#1c1d29] flex items-center justify-center gap-1 transition-all"
                          >
                            <Save className="w-3 h-3 text-zinc-400" />
                            Сохранить
                          </button>
                          <button 
                            onClick={() => handleExport('PDF')}
                            className="py-2 bg-[#121319] hover:bg-[#1a1b26] text-zinc-200 text-[10px] font-bold rounded-lg border border-[#1c1d29] flex items-center justify-center gap-1 transition-all"
                          >
                            <Download className="w-3 h-3 text-zinc-400" />
                            Экспорт
                          </button>
                          <button 
                            onClick={() => handlePublish('Instagram')}
                            className="py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                          >
                            <Send className="w-3 h-3" />
                            Опубликовать
                          </button>
                        </div>

                      </div>

                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 2. SINGLE WORKSPACE TAB VIEW (Detailed Client-like Workspace Layout) */}
          {viewMode === 'single' && (
            <div className="max-w-[1400px] mx-auto bg-[#090a0f] border border-[#15161f] rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col space-y-6">
              
              {/* Header inside Workspace Tab */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#12131a]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs text-zinc-500 font-semibold tracking-widest uppercase">Рабочая сессия</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mt-1">
                    {activeTab === 'competitors' && 'Отслеживаемые конкуренты'}
                    {activeTab === 'reels' && 'Библиотека вирусных рилс'}
                    {activeTab === 'editor' && `Нейро-редактор: ${selectedReel.title}`}
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    {activeTab === 'competitors' && 'Управление аккаунтами ваших главных конкурентов и мониторинг их показателей.'}
                    {activeTab === 'reels' && 'Изучайте вирусные ролики в вашей нише и быстро адаптируйте сценарии с помощью искусственного интеллекта.'}
                    {activeTab === 'editor' && 'Трансформируйте любой вирусный сценарий под свой стиль в 1 клик с сохранением структуры вовлечения.'}
                  </p>
                </div>

                {activeTab === 'reels' && (
                  <button 
                    onClick={() => triggerToast('Библиотека рилс обновлена!')}
                    className="bg-[#121319] hover:bg-[#181923] text-zinc-300 border border-[#1b1c26] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all self-start md:self-auto"
                  >
                    <RefreshCw className="w-4 h-4 text-zinc-400" />
                    Синхронизировать
                  </button>
                )}
              </div>

              {/* TAB CONTENTS */}
              {activeTab === 'competitors' && (
                <div className="space-y-6">
                  {/* Form to add */}
                  <div className="bg-[#0b0c11] border border-[#13141d] p-5 rounded-2xl space-y-3">
                    <h3 className="text-md font-bold text-white">Добавить новый аккаунт для отслеживания</h3>
                    <p className="text-xs text-zinc-400">Укажите ссылку на Instagram или имя пользователя. Система проанализирует последние 100 рилсов за несколько минут.</p>
                    
                    <form onSubmit={handleAddCompetitor} className="flex flex-col md:flex-row gap-3 pt-1">
                      <input 
                        type="text" 
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        placeholder="Пример: https://www.instagram.com/alex_marketing/ или @alex_marketing" 
                        className="bg-[#121319] border border-[#1b1c26] text-zinc-200 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-[#3b82f6] flex-1"
                      />
                      <button type="submit" className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/10">
                        <Plus className="w-4 h-4" />
                        Добавить в трекер
                      </button>
                    </form>
                  </div>

                  {/* Competitors List Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {competitors.map((comp) => (
                      <div 
                        key={comp.id}
                        onClick={() => setSelectedCompetitorId(comp.id)}
                        className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-4 ${selectedCompetitorId === comp.id ? 'bg-[#12131a]/80 border-[#3b82f6]' : 'bg-[#0b0c11] border-[#13141d] hover:border-zinc-700'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <img src={comp.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                            <div>
                              <p className="text-base font-bold text-white">{comp.username}</p>
                              <p className="text-xs text-zinc-500">{comp.category}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] text-green-500 font-bold">Активен</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#12131c]">
                          <div>
                            <span className="text-xs text-zinc-500 block">Подписчики:</span>
                            <span className="text-lg font-extrabold text-zinc-100">{comp.followers}</span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500 block">Средний охват:</span>
                            <span className="text-lg font-extrabold text-green-400">{comp.avgReach}</span>
                          </div>
                        </div>

                        {selectedCompetitorId === comp.id && (
                          <div className="text-xs text-blue-400 font-bold flex items-center gap-1 pt-1">
                            <Check className="w-4 h-4" /> Активный конкурент в текущей рабочей панели
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Последние рилсы выбранного конкурента */}
                  <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <PlayCircle className="w-5 h-5 text-[#3b82f6]" />
                      Последние 20 рилс - {activeCompetitorInfo.username}
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                      {reels.filter(r => r.competitorId === selectedCompetitorId).map((reel) => (
                        <div 
                          key={reel.id} 
                          onClick={() => handleSelectReelForEdit(reel)}
                          className="group relative rounded-xl overflow-hidden aspect-[9/16] bg-[#121319] border border-[#1b1c26] cursor-pointer shadow-lg hover:shadow-[#3b82f6]/5 transition-all"
                        >
                          <img src={reel.cover} alt="" className="absolute inset-0 w-full h-full object-cover brightness-75 group-hover:scale-105 transition-all duration-300" />
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent flex flex-col justify-between p-3 z-10">
                            <span className="self-end bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1 shadow-md">
                              <Eye className="w-3 h-3 text-zinc-300" /> {reel.views}
                            </span>
                            
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-white leading-snug line-clamp-2 uppercase tracking-wide group-hover:text-blue-400 transition-all">{reel.title}</p>
                              <span className="text-[10px] text-zinc-400 block">{reel.duration}</span>
                            </div>
                          </div>

                          {/* Hover action overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-3 transition-all z-20">
                            <div className="bg-[#3b82f6] p-2.5 rounded-full border border-blue-400 mb-2">
                              <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xs text-white font-bold text-center uppercase tracking-wide">Редактировать сценарий</span>
                          </div>
                        </div>
                      ))}

                      {/* Mock remaining space */}
                      {MOCK_EXTRA_REELS.map((mock) => (
                        <div key={mock.id} className="relative rounded-xl overflow-hidden aspect-[9/16] bg-[#121319] border border-[#1b1c26] opacity-70">
                          <img src={mock.cover} alt="" className="absolute inset-0 w-full h-full object-cover brightness-50" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-between p-3">
                            <span className="self-end bg-black/40 px-2 py-1 rounded-lg text-[10px] text-white flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {mock.views}
                            </span>
                            <p className="text-xs font-bold text-zinc-400 uppercase">{mock.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reels' && (
                <div className="space-y-6">
                  {/* Filters Bar */}
                  <div className="flex flex-col md:flex-row gap-3 bg-[#0b0c11] border border-[#13141d] p-4 rounded-2xl">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col space-y-1">
                        <label className="text-xs text-zinc-500 font-medium">Конкурент</label>
                        <select 
                          value={filterCompetitor}
                          onChange={(e) => setFilterCompetitor(e.target.value)}
                          className="bg-[#121319] border border-[#1b1c26] text-zinc-200 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#3b82f6]"
                        >
                          <option value="all">Все конкуренты</option>
                          {competitors.map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-col space-y-1">
                        <label className="text-xs text-zinc-500 font-medium">Тематика</label>
                        <select 
                          value={filterTopic}
                          onChange={(e) => setFilterTopic(e.target.value)}
                          className="bg-[#121319] border border-[#1b1c26] text-zinc-200 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#3b82f6]"
                        >
                          <option value="all">Все темы</option>
                          {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-col space-y-1">
                        <label className="text-xs text-zinc-500 font-medium">Формат видео</label>
                        <select 
                          value={filterFormat}
                          onChange={(e) => setFilterFormat(e.target.value)}
                          className="bg-[#121319] border border-[#1b1c26] text-zinc-200 text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#3b82f6]"
                        >
                          <option value="all">Все форматы</option>
                          {allFormats.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-end gap-2 shrink-0">
                      <select className="bg-[#121319] border border-[#1b1c26] text-zinc-200 text-sm px-4 py-2 rounded-xl focus:outline-none focus:border-[#3b82f6] h-[38px]">
                        <option>За последние 7 дней</option>
                        <option>За последние 30 дней</option>
                        <option>За все время</option>
                      </select>
                      <button className="bg-[#121319] border border-[#1b1c26] p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 h-[38px] w-[38px] flex items-center justify-center transition-all">
                        <SlidersHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Reels Library grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredReels.map((reel) => (
                      <div key={reel.id} className="bg-[#0b0c11] border border-[#13141d] rounded-2xl overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-all shadow-xl group">
                        
                        <div className="relative aspect-[16/10] bg-[#121319] overflow-hidden">
                          <img src={reel.cover} alt="" className="w-full h-full object-cover brightness-75 group-hover:scale-105 transition-all duration-300" />
                          
                          {/* Top row details */}
                          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-800">
                            <img src={reel.avatar} className="w-4 h-4 rounded-full object-cover" />
                            <span className="text-xs font-bold text-zinc-100">{reel.username}</span>
                          </div>

                          <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-md p-3 rounded-xl border border-zinc-800">
                            <span className="text-[10px] text-[#3b82f6] font-bold uppercase tracking-wider block mb-1">{reel.format}</span>
                            <h4 className="text-sm font-bold text-white uppercase leading-snug line-clamp-1">{reel.title}</h4>
                          </div>
                        </div>

                        {/* Engagement rows */}
                        <div className="grid grid-cols-3 gap-2 px-4 py-3 bg-[#0c0d12] border-b border-[#12131d] text-xs text-zinc-400 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-zinc-500">Просмотры</span>
                            <span className="font-extrabold text-zinc-200 mt-0.5 flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-zinc-500" /> {reel.views}</span>
                          </div>
                          <div className="flex flex-col items-center border-x border-[#12131d]">
                            <span className="text-[10px] text-zinc-500">Лайки</span>
                            <span className="font-extrabold text-red-400 mt-0.5 flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500" /> {reel.likes}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-zinc-500">ER (Шеринг)</span>
                            <span className="font-extrabold text-blue-400 mt-0.5 flex items-center gap-1"><Share2 className="w-3.5 h-3.5 text-blue-500" /> {reel.shares}</span>
                          </div>
                        </div>

                        {/* Action details block */}
                        <div className="p-4 space-y-4">
                          <div>
                            <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Категория / Тема</span>
                            <p className="text-xs text-zinc-300 mt-1 font-semibold">{reel.topic}</p>
                          </div>

                          <button 
                            onClick={() => handleSelectReelForEdit(reel)}
                            className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/10"
                          >
                            <Sparkles className="w-4 h-4 text-white fill-white animate-pulse" />
                            Переписать сценарий
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>

                  {filteredReels.length === 0 && (
                    <div className="text-center py-16 bg-[#0b0c11] border border-[#13141d] rounded-2xl space-y-2">
                      <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto" />
                      <p className="text-zinc-400 font-semibold text-base">Ничего не найдено</p>
                      <p className="text-xs text-zinc-500">Попробуйте сбросить фильтры для поиска</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'editor' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                  
                  {/* Left Column - Preview and metadata (cols-2) */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[#0b0c11] border border-[#13141d] p-5 rounded-2xl space-y-4 shadow-xl">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Превью источника</h3>
                      
                      {/* Floating mini video card */}
                      <div className="relative rounded-2xl overflow-hidden aspect-[9/16] bg-[#121319] border border-[#1b1c26] max-w-[200px] mx-auto shadow-2xl">
                        <img src={selectedReel.cover} alt="" className="absolute inset-0 w-full h-full object-cover brightness-75" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent flex flex-col justify-between p-4 z-10">
                          <span className="self-end bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 shadow-md">
                            <Eye className="w-3.5 h-3.5 text-zinc-300" /> {selectedReel.views}
                          </span>
                          
                          <div>
                            <p className="text-xs font-bold text-white uppercase tracking-wide leading-snug line-clamp-2">{selectedReel.title}</p>
                            <span className="text-[10px] text-zinc-400 block mt-1">{selectedReel.duration}</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => triggerToast(`Импортируем оригинальный ролик с Instagram...`)}
                        className="w-full py-3 bg-[#12131a] hover:bg-[#1a1b24] text-zinc-300 text-xs font-bold rounded-xl border border-[#1c1d29] transition-all flex items-center justify-center gap-2"
                      >
                        <PlayCircle className="w-4 h-4 text-zinc-400" />
                        Посмотреть видео-оригинал
                      </button>
                    </div>

                    {/* Meta values */}
                    <div className="bg-[#0b0c11] border border-[#13141d] p-5 rounded-2xl space-y-3">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest border-b border-[#12131c] pb-2">Метаданные оригинала</h3>
                      
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between py-1 border-b border-[#12131c]/60">
                          <span className="text-zinc-500 font-medium">Ниша / Тематика:</span>
                          <span className="text-zinc-200 font-semibold">{selectedReel.topic}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#12131c]/60">
                          <span className="text-zinc-500 font-medium">Тип формата:</span>
                          <span className="text-zinc-200 font-semibold">{selectedReel.format}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#12131c]/60">
                          <span className="text-zinc-500 font-medium">Длина хронометража:</span>
                          <span className="text-zinc-200 font-semibold">{selectedReel.duration}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[#12131c]/60">
                          <span className="text-zinc-500 font-medium">Автор исходника:</span>
                          <span className="text-blue-400 font-semibold">{selectedReel.username}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-zinc-500 font-medium">Импортировано:</span>
                          <span className="text-zinc-300 font-semibold">{selectedReel.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Editor inputs (cols-3) */}
                  <div className="lg:col-span-3 space-y-6 flex flex-col">
                    
                    {/* Hook Section */}
                    <div className="bg-[#0b0c11] border border-[#13141d] p-5 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">Шаг 1</span>
                          <span className="text-sm font-bold text-white uppercase tracking-wider">Хук (Зацепка первые 3 сек)</span>
                        </div>
                        <span className="text-xs text-zinc-500 font-semibold">{scriptHook.length}/150</span>
                      </div>
                      
                      <textarea 
                        value={scriptHook} 
                        onChange={(e) => setScriptHook(e.target.value)}
                        rows={3}
                        className="w-full bg-[#121319] border border-[#1b1c26] rounded-xl p-3.5 text-sm text-zinc-100 focus:outline-none focus:border-[#3b82f6] resize-none"
                      />
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleAiRewrite('hook')}
                          disabled={isRewritingHook}
                          className="flex-1 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#3b82f6]/50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                        >
                          <Sparkles className="w-4 h-4 text-white animate-pulse" />
                          {isRewritingHook ? 'Нейросеть генерирует...' : 'Реинс под мой стиль'}
                        </button>
                        <button 
                          onClick={() => {
                            setScriptHook(selectedReel.hook)
                            triggerToast('Хук сброшен к исходному.')
                          }}
                          className="p-2.5 bg-[#121319] hover:bg-[#181923] text-zinc-400 border border-[#1b1c26] rounded-xl transition-all"
                          title="Сбросить к оригиналу"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>

                      {isRewritingHook && (
                        <div className="w-full bg-[#121319] h-1.5 rounded-full overflow-hidden mt-2">
                          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full animate-progress" style={{ width: '100%' }} />
                        </div>
                      )}
                    </div>

                    {/* Body Section */}
                    <div className="bg-[#0b0c11] border border-[#13141d] p-5 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">Шаг 2</span>
                          <span className="text-sm font-bold text-white uppercase tracking-wider">Основная часть (Ценность)</span>
                        </div>
                        <span className="text-xs text-zinc-500 font-semibold">{scriptBody.length}/1500</span>
                      </div>
                      
                      <textarea 
                        value={scriptBody} 
                        onChange={(e) => setScriptBody(e.target.value)}
                        rows={5}
                        className="w-full bg-[#121319] border border-[#1b1c26] rounded-xl p-3.5 text-sm text-zinc-100 focus:outline-none focus:border-[#3b82f6] resize-none"
                      />
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleAiRewrite('body')}
                          disabled={isRewritingBody}
                          className="flex-1 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#3b82f6]/50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                        >
                          <Sparkles className="w-4 h-4 text-white animate-pulse" />
                          {isRewritingBody ? 'Нейросеть генерирует...' : 'Реинс под мой стиль'}
                        </button>
                        <button 
                          onClick={() => {
                            setScriptBody(selectedReel.body)
                            triggerToast('Основная часть сброшена.')
                          }}
                          className="p-2.5 bg-[#121319] hover:bg-[#181923] text-zinc-400 border border-[#1b1c26] rounded-xl transition-all"
                          title="Сбросить к оригиналу"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>

                      {isRewritingBody && (
                        <div className="w-full bg-[#121319] h-1.5 rounded-full overflow-hidden mt-2">
                          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full animate-progress" style={{ width: '100%' }} />
                        </div>
                      )}
                    </div>

                    {/* CTA Section */}
                    <div className="bg-[#0b0c11] border border-[#13141d] p-5 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-0.5 rounded">Шаг 3</span>
                          <span className="text-sm font-bold text-white uppercase tracking-wider">Призыв к действию (CTA)</span>
                        </div>
                        <span className="text-xs text-zinc-500 font-semibold">{scriptCta.length}/100</span>
                      </div>
                      
                      <textarea 
                        value={scriptCta} 
                        onChange={(e) => setScriptCta(e.target.value)}
                        rows={3}
                        className="w-full bg-[#121319] border border-[#1b1c26] rounded-xl p-3.5 text-sm text-zinc-100 focus:outline-none focus:border-[#3b82f6] resize-none"
                      />
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleAiRewrite('cta')}
                          disabled={isRewritingCta}
                          className="flex-1 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#3b82f6]/50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                        >
                          <Sparkles className="w-4 h-4 text-white animate-pulse" />
                          {isRewritingCta ? 'Нейросеть генерирует...' : 'Реинс под мой стиль'}
                        </button>
                        <button 
                          onClick={() => {
                            setScriptCta(selectedReel.cta)
                            triggerToast('CTA сброшен к исходному.')
                          }}
                          className="p-2.5 bg-[#121319] hover:bg-[#181923] text-zinc-400 border border-[#1b1c26] rounded-xl transition-all"
                          title="Сбросить к оригиналу"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>

                      {isRewritingCta && (
                        <div className="w-full bg-[#121319] h-1.5 rounded-full overflow-hidden mt-2">
                          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full animate-progress" style={{ width: '100%' }} />
                        </div>
                      )}
                    </div>

                    {/* Style Configuration */}
                    <div className="bg-[#0b0c11] border border-[#13141d] p-5 rounded-2xl space-y-4">
                      <div className="flex flex-col space-y-2">
                        <label className="text-xs text-zinc-400 uppercase font-bold tracking-widest">Индивидуальный тон и манера изложения</label>
                        <p className="text-xs text-zinc-500">Система адаптирует сленг, длину предложений и эмоциональный окрас под выбранную роль.</p>
                        
                        <select 
                          value={scriptStyle}
                          onChange={(e) => setScriptStyle(e.target.value)}
                          className="w-full bg-[#121319] border border-[#1b1c26] text-zinc-200 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-[#3b82f6]"
                        >
                          <option value="direct">🔥 Прямой, жесткий и мотивирующий (Для личной эффективности)</option>
                          <option value="friendly">🤝 Дружелюбный, поддерживающий и вовлекающий (Для лояльной базы)</option>
                          <option value="expert">🧠 Академический, экспертный и глубокий (Для нишевого B2B бизнеса)</option>
                          <option value="creative">🚀 Креативный, харизматичный и провокационный (Для вирусных охватов)</option>
                        </select>
                      </div>

                      {/* Global Buttons */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-[#12131c]">
                        <button 
                          onClick={() => triggerToast('Сценарий успешно сохранён в вашу библиотеку! 📁')}
                          className="py-3.5 bg-[#121319] hover:bg-[#1a1b26] text-zinc-200 text-sm font-bold rounded-xl border border-[#1c1d29] flex items-center justify-center gap-2 transition-all"
                        >
                          <Save className="w-4 h-4 text-zinc-400" />
                          Сохранить сценарий
                        </button>
                        <button 
                          onClick={() => handleExport('TXT')}
                          className="py-3.5 bg-[#121319] hover:bg-[#1a1b26] text-zinc-200 text-sm font-bold rounded-xl border border-[#1c1d29] flex items-center justify-center gap-2 transition-all"
                        >
                          <Download className="w-4 h-4 text-zinc-400" />
                          Экспортировать (TXT, PDF)
                        </button>
                        <button 
                          onClick={() => handlePublish('TikTok')}
                          className="py-3.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/10"
                        >
                          <Send className="w-4 h-4" />
                          Опубликовать в соцсетях
                        </button>
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* Styled Animations CSS block */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes progressBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progressBar 1.2s ease-in-out forwards;
        }
      `}</style>
    </div>
  )
}

// Side-by-side presentation mini-sidebar wrapper
function MiniSidebar({ active }) {
  return (
    <div className="flex flex-col justify-between h-full text-zinc-400 text-[10px] space-y-4">
      
      <div className="space-y-4">
        {/* Logo mockup inside screens */}
        <div className="flex items-center gap-1.5 pb-2 border-b border-[#12131a]">
          <Play className="w-3 h-3 text-white fill-white" />
          <span className="font-extrabold text-white text-[8px] tracking-wider">ИИ-РИЛС</span>
        </div>

        {/* List of tabs */}
        <div className="space-y-2">
          <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-wider block">ПАНЕЛЬ</span>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 p-1 rounded text-zinc-600">
              <Home className="w-3 h-3" /> Главная
            </div>
            <div className={`flex items-center gap-1.5 p-1 rounded font-semibold ${active === 'reels' ? 'bg-[#12131a] text-white' : 'text-zinc-500'}`}>
              <Play className="w-3 h-3" /> Рилсы
            </div>
            <div className={`flex items-center gap-1.5 p-1 rounded font-semibold ${active === 'editor' ? 'bg-[#12131a] text-white' : 'text-zinc-500'}`}>
              <FileText className="w-3 h-3" /> Сценарии
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded text-zinc-600">
              <Calendar className="w-3 h-3" /> Календарь
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded text-zinc-600">
              <BarChart3 className="w-3 h-3" /> Аналитика
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-wider block">АНАЛИЗ</span>
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 p-1 rounded font-semibold ${active === 'competitors' ? 'bg-[#12131a] text-white' : 'text-zinc-500'}`}>
              <Users className="w-3 h-3" /> Конкуренты
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded text-zinc-600">
              <Compass className="w-3 h-3" /> Темы
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded text-zinc-600">
              <TrendingUp className="w-3 h-3" /> Тренды
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-wider block">БИБЛИОТЕКА</span>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 p-1 rounded text-zinc-600">
              <Folder className="w-3 h-3" /> Мои рилсы
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded text-zinc-600">
              <LayoutGrid className="w-3 h-3" /> Шаблоны
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded text-zinc-600">
              <ImageIcon className="w-3 h-3" /> Медиа
            </div>
          </div>
        </div>
      </div>

      {/* User profile inside the panel */}
      <div className="space-y-2 pt-2 border-t border-[#12131a]">
        <div className="bg-[#12131a] p-1.5 rounded-lg border border-[#1b1c26] space-y-1.5">
          <div className="flex justify-between items-center text-[7px] font-bold">
            <span className="text-zinc-400">Тариф: PRO</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-[6px] text-zinc-500 font-medium">
              <span>Лимит рилсов</span>
              <span>2 480 / 10 000</span>
            </div>
            <div className="w-full bg-[#181923] h-1 rounded-full overflow-hidden">
              <div className="bg-[#3b82f6] h-full" style={{ width: '24.8%' }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" className="w-5 h-5 rounded-full object-cover" />
          <div className="leading-tight">
            <p className="text-[8px] font-bold text-white leading-none">Иван П.</p>
            <span className="text-[7px] text-zinc-500 font-medium block">@ivan.p</span>
          </div>
        </div>
      </div>

    </div>
  )
}

// Full size Sidebar contents for Single Workspace mode
function SidebarContent({ activeTab, setActiveTab, competitors, selectedCompetitorId }) {
  const activeComp = competitors.find(c => c.id === selectedCompetitorId) || competitors[0]

  return (
    <div className="flex flex-col justify-between h-full p-6 text-sm text-zinc-400">
      
      <div className="space-y-8">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#12131d]">
          <div className="bg-[#3b82f6] p-1.5 rounded-lg">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <span className="font-extrabold text-white text-sm tracking-widest block uppercase">ИИ-РИЛС</span>
            <span className="text-[9px] text-[#3b82f6] uppercase font-bold tracking-wider">Платформа</span>
          </div>
        </div>

        {/* Panel Tabs */}
        <div className="space-y-3">
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest block">ПАНЕЛЬ</span>
          <div className="space-y-1">
            <button 
              onClick={() => setActiveTab('reels')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'reels' ? 'bg-[#12131a] text-white border-l-2 border-[#3b82f6]' : 'hover:bg-[#12131a]/40 text-zinc-400 hover:text-zinc-200'}`}
            >
              <Play className="w-4 h-4" />
              Рилсы
            </button>
            <button 
              onClick={() => setActiveTab('editor')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'editor' ? 'bg-[#12131a] text-white border-l-2 border-[#3b82f6]' : 'hover:bg-[#12131a]/40 text-zinc-400 hover:text-zinc-200'}`}
            >
              <FileText className="w-4 h-4" />
              Сценарии
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold opacity-40 cursor-not-allowed">
              <Calendar className="w-4 h-4" />
              Календарь
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold opacity-40 cursor-not-allowed">
              <BarChart3 className="w-4 h-4" />
              Аналитика
            </button>
          </div>
        </div>

        {/* Analysis Tabs */}
        <div className="space-y-3">
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest block">АНАЛИЗ</span>
          <div className="space-y-1">
            <button 
              onClick={() => setActiveTab('competitors')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'competitors' ? 'bg-[#12131a] text-white border-l-2 border-[#3b82f6]' : 'hover:bg-[#12131a]/40 text-zinc-400 hover:text-zinc-200'}`}
            >
              <Users className="w-4 h-4" />
              Конкуренты
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold opacity-40 cursor-not-allowed">
              <Compass className="w-4 h-4" />
              Темы
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold opacity-40 cursor-not-allowed">
              <TrendingUp className="w-4 h-4" />
              Тренды
            </button>
          </div>
        </div>

        {/* Library Tabs */}
        <div className="space-y-3">
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest block">БИБЛИОТЕКА</span>
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold opacity-40 cursor-not-allowed">
              <Folder className="w-4 h-4" />
              Мои рилсы
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold opacity-40 cursor-not-allowed">
              <LayoutGrid className="w-4 h-4" />
              Шаблоны
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold opacity-40 cursor-not-allowed">
              <ImageIcon className="w-4 h-4" />
              Медиа
            </button>
          </div>
        </div>

      </div>

      {/* Footer Details - Subscription & User profile */}
      <div className="space-y-4 pt-4 border-t border-[#12131d]">
        
        {/* Tariff Info */}
        <div className="bg-[#12131a] p-3.5 rounded-2xl border border-[#1b1c26] space-y-3">
          <div className="flex justify-between items-center text-xs font-extrabold text-white">
            <span>Тариф: PRO</span>
            <span className="text-[10px] text-[#3b82f6] uppercase font-bold tracking-wider">Обновить</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
              <span>Лимит рилсов</span>
              <span>2 480 / 10 000</span>
            </div>
            <div className="w-full bg-[#181923] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#3b82f6] h-full" style={{ width: '24.8%' }} />
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="flex items-center gap-3">
          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" className="w-9 h-9 rounded-full object-cover ring-2 ring-zinc-800" />
          <div className="leading-tight">
            <p className="text-xs font-bold text-white leading-none">Иван П.</p>
            <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">@ivan.p</span>
          </div>
        </div>

      </div>

    </div>
  )
}
