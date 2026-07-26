# Reels Finder API

Backend сервиса **Reels Finder** — поиск и анализ Instagram Reels конкурентов.

Это **первый этап**: фундамент backend. Реализованы конфигурация, подключение к
SQLite через SQLAlchemy 2, ORM-модели, Alembic-миграции, Pydantic-схемы, единый
формат ошибок, структурированное логирование, healthcheck и тесты.

## Технологии

| Компонент | Назначение |
|---|---|
| Python 3.12 | язык |
| FastAPI | HTTP-слой, OpenAPI/Swagger |
| Pydantic 2 + pydantic-settings | схемы и типизированная конфигурация |
| SQLAlchemy 2 | ORM (`DeclarativeBase`, `Mapped`, `mapped_column`) |
| Alembic | миграции схемы БД |
| SQLite | база данных на текущем этапе |
| httpx | HTTP-клиент (пригодится для Apify) и `TestClient` |
| Uvicorn | ASGI-сервер |
| python-dotenv | загрузка `.env` |
| Pytest | тесты |
| Ruff | линтер и форматтер |
| mypy | статическая проверка типов |

## Требования

- **Python 3.12** или новее.
- Git.
- Проект не требует Docker, PostgreSQL, Redis и внешних сервисов.

### Установка Python 3.12

