import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowRight,
  Bookmark,
  Check,
  Eye,
  Flame,
  Instagram,
  Play,
  Search,
  Sparkles,
  Target,
  Youtube,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const THUMBS = [
  'https://images.pexels.com/photos/7243715/pexels-photo-7243715.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/3764014/pexels-photo-3764014.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/3768126/pexels-photo-3768126.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/532220/pexels-photo-532220.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/4348401/pexels-photo-4348401.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/4498606/pexels-photo-4498606.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/4056535/pexels-photo-4056535.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/4057766/pexels-photo-4057766.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/4498574/pexels-photo-4498574.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
  'https://images.pexels.com/photos/4498151/pexels-photo-4498151.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=720&w=480',
]

const WORKFLOW_STEPS = [
  'Сохраняешь сильный Reel',
  'Отправляешь идею в план',
  'Идея уже в контент-плане',
  'Переводишь в работу',
  'Открываешь сценарий',
  'Hook, структура и CTA готовы',
]

function Logo() {
  return (
    <span className="rf3-logo-mark" aria-hidden="true">
      R
    </span>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  center = false,
}: {
  eyebrow: string
  title: string
  description?: string
  center?: boolean
}) {
  return (
    <div className={`rf3-section-heading ${center ? 'is-centered' : ''}`}>
      <p className="rf3-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description ? <p className="rf3-section-description">{description}</p> : null}
    </div>
  )
}

function HeroComposition() {
  const compositionRef = useRef<HTMLDivElement>(null)

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!compositionRef.current) return
    const rect = compositionRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    compositionRef.current.style.setProperty('--hero-x', `${(x * 36).toFixed(2)}px`)
    compositionRef.current.style.setProperty('--hero-y', `${(y * 28).toFixed(2)}px`)
    compositionRef.current.style.setProperty('--hero-x-rev', `${(-x * 24).toFixed(2)}px`)
    compositionRef.current.style.setProperty('--hero-y-rev', `${(-y * 20).toFixed(2)}px`)
    compositionRef.current.style.setProperty('--hero-rx', `${(-y * 5).toFixed(2)}deg`)
    compositionRef.current.style.setProperty('--hero-ry', `${(x * 6).toFixed(2)}deg`)
  }

  const handlePointerLeave = () => {
    compositionRef.current?.style.setProperty('--hero-x', '0px')
    compositionRef.current?.style.setProperty('--hero-y', '0px')
    compositionRef.current?.style.setProperty('--hero-x-rev', '0px')
    compositionRef.current?.style.setProperty('--hero-y-rev', '0px')
    compositionRef.current?.style.setProperty('--hero-rx', '0deg')
    compositionRef.current?.style.setProperty('--hero-ry', '0deg')
  }

  return (
    <div
      className="rf3-hero-composition"
      ref={compositionRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label="Пример анализа вирусного Reel"
    >
      <div className="rf3-hero-ring rf3-hero-ring-one" />
      <div className="rf3-hero-ring rf3-hero-ring-two" />

      <div className="rf3-side-thumb rf3-side-thumb-one">
        <img src={THUMBS[7]} alt="" />
      </div>
      <div className="rf3-side-thumb rf3-side-thumb-two">
        <img src={THUMBS[4]} alt="" />
      </div>

      <article className="rf3-main-reel">
        <img src={THUMBS[5]} alt="Тренировочный Reel" />
        <div className="rf3-reel-topline">
          <span>Reels</span>
          <span>0:34</span>
        </div>
        <div className="rf3-reel-copy">
          <div className="rf3-reel-stats">
            <Eye size={12} />
            <strong>2.4M</strong>
            <span>·</span>
            <strong>0:34</strong>
          </div>
          <p>Ты делаешь планку неправильно — и вот почему</p>
        </div>
        <button className="rf3-reel-bookmark" type="button" aria-label="Сохранить ролик">
          <Bookmark size={16} />
        </button>
      </article>

      <article className="rf3-float-card rf3-creator-card">
        <span className="rf3-avatar">АМ</span>
        <div>
          <strong>@alina.moves</strong>
          <small>486K подписчиков</small>
        </div>
        <Instagram size={14} />
      </article>

      <article className="rf3-float-card rf3-viral-card">
        <small>Выше среднего аккаунта</small>
        <strong>x8.4</strong>
        <div className="rf3-mini-bars" aria-hidden="true">
          {[28, 42, 34, 56, 48, 88, 62].map((height, index) => (
            <span key={index} style={{ height: `${height}%` }} className={index === 5 ? 'is-hot' : ''} />
          ))}
        </div>
      </article>
    </div>
  )
}

