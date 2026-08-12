const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const publicUrl = process.env.TELEGRAM_BOT_PUBLIC_URL

if (!token || !secret || !publicUrl) {
  console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and TELEGRAM_BOT_PUBLIC_URL first.')
  process.exit(1)
}

const webhookUrl = `${publicUrl.replace(/\/$/, '')}/api/webhook`
const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }),
})

const data = await response.json()
if (!response.ok || !data.ok) {
  console.error(data)
  process.exit(1)
}

console.log(`Webhook configured: ${webhookUrl}`)
