import type { ContentStatus, Reel } from '@/types/reel'

const STAGE_TITLES: Record<ContentStatus, string> = {
  new: '',
  idea: 'Доработка',
  script: 'Готово',
  ready: 'Готово',
  filmed: 'Снято',
  editing: 'В монтаже',
  published: 'Выложено',
  archived: 'Выложено',
  skipped: 'Пропущено',
}

function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

function reelTitle(reel: Reel): string {
  return reel.content.hook || reel.caption || `Рилс #${reel.id}`
}

export function buildContentPlanCsv(reels: Reel[]): string {
  const header = [
    'Этап',
    'Название',
    'Автор',
    'Хук',
    'Сценарий',
    'CTA',
    'Заметки',
    'Просмотры',
    'Ссылка',
  ]
  const rows = reels.map((reel) => [
    STAGE_TITLES[reel.content.contentStatus],
    reelTitle(reel),
    `@${reel.competitor.instagramUsername}`,
    reel.content.hook,
    reel.content.script,
    reel.content.cta,
    reel.content.notes,
    reel.viewsCount,
    reel.originalUrl,
  ])

  return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
}
