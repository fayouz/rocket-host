export default defineEventHandler(async (event) => getLogement(getRouterParam(event, 'id')))
