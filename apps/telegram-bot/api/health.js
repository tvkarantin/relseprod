export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  response.setHeader('Cache-Control', 'no-store')
  return response.status(200).json({
    ok: true,
    service: 'realsflow-telegram-bot',
    configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN &&
        process.env.TELEGRAM_WEBHOOK_SECRET &&
        process.env.REALSFLOW_URL,
    ),
  })
}
