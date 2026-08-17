import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { RegistrationModal } from '@/components/auth/RegistrationModal'
import { renderWithProviders } from '@/test/utils'

afterEach(() => {
  localStorage.removeItem('realsfinder_signup_email')
})

describe('RegistrationModal', () => {
  it('accepts any non-empty email-like value and opens the dashboard', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/" element={<RegistrationModal open onClose={() => undefined} />} />
        <Route path="/dashboard" element={<div>Dashboard destination</div>} />
      </Routes>,
    )

    await user.type(screen.getByLabelText('Email'), 'anything@anywhere.test')
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))

    expect(await screen.findByText('Dashboard destination')).toBeInTheDocument()
    expect(localStorage.getItem('realsfinder_signup_email')).toBe('anything@anywhere.test')
  })

  it('only blocks an empty value', async () => {
    const user = userEvent.setup()

    renderWithProviders(<RegistrationModal open onClose={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))

    expect(screen.getByText('Введи почту, чтобы продолжить')).toBeInTheDocument()
  })
})
