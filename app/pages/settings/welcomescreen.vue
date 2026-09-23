<template>
  <div v-if="data" class="max-w-2xl space-y-3">
    <h2 class="section-title !mt-0">Livret & écran TV</h2>
    <p class="text-sm text-muted">Fond par défaut pour le livret d'accueil et l'écran TV de tous les logements. Chaque logement peut le garder, le remplacer par son propre fond, ou forcer l'absence de fond (page de son livret).</p>

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
