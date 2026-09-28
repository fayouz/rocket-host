// Ecriture seule : { settings?: { NOM: valeur }, secrets?: { NOM: valeur | null } } (null = effacer). Rien n'est renvoye des valeurs.
export default defineEventHandler(async (event) => {
  const b = await readBody(event).catch(() => null)
  const settings = b?.settings && typeof b.settings === 'object' ? Object.entries(b.settings as Record<string, unknown>) : []
  const secrets = b?.secrets && typeof b.secrets === 'object' ? Object.entries(b.secrets as Record<string, unknown>) : []
  if (!settings.length && !secrets.length) throw createError({ statusCode: 400, statusMessage: 'Rien à enregistrer' })
  for (const [name, v] of settings) if (typeof v !== 'string') throw createError({ statusCode: 400, statusMessage: `${name} : texte attendu` })
  for (const [name, v] of secrets) if (v !== null && typeof v !== 'string') throw createError({ statusCode: 400, statusMessage: `${name} : texte ou null attendu` })
  for (const [name, v] of settings) await setSetting(name, v as string)
  for (const [name, v] of secrets) await setSecret(name, v as string | null)
  // Journal : noms seulement, jamais les valeurs
  await audit(event, 'connexions_modifiees', [...settings.map(([n]) => n), ...secrets.map(([n, v]) => `${n}${v === null ? ' (effacé)' : ''}`)].join(', ').slice(0, 500))
  return { ok: true }
})
