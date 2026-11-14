<template>
  <div class="mx-auto max-w-md space-y-3">
    <h1 class="text-xl font-semibold">{{ t('account.title') }}</h1>
    <UAlert v-if="forced" color="warning" variant="subtle" icon="i-lucide-shield-alert" :title="t('account.forcedTitle')"
            :description="t('account.forcedText')" />
    <UCard>
      <p class="text-sm"><b>{{ user?.displayName }}</b> · {{ t('account.summary', { username: user?.username, role: roleLabel }) }}</p>
    </UCard>
    <UCard>
      <template #header><b>{{ t('account.changePassword') }}</b></template>
      <form class="space-y-3" @submit.prevent="submit">
        <UFormField :label="t('account.current')"><UInput v-model="form.current" type="password" autocomplete="current-password" class="w-full" /></UFormField>
        <UFormField :label="t('account.new')" :hint="t('account.newHint')"><UInput v-model="form.next" type="password" autocomplete="new-password" class="w-full" /></UFormField>
        <UFormField :label="t('account.confirm')"><UInput v-model="form.confirm" type="password" autocomplete="new-password" class="w-full" /></UFormField>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <p v-if="done" class="text-sm text-success">{{ t('account.changed') }}</p>
        <UButton type="submit" :label="t('account.changePassword')" :loading="busy" :disabled="!form.current || !form.next" />
      </form>
    </UCard>
    <UCard>
      <template #header><b>{{ t('lang.label') }}</b></template>
      <LangSelect class="w-full" />
      <p class="mt-2 text-xs text-muted">{{ t('lang.help') }}</p>
    </UCard>
    <UButton color="neutral" variant="outline" icon="i-lucide-log-out" :label="t('auth.signOut')" @click="logout" />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { user, refresh, logout } = useAuth()
await refresh()
const forced = computed(() => route.query.force === '1' || user.value?.mustChange)
const roleLabel = computed(() => (user.value?.role ? t(`role.${user.value.role}`) : ''))
const form = reactive({ current: '', next: '', confirm: '' })
const busy = ref(false)
const error = ref('')
const done = ref(false)
async function submit() {
  error.value = ''; done.value = false
  if (form.next !== form.confirm) { error.value = t('account.mismatch'); return }
  busy.value = true
  try {
    await $fetch('/api/auth/password', { method: 'POST', body: { current: form.current, next: form.next } })
    Object.assign(form, { current: '', next: '', confirm: '' })
    done.value = true
    await refresh()
    if (route.query.force === '1') window.location.assign('/')
  } catch (e: any) { error.value = e?.data?.statusMessage || t('account.retry') }
  busy.value = false
}
</script>
