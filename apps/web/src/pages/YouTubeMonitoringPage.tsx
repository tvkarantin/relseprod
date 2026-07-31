import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useState } from 'react'

import {
  monitoringApi,
  type CreateTopicPayload,
  type MonitoringTopic,
} from '@/api/monitoring'
import { formatNumber } from '@/utils/format'

const monitoringKeys = {
  topics: ['monitoring', 'topics'] as const,
  channels: ['monitoring', 'channels'] as const,
  videos: (topicId?: number) => ['monitoring', 'videos', topicId ?? 'all'] as const,
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
  const [topicName, setTopicName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [negativeKeywords, setNegativeKeywords] = useState('')
  const [channelUrl, setChannelUrl] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>()
  const [notice, setNotice] = useState('')

  const topicsQuery = useQuery({
    queryKey: monitoringKeys.topics,
    queryFn: ({ signal }) => monitoringApi.topics(signal),
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

  const createTopic = useMutation({
    mutationFn: (payload: CreateTopicPayload) => monitoringApi.createTopic(payload),
    onSuccess: async (topic) => {
      setTopicName('')
      setKeywords('')
      setNegativeKeywords('')
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
    },
  })

  const deleteChannel = useMutation({
    mutationFn: monitoringApi.deleteChannel,
    onSuccess: async () => {
      setNotice('Канал удалён из мониторинга')
      await queryClient.invalidateQueries({ queryKey: monitoringKeys.channels })
    },
  })

  const runTopic = useMutation({
    mutationFn: monitoringApi.runTopic,
    onSuccess: (_result, topicId) => {
      setNotice('Проверка запущена. Новые видео появятся после ответа YouTube.')
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: monitoringKeys.topics })
        void queryClient.invalidateQueries({ queryKey: monitoringKeys.videos(topicId) })
        void queryClient.invalidateQueries({ queryKey: monitoringKeys.videos() })
      }, 1800)
    },
  })

  const videoAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'save' | 'ignore' }) =>
      action === 'save' ? monitoringApi.saveVideo(id) : monitoringApi.ignoreVideo(id),
    onSuccess: async () => {
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
    videoAction.error,
  ].find(Boolean)

  const selectedTopic = useMemo(
    () => topicsQuery.data?.find((topic) => topic.id === selectedTopicId),
    [selectedTopicId, topicsQuery.data],
  )

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
          <button
            className="button button-lime"
            type="submit"
            disabled={createTopic.isPending}
          >
            {createTopic.isPending ? 'Создаём…' : 'Добавить тему'}
          </button>
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
              className={`monitoring-topic-card ${selectedTopicId === topic.id ? 'active' : ''}`}
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
                <span>Последняя проверка: {formatDate(topic.lastCheckedAt)}</span>
              </button>
              <button
                className="button button-primary button-small"
                type="button"
                disabled={runTopic.isPending}
                onClick={() => runTopic.mutate(topic.id)}
              >
                {runTopic.isPending && runTopic.variables === topic.id
                  ? 'Запуск…'
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
          <span className="monitoring-result-count">
            {videosQuery.isFetching ? 'Обновляем…' : `${videosQuery.data?.length ?? 0} результатов`}
          </span>
        </div>

        {videosQuery.data?.length ? (
          <div className="monitoring-video-grid">
            {videosQuery.data.map((video) => (
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
                      disabled={videoAction.isPending}
                      onClick={() => videoAction.mutate({ id: video.id, action: 'save' })}
                    >
                      {video.status === 'saved' ? 'Сохранено' : 'Сохранить'}
                    </button>
                    <button
                      className="button button-small button-danger"
                      type="button"
                      disabled={videoAction.isPending}
                      onClick={() => videoAction.mutate({ id: video.id, action: 'ignore' })}
                    >
                      Скрыть
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
