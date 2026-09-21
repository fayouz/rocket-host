<template>
  <div class="mx-auto max-w-md space-y-3">
    <h1 class="text-xl font-semibold">Mon compte</h1>
    <UAlert v-if="forced" color="warning" variant="subtle" icon="i-lucide-shield-alert" title="Choisis un nouveau mot de passe"
            description="Ce compte utilise un mot de passe provisoire : tu dois le remplacer avant de continuer." />
    <UCard>
      <p class="text-sm"><b>{{ user?.displayName }}</b> · identifiant <code>{{ user?.username }}</code> · rôle {{ roleLabel }}</p>
    </UCard>
    <UCard>
      <template #header><b>Changer le mot de passe</b></template>
      <form class="space-y-3" @submit.prevent="submit">
        <UFormField label="Mot de passe actuel"><UInput v-model="form.current" type="password" autocomplete="current-password" class="w-full" /></UFormField>
        <UFormField label="Nouveau mot de passe" hint="12 caractères au moins"><UInput v-model="form.next" type="password" autocomplete="new-password" class="w-full" /></UFormField>
        <UFormField label="Confirmer le nouveau mot de passe"><UInput v-model="form.confirm" type="password" autocomplete="new-password" class="w-full" /></UFormField>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <p v-if="done" class="text-sm text-success">Mot de passe changé. Les autres sessions ouvertes ont été fermées.</p>
        <UButton type="submit" label="Changer le mot de passe" :loading="busy" :disabled="!form.current || !form.next" />
      </form>
    </UCard>
    <UButton color="neutral" variant="outline" icon="i-lucide-log-out" label="Se déconnecter" @click="logout" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { user, refresh, logout } = useAuth()
await refresh()
const forced = computed(() => route.query.force === '1' || user.value?.mustChange)
const roleLabel = computed(() => ({ admin: 'administrateur', gestionnaire: 'gestionnaire', comptable: 'comptable (lecture)', menage: 'ménage' } as Record<string, string>)[user.value?.role ?? ''] ?? '')
const form = reactive({ current: '', next: '', confirm: '' })
const busy = ref(false)
const error = ref('')
const done = ref(false)
async function submit() {
  error.value = ''; done.value = false
  if (form.next !== form.confirm) { error.value = 'La confirmation ne correspond pas au nouveau mot de passe.'; return }
  busy.value = true
  try {
    await $fetch('/api/auth/password', { method: 'POST', body: { current: form.current, next: form.next } })
    Object.assign(form, { current: '', next: '', confirm: '' })
    done.value = true
    await refresh()
    if (route.query.force === '1') window.location.assign('/')
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
  busy.value = false
}
</script>
