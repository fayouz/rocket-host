// Traduit des messages voyageurs vers la langue de l'interface : { texts: string[], target: 'fr' | 'en' } -> { items: [{ text, sourceLang, translated }] }
export default defineEventHandler(async (event) => {
  if (!translateEnabled()) throw createError({ statusCode: 409, statusMessage: 'Traduction non configurée (Réglages › Connexions › Traduction)' })
  const body = await readBody(event)
  const target = body?.target === 'en' ? 'en' : body?.target === 'fr' ? 'fr' : null
  if (!target) throw createError({ statusCode: 400, statusMessage: 'Langue cible invalide' })
  const texts = Array.isArray(body?.texts) ? body.texts : null
  if (!texts || !texts.length || texts.length > 50 || texts.some((t: unknown) => typeof t !== 'string' || !t.trim() || t.length > 5000))
    throw createError({ statusCode: 400, statusMessage: 'Textes invalides (1 à 50 textes, 5000 caractères max)' })
  return { items: await translateTexts(texts, target) }
})
