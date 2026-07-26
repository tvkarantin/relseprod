import { Route, Routes } from 'react-router-dom'

import { AiDashboardPage } from '@/features/ai-dashboard'
import { AppLayout } from '@/components/layout/AppLayout'
import { CompetitorsPage } from '@/pages/CompetitorsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { MyReelsPage } from '@/pages/MyReelsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ReelDetailsPage } from '@/pages/ReelDetailsPage'
import { ReelsPage } from '@/pages/ReelsPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="competitors" element={<CompetitorsPage />} />
        <Route path="reels" element={<ReelsPage />} />
        <Route path="reels/:reelId" element={<ReelDetailsPage />} />
        <Route path="my-reels" element={<MyReelsPage />} />
        <Route path="ai-dashboard" element={<AiDashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
