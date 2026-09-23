// Remplace la liste des appareils mis a disposition du voyageur pour ce logement.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const body = ((await readBody(event)) ?? {}) as { devices?: unknown }
  const list = Array.isArray(body.devices) ? body.devices : []
  const devices = list.map((d: any) => ({
    deviceId: String(d?.deviceId || ''), deviceName: String(d?.deviceName || ''), deviceClass: String(d?.deviceClass || ''),
    minTemp: d?.minTemp === undefined || d?.minTemp === null || d?.minTemp === '' ? undefined : Number(d.minTemp),
    maxTemp: d?.maxTemp === undefined || d?.maxTemp === null || d?.maxTemp === '' ? undefined : Number(d.maxTemp),
  })).filter((d: { deviceId: string }) => d.deviceId)
  await setGuestDevices(lg.id, devices)
  return { ok: true }
})
