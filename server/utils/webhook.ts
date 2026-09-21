// Authentification des appels de n8n vers l'appli : en-tete "Authorization: Bearer <WEBHOOK_TOKEN>" (comparaison a temps constant).
import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export function requireWebhookToken(event: H3Event) {
  const token = useRuntimeConfig().webhookToken
  if (!token) throw createError({ statusCode: 503, statusMessage: 'Webhook désactivé : WEBHOOK_TOKEN absent de .env' })
  const given = Buffer.from((getHeader(event, 'authorization') || '').replace(/^Bearer\s+/i, ''))
  const expected = Buffer.from(token)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw createError({ statusCode: 401, statusMessage: 'Jeton invalide' })
}
