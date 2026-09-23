<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton color="neutral" variant="ghost" icon="i-lucide-palette" aria-label="Couleur du thème" />
  </UDropdownMenu>
</template>

<script setup lang="ts">
// Couleur d'accent de l'appli (boutons, liens...), choisie par le navigateur de chaque utilisateur (pas partagée).
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
const STORAGE_KEY = 'lh-theme-primary'
const STORAGE_KEY_NEUTRAL = 'lh-theme-neutral'

onMounted(() => {
  try {
    const savedPrimary = localStorage.getItem(STORAGE_KEY)
    const savedNeutral = localStorage.getItem(STORAGE_KEY_NEUTRAL)
    if (savedPrimary) appConfig.ui.colors.primary = savedPrimary
    if (savedNeutral) appConfig.ui.colors.neutral = savedNeutral
  } catch { /* stockage indisponible : couleurs par défaut */ }
})

function choose(primary: string, neutral?: string) {
  appConfig.ui.colors.primary = primary
  appConfig.ui.colors.neutral = neutral ?? 'slate'
  try {
    localStorage.setItem(STORAGE_KEY, primary)
    localStorage.setItem(STORAGE_KEY_NEUTRAL, neutral ?? 'slate')
  } catch { /* stockage indisponible : choix non mémorisé */ }
}

const items = computed(() => [
  [{
    label: PRESET.label,
    icon: 'i-lucide-sparkles' as const,
    checked: appConfig.ui.colors.primary === PRESET.primary && appConfig.ui.colors.neutral === PRESET.neutral,
    type: 'checkbox' as const,
    onSelect: () => choose(PRESET.primary, PRESET.neutral),
  }],
  COLORS.map(c => ({
    label: c.label,
    checked: appConfig.ui.colors.primary === c.name && appConfig.ui.colors.neutral === 'slate',
    type: 'checkbox' as const,
    onSelect: () => choose(c.name),
  })),
])
</script>
