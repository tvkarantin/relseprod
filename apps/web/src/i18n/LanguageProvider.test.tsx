import { act, render, screen, waitFor } from '@testing-library/react'

import { LanguageProvider } from './LanguageProvider'
import {
  DEFAULT_CREATOR_PROFILE,
  saveCreatorProfile,
} from '@/types/creatorProfile'

function Example() {
  return (
    <div>
      <span>Обзор</span>
      <input aria-label="Поиск" placeholder="Поиск по сценариям, идеям и ресурсам" />
    </div>
  )
}

describe('LanguageProvider', () => {
  beforeEach(() => window.localStorage.clear())

  it('translates the rendered interface to English from the saved profile', async () => {
    saveCreatorProfile({ ...DEFAULT_CREATOR_PROFILE, language: 'en' })
    render(<LanguageProvider><Example /></LanguageProvider>)

    await waitFor(() => expect(screen.getByText('Overview')).toBeInTheDocument())
    expect(screen.getByLabelText('Search')).toHaveAttribute('placeholder', 'Search scripts, ideas and resources')
  })

  it('switches back to Russian when the profile language changes', async () => {
    saveCreatorProfile({ ...DEFAULT_CREATOR_PROFILE, language: 'en' })
    render(<LanguageProvider><Example /></LanguageProvider>)
    await waitFor(() => expect(screen.getByText('Overview')).toBeInTheDocument())

    act(() => saveCreatorProfile({ ...DEFAULT_CREATOR_PROFILE, language: 'ru' }))
    await waitFor(() => expect(screen.getByText('Обзор')).toBeInTheDocument())
  })
})
