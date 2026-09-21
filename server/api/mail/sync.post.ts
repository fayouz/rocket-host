// Synchronise les en-tetes des e-mails recents (lecture seule) et recalcule les associations
export default defineEventHandler(async () => syncMail())
