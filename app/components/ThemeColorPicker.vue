<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton color="neutral" variant="ghost" icon="i-lucide-palette" :aria-label="t('admin.theme.label')" :loading="busy" />
  </UDropdownMenu>
</template>

<script setup lang="ts">
const { t } = useI18n()
// Couleur d'accent de l'appli (boutons, liens...) : un seul réglage, partagé par toute l'équipe, enregistré en base (server/api/theme.*).
const COLORS = ['green', 'blue', 'violet', 'rose', 'amber', 'teal'] as const

// Thème pré-rempli avec les couleurs relevées sur le livret d'accueil Canva (Gaston) : terracotta + bleu nuit.
const PRESET = { primary: 'terracotta', neutral: 'navy' }

const appConfig = useAppConfig()
const { theme, refresh } = useTheme()
const busy = ref(false)

async function choose(primary: string, neutral?: string) {
  appConfig.ui.colors.primary = primary
  appConfig.ui.colors.neutral = neutral ?? 'slate'
  busy.value = true
  try { await $fetch('/api/theme', { method: 'PUT', body: { primaryColor: primary, neutralColor: neutral ?? 'slate' } }) }
  finally { busy.value = false; await refresh() }
}

const items = computed(() => [
  [{
    label: t('admin.theme.preset'),
    icon: 'i-lucide-sparkles' as const,
    checked: theme.value?.primaryColor === PRESET.primary && theme.value?.neutralColor === PRESET.neutral,
    type: 'checkbox' as const,
    onSelect: () => choose(PRESET.primary, PRESET.neutral),
  }],
  COLORS.map(c => ({
    label: t(`admin.theme.${c}`),
    checked: theme.value?.primaryColor === c && theme.value?.neutralColor === 'slate',
    type: 'checkbox' as const,
    onSelect: () => choose(c),
  })),
])
</script>
