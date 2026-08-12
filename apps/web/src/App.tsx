import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { LandingPage } from '@/pages/LandingPage'

const AppLayout = lazy(() => import('@/components/layout/AppLayout').then((module) => ({ default: module.AppLayout })))
const AuthPage = lazy(() => import('@/pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })))
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

export function App() {
  return (
    <Suspense fallback={<div className="route-loading" role="status">Загружаем рабочее пространство…</div>}>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
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
        </Route>
      </Routes>
    </Suspense>
  )
}
