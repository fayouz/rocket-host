export default defineEventHandler(async (event) => searchBackgrounds(String(getQuery(event).q || '')))
