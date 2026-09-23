// Validation partagee des images de fond deposees (livret/ecran TV, general et par logement).
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

export const BG_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
export const BG_MAX = 8 * 1024 * 1024 // 8 Mo

export const bgRoot = () => resolve(process.cwd(), '.data', 'backgrounds')
export function bgPath(key: string, ext: string) {
  const abs = resolve(bgRoot(), `${key}.${ext}`)
  if (!abs.startsWith(bgRoot() + sep)) throw createError({ statusCode: 400, statusMessage: 'Chemin invalide' })
  return abs
}

const startsWith = (buf: Buffer, bytes: number[]) => bytes.every((b, i) => buf[i] === b)
function magicOk(ext: string, buf: Buffer) {
  if (ext === 'png') return startsWith(buf, [0x89, 0x50, 0x4e, 0x47])
  if (ext === 'jpg' || ext === 'jpeg') return startsWith(buf, [0xff, 0xd8, 0xff])
  if (ext === 'webp') return startsWith(buf, [0x52, 0x49, 0x46, 0x46])
  return false
}

// Enregistre le fichier sous <key>.<ext>, retire l'ancien s'il avait une autre extension. Retourne l'extension retenue.
export async function saveBackgroundFile(key: string, filename: string, data: Buffer, previousExt: string): Promise<string> {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (!BG_TYPES[ext]) throw createError({ statusCode: 400, statusMessage: 'Image acceptée : PNG, JPG ou WebP' })
  if (!data.length || data.length > BG_MAX) throw createError({ statusCode: 413, statusMessage: 'Image vide ou trop volumineuse (8 Mo maximum)' })
  if (!magicOk(ext, data)) throw createError({ statusCode: 400, statusMessage: `Le contenu ne correspond pas à une image .${ext}` })
  await mkdir(bgRoot(), { recursive: true })
  await writeFile(bgPath(key, ext), data)
  if (previousExt && previousExt !== ext) await unlink(bgPath(key, previousExt)).catch(() => {})
  return ext
}

export async function removeBackgroundFile(key: string, ext: string) {
  if (!ext) return
  await unlink(bgPath(key, ext)).catch(() => {})
}
