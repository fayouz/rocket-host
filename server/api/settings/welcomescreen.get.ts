export default defineEventHandler(async () => {
  const s = await getWelcomescreenSettings()
  return { hasBackground: !!(s.ext || s.webUrl), source: s.ext ? 'upload' : s.webUrl ? 'web' : '', webUrl: s.webUrl, attribution: s.attribution, animated: s.animated }
})
