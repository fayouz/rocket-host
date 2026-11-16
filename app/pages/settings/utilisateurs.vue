<template>
  <div v-if="data" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">{{ t('admin.users.title') }}</h2>
      <UButton icon="i-lucide-user-plus" :label="t('admin.users.new')" @click="openCreate" />
    </div>
    <UTabs v-model="tab" :items="tabs" :content="false" />

    <template v-if="tab === 'comptes'">
      <i18n-t keypath="admin.users.intro" tag="p" class="text-sm text-muted">
        <template #noPassword><b>{{ t('admin.users.noPassword') }}</b></template>
        <template #link><b>{{ t('admin.users.oneTimeLink') }}</b></template>
      </i18n-t>
      <UCard v-for="u in data.users" :key="u.id" :class="{ 'opacity-60': !u.active }">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium">{{ u.displayName }} <span class="font-normal text-muted">· {{ u.username }}</span><span v-if="u.id === me?.id" class="ml-2 text-xs text-muted">{{ t('admin.users.you') }}</span></p>
            <p class="text-sm text-muted">{{ u.email || t('admin.users.noEmail') }} · {{ u.role === 'admin' ? t('admin.users.allLogements') : (u.logements.length ? u.logements.map(nameOf).join(', ') : t('admin.users.noLogement')) }}</p>
            <p class="text-xs text-muted">{{ u.lastLoginAt ? t('admin.users.lastLogin', { date: dt(u.lastLoginAt) }) : t('admin.users.neverLogged') }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <UBadge color="neutral" variant="outline" :label="roleLabel[u.role]" />
            <UBadge v-if="!u.active" color="neutral" :label="t('admin.users.disabled')" />
            <UBadge v-else-if="u.pending" color="warning" variant="subtle" :label="t('admin.users.pending')" />
            <UBadge v-else-if="u.mustChange" color="info" variant="subtle" :label="t('admin.users.tempPassword')" />
            <UBadge v-else color="success" variant="subtle" :label="t('admin.users.activeBadge')" />
          </div>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" :label="t('admin.users.edit')" @click="openEdit(u)" />
          <UButton v-if="u.active" size="xs" color="neutral" variant="outline" icon="i-lucide-link" :label="u.pending ? t('admin.users.inviteLink') : t('admin.users.resetPassword')" @click="invite(u, false)" />
          <UButton v-if="u.active && u.email" size="xs" color="neutral" variant="outline" icon="i-lucide-mail" :label="t('admin.users.sendEmail')" @click="invite(u, true)" />
          <UButton v-if="!u.pending" size="xs" color="neutral" variant="ghost" icon="i-lucide-log-out" :label="t('admin.users.revokeSessions')" @click="revoke(u)" />
          <UButton v-if="u.id !== me?.id" size="xs" color="neutral" variant="ghost" :icon="u.active ? 'i-lucide-user-x' : 'i-lucide-user-check'" :label="u.active ? t('admin.users.deactivate') : t('admin.users.reactivate')" @click="toggle(u)" />
          <UButton v-if="u.id !== me?.id" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :label="t('admin.common.delete')" @click="remove(u)" />
        </div>
      </UCard>
      <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
    </template>

    <template v-else>
      <p class="text-sm text-muted">{{ t('admin.users.auditIntro') }}</p>
      <UCard>
        <p v-if="!audit.length" class="text-sm text-muted">{{ t('admin.users.noEvents') }}</p>
        <ul class="divide-y divide-default text-sm">
          <li v-for="a in audit" :key="a.id" class="flex flex-wrap gap-x-3 py-1.5">
            <span class="w-36 shrink-0 text-muted">{{ dt(a.at) }}</span>
            <span class="w-40 shrink-0 font-medium">{{ actionLabel[a.action] ?? a.action }}</span>
            <span class="min-w-0 flex-1 truncate">{{ a.username || '—' }}<span v-if="a.detail" class="text-muted"> · {{ a.detail }}</span></span>
            <span class="text-xs text-muted">{{ a.ip }}</span>
          </li>
        </ul>
      </UCard>
    </template>

    <!-- Création / modification -->
    <UModal v-model:open="formOpen" :title="editingId ? t('admin.users.editTitle') : t('admin.users.new')">
      <template #body>
        <form class="space-y-3" @submit.prevent="save">
          <UFormField :label="t('auth.username')" :hint="editingId ? t('admin.users.usernameFixed') : t('admin.users.usernameRule')"><UInput v-model="form.username" :disabled="!!editingId" class="w-full" autocomplete="off" /></UFormField>
          <UFormField :label="t('admin.users.displayName')"><UInput v-model="form.displayName" class="w-full" /></UFormField>
          <UFormField :label="t('admin.users.email')" :hint="t('admin.users.emailHint')"><UInput v-model="form.email" type="email" class="w-full" /></UFormField>
          <UFormField :label="t('admin.users.role')"><USelect v-model="form.role" :items="roleItems" class="w-full" /></UFormField>
          <p class="text-xs text-muted">{{ roleHelp[form.role] }}</p>
          <UFormField v-if="form.role !== 'admin'" :label="t('admin.users.allowed')">
            <div class="flex flex-wrap gap-3">
              <label v-for="l in data.logements" :key="l.id" class="flex items-center gap-1.5 text-sm"><input v-model="form.logements" type="checkbox" :value="l.id"> {{ l.name }}</label>
            </div>
          </UFormField>
          <p v-if="formError" class="text-sm text-error" role="alert">{{ formError }}</p>
          <div class="flex gap-2">
            <UButton type="submit" :label="editingId ? t('admin.common.save') : t('admin.users.createGetLink')" :loading="busy" />
            <UButton color="neutral" variant="ghost" :label="t('admin.common.cancel')" @click="formOpen = false" />
          </div>
        </form>
      </template>
    </UModal>

    <!-- Lien d'invitation (affiché une seule fois) -->
    <UModal v-model:open="linkOpen" :title="linkInfo?.purpose === 'reset' ? t('admin.users.resetLinkTitle') : t('admin.users.inviteLink')">
      <template #body>
        <div v-if="linkInfo" class="space-y-3">
          <UAlert color="warning" variant="subtle" icon="i-lucide-triangle-alert" :title="t('admin.users.onlyOnce')"
                  :description="t('admin.users.linkWarning', { date: dt(linkInfo.expiresAt), name: linkInfo.name })" />
          <UInput :model-value="linkInfo.link" readonly class="w-full" @focus="($event.target as HTMLInputElement).select()" />
          <p v-if="linkInfo.emailSent" class="text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> {{ t('admin.users.sentTo', { email: linkInfo.email }) }}</p>
          <p v-if="linkInfo.emailError" class="text-sm text-error" role="alert">{{ t('admin.users.notSent', { error: linkInfo.emailError }) }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton icon="i-lucide-copy" :label="copied ? t('admin.users.copied') : t('admin.users.copy')" @click="copy" />
            <UButton color="neutral" variant="ghost" :label="t('admin.common.close')" @click="linkOpen = false" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
type Role = 'admin' | 'gestionnaire' | 'comptable' | 'menage'
const { user: me } = useAuth()
const { data, refresh } = await useFetch('/api/users')
const tab = ref(useRoute().query.tab === 'journal' ? 'journal' : 'comptes') // ?tab=journal : lien « Journal d'audit » du menu
const tabs = computed(() => [{ label: t('admin.users.tabAccounts'), icon: 'i-lucide-users', value: 'comptes' }, { label: t('admin.users.tabLog'), icon: 'i-lucide-scroll-text', value: 'journal' }])
const audit = ref<{ id: number; at: string; username: string; action: string; detail: string; ip: string }[]>([])
watch(tab, async (t) => { if (t === 'journal') audit.value = (await $fetch<{ entries: typeof audit.value }>('/api/audit')).entries }, { immediate: true })

const roleLabel = computed<Record<string, string>>(() => Object.fromEntries((['admin', 'gestionnaire', 'comptable', 'menage'] as Role[]).map(r => [r, t(`admin.users.roles.${r}`)])))
const roleHelp = computed<Record<string, string>>(() => Object.fromEntries((['admin', 'gestionnaire', 'comptable', 'menage'] as Role[]).map(r => [r, t(`admin.users.roleHelp.${r}`)])))
const roleItems = computed(() => (['admin', 'gestionnaire', 'comptable', 'menage'] as Role[]).map(r => ({ label: roleLabel.value[r]!, value: r })))
const nameOf = (id: number) => data.value?.logements.find(l => l.id === id)?.name ?? `#${id}`
const dt = (d: string) => new Date(d).toLocaleString(fmtLocale.value, { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const AUDIT_ACTIONS = ['connexion', 'connexion_echec', 'deconnexion', 'mot_de_passe_change', 'mot_de_passe_echec', 'utilisateur_cree', 'utilisateur_modifie', 'utilisateur_supprime', 'invitation_creee', 'reinitialisation_creee', 'invitation_envoyee', 'oubli_demande', 'oubli_envoye', 'oubli_echec', 'reinitialisation_secours', 'compte_active', 'mot_de_passe_reinitialise', 'sessions_fermees']
const actionLabel = computed<Record<string, string>>(() => Object.fromEntries(AUDIT_ACTIONS.map(a => [a, t(`admin.users.actions.${a}`)])))

const error = ref('')
const msg = (e: any) => e?.data?.statusMessage || t('account.retry')

// --- Création / modification ---
const formOpen = ref(false)
const editingId = ref<number | null>(null)
const busy = ref(false)
const formError = ref('')
const form = reactive({ username: '', displayName: '', email: '', role: 'gestionnaire' as Role, logements: [] as number[] })
function openCreate() { editingId.value = null; Object.assign(form, { username: '', displayName: '', email: '', role: 'gestionnaire', logements: [] }); formError.value = ''; formOpen.value = true }
function openEdit(u: NonNullable<typeof data.value>['users'][number]) { editingId.value = u.id; Object.assign(form, { username: u.username, displayName: u.displayName, email: u.email, role: u.role, logements: [...u.logements] }); formError.value = ''; formOpen.value = true }
async function save() {
  busy.value = true; formError.value = ''
  try {
    if (editingId.value) { await $fetch(`/api/users/${editingId.value}`, { method: 'PUT', body: { ...form } }); formOpen.value = false; await refresh() }
    else {
      const r = await $fetch<{ id: number }>('/api/users', { method: 'POST', body: { ...form } })
      formOpen.value = false; await refresh()
      const created = data.value?.users.find(u => u.id === r.id)
      if (created) await invite(created, false) // affiche tout de suite le lien d'invitation
    }
  } catch (e) { formError.value = msg(e) }
  busy.value = false
}

// --- Actions ---
const linkOpen = ref(false)
const copied = ref(false)
const linkInfo = ref<{ link: string; purpose: string; expiresAt: string; name: string; email: string; emailSent: boolean; emailError: string } | null>(null)
async function invite(u: { id: number; displayName: string; email: string; pending: boolean }, send: boolean) {
  error.value = ''
  if (send && !confirm(t(u.pending ? 'admin.users.confirmSendInvite' : 'admin.users.confirmSendReset', { email: u.email }))) return
  try {
    const r = await $fetch<{ link: string; purpose: string; expiresAt: string; emailSent: boolean; emailError: string }>(`/api/users/${u.id}/invite`, { method: 'POST', body: { send } })
    linkInfo.value = { ...r, name: u.displayName, email: u.email }; copied.value = false; linkOpen.value = true
    await refresh()
  } catch (e) { error.value = msg(e) }
}
async function copy() { try { await navigator.clipboard.writeText(linkInfo.value!.link); copied.value = true } catch { /* sélection manuelle possible */ } }
async function act(fn: () => Promise<unknown>) { error.value = ''; try { await fn() } catch (e) { error.value = msg(e) } await refresh() }
const revoke = (u: { id: number; displayName: string }) => confirm(t('admin.users.confirmRevoke', { name: u.displayName })) && act(() => $fetch(`/api/users/${u.id}/revoke-sessions`, { method: 'POST' }))
const toggle = (u: { id: number; displayName: string; email: string; role: Role; logements: number[]; active: boolean }) =>
  (u.active ? confirm(t('admin.users.confirmDeactivate', { name: u.displayName })) : true) &&
  act(() => $fetch(`/api/users/${u.id}`, { method: 'PUT', body: { displayName: u.displayName, email: u.email, role: u.role, logements: u.logements, active: !u.active } }))
const remove = (u: { id: number; displayName: string }) => confirm(t('admin.users.confirmDelete', { name: u.displayName })) && act(() => $fetch(`/api/users/${u.id}`, { method: 'DELETE' }))
</script>
