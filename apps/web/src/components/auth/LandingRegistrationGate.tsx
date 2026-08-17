import { useState, type MouseEvent } from 'react'

import { RegistrationModal } from '@/components/auth/RegistrationModal'
import { LandingPage } from '@/pages/LandingPage'

export function LandingRegistrationGate() {
  const [registrationOpen, setRegistrationOpen] = useState(false)

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const dashboardLink = target.closest<HTMLAnchorElement>('a[href="/dashboard"]')
    if (!dashboardLink || dashboardLink.classList.contains('rf3-login')) return

    event.preventDefault()
    setRegistrationOpen(true)
  }

  return (
    <div style={{ display: 'contents' }} onClickCapture={handleClickCapture}>
      <LandingPage />
      <RegistrationModal open={registrationOpen} onClose={() => setRegistrationOpen(false)} />
    </div>
  )
}
