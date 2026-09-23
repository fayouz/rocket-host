<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton color="neutral" variant="ghost" icon="i-lucide-palette" aria-label="Couleur du thème" :loading="busy" />
  </UDropdownMenu>
</template>

<script setup lang="ts">
// Couleur d'accent de l'appli (boutons, liens...) : un seul réglage, partagé par toute l'équipe, enregistré en base (server/api/theme.*).
const COLORS = [
  { name: 'green', label: 'Vert' },
  { name: 'blue', label: 'Bleu' },
  { name: 'violet', label: 'Violet' },
  { name: 'rose', label: 'Rose' },
  { name: 'amber', label: 'Ambre' },
  { name: 'teal', label: 'Sarcelle' },
] as const

// Thème pré-rempli avec les couleurs relevées sur le livret d'accueil Canva (Gaston) : terracotta + bleu nuit.
const PRESET = { primary: 'terracotta', neutral: 'navy', label: 'Marque LoussaHousing' }

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
    label: PRESET.label,
    icon: 'i-lucide-sparkles' as const,
    checked: theme.value?.primaryColor === PRESET.primary && theme.value?.neutralColor === PRESET.neutral,
    type: 'checkbox' as const,
    onSelect: () => choose(PRESET.primary, PRESET.neutral),
  }],
  COLORS.map(c => ({
    label: c.label,
    checked: theme.value?.primaryColor === c.name && theme.value?.neutralColor === 'slate',
    type: 'checkbox' as const,
    onSelect: () => choose(c.name),
  })),
])
</script>
