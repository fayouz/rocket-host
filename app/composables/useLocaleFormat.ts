// Formats propres a la langue de l'interface (FR/EN) : dates, montants, nombres, « il y a ».
// Usage : const { fmtLocale, money, num, ago } = useLocaleFormat() ; date.toLocaleDateString(fmtLocale.value, {...})
export function useLocaleFormat() {
  const { locale, t } = useI18n()
  const fmtLocale = computed(() => (locale.value === 'en' ? 'en-GB' : 'fr-FR'))
  const money = (n: number, digits?: number) => n.toLocaleString(fmtLocale.value, { style: 'currency', currency: 'EUR', ...(digits !== undefined ? { minimumFractionDigits: digits, maximumFractionDigits: digits } : {}) })
  const num = (n: number, opts: Intl.NumberFormatOptions = {}) => n.toLocaleString(fmtLocale.value, opts)
  function ago(iso: string | null | undefined): string {
    if (!iso) return t('time.unknown')
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (min < 1) return t('time.now')
    if (min < 60) return t('time.min', { n: min })
    const h = Math.round(min / 60)
    if (h < 24) return t('time.hours', { n: h })
    return t('time.days', { n: Math.round(h / 24) })
  }
  return { fmtLocale, money, num, ago }
}
