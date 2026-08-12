import type { AppLanguage } from '@/types/creatorProfile'

const EN_TEXT: Record<string, string> = {
  // Transcription
  'Получите точную расшифровку речи из видео': 'Get an accurate transcript from the video',
  'Задача поставлена в очередь': 'Job queued',
  'Deepgram распознаёт речь…': 'Deepgram is transcribing speech…',
  'Расшифровка готова': 'Transcript ready',
  'Речь в видео не обнаружена': 'No speech detected in the video',
  'Не удалось получить расшифровку': 'Could not create transcript',
  'Расшифровать видео': 'Transcribe video',
  'Распознавание…': 'Transcribing…',
  'Посмотреть': 'View',
  'Скопировано ✓': 'Copied ✓',
  'Скопировать': 'Copy',
  'Перенести в основную часть': 'Move to main part',
  'Для этого рилса нет доступной ссылки на видео. Повторите импорт конкурента.': 'No video URL is available for this reel. Re-import the competitor.',
  'Не удалось скопировать в буфер обмена': 'Could not copy to clipboard',
  'Полная расшифровка речи': 'Full transcript',
  'Основной язык:': 'Primary language:',
  'Уверенность:': 'Confidence:',
  'Длительность:': 'Duration:',
  'Реплики и таймкоды': 'Utterances and timestamps',
  'Заменить текст?': 'Replace text?',
  'Основная часть уже содержит текст. Заменить её расшифровкой?': 'The main part already contains text. Replace it with the transcript?',
  'Заменить': 'Replace',

  // Analysis apply/rebuild
  'Результат сделан на другом языке': 'The result uses a different language',
  'Пересобираем…': 'Rebuilding…',
  'Пересобрать на выбранном языке': 'Rebuild in selected language',
  'Текущий текст будет заменён': 'Current text will be replaced',
  'Перенести в сценарий': 'Apply to script',

  // Script editor
  'Есть изменения': 'Unsaved changes',
  'Сохранение…': 'Saving…',
  'Ошибка сохранения': 'Save error',
  'Не удалось сохранить': 'Could not save',
  'Текст не потерян — нажмите': 'Your text is safe — click',
  '«Сохранить», чтобы повторить.': '“Save” to retry.',
  'Первая фраза, которая удержит зрителя': 'The opening line that keeps viewers watching',
  'Текст сценария': 'Script text',
  'Что зритель должен сделать после просмотра': 'What should the viewer do after watching?',
  'Заметки и статус': 'Notes and status',
  'Заметки': 'Notes',
  'Идеи по монтажу, съёмке, референсы': 'Editing ideas, filming notes, references',

  // Reel filters and statuses
  'Поиск по заголовку, автору или темам...': 'Search by title, creator or topic...',
  'Фильтр по конкуренту': 'Filter by competitor',
  'Все конкуренты': 'All competitors',
  'По просмотрам': 'By views',
  'По лайкам': 'By likes',
  'По дате': 'By date',
  'Вид сеткой': 'Grid view',
  'Вид списком': 'List view',
  'Новый': 'New',
  'В работе': 'In progress',
  'Опубликовано': 'Published',
  'Архив': 'Archive',
  'Не импортирован': 'Not imported',
  'В очереди': 'Queued',
  'Импорт…': 'Importing…',
  'Готов': 'Ready',
  'Ошибка': 'Error',

  // Notifications
  'Отметить все': 'Mark all read',
  'Фильтр уведомлений': 'Notification filter',
  'Непрочитанные': 'Unread',
  'Непрочитано': 'Unread',
  'Непрочитанных уведомлений нет': 'No unread notifications',
  'Показать все уведомления': 'Show all notifications',

  // 404
  'Страница не найдена': 'Page not found',
  'Возможно, ссылка устарела или раздел ещё не реализован.': 'The link may be outdated or this section may not be available yet.',
  'На главную': 'Go home',

  // Common actions and import flow
  'Импорт запущен': 'Import started',
  'Проверить снова': 'Check again',
  'Готово к работе': 'Ready to use',
}

const EN_PATTERNS: Array<[RegExp, (...matches: string[]) => string]> = [
  [/^Добавлено (\d+)$/, (count) => `${count} added`],
  [/^Обновлено (\d+)$/, (count) => `${count} updated`],
]

export function translateSupplement(value: string, language: AppLanguage): string {
  if (language === 'ru' || !value) return value

  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!match) return value
  const [, before, core, after] = match

  const exact = EN_TEXT[core]
  if (exact !== undefined) return `${before}${exact}${after}`

  for (const [pattern, formatter] of EN_PATTERNS) {
    const result = core.match(pattern)
    if (result) return `${before}${formatter(...result.slice(1))}${after}`
  }

  return value
}
