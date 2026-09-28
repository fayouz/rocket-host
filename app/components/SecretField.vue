<template>
  <!-- Champ secret en ecriture seule : on n'affiche jamais la valeur, seulement « ••••1234 » ; « Remplacer » ouvre la saisie -->
  <UFormField :label="label" :help="help">
    <div v-if="!editing" class="flex flex-wrap items-center gap-2">
      <code v-if="status.set" class="rounded bg-elevated px-2 py-1 text-sm">••••{{ status.hint || '' }}</code>
      <span v-else class="text-sm text-muted">non renseigné</span>
      <UBadge v-if="status.source === 'env'" size="sm" color="warning" variant="subtle" label="lu dans .env (à importer)" />
      <UBadge v-if="status.error" size="sm" color="error" variant="subtle" :label="status.error" />
      <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" :label="status.set ? 'Remplacer' : 'Renseigner'" @click="editing = true" />
      <UButton v-if="status.source === 'db'" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" label="Effacer" @click="emit('save', null)" />
    </div>
    <div v-else class="flex flex-wrap items-center gap-2">
      <UInput v-model="value" type="password" autocomplete="new-password" class="min-w-64 flex-1" placeholder="Nouvelle valeur" />
      <UButton size="sm" icon="i-lucide-check" label="Enregistrer" :disabled="!value.trim()" @click="save" />
      <UButton size="sm" color="neutral" variant="ghost" label="Annuler" @click="cancel" />
    </div>
  </UFormField>
</template>

<script setup lang="ts">
defineProps<{ label: string; help?: string; status: { set: boolean; hint: string; source: string; error?: string } }>()
const emit = defineEmits<{ save: [value: string | null] }>()
const editing = ref(false)
const value = ref('')
const cancel = () => { editing.value = false; value.value = '' }
function save() { emit('save', value.value); cancel() }
</script>
