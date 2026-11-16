<template>
  <div class="space-y-4">
    <!-- Livret voyageur Loussa Réservations : lien personnalisé au séjour, QR code, envoi explicite -->
    <UCard>
      <template #header>
        <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-book-heart" class="size-3.5" /> {{ t('daily.pms.stayGuidebook') }}</p>
      </template>
      <p v-if="linkStatus === 'pending' || linkStatus === 'idle'" class="text-sm text-muted">{{ t('daily.common.loading') }}</p>
      <p v-else-if="!link?.url" class="text-sm text-muted">{{ t('daily.pms.linkUnavailable') }}</p>
      <div v-else class="space-y-2">
        <div class="flex items-start gap-3">
          <img :src="link.qr" :alt="t('daily.pms.qrAlt')" class="size-28 shrink-0 rounded bg-white p-1">
          <div class="min-w-0 flex-1 space-y-2">
            <UInput :model-value="link.url" readonly size="sm" class="w-full font-mono text-xs" @focus="($event.target as HTMLInputElement).select()" />
            <div class="flex flex-wrap gap-1">
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-copy" :label="copied ? t('daily.pms.copied') : t('daily.pms.copy')" @click="copy" />
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-eye" :label="t('daily.res.open')" :to="link.url" external target="_blank" />
            </div>
            <p v-if="link.validFrom" class="text-xs text-muted">{{ t('daily.pms.activeFromTo', { from: day(link.validFrom), to: day(link.validUntil) }) }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 border-t border-default pt-2">
          <USelect v-model="channel" :items="channels" size="xs" class="w-40" />
          <UButton size="xs" icon="i-lucide-send" :label="t('daily.pms.sendGuidebook')" :loading="sendingLink" @click="sendLink" />
        </div>
        <p v-if="linkInfo" class="text-xs" :class="linkInfoError ? 'text-error' : 'text-success'">{{ linkInfo }}</p>
      </div>
    </UCard>

    <!-- E-mails Loussa Mail rattachés à la réservation -->
    <UCard>
      <template #header>
        <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-mail" class="size-3.5" /> {{ t('daily.pms.emails') }}</p>
        <p v-if="emails?.guestEmail" class="mt-1 text-xs text-muted">{{ emails.guestEmail }}</p>
      </template>
      <p v-if="emailsStatus === 'pending' || emailsStatus === 'idle'" class="text-sm text-muted">{{ t('daily.common.loading') }}</p>
      <p v-else-if="!emails" class="text-sm text-muted">{{ t('daily.pms.emailsUnavailable') }}</p>
      <p v-else-if="!emails.available" class="text-sm text-muted">{{ emails.reason ? t('daily.pms.mailboxUnavailableReason', { reason: emails.reason }) : t('daily.pms.mailboxUnavailable') }}</p>
      <template v-else>
        <p v-if="!emails.conversations.length" class="text-sm text-muted">{{ t('daily.pms.noEmail') }}</p>
        <ul v-else class="space-y-1">
          <li v-for="c in emails.conversations" :key="c.id">
            <button type="button" class="w-full rounded p-1.5 text-left text-sm hover:bg-elevated" :class="openId === c.id && 'bg-elevated'" @click="openThread(c.id)">
              <b class="block truncate">{{ c.subject || t('daily.pms.noSubject') }}</b>
              <span class="text-xs text-muted">{{ when(c.lastMessageAt) }} · {{ t('daily.pms.messages', { n: c.messageCount }, c.messageCount) }}</span>
            </button>
          </li>
        </ul>
        <div v-if="openId" class="mt-2 space-y-2 border-t border-default pt-2">
          <p v-if="!thread" class="text-xs text-muted">{{ t('daily.common.loading') }}</p>
          <div v-for="m in thread?.messages ?? []" :key="m.key" class="rounded px-2 py-1.5 text-sm" :class="m.from === 'host' ? 'bg-primary/10' : 'bg-elevated'">
            <p class="text-xs text-muted">{{ m.from === 'host' ? t('daily.res.you') : (m.fromAddress || guest) }} · {{ when(m.at) }}</p>
            <p class="whitespace-pre-line">{{ textOf(m) }}</p>
            <p v-if="isTranslated(m)" class="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted"><UIcon name="i-lucide-languages" class="size-3.5" />{{ t('translation.translatedFrom', { lang: sourceOf(m) }) }} · <button type="button" class="underline" @click="toggle(m)">{{ showOriginal(m) ? t('translation.showTranslation') : t('translation.showOriginal') }}</button></p>
          </div>
        </div>
        <div class="mt-3 space-y-2 border-t border-default pt-3">
          <UInput v-model="subject" size="sm" :placeholder="t('daily.res.subject')" :disabled="sendingMail || !emails.guestEmail" />
          <UTextarea v-model="text" :rows="3" autoresize size="sm" :placeholder="t('daily.pms.writeToGuest')" class="w-full" :disabled="sendingMail || !emails.guestEmail" />
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs" :class="mailError ? 'text-error' : 'text-muted'">{{ mailError || mailInfo || (emails.guestEmail ? t('daily.pms.sentViaMail') : t('daily.pms.noGuestEmail')) }}</p>
            <UButton size="xs" icon="i-lucide-send" :label="t('daily.res.send')" :loading="sendingMail" :disabled="!subject.trim() || !text.trim() || !emails.guestEmail" @click="sendMail" />
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ logementId: string | number; bookingId: number; guest: string }>()
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
const base = computed(() => `/api/logements/${props.logementId}/reservations/${props.bookingId}`)

