export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  return { devices: await getGuestDevices(lg.id) }
})
