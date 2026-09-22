<template>
  <div v-if="data" class="max-w-2xl space-y-3">
    <h2 class="section-title !mt-0">Règlement intérieur</h2>
    <p class="text-sm text-muted">Affiché automatiquement dans le livret d'accueil du logement. Pas de synchronisation possible avec Lodgify (son API ne donne accès ni en lecture ni en écriture au champ équivalent, {{ rentalRulesTag }}) : si vous voulez qu'il apparaisse aussi dans vos messages automatiques Lodgify, recopiez-le à la main dans Rentals &gt; Messaging placeholders.</p>

    <UCard>
      <UTextarea v-model="form.houseRules" :rows="10" class="w-full" placeholder="Non fumeur, pas de fête, horaires de calme…" />
    </UCard>

    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-save" label="Enregistrer" :loading="busy" @click="save" />
      <span v-if="saved" class="text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> Enregistré</span>
      <span v-if="error" class="text-sm text-error">{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/livret`, { key: `livret-${route.params.id}` })

const rentalRulesTag = '{{RentalRules}}'
const form = reactive({ houseRules: '' })
watch(() => data.value?.content, (c) => { if (c) form.houseRules = c.houseRules }, { immediate: true })

const busy = ref(false)
const saved = ref(false)
const error = ref('')
async function save() {
  busy.value = true; error.value = ''; saved.value = false
  try {
    await $fetch(`/api/logements/${route.params.id}/livret`, { method: 'PUT', body: { houseRules: form.houseRules } })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
  busy.value = false
  await refresh()
}
</script>
