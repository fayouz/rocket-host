<template>
  <div class="mx-auto mt-10 max-w-sm">
    <div class="mb-4 text-center">
      <h1 class="text-2xl font-semibold">LoussaHousing</h1>
      <p class="text-sm text-muted">{{ info?.purpose === 'reset' ? 'Nouveau mot de passe' : 'Activation du compte' }}</p>
    </div>
    <UCard v-if="done">
      <p class="text-sm">Mot de passe enregistré. Tu peux maintenant te connecter avec l'identifiant <b>{{ info?.username }}</b>.</p>
      <UButton class="mt-3" block label="Aller à la connexion" to="/connexion" />
    </UCard>
    <UCard v-else-if="invalid">
      <p class="text-sm text-error" role="alert">{{ invalid }}</p>
      <p class="mt-2 text-sm text-muted">Demande un nouveau lien à l'administrateur.</p>
    </UCard>
    <UCard v-else-if="info">
      <form class="space-y-3" @submit.prevent="submit">
        <p class="text-sm">Bonjour <b>{{ info.displayName }}</b> — identifiant : <code>{{ info.username }}</code></p>
        <UFormField label="Nouveau mot de passe" hint="12 caractères au moins"><UInput v-model="password" type="password" autocomplete="new-password" class="w-full" /></UFormField>
        <UFormField label="Confirmer"><UInput v-model="confirm" type="password" autocomplete="new-password" class="w-full" /></UFormField>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <UButton type="submit" block label="Enregistrer le mot de passe" :loading="busy" :disabled="!password" />
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const route = useRoute()
const token = String(route.query.token ?? '')
const info = ref<{ username: string; displayName: string; purpose: string } | null>(null)
const invalid = ref('')
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')
const done = ref(false)
onMounted(async () => {
  try { info.value = await $fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`) }
  catch (e: any) { invalid.value = e?.data?.statusMessage || 'Lien invalide.' }
})
async function submit() {
  error.value = ''
  if (password.value !== confirm.value) { error.value = 'La confirmation ne correspond pas.'; return }
  busy.value = true
  try { await $fetch('/api/auth/activate', { method: 'POST', body: { token, password: password.value } }); done.value = true }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
  password.value = ''; confirm.value = ''
  busy.value = false
}
</script>