const { data: link, status: linkStatus } = useFetch(() => `${base.value}/guest-link`, { server: false, key: `pms-link-${props.bookingId}` })
const copied = ref(false)
async function copy() { try { await navigator.clipboard.writeText(link.value!.url); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch { /* copie manuelle */ } }
const channels = computed(() => [{ label: t('daily.pms.chLodgify'), value: 'lodgify' }, { label: t('daily.res.email'), value: 'email' }])
const channel = ref<'lodgify' | 'email'>('lodgify')
const sendingLink = ref(false)
const linkInfo = ref('')
const linkInfoError = ref(false)
let linkMessageId = crypto.randomUUID()
async function sendLink() {
  if (!confirm(t('daily.pms.confirmGuidebook', { guest: props.guest, channel: channel.value === 'email' ? t('daily.pms.byEmail') : t('daily.pms.byLodgify') }))) return
  sendingLink.value = true; linkInfo.value = ''; linkInfoError.value = false
  try {
    const r: any = await $fetch(`${base.value}/guest-link`, { method: 'POST', body: { channel: channel.value, messageId: linkMessageId } })
    linkInfo.value = r?.duplicate ? t('daily.pms.alreadySent') : (r?.demo ? t('daily.pms.guidebookSentDemo') : t('daily.pms.guidebookSent'))
    linkMessageId = crypto.randomUUID()
  } catch (e: any) { linkInfoError.value = true; linkInfo.value = e?.data?.statusMessage || e?.statusMessage || t('daily.pms.sendFailed') }
  finally { sendingLink.value = false }
}

const { data: emails, status: emailsStatus, refresh: refreshEmails } = useFetch(() => `${base.value}/emails`, { server: false, key: `pms-emails-${props.bookingId}` })
const openId = ref('')
const thread = ref<any>(null)
const { textOf, isTranslated, showOriginal, toggle, sourceOf } = useGuestTranslation(() => thread.value?.messages)
async function openThread(id: string) {
  if (openId.value === id) { openId.value = ''; return }
  openId.value = id; thread.value = null
  try { thread.value = await $fetch(`${base.value}/emails/${id}`) } catch { thread.value = { messages: [] } }
}
const subject = ref('')
const text = ref('')
const sendingMail = ref(false)
const mailError = ref('')
const mailInfo = ref('')
let mailMessageId = crypto.randomUUID()
async function sendMail() {
  if (!confirm(t('daily.pms.confirmMail', { email: emails.value?.guestEmail }))) return
  sendingMail.value = true; mailError.value = ''; mailInfo.value = ''
  try {
    const r: any = await $fetch(`${base.value}/emails`, { method: 'POST', body: { subject: subject.value, text: text.value, messageId: mailMessageId } })
    mailInfo.value = r?.duplicate ? t('daily.pms.alreadySent') : (r?.demo ? t('daily.pms.mailSentDemo') : t('daily.pms.mailSent'))
    subject.value = ''; text.value = ''; mailMessageId = crypto.randomUUID()
    await refreshEmails()
  } catch (e: any) { mailError.value = e?.data?.statusMessage || e?.statusMessage || t('daily.pms.sendFailed') }
  finally { sendingMail.value = false }
}
watch(() => props.bookingId, () => { openId.value = ''; thread.value = null; subject.value = ''; text.value = ''; mailError.value = ''; mailInfo.value = ''; linkInfo.value = '' })

const when = (d: string) => d ? new Date(d).toLocaleString(fmtLocale.value, { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
const day = (d: string | null) => d ? new Date(d).toLocaleDateString(fmtLocale.value, { day: 'numeric', month: 'short' }) : ''
</script>
