// Cree un dossier dans la boite (ecriture : CREATE cote serveur) : { name, parent? (chemin d'un dossier existant) }
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const cfg = await getImapConfig()
  const missing = need(cfg)
  if (missing) throw createError({ statusCode: 503, statusMessage: missing })
  const client = connect(cfg)
  client.on('error', () => {})
  try {
    await client.connect()
    const tree = await syncFolderTree(client, cfg)
    const name = safeFolderName(String(b.name ?? ''), tree.delimiter)
    const parent = typeof b.parent === 'string' && b.parent ? b.parent : ''
    if (parent && !tree.paths.includes(parent)) throw createError({ statusCode: 400, statusMessage: 'Dossier parent inconnu' })
    const path = parent ? joinPath(tree.delimiter, parent, name) : name
    if (tree.paths.includes(path)) throw createError({ statusCode: 409, statusMessage: 'Ce dossier existe déjà' })
    await client.mailboxCreate(path)
    await syncFolderTree(client, cfg)
    return { ok: true, path }
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({ statusCode: 502, statusMessage: errText(e) })
  } finally { await client.logout().catch(() => {}) }
})
