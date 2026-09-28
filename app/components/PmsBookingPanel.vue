<template>
  <div class="space-y-4">
    <!-- Livret voyageur Rocket PMS : lien personnalisé au séjour, QR code, envoi explicite -->
    <UCard>
      <template #header>
        <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-book-heart" class="size-3.5" /> Livret du séjour (Rocket PMS)</p>
      </template>
      <p v-if="linkStatus === 'pending' || linkStatus === 'idle'" class="text-sm text-muted">Chargement…</p>
      <p v-else-if="!link?.url" class="text-sm text-muted">Lien indisponible pour cette réservation.</p>
      <div v-else class="space-y-2">
        <div class="flex items-start gap-3">
          <img :src="link.qr" alt="QR code du livret du séjour" class="size-28 shrink-0 rounded bg-white p-1">
          <div class="min-w-0 flex-1 space-y-2">
            <UInput :model-value="link.url" readonly size="sm" class="w-full font-mono text-xs" @focus="($event.target as HTMLInputElement).select()" />
            <div class="flex flex-wrap gap-1">
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-copy" :label="copied ? 'Copié' : 'Copier'" @click="copy" />
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-eye" label="Ouvrir" :to="link.url" external target="_blank" />
            </div>
            <p v-if="link.validFrom" class="text-xs text-muted">Actif du {{ day(link.validFrom) }} au {{ day(link.validUntil) }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 border-t border-default pt-2">
          <USelect v-model="channel" :items="channels" size="xs" class="w-40" />
          <UButton size="xs" icon="i-lucide-send" label="Envoyer le livret" :loading="sendingLink" @click="sendLink" />
        </div>
        <p v-if="linkInfo" class="text-xs" :class="linkInfoError ? 'text-error' : 'text-success'">{{ linkInfo }}</p>
      </div>
    </UCard>

    <!-- E-mails Rocket Mailer rattachés à la réservation -->
    <UCard>
      <template #header>
        <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-mail" class="size-3.5" /> E-mails (Rocket PMS)</p>
        <p v-if="emails?.guestEmail" class="mt-1 text-xs text-muted">{{ emails.guestEmail }}</p>
      </template>
      <p v-if="emailsStatus === 'pending' || emailsStatus === 'idle'" class="text-sm text-muted">Chargement…</p>
      <p v-else-if="!emails" class="text-sm text-muted">E-mails indisponibles pour le moment.</p>
      <p v-else-if="!emails.available" class="text-sm text-muted">Boîte e-mail indisponible{{ emails.reason ? ` : ${emails.reason}` : '' }}.</p>
      <template v-else>
        <p v-if="!emails.conversations.length" class="text-sm text-muted">Aucun e-mail rattaché.</p>
        <ul v-else class="space-y-1">
          <li v-for="c in emails.conversations" :key="c.id">
            <button type="button" class="w-full rounded p-1.5 text-left text-sm hover:bg-elevated" :class="openId === c.id && 'bg-elevated'" @click="openThread(c.id)">
              <b class="block truncate">{{ c.subject || '(sans objet)' }}</b>
              <span class="text-xs text-muted">{{ when(c.lastMessageAt) }} · {{ c.messageCount }} message{{ c.messageCount > 1 ? 's' : '' }}</span>
            </button>
          </li>
        </ul>
        <div v-if="openId" class="mt-2 space-y-2 border-t border-default pt-2">
          <p v-if="!thread" class="text-xs text-muted">Chargement…</p>
          <div v-for="m in thread?.messages ?? []" :key="m.key" class="rounded px-2 py-1.5 text-sm" :class="m.from === 'host' ? 'bg-primary/10' : 'bg-elevated'">
            <p class="text-xs text-muted">{{ m.from === 'host' ? 'Toi' : (m.fromAddress || guest) }} · {{ when(m.at) }}</p>
            <p class="whitespace-pre-line">{{ m.text }}</p>
          </div>
        </div>
        <div class="mt-3 space-y-2 border-t border-default pt-3">
          <UInput v-model="subject" size="sm" placeholder="Objet" :disabled="sendingMail || !emails.guestEmail" />
          <UTextarea v-model="text" :rows="3" autoresize size="sm" placeholder="Écrire un e-mail au voyageur…" class="w-full" :disabled="sendingMail || !emails.guestEmail" />
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs" :class="mailError ? 'text-error' : 'text-muted'">{{ mailError || mailInfo || (emails.guestEmail ? 'Envoyé via Rocket Mailer.' : 'Pas d’adresse e-mail pour ce voyageur.') }}</p>
            <UButton size="xs" icon="i-lucide-send" label="Envoyer" :loading="sendingMail" :disabled="!subject.trim() || !text.trim() || !emails.guestEmail" @click="sendMail" />
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ logementId: string | number; bookingId: number; guest: string }>()
const base = computed(() => `/api/logements/${props.logementId}/reservations/${props.bookingId}`)

const { data: link, status: linkStatus } = useFetch(() => `${base.value}/guest-link`, { server: false, key: `pms-link-${props.bookingId}` })
const copied = ref(false)
async function copy() { try { await navigator.clipboard.writeText(link.value!.url); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch { /* copie manuelle */ } }
const channels = [{ label: 'Messagerie Lodgify', value: 'lodgify' }, { label: 'E-mail', value: 'email' }]
const channel = ref<'lodgify' | 'email'>('lodgify')
const sendingLink = ref(false)
const linkInfo = ref('')
const linkInfoError = ref(false)
let linkMessageId = crypto.randomUUID()
async function sendLink() {
  if (!confirm(`Envoyer le livret à ${props.guest} par ${channel.value === 'email' ? 'e-mail' : 'la messagerie Lodgify'} ?`)) return
  sendingLink.value = true; linkInfo.value = ''; linkInfoError.value = false
  try {
    const r: any = await $fetch(`${base.value}/guest-link`, { method: 'POST', body: { channel: channel.value, messageId: linkMessageId } })
    linkInfo.value = r?.duplicate ? 'Déjà envoyé.' : `Livret envoyé${r?.demo ? ' (mode démo : rien n’est parti)' : ''}.`
    linkMessageId = crypto.randomUUID()
  } catch (e: any) { linkInfoError.value = true; linkInfo.value = e?.data?.statusMessage || e?.statusMessage || 'Échec de l’envoi.' }
  finally { sendingLink.value = false }
}

const { data: emails, status: emailsStatus, refresh: refreshEmails } = useFetch(() => `${base.value}/emails`, { server: false, key: `pms-emails-${props.bookingId}` })
const openId = ref('')
const thread = ref<any>(null)
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
  if (!confirm(`Envoyer cet e-mail à ${emails.value?.guestEmail} ?`)) return
  sendingMail.value = true; mailError.value = ''; mailInfo.value = ''
  try {
    const r: any = await $fetch(`${base.value}/emails`, { method: 'POST', body: { subject: subject.value, text: text.value, messageId: mailMessageId } })
    mailInfo.value = r?.duplicate ? 'Déjà envoyé.' : `E-mail envoyé${r?.demo ? ' (mode démo)' : ''}.`
    subject.value = ''; text.value = ''; mailMessageId = crypto.randomUUID()
    await refreshEmails()
  } catch (e: any) { mailError.value = e?.data?.statusMessage || e?.statusMessage || 'Échec de l’envoi.' }
  finally { sendingMail.value = false }
}
watch(() => props.bookingId, () => { openId.value = ''; thread.value = null; subject.value = ''; text.value = ''; mailError.value = ''; mailInfo.value = ''; linkInfo.value = '' })

const when = (d: string) => d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
const day = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''
</script>
