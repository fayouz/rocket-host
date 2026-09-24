// Sert un fichier importe (page Imports, y compris « a classer »). Type fixe (jamais celui du navigateur), nosniff, PDF/images affiches dans le navigateur,
// le reste telecharge. ?download=1 force le telechargement.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

const MIME: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', csv: 'text/csv; charset=utf-8', txt: 'text/plain; charset=utf-8', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }

export default defineEventHandler(async (event) => {
  const node = await getNode(getRouterParam(event, 'docId'))
  if (node.kind !== 'file' || !node.file_path) throw createError({ statusCode: 404, statusMessage: 'Fichier inconnu' })
  const rel = String(node.file_path)
  const abs = absPath(rel)
  let size: number
  try { size = (await stat(abs)).size } catch { throw createError({ statusCode: 404, statusMessage: 'Fichier introuvable sur le disque' }) }
  const ext = rel.split('.').pop() || ''
  const asAttachment = getQuery(event).download === '1' || !isInline(rel)
  setHeader(event, 'content-type', MIME[ext] || 'application/octet-stream')
  setHeader(event, 'content-length', size)
  setHeader(event, 'content-disposition', `${asAttachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(String(node.name))}`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'private, no-store')
  return sendStream(event, createReadStream(abs))
})
