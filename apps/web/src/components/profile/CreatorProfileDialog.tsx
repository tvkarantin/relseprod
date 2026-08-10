import { useEffect, useState, type FormEvent } from 'react'

import {
  loadCreatorProfile,
  saveCreatorProfile,
  type CreatorProfile,
} from '@/types/creatorProfile'

interface CreatorProfileDialogProps {
  onClose: () => void
  onSaved?: (profile: CreatorProfile) => void
}

export function CreatorProfileDialog({ onClose, onSaved }: CreatorProfileDialogProps) {
  const [profile, setProfile] = useState(loadCreatorProfile)
  const [ctaText, setCtaText] = useState(() => loadCreatorProfile().favoriteCtas.join('\n'))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const update = <Key extends keyof CreatorProfile>(key: Key, value: CreatorProfile[Key]) => {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const saved = {
      ...profile,
      favoriteCtas: ctaText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10),
    }
    saveCreatorProfile(saved)
    onSaved?.(saved)
    onClose()
  }

  return (
    <div className="dialog-backdrop profile-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="creator-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="creator-profile-title"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="creator-profile-header">
          <div>
            <span className="eyebrow">Один раз — для всех сценариев</span>
            <h2 id="creator-profile-title">Ваш авторский профиль</h2>
            <p>AI будет сохранять идею ролика, но переписывать формулировки под вас.</p>
          </div>
          <button type="button" className="profile-close" onClick={onClose} aria-label="Закрыть">×</button>
        </header>

        <div className="creator-profile-grid">
          <label>
            <span>Ниша *</span>
            <input required value={profile.niche} onChange={(e) => update('niche', e.target.value)} placeholder="Например, продуктовый маркетинг" />
          </label>
          <label>
            <span>Целевая аудитория *</span>
            <input required value={profile.targetAudience} onChange={(e) => update('targetAudience', e.target.value)} placeholder="Основатели и маркетологи B2B" />
          </label>
          <label className="profile-field-wide">
            <span>Продукт или услуга</span>
            <input value={profile.product} onChange={(e) => update('product', e.target.value)} placeholder="Что вы продаёте или продвигаете" />
          </label>
          <label className="profile-field-wide">
            <span>Tone of voice</span>
            <textarea rows={2} value={profile.toneOfVoice} onChange={(e) => update('toneOfVoice', e.target.value)} />
          </label>
          <label>
            <span>Обращение</span>
            <select value={profile.addressForm} onChange={(e) => update('addressForm', e.target.value as 'ты' | 'вы')}>
              <option value="ты">На «ты»</option>
              <option value="вы">На «вы»</option>
            </select>
          </label>
          <label>
            <span>Длина ролика</span>
            <select value={profile.videoLengthSeconds} onChange={(e) => update('videoLengthSeconds', Number(e.target.value))}>
              <option value={20}>до 20 секунд</option>
              <option value={30}>около 30 секунд</option>
              <option value={45}>около 45 секунд</option>
              <option value={60}>около минуты</option>
              <option value={90}>до 90 секунд</option>
            </select>
          </label>
          <label>
            <span>Мат</span>
            <select value={profile.profanity} onChange={(e) => update('profanity', e.target.value)}>
              <option>Без мата</option>
              <option>Редко и только к месту</option>
              <option>Допустим разговорный мат</option>
            </select>
          </label>
          <label>
            <span>Позиция автора</span>
            <input value={profile.expertise} onChange={(e) => update('expertise', e.target.value)} />
          </label>
          <label className="profile-field-wide">
            <span>Любимые CTA · по одному на строку</span>
            <textarea rows={3} value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Сохрани, чтобы вернуться позже" />
          </label>
        </div>

        <footer className="creator-profile-actions">
          <button type="button" className="button" onClick={onClose}>Отмена</button>
          <button type="submit" className="button button-lime">Сохранить мой стиль</button>
        </footer>
      </form>
    </div>
  )
}
