// Renomme et/ou deplace un element : { name?, parent? } (parent null = racine du logement). Meme logement uniquement.
export default defineEventHandler(async (event) => {
  const node = await getNode(getRouterParam(event, 'id'))
  const b = (await readBody(event)) ?? {}
  const lgId = Number(node.logement_id)
  const parent = b.parent === undefined ? (node.parent_id === null ? null : Number(node.parent_id)) : (b.parent === null || b.parent === '' ? null : Number(b.parent))
  const name = b.name === undefined ? String(node.name) : checkName(b.name)

  if (parent !== (node.parent_id === null ? null : Number(node.parent_id))) {
    const depth = await checkParent(lgId, parent)
    if (node.kind === 'folder') {
      if (parent === Number(node.id) || (parent !== null && (await descendants(Number(node.id))).some(d => Number(d.id) === parent)))
        throw createError({ statusCode: 400, statusMessage: 'Impossible de déplacer un dossier dans lui-même' })
      // profondeur du sous-arbre deplace
      const kids = await descendants(Number(node.id))
      const depthOf = new Map<number, number>([[Number(node.id), 0]])
      let sub = 0
      for (const k of kids.sort((a, c) => Number(a.id) - Number(c.id))) { const d = (depthOf.get(Number(k.parent_id)) ?? 0) + 1; depthOf.set(Number(k.id), d); sub = Math.max(sub, d) }
      if (depth + 1 + sub > MAX_DEPTH) throw createError({ statusCode: 400, statusMessage: `Profondeur maximale atteinte (${MAX_DEPTH} niveaux)` })
    }
  }
  if (await nameTaken(lgId, parent, name, Number(node.id))) throw createError({ statusCode: 409, statusMessage: 'Un élément porte déjà ce nom dans ce dossier' })
  await useDatabase().sql`UPDATE fs_node SET name = ${name}, parent_id = ${parent}, updated_at = ${new Date().toISOString()} WHERE id = ${Number(node.id)}`
  return { ok: true }
})
