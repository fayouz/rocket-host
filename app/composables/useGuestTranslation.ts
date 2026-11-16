// Traduction automatique des messages des voyageurs dans la langue de l'interface (DeepL cote serveur, cache en base).
// Seuls les messages du voyageur sont traduits ; « Voir l'original » / « Voir la traduction » par message.
type Msg = { key: string; from: string; text: string }
type Tr = { text: string; sourceLang: string; translated: boolean }

export function useGuestTranslation(messages: () => Msg[] | undefined) {
  const { locale } = useI18n()
  const { data: cfg } = useFetch<{ enabled: boolean }>('/api/translate', { key: 'translate-enabled', default: () => ({ enabled: false }) })
  const results = ref<Record<string, Tr>>({})
  const original = ref<Record<string, boolean>>({})
  const error = ref('')

  watch([() => (messages() ?? []).map(m => m.key + m.text.length).join(), locale, () => cfg.value?.enabled], async () => {
    error.value = ''
    if (!cfg.value?.enabled) return
    const todo = (messages() ?? []).filter(m => m.from === 'guest' && m.text.trim() && !results.value[`${locale.value}:${m.key}`])
    if (!todo.length) return
    try {
      const r = await $fetch<{ items: Tr[] }>('/api/translate', { method: 'POST', body: { texts: todo.map(m => m.text), target: locale.value } })
      const next = { ...results.value }
      todo.forEach((m, i) => { next[`${locale.value}:${m.key}`] = r.items[i]! })
      results.value = next
    } catch (e: any) { error.value = e?.data?.statusMessage || 'DeepL' }
  }, { immediate: true })

  const tr = (m: Msg) => results.value[`${locale.value}:${m.key}`]
  const isTranslated = (m: Msg) => !!tr(m)?.translated
  const showOriginal = (m: Msg) => !!original.value[m.key]
  const textOf = (m: Msg) => (isTranslated(m) && !showOriginal(m) ? tr(m)!.text : m.text)
  const toggle = (m: Msg) => { original.value = { ...original.value, [m.key]: !original.value[m.key] } }
  const sourceOf = (m: Msg) => (tr(m)?.sourceLang || '').toUpperCase()
  return { textOf, isTranslated, showOriginal, toggle, sourceOf, error }
}
