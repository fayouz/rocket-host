<template>
  <div v-if="data" class="max-w-2xl space-y-3">
    <h2 class="section-title !mt-0">Livret & écran TV</h2>
    <p class="text-sm text-muted">Fond par défaut pour le livret d'accueil et l'écran TV de tous les logements. Chaque logement peut le garder, le remplacer par son propre fond, ou forcer l'absence de fond (page de son livret).</p>

    <UCard v-if="stats">
      <template #header><b>Tableau de bord</b></template>
      <p class="text-xs text-muted">Ouvertures du livret voyageur (page mobile) par logement. L'écran TV n'est pas compté : il s'auto-rafraîchit toutes les 10 minutes, ce qui fausserait le nombre de visites.</p>

      <div v-if="stats.totalByLogement.length" class="mt-3 space-y-2">
        <div v-for="l in stats.totalByLogement" :key="l.logementId" class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium">{{ l.name }}</span>
          <span class="text-sm text-muted">{{ l.g }} ouverture{{ l.g > 1 ? 's' : '' }}</span>
        </div>
      </div>
      <p v-else class="mt-3 text-sm text-muted">Aucune ouverture enregistrée pour l'instant.</p>

      <p class="mt-4 mb-1 text-xs font-medium text-muted">14 derniers jours</p>
      <div class="flex h-20 items-end gap-1">
        <div v-for="d in stats.dailyLast14" :key="d.day" class="group relative flex-1">
          <div class="rounded-t bg-primary/70" :style="{ height: `${barHeight(d.g)}%` }" />
          <span class="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-xs text-white group-hover:block">{{ d.day.slice(5) }} · {{ d.g }}</span>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header><b>Fond par défaut</b></template>
      <div v-if="data.hasBackground" class="mb-3 flex items-center gap-3">
        <img :src="previewUrl" alt="Fond actuel" class="h-24 w-40 rounded object-cover ring ring-default">
        <div class="space-y-1">
          <p class="text-sm">{{ data.source === 'upload' ? 'Image déposée' : 'Image du web' }}</p>
          <p v-if="data.attribution" class="text-xs text-muted">{{ data.attribution }}</p>
          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" label="Retirer" :loading="busy" @click="remove" />
        </div>
      </div>
      <p v-else class="mb-3 text-sm text-muted">Aucun fond par défaut : les livrets restent unis, sauf logement avec son propre fond.</p>

      <UCheckbox v-model="animated" label="Fond animé (léger effet de zoom/travelling)" @change="toggleAnimated" />

      <div class="mt-4 space-y-3">
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-image-up" label="Déposer une image" :loading="busy" @click="fileInput?.click()" />
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="upload">
        <BackgroundSearchGrid search-url="/api/settings/welcomescreen/search" @pick="pickWeb" />
      </div>
      <p v-if="error" class="mt-2 text-sm text-error">{{ error }}</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { data, refresh } = await useFetch('/api/settings/welcomescreen', { key: 'welcomescreen-settings' })
const { data: stats } = await useFetch('/api/settings/welcomescreen/stats', { key: 'welcomescreen-stats' })
const barHeight = (n: number) => {
  const max = Math.max(1, ...(stats.value?.dailyLast14.map(d => d.g) ?? [1]))
  return Math.max(4, Math.round((n / max) * 100))
}
const animated = ref(false)
watch(() => data.value?.animated, (v) => { if (v !== undefined) animated.value = v }, { immediate: true })

const version = ref(0)
const previewUrl = computed(() => data.value?.source === 'web' ? data.value.webUrl : `/api/bg-default?v=${version.value}`)
const fileInput = ref<HTMLInputElement>()
const busy = ref(false)
const error = ref('')

async function upload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  busy.value = true; error.value = ''
  try {
    const body = new FormData(); body.append('file', file)
    await $fetch('/api/settings/welcomescreen/background', { method: 'POST', body })
  } catch (err: any) { error.value = err?.data?.statusMessage || 'Échec, réessaie.' }
  busy.value = false
  if (fileInput.value) fileInput.value.value = ''
  version.value++
  await refresh()
}

async function pickWeb(r: { url: string; attribution: string }) {
  busy.value = true; error.value = ''
  try { await $fetch('/api/settings/welcomescreen/background-web', { method: 'PUT', body: { url: r.url, attribution: r.attribution } }) }
  catch (err: any) { error.value = err?.data?.statusMessage || 'Échec, réessaie.' }
  busy.value = false
  version.value++
  await refresh()
}

async function remove() {
  if (!confirm('Retirer le fond par défaut ? Les logements sans fond propre reviendront à un fond uni.')) return
  busy.value = true
  try { await $fetch('/api/settings/welcomescreen/background', { method: 'DELETE' }) }
  finally { busy.value = false }
  version.value++
  await refresh()
}

async function toggleAnimated() {
  await $fetch('/api/settings/welcomescreen', { method: 'PUT', body: { animated: animated.value } })
}
</script>
