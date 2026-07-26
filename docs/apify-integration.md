# Интеграция с Apify

Документ описывает, как backend Reels Finder импортирует Instagram Reels через
Apify: какой Actor используется, какой у него вход и выход, как работает
нормализация, защита от дублей и какие есть ограничения.

## Общая схема

```
Клиент → POST /api/v1/competitors/{id}/parse
           └─ создаётся parsing job (status=queued), HTTP сразу отвечает 202
BackgroundTask → ApifyService.start_run()      → Apify: POST /v2/acts/{actor}/runs
               → ApifyService.wait_for_completion() → Apify: GET /v2/actor-runs/{id}
               → ApifyService.get_dataset_items()   → Apify: GET /v2/datasets/{id}/items
               → normalize_apify_reel()  → NormalizedReel
               → ReelImporter.import_reels() → SQLite
```

Frontend **никогда** не обращается к Apify напрямую: только `Backend → Apify`.
Токен живёт исключительно в `.env` на стороне сервера.

## Используемый Actor

Actor задаётся переменной `APIFY_ACTOR_ID` в формате `owner/actor-name`.
Рекомендуемый вариант:

```
APIFY_ACTOR_ID=apify/instagram-reel-scraper
```

В URL идентификатор кодируется как `apify~instagram-reel-scraper`
(см. `encode_actor_id()` в `app/services/apify.py`).

## Фактический input

Разные Instagram-акторы принимают разный вход, поэтому структура строится в
одном месте — `app/services/apify_input.py`, функция `build_actor_input()`.
Форма определяется автоматически по `APIFY_ACTOR_ID` и может быть
принудительно задана через `APIFY_ACTOR_INPUT_STYLE`.

### Стиль `username` (по умолчанию для `*-reel-scraper`)

Для `apify/instagram-reel-scraper`:

```json
{
  "username": ["example"],
  "resultsLimit": 20
}
```

### Стиль `direct_urls` (для `instagram-scraper` / `instagram-api-scraper`)

```json
{
  "directUrls": ["https://www.instagram.com/example/"],
  "resultsType": "reels",
  "resultsLimit": 20
}
```

Определение стиля:

| `APIFY_ACTOR_ID` | Определённый стиль |
|---|---|
| `apify/instagram-reel-scraper` | `username` |
| `apify/instagram-scraper` | `direct_urls` |
| `apify/instagram-api-scraper` | `direct_urls` |
| неизвестный actor | `username` |

Если ваш Actor ожидает другой вход, задайте `APIFY_ACTOR_INPUT_STYLE=username`
или `direct_urls` явно. Проверить фактический вход можно скриптом
`python -m scripts.test_apify` — он печатает отправляемый JSON.

`resultsLimit` берётся из `APIFY_RESULTS_LIMIT`, никогда не хардкодится.

## Основные output-поля

Формы ответа отличаются между акторами, поэтому нормализатор понимает несколько
написаний каждого поля. Пример элемента `apify/instagram-reel-scraper`:

```json
{
  "reelURL": "https://www.instagram.com/p/DTN5aH4gG9z/",
  "reelId": "3804949744019599219",
  "ownerUsername": "natgeo",
  "videoPlayCount": 1948214,
  "likesCount": 64503,
  "commentsCount": 340,
  "timestamp": "2026-01-07T17:04:30.000Z"
}
```

Реальный обезличенный пример вашего Actor сохраняется скриптом в
`docs/apify-sample-output.json`.

## Правила normalizer

`app/services/reel_normalizer.py` → `normalize_apify_reel(raw) -> NormalizedReel | None`.

### Поддерживаемые имена полей

| Поле | Принимаемые ключи |
|---|---|
| `instagram_id` | `id`, `instagramId`, `postId`, `pk`, `reelId` |
| `shortcode` | `shortCode`, `shortcode`, `code` |
| `original_url` | `url`, `postUrl`, `reelUrl`, `inputUrl`, `reelURL` |
| `video_url` | `videoUrl`, `video_url`, `videoPlayUrl` |
| `thumbnail_url` | `displayUrl`, `thumbnailUrl`, `imageUrl`, `coverUrl` |
| `caption` | `caption`, `text`, `description` |
| `views_count` | `videoViewCount`, `viewsCount`, `playCount`, `videoPlayCount` |
| `likes_count` | `likesCount`, `likeCount` |
| `comments_count` | `commentsCount`, `commentCount` |
| `published_at` | `timestamp`, `publishedAt`, `takenAt`, `createdAt` |
| `duration` | `videoDuration`, `duration` |

### Правила преобразования

1. Числа принимаются как `int`, `float` и числовые строки (`"1 200 000"`, `"1,200,000"`).
2. Пустые строки не ломают разбор.
3. Неизвестные значения становятся `None`, **никогда не `0`** — отсутствие метрики
   и нулевая метрика различаются.
4. Даты: ISO 8601 (в т.ч. с `Z`), Unix-секунды и Unix-миллисекунды.
   Значения `>= 10^10` считаются миллисекундами.
5. Все даты приводятся к timezone-aware UTC.
6. URL принимается только абсолютный `http(s)://`; остальное отбрасывается.
7. Если `original_url` отсутствует, он строится из shortcode:
   `https://www.instagram.com/reel/{shortcode}/`.
8. Если shortcode отсутствует, но есть URL вида `/reel/<code>/` или `/p/<code>/`,
   shortcode извлекается из URL.
9. Исходный объект сохраняется в `raw_data` через `deepcopy` — входной словарь
   **не мутируется**.
10. Если отсутствуют **и** `instagram_id`, **и** `shortcode` — элемент
    пропускается (его невозможно дедуплицировать). В лог пишется только факт
    пропуска, без полного JSON, чтобы не утекли персональные данные.