function WorkflowStage({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="rf3-work-stage-inner rf3-work-save-stage">
        <div className="rf3-work-reel">
          <img src={THUMBS[0]} alt="" />
          <span className="rf3-work-saved"><Bookmark size={15} fill="currentColor" /></span>
        </div>
        <div>
          <p className="rf3-work-kicker">Библиотека</p>
          <h3>Сильный ролик сохранён</h3>
          <p>Референс остаётся под рукой и готов перейти в работу.</p>
        </div>
      </div>
    )
  }

  if (step === 1 || step === 2 || step === 3) {
    const activeColumn = step === 3 ? 1 : 0
    return (
      <div className="rf3-mini-kanban">
        {['Идеи', 'В работе', 'Готово'].map((title, columnIndex) => (
          <div className={`rf3-mini-column ${columnIndex === activeColumn ? 'is-active' : ''}`} key={title}>
            <div className="rf3-mini-column-head">
              <strong>{title}</strong>
              <span>{columnIndex === activeColumn ? 1 : 0}</span>
            </div>
            {columnIndex === activeColumn ? (
              <article className={`rf3-mini-plan-card ${step === 2 ? 'is-arriving' : ''}`}>
                <img src={THUMBS[0]} alt="" />
                <div>
                  <strong>Кофе: 3 ошибки</strong>
                  <p>«Ты завариваешь кофе неправильно…»</p>
                  <small>{step === 3 ? 'В работе' : 'Instagram Reel'}</small>
                </div>
              </article>
            ) : (
              <div className="rf3-mini-empty">Пусто</div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="rf3-mini-editor">
      <aside>
        <img src={THUMBS[0]} alt="" />
        <strong>@coffee.lab</strong>
        <small>1.2M просмотров · x6.8</small>
      </aside>
      <div className="rf3-mini-editor-fields">
        <label>
          <span>Hook</span>
          <div>Ты завариваешь кофе неправильно всю жизнь</div>
        </label>
        <label className={step === 4 ? 'is-muted' : ''}>
          <span>Основная часть</span>
          <div>Покажи три ошибки, объясни температуру воды и сравни вкус.</div>
        </label>
        <label className={step === 4 ? 'is-muted' : ''}>
          <span>CTA</span>
          <div>Сохрани рецепт и отправь тому, кто заваривает кипятком.</div>
        </label>
        <div className="rf3-autosave">Сохранено автоматически</div>
      </div>
    </div>
  )
}

export function LandingPage() {
  const root = useRef<HTMLElement>(null)
  const [headerScrolled, setHeaderScrolled] = useState(false)

  useEffect(() => {
    const update = () => setHeaderScrolled(window.scrollY > 16)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduceMotion) {
        gsap.set('.rf3-reveal, .rf3-analysis-block, .rf3-work-stage', { clearProps: 'all' })
        return
      }

      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('.rf3-header-inner', { y: -18, opacity: 0, duration: 0.65 })
        .from('.rf3-hero-badge', { y: 10, opacity: 0, duration: 0.5 }, '-=.3')
        .from('.rf3-hero-line > span', { yPercent: 112, duration: 0.8, stagger: 0.085 }, '-=.2')
        .from('.rf3-hero-copy > p, .rf3-hero-actions, .rf3-hero-trust', { y: 18, opacity: 0, duration: 0.6, stagger: 0.08 }, '-=.35')
        .from('.rf3-main-reel', { y: 26, scale: 0.92, opacity: 0, duration: 0.9 }, '-=.82')
        .from('.rf3-side-thumb, .rf3-float-card', { y: 16, scale: 0.94, opacity: 0, duration: 0.62, stagger: 0.09 }, '-=.58')

      gsap.utils.toArray<HTMLElement>('.rf3-reveal-section').forEach((section) => {
        const items = section.querySelectorAll('.rf3-reveal')
        if (!items.length) return
        gsap.from(items, {
          y: 34,
          opacity: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 78%', once: true },
        })
      })

      const competitorTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: '.rf3-competitors',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
        },
      })
      competitorTimeline
        .fromTo('.rf3-competitor-panel', { y: 28, opacity: 0.15 }, { y: 0, opacity: 1, duration: 0.22 })
        .to('.rf3-competitor-row.is-primary', { scale: 1.035, borderColor: '#ef8a6a', duration: 0.2 })
        .fromTo('.rf3-comp-reel', { x: 24, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.06, duration: 0.28 })
        .fromTo('.rf3-comp-score', { scale: 0.78, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2 })

      const analysisBlocks = gsap.utils.toArray<HTMLElement>('.rf3-analysis-block')
      gsap.set(analysisBlocks, { opacity: 0.18, y: 20 })
      const analysisTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: '.rf3-analysis',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.9,
        },
      })
      analysisBlocks.forEach((block) => {
        analysisTimeline.to(block, { opacity: 1, y: 0, duration: 0.22 }).to(block, { opacity: 0.72, duration: 0.1 })
      })
      const lastAnalysisBlock = analysisBlocks[analysisBlocks.length - 1]
      if (lastAnalysisBlock) {
        analysisTimeline.to(lastAnalysisBlock, { opacity: 1, duration: 0.08 })
      }

      gsap.from('.rf3-library-card', {
        y: (index) => (index % 2 === 0 ? 38 : -26),
        opacity: 0,
        duration: 0.72,
        stagger: 0.055,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.rf3-library-grid', start: 'top 82%', once: true },
      })
      gsap.to('.rf3-library-grid', {
        y: -52,
        ease: 'none',
        scrollTrigger: { trigger: '.rf3-library', start: 'top bottom', end: 'bottom top', scrub: 1 },
      })

      const stages = gsap.utils.toArray<HTMLElement>('.rf3-work-stage')
      const bullets = gsap.utils.toArray<HTMLElement>('.rf3-work-step')
      gsap.set(stages, { autoAlpha: 0, y: 14, scale: 0.97 })
      const firstStage = stages[0]
      const firstBullet = bullets[0]
      if (firstStage) gsap.set(firstStage, { autoAlpha: 1, y: 0, scale: 1 })
      if (firstBullet) gsap.set(firstBullet, { opacity: 1 })
      const workflow = gsap.timeline({
        scrollTrigger: {
          trigger: '.rf3-workflow',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.85,
        },
      })
      stages.forEach((stage, index) => {
        if (index === 0) return
        const previous = stages[index - 1]
        const previousBullet = bullets[index - 1]
        const currentBullet = bullets[index]
        if (!previous || !previousBullet || !currentBullet) return
        workflow
          .to(previous, { autoAlpha: 0, y: -10, scale: 0.985, duration: 0.14 })
          .to(stage, { autoAlpha: 1, y: 0, scale: 1, duration: 0.19 }, '<0.05')
          .to(previousBullet, { opacity: 0.38, duration: 0.06 }, '<')
          .to(currentBullet, { opacity: 1, duration: 0.07 }, '<')
      })

      gsap.to('.rf3-how-progress', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: '.rf3-how', start: 'top 72%', end: 'bottom 52%', scrub: 1 },
      })

      gsap.from('.rf3-price-card', {
        y: 32,
        opacity: 0,
        duration: 0.75,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.rf3-pricing-grid', start: 'top 82%', once: true },
      })

      gsap.from('.rf3-final-thumb', {
        y: 58,
        opacity: 0,
        rotation: (index) => (index - 2.5) * 7,
        duration: 0.82,
        stagger: 0.06,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.rf3-final', start: 'top 78%', once: true },
      })
      gsap.from('.rf3-final-copy > *', {
        y: 24,
        opacity: 0,
        duration: 0.72,
        stagger: 0.09,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.rf3-final', start: 'top 70%', once: true },
      })
    },
    { scope: root },
  )

  return (
    <main className="rf3-page" id="top" ref={root}>
      <header className={`rf3-header ${headerScrolled ? 'is-scrolled' : ''}`}>
        <div className="rf3-header-inner">
          <a className="rf3-brand" href="#top" aria-label="RealsFlow, начало страницы">
            <Logo />
            <strong>RealsFlow</strong>
          </a>
          <nav aria-label="Навигация по лендингу">
            <a href="#features">Возможности</a>
            <a href="#how">Как работает</a>
            <a href="#pricing">Тарифы</a>
          </nav>
          <div className="rf3-header-actions">
            <Link to="/dashboard" className="rf3-login">Войти</Link>
            <Link to="/dashboard" className="rf3-header-cta">Попробовать бесплатно</Link>
          </div>
        </div>
      </header>

      <section className="rf3-hero">
        <div className="rf3-container rf3-hero-grid">
          <div className="rf3-hero-copy">
            <div className="rf3-hero-badge"><i /> Вирусные идеи без бесконечного скролла</div>
            <h1>
              {['Находи идеи для Reels,', 'которые уже залетают'].map((line) => (
                <span className="rf3-hero-line" key={line}><span>{line}</span></span>
              ))}
            </h1>
            <p>Следи за конкурентами, находи ролики с аномальным ростом и сразу понимай, что в них сработало — от Hook до CTA.</p>
            <div className="rf3-hero-actions">
              <Link to="/dashboard" className="rf3-primary-button">Попробовать бесплатно <ArrowRight size={17} /></Link>
              <a href="#features" className="rf3-secondary-button"><Play size={15} fill="currentColor" /> Посмотреть продукт</a>
            </div>
            <div className="rf3-hero-trust"><Check size={13} /> Без карты <span>·</span> Instagram Reels <span>·</span> YouTube Shorts</div>
          </div>
          <HeroComposition />
        </div>
      </section>

      <section className="rf3-competitors" id="features">
        <div className="rf3-competitors-sticky">
          <div className="rf3-container rf3-two-column">
            <div>
              <SectionHeading
                eyebrow="Конкуренты"
                title="Не угадывай, что снимать. Смотри, что уже растёт"
                description="Добавь нужные аккаунты один раз. RealsFlow соберёт свежие Reels и покажет ролики, которые заметно обгоняют обычные результаты автора."
              />
              <ul className="rf3-benefits">
                <li><Check size={14} /> Новые публикации автоматически попадают в библиотеку</li>
                <li><Check size={14} /> Видно, во сколько раз ролик сильнее среднего результата аккаунта</li>
                <li><Check size={14} /> Перспективные идеи находятся до того, как ты увидишь их у всех</li>
              </ul>
            </div>
            <div className="rf3-competitor-panel">
              <div className="rf3-competitor-list">
                {[
                  ['alina.moves', '486K', true],
                  ['morning.brew', '214K', false],
                  ['kate.wears', '342K', false],
                ].map(([name, followers, primary], index) => (
                  <div className={`rf3-competitor-row ${primary ? 'is-primary' : ''}`} key={String(name)}>
                    <span className={`rf3-competitor-avatar avatar-${index}`} />
                    <div><strong>@{name}</strong><small>{followers} подписчиков</small></div>
                    {primary ? <span className="rf3-viral-badge"><Flame size={11} /> viral</span> : null}
                  </div>
                ))}
              </div>
              <div className="rf3-comp-grid">
                {THUMBS.slice(0, 4).map((thumb, index) => (
                  <div className="rf3-comp-reel" key={thumb}>
                    <img src={thumb} alt="" />
                    {index === 0 ? <div className="rf3-comp-score"><strong>580K просмотров</strong><span>x7.8 выше среднего</span></div> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rf3-analysis">
        <div className="rf3-analysis-sticky">
          <div className="rf3-container">
            <SectionHeading
              eyebrow="Анализ"
              title="Понимай механику сильного Reel за минуту"
              description="Получай расшифровку и готовый разбор: Hook, развитие мысли, CTA и ключевые приёмы, которые удерживают внимание."
            />
            <div className="rf3-analysis-grid">
              <div className="rf3-analysis-phone">
                <img src={THUMBS[0]} alt="" />
                <div className="rf3-analysis-phone-meta"><Eye size={12} /> 1.2M <span>·</span> 0:27</div>
              </div>
              <div className="rf3-analysis-blocks">
                <article className="rf3-analysis-block is-accent">
                  <span><Flame size={15} /> Hook</span>
                  <p>«Ты завариваешь кофе неправильно всю жизнь» — сильный конфликт и понятная причина досмотреть.</p>
                </article>
                <article className="rf3-analysis-block">
                  <span><Sparkles size={15} /> Основная часть</span>
                  <p>Три коротких тезиса с демонстрацией в кадре. Смена плана каждые 2–3 секунды поддерживает темп.</p>
                </article>
                <article className="rf3-analysis-block">
                  <span><Target size={15} /> CTA</span>
                  <p>«Сохрани рецепт и пришли тому, кто заваривает кипятком» — CTA сразу работает на сохранения и пересылки.</p>
                </article>
                <article className="rf3-analysis-block is-transcript">
                  <span><Search size={15} /> Расшифровка</span>
                  <p>0:00 Ты завариваешь кофе неправильно всю жизнь<br />0:04 Кипяток сжигает зерно<br />0:11 Правило 92 градусов<br />0:19 Слепая дегустация</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rf3-library rf3-reveal-section">
        <div className="rf3-container">
          <div className="rf3-reveal"><SectionHeading eyebrow="Библиотека" title="Собирай рабочую базу идей, а не папку ссылок" description="Сохраняй сильные Reels вместе с метриками и разбором. В любой момент возвращайся к тому, что уже доказало результат." /></div>
          <div className="rf3-library-grid">
            {THUMBS.map((thumb, index) => (
              <article className={`rf3-library-card card-${index % 4}`} key={thumb}>
                <img src={thumb} alt="" />
                <button type="button" aria-label="Сохранить"><Bookmark size={15} /></button>
                <div>
                  <strong>{['Ты делаешь это неправильно — и вот почему', '30 дней теста: честный результат', 'Формат, который залетает каждую неделю', 'Одна база — пять образов'][index % 4]}</strong>
                  <span>{['2.4M', '842K', '1.1M', '697K'][index % 4]} просмотров</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rf3-workflow">
        <div className="rf3-workflow-sticky">
          <div className="rf3-container">
            <SectionHeading eyebrow="Рабочий процесс" title="От найденного Reel до готового сценария — в одном месте" center />
            <div className="rf3-workflow-layout">
              <div className="rf3-workflow-stage-wrap">
                {WORKFLOW_STEPS.map((_, index) => (
                  <div className="rf3-work-stage" key={index}><WorkflowStage step={index} /></div>
                ))}
              </div>
              <ol className="rf3-work-steps">
                {WORKFLOW_STEPS.map((label, index) => (
                  <li className="rf3-work-step" key={label}><span>{String(index + 1).padStart(2, '0')}</span>{label}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="rf3-how rf3-reveal-section" id="how">
        <div className="rf3-container">
          <div className="rf3-reveal"><SectionHeading eyebrow="Как работает" title="От конкурента до своего Reel — три шага" center /></div>
          <div className="rf3-how-grid">
            <div className="rf3-how-line"><span className="rf3-how-progress" /></div>
            {[
              ['01', 'Добавь нужные аккаунты', 'Подключи конкурентов из Instagram и YouTube, за которыми действительно хочешь следить.'],
              ['02', 'Отбери победителей', 'Смотри, какие ролики резко обгоняют обычные показатели автора, и сохраняй лучшие идеи.'],
              ['03', 'Собери свой сценарий', 'Возьми Hook, структуру и механику ролика за основу и адаптируй под свою тему и подачу.'],
            ].map(([number, title, description]) => (
              <article className="rf3-how-step rf3-reveal" key={number}>
                <span>{number}</span><h3>{title}</h3><p>{description}</p>
              </article>
            ))}
          </div>
          <div className="rf3-platform-label"><Instagram size={16} /> Instagram Reels <span>·</span><Logo /> RealsFlow <span>·</span><Youtube size={17} /> YouTube Shorts</div>
          <div className="rf3-marquee"><div>{[...THUMBS, ...THUMBS].map((thumb, index) => <img src={thumb} alt="" key={`${thumb}-${index}`} />)}</div></div>
        </div>
      </section>

      <section className="rf3-pricing rf3-reveal-section" id="pricing">
        <div className="rf3-container rf3-pricing-container">
          <div className="rf3-reveal"><SectionHeading eyebrow="Тарифы" title="Начни бесплатно. Переходи на Pro, когда станет тесно" center /></div>
          <div className="rf3-pricing-grid">
            <article className="rf3-price-card">
              <h3>Free</h3><p>Чтобы найти первые идеи и проверить подход</p><strong>0 ₽ <small>/ мес</small></strong>
              <ul><li><Check size={14} />3 конкурента</li><li><Check size={14} />20 роликов в месяц</li><li><Check size={14} />Базовый разбор Hook и CTA</li><li><Check size={14} />Библиотека до 50 роликов</li></ul>
              <Link to="/dashboard">Начать бесплатно</Link>
            </article>
            <article className="rf3-price-card is-pro">
              <span className="rf3-price-badge">Популярный</span>
              <h3>Pro</h3><p>Для системной работы с конкурентами и контентом</p><strong>2 900 ₽ <small>/ мес</small></strong>
              <ul><li><Check size={14} />25 конкурентов</li><li><Check size={14} />500 роликов в месяц</li><li><Check size={14} />Полный разбор и расшифровка</li><li><Check size={14} />Контент-план и редактор</li><li><Check size={14} />Подключение своих аккаунтов</li></ul>
              <Link to="/dashboard">Попробовать бесплатно</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="rf3-final">
        <div className="rf3-final-thumbs" aria-hidden="true">
          {THUMBS.slice(0, 6).map((thumb) => <img className="rf3-final-thumb" src={thumb} alt="" key={thumb} />)}
        </div>
        <div className="rf3-final-copy">
          <h2>Следующий сильный Reel уже существует. Тебе осталось его найти</h2>
          <p>Смотри, что растёт у конкурентов, разбирай механику и превращай найденную идею в собственный сценарий.</p>
          <Link to="/dashboard">Начать бесплатно <ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer className="rf3-footer">
        <div className="rf3-container rf3-footer-grid">
          <div><a href="#top" className="rf3-brand"><Logo /><strong>RealsFlow</strong></a><p>Сервис для поиска сильных Reels и Shorts: мониторинг конкурентов, анализ механик, библиотека идей и контент-план.</p></div>
          <div><strong>Product</strong><a href="#features">Возможности</a><a href="#pricing">Тарифы</a></div>
          <div><strong>Company</strong><a href="mailto:hello@realsfinder.app">Контакты</a></div>
          <div><strong>Legal</strong><a href="#top">Privacy</a><a href="#top">Terms</a></div>
        </div>
        <div className="rf3-footer-bottom"><div className="rf3-container"><span>© 2026 RealsFlow</span><span>Идеи, которые уже доказали результат</span></div></div>
      </footer>
    </main>
  )
}