**Windows.** Скачай установщик с [python.org/downloads](https://www.python.org/downloads/)
или установи через winget:

```powershell
winget install Python.Python.3.12
```

При установке через установщик отметь галочку **«Add python.exe to PATH»**.

Проверь версию:

```powershell
python --version
```

Должно вывести `Python 3.12.x`.

## Быстрый старт (Windows PowerShell)

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Linux / macOS

```bash
cd apps/api
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Переменные окружения

`.env` создаётся копированием `.env.example` и **никогда не коммитится**.

| Переменная | По умолчанию | Описание |
|---|---|---|
| `APP_ENV` | `development` | `development` / `testing` / `production` |
| `APP_HOST` | `127.0.0.1` | хост |
| `APP_PORT` | `8000` | порт |
| `DATABASE_URL` | `sqlite:///./data/relseprod.db` | относительный путь резолвится от `apps/api` |
| `APIFY_API_TOKEN` | пусто | **опционально на этом этапе** |
| `APIFY_ACTOR_ID` | пусто | **опционально на этом этапе** |
| `APIFY_RESULTS_LIMIT` | `20` | лимит результатов парсинга |
| `APIFY_TIMEOUT_SECONDS` | `300` | таймаут запуска актора |
| `APIFY_POLL_INTERVAL_SECONDS` | `3` | интервал опроса статуса |
| `CORS_ORIGINS` | `http://localhost:4173` | список origin через запятую |
| `LOG_LEVEL` | `INFO` | уровень логирования |

Приложение **стартует без Apify-токена** — интеграция появится на следующем этапе.

## Проверка работы

После запуска сервера:

| URL | Ответ |
|---|---|
| <http://localhost:8000/> | `{"name":"Reels Finder API","version":"0.1.0","docs":"/docs"}` |
| <http://localhost:8000/health> | `{"status":"ok","database":"connected"}` |
| <http://localhost:8000/api/v1/health> | то же, под префиксом API |
| <http://localhost:8000/docs> | Swagger UI |
| <http://localhost:8000/redoc> | ReDoc |
| <http://localhost:8000/openapi.json> | OpenAPI-схема |

`/health` выполняет реальный запрос `SELECT 1` к базе. Если база недоступна,
возвращается **503** с единым форматом ошибки, а не «ok».

## Миграции

Схема базы управляется **только** Alembic. `Base.metadata.create_all()` при
запуске приложения не вызывается.

```powershell
alembic upgrade head       # применить миграции
alembic downgrade base     # откатить всё
alembic current            # текущая ревизия
alembic history            # история
alembic revision --autogenerate -m "описание"   # новая миграция
```

Текущая (и единственная) миграция: **`initial backend schema`** —
создаёт `competitors`, `reels`, `reel_content`, `parsing_jobs` со всеми
primary/foreign keys, уникальными ограничениями, индексами и каскадным удалением.

## Проверки качества

```powershell
ruff check .          # линтер
ruff format .         # форматирование
mypy                  # проверка типов
pytest                # тесты
pytest --cov=app      # тесты с покрытием
```

Тесты используют **отдельную временную SQLite-базу** для каждого запуска
(создаётся реальными Alembic-миграциями) — рабочий файл `data/relseprod.db`
не затрагивается. Каждый тест выполняется в откатываемой транзакции, поэтому
тесты изолированы и не зависят от порядка выполнения.

## Структура папок

```
apps/api/
├── app/
│   ├── main.py              # FastAPI-приложение, GET / и GET /health
│   ├── api/
│   │   ├── deps.py          # общие зависимости (сессия БД, check_database)
│   │   └── v1/router.py     # роутер /api/v1
│   ├── core/
│   │   ├── config.py        # Settings на pydantic-settings + lru_cache
│   │   ├── errors.py        # коды ошибок, исключения, exception handlers
│   │   └── logging.py       # настройка стандартного logging
│   ├── database/
│   │   ├── base.py          # DeclarativeBase, TimestampMixin, utcnow()
│   │   ├── session.py       # engine, sessionmaker, get_db
│   │   └── types.py         # UTCDateTime — timezone-aware даты в SQLite
│   ├── models/              # ORM-модели и Enum-статусы
│   ├── schemas/             # Pydantic-схемы (camelCase наружу)
│   ├── repositories/        # доступ к БД, работает только с ORM
│   ├── services/
│   │   └── instagram.py     # нормализация Instagram-профиля
│   └── tasks/               # задел под фоновые задачи
├── data/                    # локальная SQLite-база (в .gitignore)
├── migrations/              # Alembic: env.py + versions/
├── tests/                   # pytest: conftest + тесты
├── .env.example
├── alembic.ini
└── pyproject.toml
```

### Разделение ответственности

- **api** — только HTTP: маршруты, зависимости, коды статусов.
- **core** — конфигурация, ошибки, логирование.
- **database** — engine, сессии, `Base`, общие типы и миксины.
- **models** — ORM-модели.
- **schemas** — валидация запросов и сериализация ответов.
- **repositories** — все обращения к БД; возвращают ORM-объекты или `None`,
  никогда не бросают `HTTPException`.
- **services** — бизнес-логика.
- **tasks** — будущие фоновые задачи.

## Модели и связи

```
Competitor 1 ──< N Reel 1 ──1 ReelContent
     │
     └──< N ParsingJob
```

| Таблица | Ключевые особенности |
|---|---|
| `competitors` | уникальный индекс по `instagram_username` (хранится в lowercase, без `@`); статус `idle/queued/parsing/ready/error`; `reels_count` по умолчанию `0` |
| `reels` | FK на `competitors.id` с `ON DELETE CASCADE`; уникальность `competitor_id + shortcode`; индекс `competitor_id + instagram_id`; `raw_data` в JSON; метрики nullable |
| `reel_content` | FK на `reels.id` с `ON DELETE CASCADE`; `reel_id` уникален (один-к-одному); статус по умолчанию `new` |
| `parsing_jobs` | FK на `competitors.id` с `ON DELETE CASCADE`; индексы по `competitor_id`, `status`, `created_at`; статус по умолчанию `queued` |

Все даты хранятся в **UTC** и возвращаются как timezone-aware `datetime`
(тип `UTCDateTime` компенсирует отсутствие поддержки таймзон в SQLite).

Каскадное удаление в SQLite работает благодаря `PRAGMA foreign_keys=ON`,
включаемому на каждом соединении.

### Соглашение по пустым значениям

Пользовательские текстовые поля (`hook`, `script`, `cta`, `notes`) хранят
`NULL`, если значение не заполнено. Pydantic-схемы приводят пустые строки и
строки из пробелов к `None`, так что «пусто» во всём проекте представлено
единообразно.

## Формат ошибок

Все ошибки возвращаются в едином виде:

```json
{
  "error": {
    "code": "COMPETITOR_NOT_FOUND",
    "message": "Конкурент не найден",
    "details": {}
  }
}
```

Коды: `VALIDATION_ERROR`, `NOT_FOUND`, `COMPETITOR_ALREADY_EXISTS`,
`COMPETITOR_NOT_FOUND`, `REEL_NOT_FOUND`, `JOB_NOT_FOUND`,
`ACTIVE_JOB_ALREADY_EXISTS`, `INVALID_INSTAGRAM_PROFILE`, `INVALID_JOB_STATE`,
`DATABASE_ERROR`, `INTERNAL_ERROR`.

Клиенту никогда не возвращаются stack trace, SQL-запросы, переменные окружения,
пути к файлам, токены и внутренние исключения драйвера БД. Непредвиденные
исключения логируются на сервере, а наружу уходит безопасный `INTERNAL_ERROR`.

## API-контракт

Python-код использует `snake_case`, JSON — `camelCase`:

```json
{
  "id": 1,
  "instagramUsername": "example",
  "profileUrl": "https://www.instagram.com/example/",
  "status": "ready",
  "reelsCount": 20,
  "lastParsedAt": "2026-05-02T12:00:00Z"
}
```

## Нормализация Instagram-профиля

`app.services.instagram.normalize_instagram_profile()` приводит любой ввод к
канонической паре `username` + `profile_url`:

| Ввод | `username` | `profile_url` |
|---|---|---|
| `example` | `example` | `https://www.instagram.com/example/` |
| `@Example` | `example` | `https://www.instagram.com/example/` |
| `instagram.com/example` | `example` | `https://www.instagram.com/example/` |
| `https://www.instagram.com/example/?hl=ru` | `example` | `https://www.instagram.com/example/` |

Отклоняются: посторонние домены, ссылки на `/reel/`, `/reels/`, `/p/`,
`/stories/`, `/explore/`, `/accounts/`, `/direct/`, недопустимые символы,
username длиннее 30 символов и пустые строки. При ошибке выбрасывается
`InvalidInstagramProfileError` с кодом `INVALID_INSTAGRAM_PROFILE` —
«сырой» `ValueError` наружу не пробрасывается.

## Хранение секретов

- Реальные значения живут **только** в локальном `.env`, который в `.gitignore`.
- `.env.example` содержит **пустые** значения `APIFY_API_TOKEN` и `APIFY_ACTOR_ID`.
- Токен **не должен** попадать в исходный код, frontend, тесты, README, логи,
  GitHub Actions и снапшоты.
- Логирование настроено так, чтобы не выводить содержимое `.env`, токены и
  секретные HTTP-заголовки.
- Файлы `*.db`, `*.sqlite`, `*.sqlite3` и папка `data/` игнорируются Git.

## Troubleshooting

### PowerShell: «выполнение сценариев отключено в этой системе»

При запуске `.venv\Scripts\Activate.ps1` можно получить:

```
Activate.ps1 cannot be loaded because running scripts is disabled on this system.
```

Разреши запуск скриптов для текущего пользователя:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Подтверди выбор `Y` и снова активируй venv. Разовая альтернатива без изменения
политики:

```powershell
powershell -ExecutionPolicy Bypass -File .venv\Scripts\Activate.ps1
```

Или используй `cmd`-версию активации:

```cmd
.venv\Scripts\activate.bat
```

### Не создаётся файл SQLite

Симптомы: `sqlite3.OperationalError: unable to open database file` или
ответ `/health` с кодом **503** и `DATABASE_ERROR`.

Что проверить:

1. **Рабочая папка.** Относительный путь `sqlite:///./data/relseprod.db`
   резолвится от `apps/api`, поэтому команды запускай из `apps/api`.
2. **Папка `data/` существует и доступна на запись.** Приложение пытается
   создать её само; если не хватает прав — создай вручную:
   ```powershell
   New-Item -ItemType Directory -Force -Path data
   ```
3. **Миграции применены.** Если таблиц нет, выполни `alembic upgrade head`.
4. **Файл не занят.** Закрой DB Browser for SQLite / другой процесс, который
   держит `data/relseprod.db`.
5. **Абсолютный путь.** На проблемных конфигурациях (OneDrive, сетевые диски)
   укажи путь явно, с прямыми слэшами и четырьмя слэшами после `sqlite:`:
   ```
   DATABASE_URL=sqlite:////C:/projects/relseprod/apps/api/data/relseprod.db
   ```
6. **Антивирус / права.** Папка внутри `C:\Program Files` или системного
   каталога может блокировать запись — перенеси проект в пользовательский каталог.

### `pip install -e ".[dev]"` падает с ошибкой версии Python

```
Package 'reels-finder-api' requires a different Python: 3.11.x not in '>=3.12'
```

Активирован venv на Python < 3.12. Удали `.venv`, создай заново явно на 3.12:

```powershell
Remove-Item -Recurse -Force .venv
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

### `alembic: command not found`

Виртуальное окружение не активировано либо зависимости не установлены.
Активируй venv и выполни `pip install -e ".[dev]"`.

## Ограничения текущего этапа

Намеренно **не реализовано** (запланировано на следующие этапы):

- CRUD-эндпоинты для конкурентов;
- запуск и отслеживание parsing job по HTTP;
- реальный `ApifyService` и интеграция с Apify API;
- импорт Reels и список Reels;
- сохранение сценария через HTTP;
- интеграция с frontend;
- аналитика, теги, расширенная сортировка;
- AI-функции, транскрибация, скачивание видео;
- публикация в Instagram;
- Docker, PostgreSQL, Redis, Celery/Dramatiq, отдельный worker.

Архитектура подготовлена так, чтобы эти возможности добавлялись без переписывания
существующего кода: слои `repositories`, `services` и `tasks` уже разделены,
статусы вынесены в Enum, а схемы ответов и коды ошибок для будущих сущностей
уже определены.
