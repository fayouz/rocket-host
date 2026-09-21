// Sert le fichier d'un document. Type fixe (jamais celui du navigateur), nosniff, PDF/images affiches dans le navigateur,
// le reste telecharge. ?download=1 force le telechargement.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

const MIME: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', csv: 'text/csv; charset=utf-8', txt: 'text/plain; charset=utf-8', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'docId'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const row = ((await useDatabase().sql`SELECT file_path, original_name FROM document WHERE id = ${id}`).rows as any[])[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Document inconnu' })
  const rel = String(row.file_path)
  const abs = absPath(rel)
  let size: number
  try { size = (await stat(abs)).size } catch { throw createError({ statusCode: 404, statusMessage: 'Fichier introuvable sur le disque' }) }
  const ext = rel.split('.').pop() || ''
  const asAttachment = getQuery(event).download === '1' || !isInline(rel)
  setHeader(event, 'content-type', MIME[ext] || 'application/octet-stream')
  setHeader(event, 'content-length', size)
  setHeader(event, 'content-disposition', `${asAttachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(String(row.original_name))}`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'private, no-store')
  return sendStream(event, createReadStream(abs))
})
