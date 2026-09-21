<template>
  <div v-if="data" class="space-y-2">
    <h2 class="section-title !mt-0">Logements</h2>
    <UCard v-for="l in data.logements" :key="l.id">
      <UFormField :label="l.lodgifyName ? `Associé à Lodgify : ${l.lodgifyName}` : 'Non associé à Lodgify'" class="w-full">
        <UInput v-model="l.name" placeholder="Nom du logement" class="w-full" @change="rename(l)" />
      </UFormField>
      <p v-if="l.lodgifyShortName && l.lodgifyShortName !== l.name" class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        Nom court dans Lodgify : <b>{{ l.lodgifyShortName }}</b>
        <UButton size="xs" color="neutral" variant="outline" label="Utiliser ce nom" @click="syncName(l)" />
      </p>
    </UCard>
    <h2 class="section-title">Serrures Nuki</h2>
    <UCard v-for="l in data.locks" :key="l.id">
      <UFormField :label="`Serrure « ${l.name} »`" class="w-full">
        <USelect v-model="links[l.id]" :items="options" class="w-full" @update:model-value="saveLock(l.id)" />
      </UFormField>
    </UCard>
    <p class="text-sm text-muted">{{ error || (saved ? 'Enregistré ✓' : 'Les changements sont enregistrés automatiquement.') }}</p>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/settings')
const saved = ref(false)
const error = ref('')
// 0 = aucun logement (USelect n'accepte pas null comme valeur d'option) ; la valeur est l'id Lodgify du logement
const links = reactive<Record<number, number>>(Object.fromEntries((data.value?.locks ?? []).map(l => [l.id, l.propertyId ?? 0])))
const options = computed(() => [{ label: '— aucun logement —', value: 0 }, ...(data.value?.logements ?? []).filter(l => l.lodgifyPropertyId).map(l => ({ label: l.name, value: l.lodgifyPropertyId as number }))])
async function send(url: string, body: object) {
  error.value = ''
  try { await $fetch(url, { method: 'PUT', body }); saved.value = true; await refreshNuxtData('logements') }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec de l’enregistrement' }
}
const rename = (l: { id: number; name: string }) => send(`/api/logements/${l.id}`, { name: l.name })
const syncName = async (l: { id: number; name: string }) => {
  error.value = ''
  try { const r = await $fetch<{ name: string }>(`/api/logements/${l.id}/sync-name`, { method: 'POST' }); l.name = r.name; saved.value = true; await refreshNuxtData('logements') }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec de la synchronisation' }
}
const saveLock = (lockId: number) => send('/api/settings', { lockId, propertyId: links[lockId] || null })
</script>
