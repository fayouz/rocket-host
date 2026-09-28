<template>
  <div class="mx-auto mt-10 max-w-sm">
    <div class="mb-4 text-center">
      <h1 class="text-2xl font-semibold">Rocket Host</h1>
      <p class="text-sm text-muted">Mot de passe oublié</p>
    </div>
    <UCard v-if="sent">
      <p class="text-sm">Si un compte correspond à cet identifiant ou à cette adresse et possède une adresse e-mail, un message contenant un lien de réinitialisation (valable 1 heure) vient d'être envoyé.</p>
      <p class="mt-2 text-sm text-muted">Rien reçu ? Vérifie tes courriers indésirables, ou demande un lien à l'administrateur.</p>
      <UButton class="mt-3" color="neutral" variant="outline" block label="Retour à la connexion" to="/connexion" />
    </UCard>
    <UCard v-else>
      <form class="space-y-3" @submit.prevent="submit">
        <UFormField label="Identifiant ou adresse e-mail"><UInput v-model="identifier" autocomplete="username" autofocus class="w-full" /></UFormField>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <UButton type="submit" block label="Envoyer le lien" :loading="busy" :disabled="!identifier.trim()" />
        <UButton color="neutral" variant="link" block label="Retour à la connexion" to="/connexion" />
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const identifier = ref('')
const busy = ref(false)
const error = ref('')
const sent = ref(false)
async function submit() {
  busy.value = true; error.value = ''
  try { await $fetch('/api/auth/forgot', { method: 'POST', body: { identifier: identifier.value } }); sent.value = true }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
  busy.value = false
}
</script>
