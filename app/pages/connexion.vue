<template>
  <div class="mx-auto mt-10 max-w-sm">
    <div class="mb-4 text-center">
      <h1 class="text-2xl font-semibold">LoussaHousing</h1>
      <p class="text-sm text-muted">Connexion</p>
    </div>
    <UCard>
      <div v-if="sso?.enabled" class="space-y-3" :class="{ 'mb-4': sso.localLogin }">
        <p v-if="loggedOut" class="text-sm text-muted">Tu es déconnecté.</p>
        <p v-if="ssoError" class="text-sm text-error" role="alert">{{ ssoError }}</p>
        <UButton block icon="i-lucide-rocket" label="Se connecter avec Rocket Auth" :to="`/api/auth/rocket/login?next=${encodeURIComponent(next)}`" external />
        <USeparator v-if="sso.localLogin" label="ou avec un compte local" />
      </div>
      <form v-if="!sso?.enabled || sso.localLogin" class="space-y-3" @submit.prevent="submit">
        <UFormField label="Identifiant"><UInput v-model="username" autocomplete="username" autofocus class="w-full" /></UFormField>
        <UFormField label="Mot de passe"><UInput v-model="password" type="password" autocomplete="current-password" class="w-full" /></UFormField>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <UButton type="submit" block label="Se connecter" :loading="busy" :disabled="!username || !password" />
        <UButton color="neutral" variant="link" block label="Mot de passe oublié ?" to="/mot-de-passe-oublie" />
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const route = useRoute()
const username = ref('')
const password = ref('')
// Rocket Auth (connexion unique) : bouton affiche seulement si ROCKET_AUTH_URL est renseigne cote serveur
const { data: sso } = await useFetch<{ enabled: boolean; localLogin: boolean }>('/api/auth/rocket/config', { default: () => ({ enabled: false, localLogin: true }) })
const ssoError = computed(() => String(route.query.sso_error ?? '').slice(0, 200))
const loggedOut = computed(() => route.query.logged_out === '1')
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
