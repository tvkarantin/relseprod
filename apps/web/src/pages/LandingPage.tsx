import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Instagram,
  Lightbulb,
  MessageCircle,
  Play,
  Search,
  Star,
  UserRound,
  Youtube,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const reelRows = [
  { image: 'https://picsum.photos/seed/focus-desk/100/130', title: 'Утренний ритуал\nпродуктивного дня', author: '@fit_with_focus', trend: '+248%', views: '2.1M', likes: '126K', saves: '18K' },
  { image: 'https://picsum.photos/seed/healthy-food/100/130', title: 'Быстрый и полезный\nперекус за 5 минут', author: '@easy.recipes', trend: '+185%', views: '1.4M', likes: '89K', saves: '13K' },
  { image: 'https://picsum.photos/seed/europe-beach/100/130', title: 'Скрытые пляжи\nЕвропы', author: '@travel.more', trend: '+162%', views: '980K', likes: '72K', saves: '9K' },
  { image: 'https://picsum.photos/seed/weekly-plan/100/130', title: 'Как я планирую\nнеделю за 10 минут', author: '@plan.and.create', trend: '+134%', views: '760K', likes: '58K', saves: '7K' },
]

const faqItems = [
  ['Для кого подходит Reels Finder?', 'Для экспертов, брендов, маркетологов и команд, которые ищут рабочие идеи для Reels и Shorts без долгого ручного поиска.'],
  ['Что анализирует сервис?', 'Сервис разбирает хук, удержание, структуру, подачу, ключевые смыслы и призыв к действию.'],
  ['Можно ли следить за конкурентами?', 'Да. Добавляйте аккаунты конкурентов, ниши и темы, чтобы видеть новые и растущие ролики в одном потоке.'],
  ['Есть ли разбор хука и структуры?', 'Да. Каждый ролик можно транскрибировать и разложить на хук, развитие, кульминацию и CTA.'],
  ['Что я получаю на выходе?', 'Готовую идею, структурный разбор и сценарий, который можно адаптировать под свой стиль и отправить в производство.'],
]

function Brand() {
  return (
    <a className="rf2-brand" href="#top" aria-label="Reels Finder, начало страницы">
      <span className="rf2-brand-mark">R</span>
      <strong>Reels Finder</strong>
    </a>
  )
}

function TrendLine({ variant = 0 }: { variant?: number }) {
  const points = [
    '1,27 12,21 24,23 35,14 47,16 58,9 69,12 80,4',
    '1,25 12,18 24,21 35,13 47,15 58,7 69,10 80,3',
    '1,23 12,15 24,18 35,10 47,12 58,4 69,8 80,1',
    '1,24 12,20 24,21 35,16 47,17 58,10 69,12 80,6',
  ]
  return <svg className="rf2-trend" viewBox="0 0 82 30" aria-hidden="true"><polyline points={points[variant] ?? points[0]} /></svg>
}

