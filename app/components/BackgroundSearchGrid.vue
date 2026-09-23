<template>
  <div class="space-y-2">
    <div class="flex gap-2">
      <UInput v-model="q" placeholder="Rechercher une image (ex. plage, montagne, forêt…)" class="w-full" @keyup.enter="search" />
      <UButton icon="i-lucide-search" label="Chercher" :loading="busy" @click="search" />
    </div>
    <p class="text-xs text-muted">Images du domaine public (Openverse), sans compte ni clé, aucune attribution requise.</p>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
    <div v-if="results.length" class="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <button
        v-for="r in results" :key="r.id" type="button"
        class="group relative aspect-video overflow-hidden rounded-lg ring ring-default"
        :title="r.title" @click="$emit('pick', r)"
      >
        <img :src="r.thumbnail" :alt="r.title" class="size-full object-cover transition group-hover:scale-105">
        <span class="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex">
          <UIcon name="i-lucide-check" class="size-6 text-white" />
        </span>
      </button>
    </div>
    <p v-else-if="searched && !busy" class="text-sm text-muted">Aucun résultat.</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ searchUrl: string }>()
defineEmits<{ pick: [{ id: string; url: string; thumbnail: string; title: string; attribution: string }] }>()

const q = ref('')
const busy = ref(false)
const searched = ref(false)
const error = ref('')
const results = ref<{ id: string; url: string; thumbnail: string; title: string; attribution: string }[]>([])

async function search() {
  if (!q.value.trim()) return
  busy.value = true; error.value = ''; searched.value = true
  try { results.value = await $fetch(props.searchUrl, { query: { q: q.value } }) }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec de la recherche.' }
  busy.value = false
}
</script>
