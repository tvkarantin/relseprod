# YouTube Monitoring

Мониторинг использует только официальный YouTube Data API v3. Ключ выполняется
на backend и никогда не попадает в браузер.

## Настройка

1. Откройте [Google Cloud Console](https://console.cloud.google.com/), создайте проект.
2. В **APIs & Services → Library** включите **YouTube Data API v3**.
3. В **Credentials** создайте API key. Рекомендуется ограничить ключ API YouTube Data API.
4. Добавьте его в `apps/api/.env`:

```ini
YOUTUBE_API_KEY=...
YOUTUBE_DAILY_QUOTA_LIMIT=9000
```

После этого выполните `alembic upgrade head` в `apps/api` и запустите API.

## Использование

Откройте `/youtube-monitoring`, создайте тему, добавьте каналы (ссылка на канал,
`@handle`, Channel ID или ссылка на видео) и нажмите «Проверить сейчас».
API маршруты находятся под `/api/v1/monitoring`: topics, channels, videos и
ручной запуск topic. В локальном MVP принадлежность данных задаётся заголовком
`X-User-Id`; в production его должен выдавать существующий механизм авторизации.

## Cron

Ручной запуск ставится в FastAPI background task и не блокирует HTTP. Для
production рекомендуется внешний cron (Vercel/Supabase/системный cron), который
каждые 2–4 часа вызывает `POST /api/v1/monitoring/topics/{id}/run`. У задачи
есть `lastCheckedAt`, а запросы используют `publishedAfter`; видео и статистика
дедуплицируются. Перед подключением внешнего cron добавьте distributed lock
(например, PostgreSQL advisory lock или Redis), если worker будет больше одного.

## Квота и ограничения

`search.list` стоит дорого, поэтому каналы читаются через uploads playlist,
статистика запрашивается пачками до 50 ID. YouTube API имеет дневную квоту,
лимит задаётся `YOUTUBE_DAILY_QUOTA_LIMIT`; в следующем production-слое стоит
записывать фактические операции в `youtube_quota_logs` и останавливать задачу
при достижении лимита. API может вернуть deleted/private videos, неполные
статистики и временные 403/429/5xx. Shorts определяются эвристически и имеют
`contentType=unknown`, если данных недостаточно.

AI-анализ в текущем MVP имеет безопасный fallback по ключевым словам и метрикам;
при включённом OpenRouter его можно подключить через существующий клиент без
добавления второго SDK. Уведомления пока представлены порогом и статусом
`recommended`; внешний Telegram адаптер следует подключать к текущему
notification layer после появления пользовательских каналов доставки.
