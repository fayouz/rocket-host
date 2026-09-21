// Depose un ou plusieurs fichiers (multipart) : champs logement, parent? (id de dossier) et file (repetable).
// Un nom deja pris devient « nom 2.ext ». Chaque fichier est verifie (type, contenu, taille) ; les refus sont listes sans bloquer les autres.
export default defineEventHandler(async (event) => {
  if (Number(getHeader(event, 'content-length') || 0) > 10 * MAX_SIZE) throw createError({ statusCode: 413, statusMessage: 'Envoi trop volumineux' })
  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Fichier requis' })
  const field = (n: string) => parts.find(p => p.name === n && !p.filename)?.data.toString('utf8')
  const lg = await getLogement(field('logement'))
  const parentRaw = field('parent')
  const parent = parentRaw ? Number(parentRaw) : null
  await checkParent(lg.id, parent)
  const files = parts.filter(p => p.name === 'file' && p.filename)
  if (!files.length) throw createError({ statusCode: 400, statusMessage: 'Fichier requis' })
  if (files.length > 30) throw createError({ statusCode: 400, statusMessage: '30 fichiers au plus par envoi' })
  const db = useDatabase()
  const added: number[] = []
  const errors: string[] = []
  for (const f of files) {
    const display = cleanName(f.filename!)
    let saved: Awaited<ReturnType<typeof saveFile>> | undefined
    try {
      saved = await saveFile(lg.id, f.filename!, f.data)
      const name = await freeName(lg.id, parent, checkName(display))
      const now = new Date().toISOString()
      const r = await db.sql`INSERT INTO fs_node (logement_id, parent_id, kind, name, file_path, mime, size, created_at, updated_at)
        VALUES (${lg.id}, ${parent}, 'file', ${name}, ${saved.rel}, ${saved.mime}, ${saved.size}, ${now}, ${now})`
      added.push(Number(r.lastInsertRowid))
    } catch (e: any) {
      if (saved) await removeFile(saved.rel)
      errors.push(`${display} : ${e?.statusMessage || e?.message || 'échec'}`)
    }
  }
  return { ok: !!added.length, added: added.length, errors }
})
