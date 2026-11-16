<template>
  <div class="mx-auto mt-10 max-w-sm">
    <div class="mb-4 text-center">
      <h1 class="text-2xl font-semibold">{{ t('app.name') }}</h1>
      <p class="text-sm text-muted">{{ t('admin.forgot.title') }}</p>
    </div>
    <UCard v-if="sent">
      <p class="text-sm">{{ t('admin.forgot.sent') }}</p>
      <p class="mt-2 text-sm text-muted">{{ t('admin.forgot.nothing') }}</p>
      <UButton class="mt-3" color="neutral" variant="outline" block :label="t('admin.forgot.back')" to="/connexion" />
    </UCard>
    <UCard v-else>
      <form class="space-y-3" @submit.prevent="submit">
        <UFormField :label="t('admin.forgot.identifier')"><UInput v-model="identifier" autocomplete="username" autofocus class="w-full" /></UFormField>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <UButton type="submit" block :label="t('admin.forgot.send')" :loading="busy" :disabled="!identifier.trim()" />
        <UButton color="neutral" variant="link" block :label="t('admin.forgot.back')" to="/connexion" />
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
definePageMeta({ layout: 'bare' })
const identifier = ref('')
const busy = ref(false)
const error = ref('')
const sent = ref(false)
async function submit() {
  busy.value = true; error.value = ''
  try { await $fetch('/api/auth/forgot', { method: 'POST', body: { identifier: identifier.value } }); sent.value = true }
  catch (e: any) { error.value = e?.data?.statusMessage || t('account.retry') }
  busy.value = false
}
</script>
