// Couleurs de l'appli (accent + neutre) : un seul reglage partage par toute l'equipe, en base.
export interface AppTheme { primaryColor: string; neutralColor: string }

const PRIMARY = new Set(['green', 'blue', 'violet', 'rose', 'amber', 'teal', 'terracotta'])
const NEUTRAL = new Set(['slate', 'navy'])

export async function getTheme(): Promise<AppTheme> {
  const r = ((await useDatabase().sql`SELECT primary_color, neutral_color FROM app_theme WHERE id = 1`).rows as any[])[0]
  return { primaryColor: r?.primary_color || 'green', neutralColor: r?.neutral_color || 'slate' }
}

export async function saveTheme(input: Record<string, unknown>): Promise<AppTheme> {
  const primaryColor = PRIMARY.has(String(input.primaryColor)) ? String(input.primaryColor) : undefined
  const neutralColor = NEUTRAL.has(String(input.neutralColor)) ? String(input.neutralColor) : undefined
  if (!primaryColor && !neutralColor) throw createError({ statusCode: 400, statusMessage: 'Aucune valeur valide' })
  const db = useDatabase()
  if (primaryColor) await db.sql`UPDATE app_theme SET primary_color = ${primaryColor} WHERE id = 1`
  if (neutralColor) await db.sql`UPDATE app_theme SET neutral_color = ${neutralColor} WHERE id = 1`
  await db.sql`UPDATE app_theme SET updated_at = ${new Date().toISOString()} WHERE id = 1`
  return getTheme()
}
