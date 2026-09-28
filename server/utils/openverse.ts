// Recherche d'images libres de droits (Openverse : api.openverse.org, agrégateur public, aucun compte ni clé nécessaire).
// Filtre restreint au domaine public (cc0, pdm) : aucune attribution requise, donc rien à créditer sur les pages voyageur.
export interface BackgroundCandidate { id: string; url: string; thumbnail: string; title: string; attribution: string }

export async function searchBackgrounds(query: string): Promise<BackgroundCandidate[]> {
  const q = query.trim().slice(0, 100)
  if (!q) return []
  const url = `https://api.openverse.org/v1/images/?${new URLSearchParams({ q, license: 'cc0,pdm', page_size: '15', mature: 'false' })}`
  const r = await fetch(url, { headers: { 'User-Agent': 'RocketHost/1.0 (welcomescreen backgrounds)' } })
  if (!r.ok) throw createError({ statusCode: 502, statusMessage: `Openverse ${r.status}` })
  const j = await r.json() as any
  const results = Array.isArray(j.results) ? j.results : []
  return results
    .filter((x: any) => typeof x.url === 'string' && x.url)
    .slice(0, 12)
    .map((x: any): BackgroundCandidate => ({
      id: String(x.id),
      url: String(x.url),
      thumbnail: String(x.thumbnail || x.url),
      title: String(x.title || 'Sans titre').slice(0, 120),
      attribution: `${x.title || 'Sans titre'} — ${x.creator || 'inconnu'} (${x.source || x.provider || ''}, domaine public)`.slice(0, 200),
    }))
}