function HeroDashboard() {
  return (
    <div className="rf2-browser js-parallax" data-speed="10">
      <div className="rf2-browser-bar"><i /><i /><i /></div>
      <div className="rf2-dashboard">
        <aside className="rf2-dash-side">
          <div className="rf2-dash-brand"><span className="rf2-mini-logo">R</span><strong>Reels Finder</strong></div>
          <nav>
            <span className="active"><Lightbulb size={15} /> Обзор</span>
            <span><Search size={15} /> Поиск Reels</span>
            <span><Bookmark size={15} /> Сохранённые</span>
            <span><Star size={15} /> Коллекции</span>
            <span><CircleHelp size={15} /> Подписки</span>
          </nav>
          <div className="rf2-dash-side-bottom"><span>Настройки</span><span>Помощь</span></div>
          <div className="rf2-dash-user"><span>ИП</span><div><strong>Иван Петров</strong><small>Команда</small></div></div>
        </aside>
        <div className="rf2-dash-main">
          <div className="rf2-dash-head"><div><h2>Популярные Reels</h2><p>Актуальные растущие ролики за 7 дней</p></div><div className="rf2-dash-filters"><span>7 дней <ChevronDown size={13} /></span><span>Все ниши <ChevronDown size={13} /></span></div></div>
          <div className="rf2-reel-table">
            <div className="rf2-reel-head"><span>Ролик</span><span>Тренд</span><span>Просмотры</span><span>Лайки</span><span>Сохранения</span></div>
            {reelRows.map((row, index) => (
              <div className="rf2-reel-row" key={row.author}>
                <div className="rf2-reel-title"><img src={row.image} alt="" /><span><strong>{row.title}</strong><small>{row.author}</small></span></div>
                <div className="rf2-reel-growth"><b>↗ Рост</b><small>{row.trend}</small><TrendLine variant={index} /></div>
                <span>{row.views}</span><span>{row.likes}</span><span>{row.saves}</span><button aria-label="Сохранить ролик"><Bookmark size={15} /></button>
              </div>
            ))}
            <button className="rf2-show-more">Показать ещё <ChevronDown size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackingMockup() {
  return (
    <div className="rf2-mini-panel rf2-tracking-mock js-parallax" data-speed="5">
      <h4>Отслеживание</h4>
      <div className="rf2-mini-tabs"><b>Мои подписки</b><span>Ниши</span><span>Конкуренты</span></div>
      {[['creator', '3.2M', '48%'], ['speaker', '1.8M', '27%'], ['expert', '982K', '16%']].map((item) => (
        <div className="rf2-track-row" key={item[0]}><img src={`https://picsum.photos/seed/${item[0]}/150/86`} alt="" /><strong>{item[1]}</strong><b>↗ {item[2]}</b><Bookmark size={14} /></div>
      ))}
    </div>
  )
}

function AnalysisMockup() {
  return (
    <div className="rf2-mini-panel rf2-analysis-mock js-parallax" data-speed="-5">
      <h4>Анализ ролика</h4>
      <div className="rf2-analysis-body">
        <div className="rf2-video-thumb"><img src="https://picsum.photos/seed/mountain-video/300/420" alt="" /><Play size={22} fill="currentColor" /></div>
        <div className="rf2-retention"><span>Удержание <strong>71%</strong></span><svg viewBox="0 0 300 100" aria-hidden="true"><polyline points="0,12 28,20 55,31 85,42 116,53 148,59 180,62 210,72 244,79 275,85 300,89" /></svg><div className="rf2-phases"><span>Хук<small>0–2 сек</small></span><span>Развитие<small>2–18 сек</small></span><span>Пик<small>18–26 сек</small></span><span>Концовка<small>26–28 сек</small></span></div></div>
      </div>
      <h5>Что сработало</h5><div className="rf2-chips"><span>Сильный хук</span><span>Понятная структура</span><span>Эмоция и контраст</span></div>
    </div>
  )
}

function IdeaMockup() {
  return (
    <div className="rf2-mini-panel rf2-idea-mock js-parallax" data-speed="5">
      <div className="rf2-idea-copy"><h4>Идея для ролика <b>Сохранено</b></h4><dl><dt>Инсайт</dt><dd>Неожиданная правда в начале</dd><dt>Хук</dt><dd>Фраза или вопрос, который цепляет</dd><dt>Структура</dt><dd>Проблема → Решение → Доказательство</dd><dt>Формат</dt><dd>Говорящая голова + примеры</dd><dt>CTA</dt><dd>Сохранить / Подписаться</dd></dl></div>
      <div className="rf2-phone"><img src="https://picsum.photos/seed/mountain-idea/260/430" alt="" /><Play size={26} fill="currentColor" /><small>0:32</small></div>
      <button>Открыть в сценарии</button><button className="primary">Создать ролик</button>
    </div>
  )
}

function ProductStoryCard({ icon, title, body, bullets, mockup, className = '' }: { icon: React.ReactNode; title: string; body: string; bullets: string[]; mockup: React.ReactNode; className?: string }) {
  return (
    <article className={`rf2-story-card js-story-card ${className}`}>
      <div className="rf2-story-copy"><span className="rf2-story-icon">{icon}</span><h3>{title}</h3><p>{body}</p><ul>{bullets.map((bullet) => <li key={bullet}><Check size={15} />{bullet}</li>)}</ul></div>
      <div className="rf2-story-visual">{mockup}</div>
    </article>
  )
}

export function LandingPage() {
  const root = useRef<HTMLElement>(null)
  const [openFaq, setOpenFaq] = useState(0)

  useGSAP(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.rf2-header', { y: -24, opacity: 0, duration: 0.8 })
      .from('.rf2-hero-copy > *', { y: 34, opacity: 0, stagger: 0.1, duration: 0.85 }, '-=.4')
      .from('.rf2-browser', { x: 90, scale: 0.94, opacity: 0, duration: 1.15 }, '-=.9')

    gsap.utils.toArray<HTMLElement>('.js-section').forEach((section) => {
      const targets = section.querySelectorAll('.js-reveal')
      if (!targets.length) return
      gsap.from(targets, { y: 54, opacity: 0, stagger: 0.09, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: section, start: 'top 78%', once: true } })
    })

    gsap.utils.toArray<HTMLElement>('.js-story-card').forEach((card, index) => {
      gsap.fromTo(card, { y: 80, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 86%', end: 'top 48%', scrub: 0.8 } })
      gsap.to(card.querySelector('.rf2-story-visual'), { yPercent: index % 2 ? -5 : 5, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 1.1 } })
    })

    gsap.utils.toArray<HTMLElement>('.js-parallax').forEach((element) => {
      const speed = Number(element.dataset.speed ?? 6)
      gsap.fromTo(element, { yPercent: speed }, { yPercent: -speed, ease: 'none', scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 1.15 } })
    })

    gsap.from('.rf2-work-card', { scale: 0.9, opacity: 0, y: 44, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.rf2-work-grid', start: 'top 78%', once: true } })
    gsap.from('.rf2-price-card', { y: 70, opacity: 0, stagger: 0.13, ease: 'power3.out', scrollTrigger: { trigger: '.rf2-pricing-grid', start: 'top 78%', once: true } })
    gsap.from('.rf2-faq-row', { x: 70, opacity: 0, stagger: 0.07, ease: 'power3.out', scrollTrigger: { trigger: '.rf2-faq-list', start: 'top 78%', once: true } })
    gsap.from('.rf2-footer > *', { y: 22, opacity: 0, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.rf2-footer', start: 'top 90%', once: true } })
  }, { scope: root })

  return (
    <main className="rf2-page" id="top" ref={root}>
      <header className="rf2-header">
        <Brand />
        <nav aria-label="Навигация по лендингу"><a href="#features">Возможности</a><a href="#workflow">Как это работает</a><a href="#pricing">Тарифы</a><a href="#faq">FAQ</a></nav>
        <Link className="rf2-login" to="/dashboard"><UserRound size={18} />Войти в кабинет</Link>
      </header>

      <section className="rf2-hero">
        <div className="rf2-hero-copy"><p>Поиск вирусных Reels</p><h1>Находи Reels,<br />которые уже <em>залетают.</em></h1><span>Находи растущие ролики и забирай<br />рабочие идеи.</span><div><Link className="rf2-primary" to="/dashboard">Попробовать бесплатно <ArrowRight size={20} /></Link><a className="rf2-secondary" href="#features"><Play size={16} />Смотреть демо</a></div></div>
        <HeroDashboard />
      </section>

      <section className="rf2-stories js-section" id="features">
        <div className="rf2-section-head"><div className="js-reveal"><p>Контент под доставку</p><h2>Пока конкуренты<br />тестируют —<br /><em>вы забираете готовые идеи.</em></h2></div><p className="js-reveal">Следите за сильными роликами,<br />разбирайте механику<br />и быстрее запускайте свои Reels.</p></div>
        <ProductStoryCard icon={<UserRound />} title="Следите за рынком, пока занимаетесь бизнесом" body="Сервис сам находит растущие ролики и показывает, что цепляет аудиторию." bullets={['Мониторинг ниш и конкурентов', 'Актуальные тренды в реальном времени', 'Персональная подборка каждый день']} mockup={<TrackingMockup />} />
        <ProductStoryCard icon={<Search />} title="Разбирайте не просмотры, а причины роста" body="Понимайте хук, структуру и подачу, чтобы брать не шум, а рабочую механику." bullets={['Анализ хука и удержания', 'Структура и сценарий', 'Причины роста и триггеры']} mockup={<AnalysisMockup />} />
        <ProductStoryCard icon={<ClipboardList />} title="Превращайте находки в следующий ролик" body="Собирайте идеи в библиотеку и быстро переходите от анализа к продакшену." bullets={['Сохраняйте идеи и сценарии', 'Шаблоны и заметки', 'Экспорт в сценарий и монтаж']} mockup={<IdeaMockup />} />
      </section>

      <section className="rf2-workflow js-section" id="workflow">
        <div className="rf2-work-head js-reveal"><p>Один рабочий контур</p><h2>От сигнала рынка<br />до готового сценария</h2><span>Находите сильные ролики, разбирайте механику<br />и сразу собирайте идеи в рабочий сценарий.</span></div>
        <div className="rf2-work-grid">
          <article className="rf2-work-card"><b>01</b><h3>Instagram + YouTube</h3><p>Следите за двумя площадками<br />в одном окне.</p><div className="rf2-platform-tabs"><span className="active"><Instagram size={24} />Instagram</span><span><Youtube size={24} />YouTube</span></div></article>
          <article className="rf2-work-card"><b>02</b><h3>Хук · Сюжет · CTA</h3><p>Разбор ролика по ключевым<br />элементам без воды.</p><div className="rf2-analysis-tabs"><span>↗ Хук</span><span>☷ Сюжет</span><span>➤ CTA</span></div></article>
          <article className="rf2-work-card"><b>03</b><h3>Идея → Сценарий → Готово</h3><p>Сразу видно, что брать<br />в работу дальше.</p><div className="rf2-steps"><span>1<small>Идея</small></span><i>→</i><span>2<small>Сценарий</small></span><i>→</i><span className="muted">3<small>Готово</small></span></div></article>
          <article className="rf2-work-card"><b>04</b><h3>Своя библиотека</h3><p>Сохраняйте находки и возвращайтесь<br />к ним в любой момент.</p><div className="rf2-saved-list"><strong>Мои сохранения <i>128</i></strong>{['Утренний ритуал', '3 ошибки в продажах', 'Обзор продукта'].map((title, i) => <span key={title}><img src={`https://picsum.photos/seed/saved-${i}/90/50`} alt="" />{title}<small>0:{28 + i * 2}</small><Bookmark size={12} /></span>)}</div></article>
        </div>
      </section>

      <section className="rf2-faq js-section" id="faq">
        <div className="rf2-faq-title js-reveal"><p><CircleHelp size={18} />Коротко о главном</p><h2>Частые<br />вопросы</h2><span>Всё, что нужно понять перед стартом.</span></div>
        <div className="rf2-faq-side"><div className="rf2-faq-list">{faqItems.map(([question, answer], index) => <article className={`rf2-faq-row ${openFaq === index ? 'open' : ''}`} key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{String(index + 1).padStart(2, '0')}</span><strong>{question}</strong><i>{openFaq === index ? '−' : '+'}</i></button><div className="rf2-faq-answer"><p>{answer}</p></div></article>)}</div><p className="rf2-support"><MessageCircle size={18} />Не нашли ответ? <a href="mailto:support@reelsfinder.ru">Напишите в поддержку.</a></p></div>
      </section>

      <section className="rf2-pricing js-section" id="pricing">
        <div className="rf2-pricing-title js-reveal"><p>Тарифы</p><h2>Выберите свой<br />тариф</h2><span>Подключайтесь на старте или берите<br />полный доступ для команды.</span></div>
        <div className="rf2-pricing-side"><div className="rf2-pricing-grid">
          <article className="rf2-price-card"><h3>Starter</h3><strong>0 ₽</strong><em>7 дней бесплатно</em><ul><li><Check />До 50 сохранений</li><li><Check />Отслеживание 1 ниши</li><li><Check />Базовый анализ роликов</li></ul><Link to="/dashboard">Попробовать</Link></article>
          <article className="rf2-price-card popular"><span className="rf2-popular"><Star size={13} />Популярный</span><h3>Pro</h3><strong>2 990 ₽ <small>/ мес</small></strong><ul><li><Check />Безлимитные сохранения</li><li><Check />Отслеживание конкурентов</li><li><Check />Разбор: хук · структура · CTA</li><li><Check />Библиотека идей и сценариев</li></ul><Link to="/dashboard">Выбрать Pro</Link></article>
          <article className="rf2-price-card"><h3>Team</h3><strong>7 990 ₽ <small>/ мес</small></strong><ul><li><Check />Все функции Pro</li><li><Check />Командный доступ</li><li><Check />Общие коллекции</li><li><Check />Приоритетная поддержка</li></ul><Link to="/dashboard">Выбрать Team</Link></article>
        </div><p className="rf2-custom"><MessageCircle size={18} />Нужен кастомный тариф? <a href="mailto:support@reelsfinder.ru">Напишите в поддержку.</a></p></div>
      </section>

      <footer className="rf2-footer"><div><Brand /><p>Система поиска и разбора<br />коротких видео.</p></div><div><strong>Продукт</strong><a href="#features">Возможности</a><a href="#workflow">Как это работает</a><a href="#pricing">Тарифы</a></div><div><strong>Компания</strong><a href="#faq">FAQ</a><a href="mailto:support@reelsfinder.ru">Поддержка</a><a href="mailto:hello@reelsfinder.ru">Контакты</a></div><div><strong>Документы</strong><a href="#top">Политика</a><a href="#top">Оферта</a></div><Link className="rf2-login" to="/dashboard"><UserRound size={18} />Войти в кабинет</Link><span className="rf2-copyright">© 2026 Reels Finder</span><span className="rf2-social">Telegram <i /> Email</span></footer>
    </main>
  )
}
