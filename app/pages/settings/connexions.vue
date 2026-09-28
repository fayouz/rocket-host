<template>
  <div v-if="data" class="space-y-4">
    <h2 class="section-title !mt-0">Connexions</h2>
    <p class="text-sm text-muted">
      Adresses et jetons des briques Rocket et des services branchés. Les secrets sont chiffrés en base (AES-256-GCM) et ne sont jamais réaffichés :
      seuls leurs 4 derniers caractères apparaissent. Détails : docs/secrets.md.
    </p>
    <UAlert v-if="!data.keyPresent" color="error" variant="subtle" icon="i-lucide-key-round" title="Clé de chiffrement absente"
      description="ROCKET_SECRETS_KEY n'est pas définie dans l'environnement du serveur : les secrets ne peuvent pas être enregistrés." />
    <UAlert v-if="envCount" color="warning" variant="subtle" icon="i-lucide-file-warning" :title="`${envCount} valeur(s) encore lue(s) dans .env`"
      description="Lance « npm run secrets:import-env » sur le serveur pour les importer en base, puis retire-les de .env." />
    <p v-if="error" class="text-sm text-error">{{ error }}</p>

    <div class="grid gap-4 lg:grid-cols-2">
      <UCard v-for="g in data.groups" :key="g.key">
        <template #header>
          <h3 class="font-semibold">{{ g.title }}</h3>
          <p class="text-xs text-muted">{{ g.description }}</p>
        </template>
        <div class="space-y-3">
          <template v-for="e in data.entries.filter(x => x.group === g.key)" :key="e.name">
            <SecretField v-if="e.kind === 'secret'" :label="e.label" :help="e.help" :status="e as any" @save="v => save({ secrets: { [e.name]: v } })" />
            <UFormField v-else :label="e.label" :help="e.help">
              <div class="flex gap-2">
                <UInput v-model="form[e.name]" :placeholder="e.placeholder" class="flex-1" />
                <UButton size="sm" color="neutral" variant="outline" label="Enregistrer" :disabled="form[e.name] === (e as any).value" @click="save({ settings: { [e.name]: form[e.name] ?? '' } })" />
              </div>
            </UFormField>
          </template>
          <p v-if="g.key === 'mail'" class="text-xs text-muted"><NuxtLink to="/settings/imap" class="underline">Serveur, identifiant et règles de la boîte</NuxtLink></p>
          <p v-if="g.key === 'homey'" class="text-xs text-muted">Adresse du Homey et mode (local/cloud) : réglages du logement › Domotique.</p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="font-semibold">Secrets des connecteurs</h3>
          <p class="text-xs text-muted">Jetons des connecteurs « Service web »… : le connecteur indique le nom (CONNECTOR_…), la valeur se saisit ici.</p>
        </template>
        <div class="space-y-3">
          <SecretField v-for="s in data.connectorSecrets" :key="s.name" :label="s.name" :status="s" @save="v => save({ secrets: { [s.name]: v } })" />
          <div class="flex flex-wrap gap-2">
            <UInput v-model="newName" placeholder="CONNECTOR_MON_SERVICE" class="w-60" />
            <UInput v-model="newValue" type="password" autocomplete="new-password" placeholder="Valeur" class="flex-1" />
            <UButton size="sm" icon="i-lucide-plus" label="Ajouter" :disabled="!/^CONNECTOR_[A-Z0-9_]{1,60}$/.test(newName) || !newValue.trim()" @click="addConnector" />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data, refresh } = await useFetch('/api/settings/connexions')
const form = reactive<Record<string, string>>({})
const error = ref('')
const newName = ref(''), newValue = ref('')
watchEffect(() => { for (const e of data.value?.entries ?? []) if (e.kind === 'setting') form[e.name] = String((e as any).value ?? '') })
const envCount = computed(() => [...(data.value?.entries ?? []), ...(data.value?.connectorSecrets ?? [])].filter(e => (e as any).source === 'env').length)
async function save(body: { settings?: Record<string, string>; secrets?: Record<string, string | null> }) {
  error.value = ''
  if (body.secrets && Object.values(body.secrets).includes(null) && !confirm('Effacer ce secret ? Le service concerné cessera de fonctionner.')) return
  try { await $fetch('/api/settings/connexions', { method: 'PUT', body }); await refresh() } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
}
async function addConnector() { await save({ secrets: { [newName.value]: newValue.value } }); newName.value = ''; newValue.value = '' }
</script>
