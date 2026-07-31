# Reels Finder

Локальный сервис для поиска и разбора Instagram Reels конкурентов: добавляете
аккаунт, импортируете его рилсы через Apify и пишете по ним свои сценарии.

Работает **без Docker** — нужны только Python 3.12 и Node.js 20+.

```
relseprod/
├── apps/
│   ├── api/                    # Backend: FastAPI + SQLAlchemy 2 + SQLite + Alembic
│   └── web/                    # Frontend: React + TypeScript + Vite
├── docs/
│   └── apify-integration.md    # Как устроена интеграция с Apify
└── relseprod-frontend-dark/    # Архив: исходный дизайн-прототип (моки, не используется)
```

## Возможности

- добавление конкурентов по username, `@username` или ссылке на профиль;
- импорт рилсов через Apify в фоновой задаче с отслеживанием прогресса;
- повторный импорт обновляет метрики и **не создаёт дубли**;
- библиотека рилсов с серверным поиском и пагинацией;
- ручной запуск точной расшифровки речи из видео через Deepgram Speech-to-Text с polling, таймкодами и переносом в сценарий;
- перевод речи на русский язык и структурный разбор сценария через OpenRouter (AI);
- редактор сценария (хук, основная часть, призыв, заметки, статус) с
  автосохранением;
- написанный сценарий **не перезаписывается** при повторном импорте;
- раздел «Мои рилсы» и обзор с реальными счётчиками.

## Локальный запуск без Docker

Нужны два терминала.

### 1. Backend

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Linux/macOS: `python3.12 -m venv .venv && source .venv/bin/activate && cp .env.example .env`.

### 2. Frontend

```powershell
cd apps/web
npm install
Copy-Item .env.example .env
npm run dev -- --port 4173
```

### Адреса

| Что | URL |
|---|---|
| Frontend | <http://localhost:4173> |
| Backend | <http://localhost:8000> |
| Swagger | <http://localhost:8000/docs> |
| Health | <http://localhost:8000/health> |

## Настройка Apify

Импорт рилсов требует учётной записи [Apify](https://apify.com). Токен берётся
в **Settings → Integrations → API tokens** и вставляется в `apps/api/.env`:

```
APIFY_API_TOKEN=<ваш_токен>
APIFY_ACTOR_ID=apify/instagram-reel-scraper
```

Без токена приложение полностью запускается, но запуск импорта вернёт понятную
ошибку `APIFY_NOT_CONFIGURED`.

⚠️ **Токен — секрет.** Он хранится только в локальном `.env` (в `.gitignore`),
никогда не попадает во frontend, в репозиторий и в логи. Если токен где-то
засветился — отзовите его в Apify Console и выпустите новый.

⚠️ Каждый запуск Actor расходует кредиты Apify. Подробности и рекомендации —
в [`docs/apify-integration.md`](docs/apify-integration.md).

## Ручной smoke-тест

Полный пользовательский путь, который стоит пройти после установки:

1. Запустите backend и frontend, откройте <http://localhost:4173>.
2. Перейдите в **«Конкуренты»**.
3. Добавьте аккаунт, например `https://www.instagram.com/natgeo/` → появится в списке
   со статусом «Не импортирован».
4. Повторно добавьте тот же аккаунт → появится ошибка «уже добавлен».
5. Нажмите **«Импортировать Reels»** → под строкой появится прогресс-бар.
6. Дождитесь статуса «Импорт завершён» и уведомления с количеством рилсов.
7. Откройте **«Библиотеку рилсов»** → отображаются настоящие импортированные
   ролики с метриками.
8. Введите слово из описания в поиск → список сузится, `page` сбросится на 1.
9. Выберите конкурента в фильтре, перейдите на страницу 2 и обновите
   страницу → фильтры сохранятся (они в URL).
10. Откройте любой рилс → слева видео или обложка, справа редактор.
11. Заполните **хук** и **основную часть** → статус сменится на «Есть
    изменения», затем «Сохранение…» и «Сохранено».
12. Обновите страницу (F5) → текст на месте.
13. Смените статус на «Сценарий» → рилс появится в разделе **«Мои рилсы»**.
14. Вернитесь в «Конкуренты» и запустите импорт повторно.
15. После завершения проверьте: количество рилсов не удвоилось (дублей нет),
    метрики обновились, а ваш хук и сценарий сохранились.
16. На вкладке **«Обзор»** счётчики соответствуют реальным данным.

## Проверки качества

Backend:

```powershell
cd apps/api
ruff check .
pytest
alembic upgrade head
```

Frontend:

```powershell
cd apps/web
npm run lint
npm run typecheck
npm run test
npm run build
```

## Документация

- [`apps/api/README.md`](apps/api/README.md) — backend: установка, миграции,
  API, фоновые задачи, troubleshooting.
- [`apps/web/README.md`](apps/web/README.md) — frontend: маршруты, кэш, поиск,
  автосохранение, тесты.
- [`docs/apify-integration.md`](docs/apify-integration.md) — Actor, его вход и
  выход, нормализация, защита от дублей, стоимость.
- [`docs/deepgram-integration.md`](docs/deepgram-integration.md) — Deepgram Speech-to-Text: интеграция, бэкенд, фоновые задачи, полинг на фронтенде и перенос в редактор.
- [`docs/openrouter-analysis-integration.md`](docs/openrouter-analysis-integration.md) — OpenRouter AI-анализ: перевод, разбивка сценария, применение.

## Ограничения текущей версии

- нет авторизации, регистрации и оплаты — это локальный однопользовательский MVP;
- фоновые задачи выполняются в процессе backend: после его перезапуска
  незавершённый импорт останется в статусе `running`;
- нет Docker, PostgreSQL, Redis и отдельного worker;
- нет аналитики, графиков, тегов и пользовательской сортировки;
- видео и обложки не скачиваются, хранятся только ссылки Instagram, которые
  со временем перестают открываться;
- нет AI-рерайта, транскрибации и публикации в Instagram.

## YouTube Monitoring

MVP мониторинга YouTube находится в `/youtube-monitoring` и использует только
официальный YouTube Data API v3. Инструкция по Google Cloud, API key, миграциям,
cron, квоте и ограничениям: [`docs/youtube-monitoring.md`](docs/youtube-monitoring.md).
Добавьте `YOUTUBE_API_KEY` в `apps/api/.env`; ключ не передаётся frontend.
