// Traduction automatique des messages voyageurs via DeepL (cle DEEPL_API_KEY, secret chiffre ; cle gratuite = suffixe « :fx »).
// Cache en base (translation_cache) : un meme texte n'est envoye qu'une fois par langue cible. Le texte n'est jamais journalise.
import { createHash } from 'node:crypto'

export type Target = 'fr' | 'en'
export interface Translation { text: string; sourceLang: string; translated: boolean }

export const translateEnabled = () => hasSecret('DEEPL_API_KEY')
const hashOf = (s: string) => createHash('sha256').update(s).digest('hex')

export async function translateTexts(texts: string[], target: Target): Promise<Translation[]> {
  const db = useDatabase()
  const out: (Translation | null)[] = texts.map(() => null)
  const missing: number[] = []
  for (let i = 0; i < texts.length; i++) {
    const r = (await db.sql`SELECT text, source_lang FROM translation_cache WHERE hash = ${hashOf(texts[i]!)} AND target = ${target}`).rows[0] as any
    if (r) out[i] = { text: String(r.text), sourceLang: String(r.source_lang), translated: String(r.source_lang) !== target }
    else missing.push(i)
  }
  if (missing.length) {
    const key = getSecret('DEEPL_API_KEY')
    const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
    const res = await fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { 'Authorization': `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: missing.map(i => texts[i]), target_lang: target === 'en' ? 'EN-GB' : 'FR' }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null)
    if (!res) throw createError({ statusCode: 502, statusMessage: 'DeepL injoignable' })
    if (res.status === 403) throw createError({ statusCode: 502, statusMessage: 'Clé DeepL refusée (Réglages › Connexions › Traduction)' })
    if (res.status === 456) throw createError({ statusCode: 502, statusMessage: 'Quota DeepL du mois atteint' })
    if (!res.ok) throw createError({ statusCode: 502, statusMessage: `DeepL : erreur ${res.status}` })
    const j = await res.json() as { translations: { text: string; detected_source_language: string }[] }
    const now = new Date().toISOString()
    for (let k = 0; k < missing.length; k++) {
      const i = missing[k]!, tr = j.translations[k]!
      const src = String(tr.detected_source_language || '').toLowerCase()
      const text = src === target ? texts[i]! : tr.text
      await db.sql`INSERT OR REPLACE INTO translation_cache (hash, target, source_lang, text, created_at) VALUES (${hashOf(texts[i]!)}, ${target}, ${src}, ${text}, ${now})`
      out[i] = { text, sourceLang: src, translated: src !== target }
    }
  }
  return out as Translation[]
}
