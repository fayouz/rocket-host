// Météo du logement (widget du livret/écran TV) : Open-Meteo, gratuit, sans clé. Cache en mémoire (30 min) par coordonnées.
// Le code meteo est traduit cote client (app/composables/useGuestLang.ts), selon la langue du voyageur.
export interface Weather { tempC: number; code: number; isDay: boolean }

const cache = new Map<string, { at: number; data: Weather }>()

export async function getWeather(lat: number, lon: number): Promise<Weather | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.data
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`
    const r = await fetch(url)
    if (!r.ok) return hit?.data ?? null
    const j = await r.json() as any
    const data: Weather = { tempC: Math.round(j.current.temperature_2m), code: Number(j.current.weather_code), isDay: j.current.is_day === 1 }
    cache.set(key, { at: Date.now(), data })
    return data
  } catch { return hit?.data ?? null }
}
