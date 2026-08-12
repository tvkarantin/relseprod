import { useQuery } from '@tanstack/react-query'
import { BookOpen, Clapperboard, FileText, Lightbulb, Plus, Send, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { queryKeys } from '@/api/queryKeys'
import { fetchDashboardSummary } from '@/api/reels'
import { formatNumber } from '@/utils/format'
import './dashboard-realsflow.css'

const RECENT = [
  { title: 'Три ошибки при съёмке рилс', date: 'Обновлён 25 мая', status: 'Черновик', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=85' },
  { title: 'Как снимать видео за 5 минут', date: 'Обновлён 24 мая', status: 'Готов к съёмке', image: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=700&q=85' },
  { title: 'Мой сетап для съёмки дома', date: 'Обновлён 22 мая', status: 'Черновик', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=700&q=85' },
  { title: 'Свет и тени: простой приём', date: 'Опубликовано 20 мая', status: 'Опубликовано', image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=700&q=85' },
]

function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const onMove = (event: ReactPointerEvent<HTMLElement>) => {
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`)
    el.style.setProperty('--tilt-y', `${(x * 7).toFixed(2)}deg`)
    el.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`)
  }
  const onLeave = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--tilt-x', '0deg')
    event.currentTarget.style.setProperty('--tilt-y', '0deg')
  }
  return <article className={`rf-tilt-card ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>{children}</article>
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
  return <span className="rf-typed-name">{visible}<i aria-hidden="true" /></span>
}

export function DashboardPage() {
  const summaryQuery = useQuery({ queryKey: queryKeys.dashboard.summary(), queryFn: ({ signal }) => fetchDashboardSummary(signal) })
  const summary = summaryQuery.data
  const stats = useMemo(() => [
    { label: 'Новые идеи', value: summary?.ideasCount ?? 16, note: '+8 за неделю', icon: Lightbulb },
    { label: 'Сценарии', value: summary?.scriptsCount ?? 24, note: 'В работе', icon: FileText },
    { label: 'Готово к съёмке', value: summary?.readyCount ?? 7, note: 'На этой неделе', icon: Clapperboard },
    { label: 'Опубликовано', value: Math.max(32, (summary?.reelsCount ?? 0) - (summary?.ideasCount ?? 0)), note: '+12 за неделю', icon: Send },
  ], [summary])

  return (
    <div className="rf-dashboard-page">
      <section className="rf-hero">
        <div className="rf-hero-copy">
          <div className="rf-day-chip"><span>☀</span><strong>Пн, 26 мая</strong><i />Хорошего дня!</div>
          <h1>Доброе утро,<br /><TypeName value="Андрей" /></h1>
          <p>RealsFlow помогает управлять идеями, сценариями<br className="rf-desktop-break" /> и контентом — от задумки до публикации.</p>
          <div className="rf-hero-actions">
            <Link to="/ideas" className="rf-primary-button"><Plus size={19} /> Создать сценарий</Link>
            <Link to="/library" className="rf-secondary-button"><BookOpen size={19} /> Открыть библиотеку</Link>
          </div>
        </div>

        <div className="rf-story-stack" aria-label="Анимированная схема от идеи к рилсу">
          <div className="rf-orbit-line" />
          <div className="rf-story-card rf-story-card-back"><span>контент</span></div>
          <div className="rf-story-card rf-story-card-mid"><span>сценарий</span></div>
          <div className="rf-story-card rf-story-card-front"><div className="rf-play">▶</div><em>Идея</em><b>→ сценарий</b><b>→ рилс</b></div>
          <div className="rf-spark">✦</div>
        </div>
      </section>

      <section className="rf-stat-grid" aria-label="Сводка">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <TiltCard key={label} className="rf-stat-card"><div className="rf-stat-top"><Icon size={21} /><span>{label}</span></div><strong>{summaryQuery.isLoading ? '—' : formatNumber(value)}</strong><small>{note}{note.startsWith('+') ? <TrendingUp size={14} /> : null}</small></TiltCard>
        ))}
      </section>

      <section className="rf-recents"><div className="rf-section-head"><h2>Недавние сценарии</h2><Link to="/my-reels">Смотреть все →</Link></div><div className="rf-recent-grid">
        {RECENT.map((item) => <TiltCard key={item.title} className="rf-recent-card"><div className="rf-recent-image"><img src={item.image} alt="" /><span className={`rf-status rf-status-${item.status === 'Опубликовано' ? 'green' : item.status === 'Готов к съёмке' ? 'yellow' : 'cream'}`}>{item.status}</span></div><div className="rf-recent-copy"><strong>{item.title}</strong><small>{item.date}</small></div></TiltCard>)}
      </div></section>
    </div>
  )
}
