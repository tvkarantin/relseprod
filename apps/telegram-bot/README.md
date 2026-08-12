# Reels Finder Telegram Bot

Standalone Telegram Bot API webhook service for Reels Finder, designed for a separate Vercel project.

## Responsibilities

- receive Telegram updates through HTTPS webhook;
- validate `X-Telegram-Bot-Api-Secret-Token`;
- respond to `/start` and `/help`;
- send users back to the Reels Finder Telegram auth screen;
- stay independent from the main frontend and FastAPI backend.

Telegram login itself is handled through Telegram OIDC + Supabase Auth. The bot service uses the Bot API token only for bot messages.

## Environment variables

Copy `.env.example` and configure:

- `TELEGRAM_BOT_TOKEN` — Bot API token from @BotFather;
- `TELEGRAM_WEBHOOK_SECRET` — random webhook secret;
- `REELSFINDER_URL` — public frontend URL;
- `TELEGRAM_BOT_PUBLIC_URL` — production URL of this Vercel bot project.

## Deploy

Deploy this directory as its own Vercel project. After the production URL and env vars are configured, run:

```bash
node scripts/set-webhook.mjs
```

The webhook endpoint is `/api/webhook`. Health check is `/api/health` (and `/` rewrites there).
