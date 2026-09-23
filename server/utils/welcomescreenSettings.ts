// Reglages generaux du livret/ecran TV (V3) : fond par defaut pour tous les logements, surchargeable par logement
// (voir server/utils/guestbook.ts). Un seul reglage, partage par toute l'equipe (comme les couleurs, server/utils/theme.ts).
const KEY = 'default'

export interface WelcomescreenSettings { ext: string; webUrl: string; attribution: string; animated: boolean }

async function getRow(): Promise<WelcomescreenSettings> {
  const r = ((await useDatabase().sql`SELECT background_ext, background_web_url, background_attribution, animated FROM welcomescreen_settings WHERE id = 1`).rows as any[])[0]
  return { ext: String(r?.background_ext || ''), webUrl: String(r?.background_web_url || ''), attribution: String(r?.background_attribution || ''), animated: !!r?.animated }
}
export const getWelcomescreenSettings = getRow

export async function saveDefaultBackground(filename: string, data: Buffer) {
  const row = await getRow()
  const ext = await saveBackgroundFile(KEY, filename, data, row.ext)
  await useDatabase().sql`UPDATE welcomescreen_settings SET background_ext = ${ext}, background_web_url = '', background_attribution = '', updated_at = ${new Date().toISOString()} WHERE id = 1`
}

export async function saveDefaultBackgroundWeb(url: string, attribution: string) {
  const row = await getRow()
  await removeBackgroundFile(KEY, row.ext)
  await useDatabase().sql`UPDATE welcomescreen_settings SET background_ext = '', background_web_url = ${url.slice(0, 500)}, background_attribution = ${attribution.slice(0, 300)}, updated_at = ${new Date().toISOString()} WHERE id = 1`
}

export async function removeDefaultBackground() {
  const row = await getRow()
  await removeBackgroundFile(KEY, row.ext)
  await useDatabase().sql`UPDATE welcomescreen_settings SET background_ext = '', background_web_url = '', background_attribution = '', updated_at = ${new Date().toISOString()} WHERE id = 1`
}

export async function setDefaultAnimated(animated: boolean) {
  await useDatabase().sql`UPDATE welcomescreen_settings SET animated = ${animated ? 1 : 0}, updated_at = ${new Date().toISOString()} WHERE id = 1`
}

export async function readDefaultBackgroundFile(): Promise<{ path: string; mime: string } | null> {
  const row = await getRow()
  if (!row.ext) return null
  return { path: bgPath(KEY, row.ext), mime: BG_TYPES[row.ext]! }
}

// Fond effectif des reglages generaux (utilise par guestbook.ts en cas d'heritage)
export async function getDefaultBackground(): Promise<{ url: string; animated: boolean } | null> {
  const row = await getRow()
  if (row.ext) return { url: '/api/bg-default', animated: row.animated }
  if (row.webUrl) return { url: row.webUrl, animated: row.animated }
  return null
}
