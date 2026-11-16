<template>
  <div class="mx-auto mt-10 max-w-sm">
    <div class="mb-4 text-center">
      <h1 class="text-2xl font-semibold">{{ t('app.name') }}</h1>
      <p class="text-sm text-muted">{{ info?.purpose === 'reset' ? t('admin.activation.resetTitle') : t('admin.activation.title') }}</p>
    </div>
    <UCard v-if="done">
      <i18n-t keypath="admin.activation.done" tag="p" class="text-sm"><template #username><b>{{ info?.username }}</b></template></i18n-t>
      <UButton class="mt-3" block :label="t('admin.activation.goLogin')" to="/connexion" />
    </UCard>
    <UCard v-else-if="invalid">
      <p class="text-sm text-error" role="alert">{{ invalid }}</p>
      <p class="mt-2 text-sm text-muted">{{ t('admin.activation.askNew') }}</p>
    </UCard>
    <UCard v-else-if="info">
      <form class="space-y-3" @submit.prevent="submit">
        <i18n-t keypath="admin.activation.hello" tag="p" class="text-sm"><template #name><b>{{ info.displayName }}</b></template><template #username><code>{{ info.username }}</code></template></i18n-t>
        <UFormField :label="t('account.new')" :hint="t('account.newHint')"><UInput v-model="password" type="password" autocomplete="new-password" class="w-full" /></UFormField>
        <UFormField :label="t('admin.activation.confirm')"><UInput v-model="confirm" type="password" autocomplete="new-password" class="w-full" /></UFormField>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <UButton type="submit" block :label="t('admin.activation.submit')" :loading="busy" :disabled="!password" />
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
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
  catch (e: any) { invalid.value = e?.data?.statusMessage || t('admin.activation.invalid') }
})
async function submit() {
  error.value = ''
  if (password.value !== confirm.value) { error.value = t('admin.activation.mismatch'); return }
  busy.value = true
  try { await $fetch('/api/auth/activate', { method: 'POST', body: { token, password: password.value } }); done.value = true }
  catch (e: any) { error.value = e?.data?.statusMessage || t('account.retry') }
  password.value = ''; confirm.value = ''
  busy.value = false
}
</script>
