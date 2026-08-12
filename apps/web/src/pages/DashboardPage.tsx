import { useQuery } from '@tanstack/react-query'
import { BookOpen, Clapperboard, FileText, Lightbulb, Plus, Send } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

import { queryKeys } from '@/api/queryKeys'
import { fetchAllMyReels, fetchDashboardSummary } from '@/api/reels'
import { formatNumber } from '@/utils/format'
import './dashboard-realsflow.css'

function setSpotlight(event: ReactPointerEvent<HTMLElement>) {
  const element = event.currentTarget
  const rect = element.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const y = ((event.clientY - rect.top) / rect.height) * 100
  element.style.setProperty('--glow-x', `${x.toFixed(1)}%`)
  element.style.setProperty('--glow-y', `${y.toFixed(1)}%`)
}

function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <article
      className={`rf-spotlight-card ${className}`}
      onPointerMove={setSpotlight}
    >
      {children}
    </article>
  )
}

function TypeName({ value }: { value: string }) {
  const [visible, setVisible] = useState('')

  useEffect(() => {
    let index = 0
    setVisible('')
    const timer = window.setInterval(() => {
      index += 1
      setVisible(value.slice(0, index))
      if (index >= value.length) window.clearInterval(timer)
    }, 120)
    return () => window.clearInterval(timer)
  }, [value])

  return (
    <span className="rf-typed-name">
      {visible}
      <i aria-hidden="true" />
    </span>
  )
}

function getGreeting(hour: number) {
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function formatToday(date: Date) {
  const label = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  })
  const contentPlanQuery = useQuery({
    queryKey: queryKeys.reels.contentPlan(),
    queryFn: ({ signal }) => fetchAllMyReels(signal),
  })

  const summary = summaryQuery.data
  const publishedCount = useMemo(
    () =>
      contentPlanQuery.data?.filter(
        (reel) => reel.content.contentStatus === 'published',
      ).length,
    [contentPlanQuery.data],
  )

  const stats = useMemo(
    () => [
      {
        label: 'Новые идеи',
        value: summary?.ideasCount,
        note: 'В ленте идей',
        icon: Lightbulb,
      },
      {
        label: 'Сценарии',
        value: summary?.scriptsCount,
        note: 'В работе',
        icon: FileText,
      },
      {
        label: 'Готово к съёмке',
        value: summary?.readyCount,
        note: 'Готовы к следующему шагу',
        icon: Clapperboard,
      },
      {
        label: 'Опубликовано',
        value: publishedCount,
        note: 'В контент-плане',
        icon: Send,
      },
    ],
    [publishedCount, summary],
  )

  const now = new Date()

  return (
    <div className="rf-dashboard-page">
      <section className="rf-hero">
        <div className="rf-hero-copy">
          <div className="rf-day-chip">
            <span>☀</span>
            <strong>{formatToday(now)}</strong>
            <i />
            Хорошего дня!
          </div>
          <h1>
            {getGreeting(now.getHours())},
            <br />
            <TypeName value="Андрей" />
          </h1>
          <p>
            RealsFlow помогает управлять идеями, сценариями
            <br className="rf-desktop-break" /> и контентом — от задумки до публикации.
          </p>
          <div className="rf-hero-actions">
            <Link to="/ideas" className="rf-primary-button">
              <Plus size={19} /> Создать сценарий
            </Link>
            <Link to="/library" className="rf-secondary-button">
              <BookOpen size={19} /> Открыть библиотеку
            </Link>
          </div>
        </div>

        <div
          className="rf-story-stack"
          aria-label="Анимированная схема от идеи к рилсу"
          onPointerMove={setSpotlight}
        >
          <div className="rf-orbit-line" />
          <div className="rf-story-card rf-story-card-back">
            <span>контент</span>
          </div>
          <div className="rf-story-card rf-story-card-mid">
            <span>сценарий</span>
          </div>
          <div className="rf-story-card rf-story-card-front">
            <div className="rf-play">▶</div>
            <em>Идея</em>
            <b>→ сценарий</b>
            <b>→ рилс</b>
          </div>
          <div className="rf-spark">✦</div>
        </div>
      </section>

      <section className="rf-stat-grid" aria-label="Сводка">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <SpotlightCard key={label} className="rf-stat-card">
            <div className="rf-stat-top">
              <Icon size={21} />
              <span>{label}</span>
            </div>
            <strong>{value === undefined ? '—' : formatNumber(value)}</strong>
            <small>{note}</small>
          </SpotlightCard>
        ))}
      </section>
    </div>
  )
}
