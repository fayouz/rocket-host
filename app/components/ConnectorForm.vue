<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <UFormField label="Nom du connecteur" class="sm:col-span-2">
      <UInput v-model="name" class="w-full" :placeholder="plugin.name" />
    </UFormField>
    <UFormField
      v-for="f in visibleFields" :key="f.key" :label="f.label" :required="f.required" :help="f.help"
      :class="f.type === 'textarea' || f.type === 'secret' ? 'sm:col-span-2' : ''"
    >
      <USelect v-if="f.type === 'select'" :model-value="config[f.key]" :items="optionsOf(f)" class="w-full" :placeholder="f.optionsFrom === 'homeys' ? (homeysError || 'Choisir…') : 'Choisir…'" @update:model-value="set(f.key, $event)" />
      <UTextarea v-else-if="f.type === 'textarea'" :model-value="config[f.key] ?? ''" :rows="3" autoresize class="w-full font-mono text-xs" :placeholder="f.placeholder" @update:model-value="set(f.key, $event)" />
      <div v-else-if="f.type === 'secret'" class="flex items-center gap-2">
        <UInput :model-value="config[f.key] ?? ''" class="w-full font-mono" :placeholder="f.placeholder" @update:model-value="set(f.key, String($event).toUpperCase())" />
        <UBadge
          v-if="config[f.key] && secrets[f.key] !== undefined" :color="secrets[f.key] ? 'success' : 'warning'" variant="subtle" class="shrink-0"
          :label="secrets[f.key] ? 'présente dans .env' : 'absente de .env'"
        />
      </div>
      <UInput v-else :model-value="config[f.key] ?? ''" class="w-full" :type="f.type === 'url' ? 'url' : 'text'" :placeholder="f.placeholder" @update:model-value="set(f.key, String($event))" />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
// Formulaire generique d'un connecteur : les champs viennent de la definition du plugin (server/utils/plugins.ts)
interface Field { key: string; label: string; type: string; required?: boolean; help?: string; placeholder?: string; options?: { label: string; value: string }[]; optionsFrom?: string; showIf?: { key: string; values: string[] } }
const props = defineProps<{ plugin: { name: string; fields: Field[] }; secrets: Record<string, boolean> }>()
const name = defineModel<string>('name', { required: true })
const config = defineModel<Record<string, string>>('config', { required: true })
const set = (k: string, v: unknown) => { config.value = { ...config.value, [k]: String(v ?? '') } }
const visibleFields = computed(() => props.plugin.fields.filter(f => !f.showIf || f.showIf.values.includes(config.value[f.showIf.key] ?? '')))

// Homey du compte connecte : charges seulement quand le champ est affiche (appel au compte Homey, pas aux appareils)
const homeys = ref<{ label: string; value: string }[]>([])
const homeysError = ref('')
const needHomeys = computed(() => visibleFields.value.some(f => f.optionsFrom === 'homeys'))
watch(needHomeys, async (need) => {
  if (!need || homeys.value.length) return
  try { homeys.value = (await $fetch<{ homeys: { id: string; name: string }[] }>('/api/homey/homeys')).homeys.map(h => ({ label: h.name, value: h.id })) }
  catch (e: any) { homeysError.value = e?.data?.statusMessage || 'Compte Homey non connecté (onglet Domotique)' }
}, { immediate: true })
const optionsOf = (f: Field) => f.optionsFrom === 'homeys' ? homeys.value : (f.options ?? [])
</script>
