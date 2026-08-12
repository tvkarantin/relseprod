const TELEGRAM_API = 'https://api.telegram.org'

function getHeader(request, name) {
  const value = request.headers?.[name]
  if (Array.isArray(value)) return value[0] ?? ''
  return typeof value === 'string' ? value : ''
}

function normalizeBody(body) {
  if (!body) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  }
  return body
}

async function telegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')

  const result = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await result.json().catch(() => null)
  if (!result.ok || !data?.ok) {
    const message = data?.description || `Telegram API ${result.status}`
    throw new Error(message)
  }
  return data.result
}

function appUrl() {
  return (process.env.REELSFINDER_URL || 'https://realsfinder-vercel.vercel.app').replace(/\/$/, '')
}

async function sendWelcome(chatId, firstName) {
  const greeting = firstName ? `Привет, ${firstName}.` : 'Привет.'

  return telegram('sendMessage', {
    chat_id: chatId,
    text: `${greeting}\n\nЭто официальный бот Reels Finder. Через него будем подтверждать Telegram и присылать полезные системные уведомления.`,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть Reels Finder',
            url: `${appUrl()}/auth?provider=telegram`,
          },
        ],
      ],
    },
  })
}

async function handleMessage(message) {
  if (!message?.chat?.id || message.chat.type !== 'private') return

  const text = typeof message.text === 'string' ? message.text.trim() : ''
  const command = text.split(/\s+/)[0]?.toLowerCase() || ''

  if (command === '/start' || command === '/help') {
    await sendWelcome(message.chat.id, message.from?.first_name)
    return
  }

  await telegram('sendMessage', {
    chat_id: message.chat.id,
    text: 'Для входа и работы с Reels Finder используй кнопку ниже.',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть Reels Finder',
            url: `${appUrl()}/auth?provider=telegram`,
          },
        ],
      ],
    },
  })
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  const receivedSecret = getHeader(request, 'x-telegram-bot-api-secret-token')
  if (!configuredSecret || receivedSecret !== configuredSecret) {
    return response.status(401).json({ ok: false, error: 'invalid_webhook_secret' })
  }

  const update = normalizeBody(request.body)
  if (!update || typeof update !== 'object') {
    return response.status(400).json({ ok: false, error: 'invalid_update' })
  }

  if (!update.message) return response.status(200).json({ ok: true })

  try {
    await handleMessage(update.message)
    return response.status(200).json({ ok: true })
  } catch (error) {
    console.error('telegram_webhook_error', error instanceof Error ? error.message : error)
    return response.status(500).json({ ok: false, error: 'telegram_request_failed' })
  }
}
