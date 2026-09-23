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

const appConfig = useAppConfig()
const STORAGE_KEY = 'lh-theme-primary'

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && COLORS.some(c => c.name === saved)) appConfig.ui.colors.primary = saved
  } catch { /* stockage indisponible : couleur par défaut */ }
})

function choose(name: string) {
  appConfig.ui.colors.primary = name
  try { localStorage.setItem(STORAGE_KEY, name) } catch { /* stockage indisponible : choix non mémorisé */ }
}

const items = computed(() => [COLORS.map(c => ({
  label: c.label,
  checked: appConfig.ui.colors.primary === c.name,
  type: 'checkbox' as const,
  onSelect: () => choose(c.name),
}))])
</script>
