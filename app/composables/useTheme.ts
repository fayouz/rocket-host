// Couleurs de l'appli (accent + neutre) : chargées une fois depuis la base et appliquées partout, pour toute l'équipe.
export function useTheme() {
  const appConfig = useAppConfig()
  const { data: theme, refresh } = useFetch('/api/theme', { key: 'app-theme' })

  watch(theme, (t) => {
    if (!t) return
    appConfig.ui.colors.primary = t.primaryColor
    appConfig.ui.colors.neutral = t.neutralColor
  }, { immediate: true })

  return { theme, refresh }
}