## Статусы run

| Статус | Трактовка |
|---|---|
| `READY`, `RUNNING` | выполняется, продолжаем polling |
| `SUCCEEDED` | успех, забираем dataset |
| `FAILED`, `ABORTING`, `ABORTED`, `TIMING-OUT`, `TIMED-OUT` | неуспех → `APIFY_RUN_FAILED` |
| неизвестный терминальный | трактуется как неуспех (не зацикливаемся) |

Polling выполняется с интервалом `APIFY_POLL_INTERVAL_SECONDS`.

## Timeout

Общий лимит ожидания — `APIFY_TIMEOUT_SECONDS` (по умолчанию 300 с). При
превышении:

- polling прекращается (бесконечного цикла нет);
- задача переводится в `failed` с кодом `APIFY_RUN_TIMEOUT`;
- сохраняется безопасное сообщение без внутренних деталей.

## Dataset

ID берётся из поля `defaultDatasetId` ответа run. Запрос:
`GET /v2/datasets/{id}/items?clean=true&format=json&limit=APIFY_RESULTS_LIMIT`.

Обрабатываемые ситуации:

| Ситуация | Поведение |
|---|---|
| dataset ID отсутствует | `APIFY_DATASET_ERROR`, задача `failed` |
| dataset пустой, run `SUCCEEDED` | задача **`completed`**, `reelsCreated=0`, `reelsUpdated=0`, конкурент `ready` |
| ответ не список | `APIFY_DATASET_ERROR` |
| отдельный элемент не объект | элемент пропускается, импорт продолжается |
| некорректный JSON | `APIFY_REQUEST_FAILED` |

Пустой датасет при успешном run **не считается ошибкой** — это нормальный
результат для аккаунта без рилсов.

## Повторный импорт и защита от дублей

Поиск существующего рилса выполняется в два шага:

1. по паре `competitor_id + shortcode`;
2. если не найдено — по паре `competitor_id + instagram_id`.

Это покрывает случай, когда первый импорт принёс только shortcode, а следующий —
только `instagram_id` (или наоборот): дубликат не создаётся, запись дополняется.

На уровне базы стоит `UNIQUE (competitor_id, shortcode)`.

### Что обновляется

Только данные, принадлежащие Instagram: `instagram_id`, `shortcode`,
`original_url`, `video_url`, `thumbnail_url`, `caption`, `views_count`,
`likes_count`, `comments_count`, `published_at`, `duration`, `raw_data`,
`updated_at`.

Пустые значения в новом ответе **не затирают** ранее сохранённые данные.

### Что НЕ трогается никогда

Пользовательский контент в `reel_content`: `hook`, `script`, `cta`, `notes`,
`content_status`. Сценарий, написанный пользователем, переживает любое
количество повторных импортов.

### Счётчик рилсов

После импорта `competitor.reels_count` пересчитывается **фактическим** запросом
`COUNT(*)` по базе, а не как «старое значение + created».

### Транзакции

Импорт идёт в общей транзакции, каждый элемент — в отдельном savepoint
(`begin_nested()`). Один битый элемент увеличивает `skipped` и не ломает
остальные. Сбой инфраструктуры базы откатывает операцию целиком.

## Коды ошибок

| Код | Когда |
|---|---|
| `APIFY_NOT_CONFIGURED` | не задан `APIFY_API_TOKEN` или `APIFY_ACTOR_ID` |
| `APIFY_REQUEST_FAILED` | сетевая ошибка, HTTP 4xx/5xx, некорректный JSON |
| `APIFY_RUN_FAILED` | run завершился в `FAILED`/`ABORTED`/`TIMED-OUT` |
| `APIFY_RUN_TIMEOUT` | превышен `APIFY_TIMEOUT_SECONDS` |
| `APIFY_DATASET_ERROR` | нет dataset ID или неожиданный формат |
| `APIFY_EMPTY_DATASET` | зарезервирован (сейчас пустой датасет = `completed`) |

Сообщения об ошибках Apify очищены: наружу не уходят токен, URL с токеном,
заголовки авторизации и внутренние детали драйвера.

## Авторизация

Токен передаётся заголовком:

```
Authorization: Bearer <APIFY_API_TOKEN>
```

Токен **никогда** не попадает в URL, логи, ответы API и сохранённые сообщения об
ошибках. Тесты используют фиктивные значения и `httpx.MockTransport`.

## Ограничения

1. Фоновая задача выполняется **в процессе** FastAPI (`BackgroundTasks`).
   При перезапуске backend незавершённая задача останется в статусе `running`
   и не возобновится — это осознанное ограничение локального MVP.
2. Нет Docker, Redis, Celery и отдельного worker-процесса.
3. Видео и обложки не скачиваются — хранятся только URL.
4. Одновременно у конкурента может выполняться только одна задача.
5. Лимит результатов ограничен `APIFY_RESULTS_LIMIT`; постраничная выгрузка
   всей истории аккаунта не реализована.

## Стоимость частого парсинга

⚠️ Каждый запуск Actor **расходует кредиты Apify** и оплачивается по тарифу
вашего аккаунта (обычно за compute units и за прокси-трафик).

Рекомендации:

- держите `APIFY_RESULTS_LIMIT` небольшим (20–30) для регулярных обновлений;
- не запускайте парсинг одного аккаунта чаще, чем раз в час — Instagram может
  начать отдавать неполные данные, а расход кредитов вырастет линейно;
- для отладки используйте `python -m scripts.test_apify --limit 1`;
- следите за расходом в Apify Console → Billing;
- ошибка `402` в `APIFY_REQUEST_FAILED` означает исчерпание баланса.

Повторный импорт обновляет существующие рилсы, поэтому частый парсинг не
раздувает базу — но кредиты тратит каждый раз.
