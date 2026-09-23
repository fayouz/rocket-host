// Ecart de temps en francais, arrondi ("il y a 2 min") — pour afficher un horodatage serveur sans fabriquer de donnee.
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'inconnue'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}
