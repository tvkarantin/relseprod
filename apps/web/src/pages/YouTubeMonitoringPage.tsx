import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  monitoringApi,
  type CreateTopicPayload,
  type MonitoredVideo,
  type MonitoringTopic,
  type TopicContentFilter,
  type TopicSort,
} from '@/api/monitoring'
import { formatNumber } from '@/utils/format'

const monitoringKeys = {
  topics: ['monitoring', 'topics'] as const,
  channels: ['monitoring', 'channels'] as const,
  videos: (topicId?: number) => ['monitoring', 'videos', topicId ?? 'all'] as const,
}

const CONTENT_FILTER_LABELS: Record<TopicContentFilter, string> = {
  all: 'Все форматы',
  shorts: 'Только Shorts',
  videos: 'Горизонтальные видео',
  animation: 'Анимация',
}

const SORT_LABELS: Record<TopicSort, string> = {
  score: 'По рейтингу',
  views: 'Сначала популярные',
  recent: 'Сначала новые',
  velocity: 'Быстрорастущие',
}

function splitWords(value: string): string[] {
  return [...new Set(value.split(',').map((word) => word.trim()).filter(Boolean))]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'ещё не запускался'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function YouTubeMonitoringPage() {
  const queryClient = useQueryClient()
  const finishedRunsRef = useRef(new Map<number, string>())
  const [topicName, setTopicName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [negativeKeywords, setNegativeKeywords] = useState('')
  const [contentFilter, setContentFilter] = useState<TopicContentFilter>('all')
  const [minViewCount, setMinViewCount] = useState(0)
  const [publishedWithinDays, setPublishedWithinDays] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<TopicSort>('score')
  const [channelUrl, setChannelUrl] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>()
  const [notice, setNotice] = useState('')

  const topicsQuery = useQuery({
    queryKey: monitoringKeys.topics,
    queryFn: ({ signal }) => monitoringApi.topics(signal),
    refetchInterval: (query) =>
      query.state.data?.some((topic) => ['queued', 'running'].includes(topic.runStatus))
        ? 1000
        : false,
    refetchIntervalInBackground: true,
  })
  const channelsQuery = useQuery({
    queryKey: monitoringKeys.channels,
    queryFn: ({ signal }) => monitoringApi.channels(signal),
  })
  const videosQuery = useQuery({
    queryKey: monitoringKeys.videos(selectedTopicId),
    queryFn: ({ signal }) => monitoringApi.videos(selectedTopicId, signal),
  })

  useEffect(() => {
    if (
      selectedTopicId !== undefined &&
      topicsQuery.data &&
      !topicsQuery.data.some((topic) => topic.id === selectedTopicId)
    ) {
      setSelectedTopicId(undefined)
    }
  }, [selectedTopicId, topicsQuery.data])

  useEffect(() => {
    for (const topic of topicsQuery.data ?? []) {
      if (!topic.runFinishedAt || !['completed', 'failed'].includes(topic.runStatus)) continue
      if (finishedRunsRef.current.get(topic.id) === topic.runFinishedAt) continue
      finishedRunsRef.current.set(topic.id, topic.runFinishedAt)
      if (topic.runStatus === 'completed') {
        void queryClient.invalidateQueries({ queryKey: ['monitoring', 'videos'] })
      }
    }
  }, [queryClient, topicsQuery.data])

  const createTopic = useMutation({
    mutationFn: (payload: CreateTopicPayload) => monitoringApi.createTopic(payload),
    onSuccess: async (topic) => {
      setTopicName('')
      setKeywords('')
      setNegativeKeywords('')
      setContentFilter('all')
      setMinViewCount(0)
      setPublishedWithinDays(null)
      setSortBy('score')
      setSelectedTopicId(topic.id)
      setNotice(`Тема «${topic.name}» создана`)
      await queryClient.invalidateQueries({ queryKey: monitoringKeys.topics })
    },
  })

  const addChannel = useMutation({
    mutationFn: monitoringApi.addChannel,
    onSuccess: async (channel) => {
      setChannelUrl('')
      setNotice(`Канал «${channel.channelTitle}» добавлен`)
      await queryClient.invalidateQueries({ queryKey: monitoringKeys.channels })
      await queryClient.invalidateQueries({ queryKey: monitoringKeys.topics })
    },
  })

  const deleteChannel = useMutation({
    mutationFn: monitoringApi.deleteChannel,
    onSuccess: async () => {
      setNotice('Канал удалён из мониторинга')
      await queryClient.invalidateQueries({ queryKey: monitoringKeys.channels })
      await queryClient.invalidateQueries({ queryKey: monitoringKeys.topics })
    },
  })

  const runTopic = useMutation({
    mutationFn: monitoringApi.runTopic,
    onSuccess: async () => {
      setNotice('Проверка запущена. Ход выполнения отображается на карточке темы.')
      await queryClient.invalidateQueries({ queryKey: monitoringKeys.topics })
    },
  })

  const addToLibrary = useMutation({
    mutationFn: (videoId: number) => monitoringApi.addToLibrary(videoId),
    onSuccess: async (_, videoId) => {
      queryClient.setQueriesData(
        { queryKey: ['monitoring', 'videos'] },
        (videos: MonitoredVideo[] | undefined) =>
          videos?.filter((video) => video.id !== videoId),
      )
      setNotice('Видео перенесено в основную библиотеку')
      await queryClient.invalidateQueries({ queryKey: ['monitoring', 'library'] })
      await queryClient.invalidateQueries({ queryKey: ['monitoring', 'videos'] })
    },
  })

  const deleteVideo = useMutation({
    mutationFn: monitoringApi.deleteVideo,
    onSuccess: async () => {
      setNotice('Видео удалено')
      await queryClient.invalidateQueries({ queryKey: ['monitoring', 'videos'] })
    },
  })

  const activeError = [
    topicsQuery.error,
    channelsQuery.error,
    videosQuery.error,
    createTopic.error,
    addChannel.error,
    deleteChannel.error,
    runTopic.error,
    addToLibrary.error,
    deleteVideo.error,
  ].find(Boolean)

  const selectedTopic = useMemo(
    () => topicsQuery.data?.find((topic) => topic.id === selectedTopicId),
    [selectedTopicId, topicsQuery.data],
  )
  const displayedVideos = videosQuery.data ?? []

  function requestVideoDelete(id: number) {
    deleteVideo.mutate(id)
  }

  function submitTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanKeywords = splitWords(keywords)
    if (topicName.trim().length < 2 || cleanKeywords.length === 0) return
    createTopic.mutate({
      name: topicName.trim(),
      keywords: cleanKeywords,
      negativeKeywords: splitWords(negativeKeywords),
      language: 'ru',
      regionCode: 'RU',
      minimumScore: 70,
      isActive: true,
      checkIntervalHours: 3,
      contentFilter,
      minViewCount,
      publishedWithinDays,
      sortBy,
    })
  }

  function submitChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (channelUrl.trim()) addChannel.mutate(channelUrl.trim())
  }

  return (
    <div className="page-content monitoring-page">
      <header className="page-header monitoring-header">
        <div>
          <span className="monitoring-eyebrow">YouTube Intelligence</span>
          <h1>YouTube мониторинг</h1>
          <p>Следите за темами и каналами, находите растущие видео раньше конкурентов.</p>
        </div>
        <div className="monitoring-header-stat">
          <span>Найдено видео</span>
          <strong>{formatNumber(videosQuery.data?.length ?? 0)}</strong>
        </div>
      </header>

      {notice ? (
        <div className="monitoring-notice" role="status">
          <span aria-hidden="true">✓</span>
          {notice}
          <button type="button" onClick={() => setNotice('')} aria-label="Закрыть">
            ×
          </button>
        </div>
      ) : null}
      {activeError ? (
        <div className="monitoring-error" role="alert">
          {errorMessage(activeError)}
        </div>
      ) : null}

      <section className="monitoring-setup-grid" aria-label="Настройка мониторинга">
        <form className="monitoring-panel" onSubmit={submitTopic}>
          <div className="monitoring-panel-heading">
            <span className="monitoring-step">01</span>
            <div>
              <h2>Создать тему</h2>
              <p>Соберите ключевые слова в один поисковый радар.</p>
            </div>
          </div>
          <label className="field">
            <span className="field-label">Название темы</span>
            <input
              className="input"
              value={topicName}
              onChange={(event) => setTopicName(event.target.value)}
              placeholder="Например, AI для контента"
              minLength={2}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Ключевые слова через запятую</span>
            <input
              className="input"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              placeholder="нейросети, монтаж, reels"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Исключить</span>
            <input
              className="input"
              value={negativeKeywords}
              onChange={(event) => setNegativeKeywords(event.target.value)}
              placeholder="стрим, музыка"
            />
          </label>
          <div className="monitoring-filter-grid">
            <label className="field">
              <span className="field-label">Формат видео</span>
              <select
                className="input"
                value={contentFilter}
                onChange={(event) =>
                  setContentFilter(event.target.value as TopicContentFilter)
                }
              >
                <option value="all">Все форматы</option>
                <option value="shorts">Только Shorts / вертикальные</option>
                <option value="videos">Горизонтальные видео</option>
                <option value="animation">Анимация</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Период публикации</span>
              <select
                className="input"
                value={publishedWithinDays ?? ''}
                onChange={(event) =>
                  setPublishedWithinDays(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">Без ограничения</option>
                <option value="1">Последние 24 часа</option>
                <option value="7">Последние 7 дней</option>
                <option value="30">Последние 30 дней</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Минимум просмотров</span>
              <select
                className="input"
                value={minViewCount}
                onChange={(event) => setMinViewCount(Number(event.target.value))}
              >
                <option value="0">Любое количество</option>
                <option value="1000">От 1 000</option>
                <option value="10000">От 10 000</option>
                <option value="50000">От 50 000</option>
                <option value="100000">От 100 000</option>
                <option value="1000000">От 1 000 000</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Сортировка</span>
              <select
                className="input"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as TopicSort)}
              >
                <option value="score">По рейтингу</option>
                <option value="views">Сначала популярные</option>
                <option value="recent">Сначала новые</option>
                <option value="velocity">Быстрорастущие</option>
              </select>
            </label>
          </div>
          <button
            className="button button-lime"
            type="submit"
            disabled={createTopic.isPending}
          >
            {createTopic.isPending ? 'Создаём…' : 'Добавить тему'}
          </button>
          <p className="monitoring-included-channels">
            <span aria-hidden="true">▶</span>
            В проверку войдут все активные каналы: {' '}
            <strong>
              {(channelsQuery.data ?? []).filter((channel) => channel.isActive).length}
            </strong>
          </p>
        </form>

        <form className="monitoring-panel" onSubmit={submitChannel}>
          <div className="monitoring-panel-heading">
            <span className="monitoring-step">02</span>
            <div>
              <h2>Добавить канал</h2>
              <p>Поддерживаются ссылка на канал, @handle или ссылка на видео.</p>
            </div>
          </div>
          <label className="field">
            <span className="field-label">YouTube URL</span>
            <input
              className="input"
              value={channelUrl}
              onChange={(event) => setChannelUrl(event.target.value)}
              placeholder="https://youtube.com/@channel"
              required
            />
          </label>
          <button
            className="button button-lime"
            type="submit"
            disabled={addChannel.isPending}
          >
            {addChannel.isPending ? 'Проверяем…' : 'Добавить канал'}
          </button>

          <div className="monitoring-channel-list">
            {channelsQuery.isLoading ? <span className="monitoring-muted">Загрузка…</span> : null}
            {channelsQuery.data?.map((channel) => (
              <article className="monitoring-channel" key={channel.id}>
                {channel.thumbnailUrl ? (
                  <img src={channel.thumbnailUrl} alt="" />
                ) : (
                  <span className="monitoring-channel-fallback">▶</span>
                )}
                <div>
                  <strong>{channel.channelTitle}</strong>
                  <small>
                    {formatNumber(channel.subscriberCount ?? 0)} подписчиков
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => deleteChannel.mutate(channel.id)}
                  disabled={deleteChannel.isPending}
                  aria-label={`Удалить ${channel.channelTitle}`}
                >
                  ×
                </button>
              </article>
            ))}
          </div>
        </form>
      </section>

      <section className="monitoring-topics" aria-labelledby="monitoring-topics-title">
        <div className="monitoring-section-heading">
          <div>
            <span className="monitoring-eyebrow">Поисковые радары</span>
            <h2 id="monitoring-topics-title">Темы мониторинга</h2>
          </div>
          <button
            type="button"
            className={`monitoring-topic-filter ${selectedTopicId === undefined ? 'active' : ''}`}
            onClick={() => setSelectedTopicId(undefined)}
          >
            Все результаты
          </button>
        </div>

        <div className="monitoring-topic-grid">
          {topicsQuery.isLoading ? <div className="monitoring-skeleton">Загрузка тем…</div> : null}
          {topicsQuery.data?.map((topic: MonitoringTopic) => (
            <article
              className={[
                'monitoring-topic-card',
                selectedTopicId === topic.id ? 'active' : '',
                ['queued', 'running'].includes(topic.runStatus) ? 'is-running' : '',
                topic.runStatus === 'failed' ? 'is-failed' : '',
                topic.runStatus === 'completed' ? 'is-completed' : '',
              ].filter(Boolean).join(' ')}
              key={topic.id}
            >
              <button
                className="monitoring-topic-select"
                type="button"
                onClick={() => setSelectedTopicId(topic.id)}
              >
                <span className="monitoring-topic-score">порог {topic.minimumScore}</span>
                <strong>{topic.name}</strong>
                <small>{topic.keywords.join(' · ')}</small>
                <span className="monitoring-topic-channels">
                  Каналов в проверке: {topic.includedChannelsCount}
                </span>
                <span className="monitoring-topic-filters">
                  <i>{CONTENT_FILTER_LABELS[topic.contentFilter]}</i>
                  <i>
                    {topic.minViewCount > 0
                      ? `от ${formatNumber(topic.minViewCount)} просмотров`
                      : 'любые просмотры'}
                  </i>
                  <i>
                    {topic.publishedWithinDays
                      ? `за ${topic.publishedWithinDays} дн.`
                      : 'любой период'}
                  </i>
                  <i>{SORT_LABELS[topic.sortBy]}</i>
                </span>
                <span>Последняя проверка: {formatDate(topic.lastCheckedAt)}</span>
              </button>
              {topic.runStatus !== 'idle' ? (
                <div className="monitoring-run-progress">
                  <div className="monitoring-run-progress-head">
                    <span>
                      {topic.runStatus === 'failed'
                        ? 'Ошибка'
                        : topic.runStatus === 'completed'
                          ? 'Завершено'
                          : topic.runMessage ?? 'Выполняется'}
                    </span>
                    <strong>{topic.runProgress}%</strong>
                  </div>
                  <div
                    className="monitoring-progress-track"
                    role="progressbar"
                    aria-label={`Прогресс проверки темы ${topic.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={topic.runProgress}
                  >
                    <span style={{ width: `${topic.runProgress}%` }} />
                  </div>
                  {topic.runStatus === 'failed' ? (
                    <small className="monitoring-run-error">
                      {topic.runError ?? topic.runMessage ?? 'Проверка завершилась с ошибкой'}
                    </small>
                  ) : (
                    <small>{topic.runMessage}</small>
                  )}
                </div>
              ) : null}
              <button
                className="button button-primary button-small"
                type="button"
                disabled={
                  runTopic.isPending || ['queued', 'running'].includes(topic.runStatus)
                }
                onClick={() => runTopic.mutate(topic.id)}
              >
                {['queued', 'running'].includes(topic.runStatus)
                  ? 'Проверка идёт…'
                  : runTopic.isPending && runTopic.variables === topic.id
                    ? 'Запуск…'
                    : topic.runStatus === 'failed'
                      ? 'Повторить проверку'
                      : 'Проверить сейчас'}
              </button>
            </article>
          ))}
          {!topicsQuery.isLoading && topicsQuery.data?.length === 0 ? (
            <div className="monitoring-empty compact">
              <span>◎</span>
              <p>Создайте первую тему, чтобы начать поиск видео.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="monitoring-results" aria-labelledby="monitoring-results-title">
        <div className="monitoring-section-heading">
          <div>
            <span className="monitoring-eyebrow">Сигналы роста</span>
            <h2 id="monitoring-results-title">
              {selectedTopic ? selectedTopic.name : 'Все найденные видео'}
            </h2>
          </div>
          <div className="monitoring-result-controls">
            <Link className="button button-small" to="/reels">
              Открыть библиотеку →
            </Link>
            <span className="monitoring-result-count">
              {videosQuery.isFetching ? 'Обновляем…' : `${displayedVideos.length} результатов`}
            </span>
          </div>
        </div>

        {displayedVideos.length ? (
          <div className="monitoring-video-grid">
            {displayedVideos.map((video) => (
              <article className="monitoring-video-card" key={video.id}>
                <a
                  className="monitoring-video-cover"
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : null}
                  <span>▶</span>
                  <b>{Math.round(video.finalScore ?? 0)}</b>
                </a>
                <div className="monitoring-video-body">
                  <div className="monitoring-video-meta">
                    <span>{video.contentType === 'short' ? 'Shorts' : 'Видео'}</span>
                    <span>{formatNumber(video.viewCount)} просмотров</span>
                  </div>
                  <a href={video.url} target="_blank" rel="noreferrer">
                    <h3>{video.title}</h3>
                  </a>
                  <p>{video.channelTitle}</p>
                  <div className="monitoring-video-actions">
                    <button
                      className="button button-small"
                      type="button"
                      disabled={addToLibrary.isPending}
                      onClick={() => addToLibrary.mutate(video.id)}
                    >
                      {addToLibrary.isPending && addToLibrary.variables === video.id
                        ? 'Переносим…'
                        : 'В библиотеку'}
                    </button>
                    <button
                      className="button button-small button-danger"
                      type="button"
                      disabled={deleteVideo.isPending}
                      onClick={() => requestVideoDelete(video.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="monitoring-empty">
            <span>▶</span>
            <h3>Пока нет найденных видео</h3>
            <p>Создайте тему и нажмите «Проверить сейчас» — результаты появятся здесь.</p>
          </div>
        )}
      </section>
    </div>
  )
}
