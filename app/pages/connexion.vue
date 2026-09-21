<template>
  <div class="mx-auto mt-10 max-w-sm">
    <div class="mb-4 text-center">
      <h1 class="text-2xl font-semibold">LoussaHousing</h1>
      <p class="text-sm text-muted">Connexion</p>
    </div>
    <UCard>
      <form class="space-y-3" @submit.prevent="submit">
        <UFormField label="Identifiant"><UInput v-model="username" autocomplete="username" autofocus class="w-full" /></UFormField>
        <UFormField label="Mot de passe"><UInput v-model="password" type="password" autocomplete="current-password" class="w-full" /></UFormField>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <UButton type="submit" block label="Se connecter" :loading="busy" :disabled="!username || !password" />
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const route = useRoute()
const username = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
// Page de retour : chemin interne seulement (jamais une adresse externe)
const next = computed(() => { const n = String(route.query.next ?? ''); return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/connexion') ? n : '/' })
async function submit() {
  busy.value = true; error.value = ''
  try {
    const r = await $fetch<{ mustChange: boolean }>('/api/auth/login', { method: 'POST', body: { username: username.value, password: password.value } })
    window.location.assign(r.mustChange ? '/mon-compte?force=1' : next.value) // rechargement complet : la session est lue côté serveur
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec de la connexion.' }
  password.value = ''
  busy.value = false
}
</script>
