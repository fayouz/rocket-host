// Connecteurs : un plugin de la bibliotheque configure pour un logement (table connector). Voir server/utils/plugins.ts.
import type { ConnectorContext, PluginDef } from './plugins'
import { readSecretVar, SECRET_VAR } from './plugins'
import { homeyPlugin } from './pluginHomey'
import { webServicePlugin } from './pluginWebService'

// Catalogue : ajouter un plugin = ajouter un fichier pluginXxx.ts et l'inscrire ici
export const PLUGINS: PluginDef[] = [homeyPlugin, webServicePlugin]
export const getPlugin = (id: string) => {
  const p = PLUGINS.find(x => x.id === id)
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Plugin inconnu' })
  return p
}

export interface ConnectorRow {
  id: number; logement_id: number; plugin_id: string; name: string; config_json: string; enabled: number
  created_at: string; updated_at: string; last_run_at: string | null; last_result: string
}

export async function getConnector(idParam: unknown): Promise<ConnectorRow> {
  const id = Number(idParam)
  const row = Number.isInteger(id) ? ((await useDatabase().sql`SELECT * FROM connector WHERE id = ${id}`).rows as any[])[0] : undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Connecteur introuvable' })
  return row as ConnectorRow
}

const parseConfig = (row: ConnectorRow) => { try { return JSON.parse(row.config_json) as Record<string, string> } catch { return {} } }

// Contexte passe au plugin : configuration + acces aux secrets (.env) designes par les champs secrets
export function contextOf(row: ConnectorRow): ConnectorContext {
  const plugin = getPlugin(row.plugin_id)
  const config = parseConfig(row)
  return {
    connectorId: row.id, logementId: Number(row.logement_id), config,
    secret: (key) => readSecretVar(config[key] ?? '', plugin.fields.find(f => f.key === key)?.label ?? key),
  }
}

// Configuration envoyee par le navigateur : seuls les champs du plugin sont gardes, textes bornes, secrets = noms de variables
export async function cleanConfig(plugin: PluginDef, raw: unknown, ctx: { logementId: number; connectorId: number }) {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const f of plugin.fields) {
    const v = typeof b[f.key] === 'string' ? (b[f.key] as string).trim() : ''
    if (f.type === 'select' && v && f.options && !f.options.some(o => o.value === v)) throw createError({ statusCode: 400, statusMessage: `« ${f.label} » : valeur invalide` })
    if (f.type === 'secret' && v && !SECRET_VAR.test(v)) throw createError({ statusCode: 400, statusMessage: `« ${f.label} » : le nom de variable doit commencer par CONNECTOR_ (majuscules, chiffres, _)` })
    const visible = !f.showIf || f.showIf.values.includes(typeof b[f.showIf.key] === 'string' ? (b[f.showIf.key] as string) : '')
    if (f.required && visible && !v) throw createError({ statusCode: 400, statusMessage: `« ${f.label} » est requis` })
    if (v) out[f.key] = v.slice(0, f.type === 'textarea' ? 4000 : 500)
  }
  return plugin.validate ? plugin.validate(out, ctx) : out
}

// Vue navigateur : configuration (sans aucun secret : seulement le nom de variable et s'il est renseigne dans .env)
export function connectorView(row: ConnectorRow) {
  const plugin = getPlugin(row.plugin_id)
  const config = parseConfig(row)
  const ctx = contextOf(row)
  return {
    id: row.id, logementId: Number(row.logement_id), pluginId: row.plugin_id, name: row.name, enabled: !!Number(row.enabled),
    config,
    secrets: Object.fromEntries(plugin.fields.filter(f => f.type === 'secret' && config[f.key]).map(f => [f.key, !!process.env[config[f.key]!]])),
    actions: plugin.actions ? plugin.actions(ctx) : [],
    lastRunAt: row.last_run_at, lastResult: row.last_result, updatedAt: row.updated_at,
  }
}

export async function recordRun(id: number, result: string) {
  await useDatabase().sql`UPDATE connector SET last_run_at = ${new Date().toISOString()}, last_result = ${result.slice(0, 300)} WHERE id = ${id}`
}

export const pluginView = (p: PluginDef) => ({ id: p.id, name: p.name, description: p.description, icon: p.icon, category: p.category, capabilities: p.capabilities, fields: p.fields })
