import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { fetchCompetitors } from '@/api/competitors'
import { queryKeys } from '@/api/queryKeys'
import { useJobPolling } from '@/hooks/useJobPolling'
import { LandingPage } from '@/pages/LandingPage'

const AppLayout = lazy(() => import('@/components/layout/AppLayout').then((module) => ({ default: module.AppLayout })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const IdeaFeedPage = lazy(() => import('@/pages/IdeaFeedPage').then((module) => ({ default: module.IdeaFeedPage })))
const CompetitorsPage = lazy(() => import('@/pages/CompetitorsPage').then((module) => ({ default: module.CompetitorsPage })))
const ReelsPage = lazy(() => import('@/pages/ReelsPage').then((module) => ({ default: module.ReelsPage })))
const YouTubeMonitoringPage = lazy(() => import('@/pages/YouTubeMonitoringPage').then((module) => ({ default: module.YouTubeMonitoringPage })))
const ReelDetailsPage = lazy(() => import('@/pages/ReelDetailsPage').then((module) => ({ default: module.ReelDetailsPage })))
const MyReelsPage = lazy(() => import('@/pages/MyReelsPage').then((module) => ({ default: module.MyReelsPage })))
const ResourcesPage = lazy(() => import('@/pages/ResourcesPage').then((module) => ({ default: module.ResourcesPage })))
const SubscriptionPage = lazy(() => import('@/pages/SubscriptionPage').then((module) => ({ default: module.SubscriptionPage })))
const AiDashboardPage = lazy(() => import('@/features/ai-dashboard').then((module) => ({ default: module.AiDashboardPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))

const PUBLIC_URL = 'https://realsfinder-github.vercel.app/'
const LANDING_TITLE = 'RealsFinder — поиск идей и анализ Reels конкурентов'
const LANDING_DESCRIPTION =
  'RealsFinder помогает находить растущие Instagram Reels и YouTube Shorts у конкурентов, разбирать Hook, структуру и CTA и превращать сильные идеи в собственный контент.'

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

function setCanonical(href: string | null) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!href) {
    canonical?.remove()
    return
  }
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = href
}

function RouteSeo() {
  const location = useLocation()

  useEffect(() => {
    const isLanding = location.pathname === '/'

    if (isLanding) {
      document.title = LANDING_TITLE
      setMeta('meta[name="description"]', 'name', 'description', LANDING_DESCRIPTION)
      setMeta('meta[name="robots"]', 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
      setMeta('meta[property="og:title"]', 'property', 'og:title', LANDING_TITLE)
      setMeta('meta[property="og:description"]', 'property', 'og:description', LANDING_DESCRIPTION)
      setMeta('meta[property="og:url"]', 'property', 'og:url', PUBLIC_URL)
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', LANDING_TITLE)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', LANDING_DESCRIPTION)
      setCanonical(PUBLIC_URL)
      return
    }

    document.title = 'RealsFinder — рабочее пространство'
    setMeta('meta[name="description"]', 'name', 'description', 'Рабочее пространство RealsFinder.')
    setMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow, noarchive')
    setCanonical(null)
  }, [location.pathname])

  return null
}

function ActiveImportWatcher({ jobId }: { jobId: number }) {
  useJobPolling(jobId)
  return null
}

function ImportJobsWatcher() {
  const competitorsQuery = useQuery({
    queryKey: queryKeys.competitors.list(),
    queryFn: ({ signal }) => fetchCompetitors(signal),
  })

  return (
    <>
      {(competitorsQuery.data ?? []).map((competitor) =>
        typeof competitor.activeJobId === 'number' ? (
          <ActiveImportWatcher key={competitor.activeJobId} jobId={competitor.activeJobId} />
        ) : null,
      )}
    </>
  )
}

export function App() {
  return (
    <Suspense fallback={<div className="route-loading" role="status">Загружаем рабочее пространство…</div>}>
      <RouteSeo />
      <Routes>
        <Route index element={<LandingPage />} />
        <Route
          element={
            <>
              <ImportJobsWatcher />
              <AppLayout />
            </>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="ideas" element={<IdeaFeedPage />} />
          <Route path="competitors" element={<CompetitorsPage />} />
          <Route path="library" element={<ReelsPage />} />
          <Route path="reels" element={<Navigate to="/ideas" replace />} />
          <Route path="youtube-monitoring" element={<YouTubeMonitoringPage />} />
          <Route path="reels/:reelId" element={<ReelDetailsPage />} />
          <Route path="my-reels" element={<MyReelsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="ai-dashboard" element={<AiDashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
