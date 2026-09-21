<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold">E-mails</h1>
        <p class="text-sm text-muted">Ta boîte, rattachée automatiquement aux réservations et aux contacts, et rangée dans des dossiers.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton :color="mode === 'filing' ? 'primary' : 'neutral'" :variant="mode === 'filing' ? 'soft' : 'outline'" icon="i-lucide-folder-input" label="Tri automatique" :disabled="!list?.passwordSet" @click="openFiling" />
        <UButton color="neutral" variant="outline" icon="i-lucide-link" label="Relancer l'association" :loading="busy === 'relink'" @click="relink" />
        <UButton icon="i-lucide-refresh-cw" label="Synchroniser" :loading="syncing" :disabled="!list?.passwordSet" @click="sync" />
        <UButton color="neutral" variant="outline" icon="i-lucide-settings" to="/settings/imap" title="Réglages e-mail" />
      </div>
    </div>
    <p class="text-sm text-muted">
      <template v-if="!list?.passwordSet"><span class="text-warning">Mot de passe IMAP manquant (voir Réglages &gt; E-mail).</span></template>
      <template v-else>Dernière synchronisation : {{ list?.sync.at ? when(list.sync.at) : 'jamais' }}<template v-if="list?.sync.result"> — {{ list.sync.result }}</template></template>
    </p>
    <p v-if="notice" class="text-sm text-success">{{ notice }}</p>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>

    <div class="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <!-- Menu vertical -->
      <aside :class="selected && mode === 'list' ? 'hidden lg:block' : ''" class="space-y-3">
        <UButton block size="lg" icon="i-lucide-square-pen" label="Nouveau message" :disabled="!list?.passwordSet" @click="startCompose()" />
        <UNavigationMenu orientation="vertical" :items="menu" class="w-full" />
        <form v-if="folderForm !== null" class="space-y-2" @submit.prevent="newFolder">
          <UInput v-model="folderForm" autofocus class="w-full" placeholder="Nom (ou Parent/Nom)" />
          <div class="flex gap-2"><UButton type="submit" size="sm" label="Créer" :disabled="!folderForm.trim()" /><UButton size="sm" color="neutral" variant="ghost" label="Annuler" @click="folderForm = null" /></div>
        </form>
      </aside>

      <div class="min-w-0">
        <!-- Nouveau message -->
        <UCard v-if="mode === 'compose'">
          <h2 class="mb-3 text-lg font-semibold">{{ compose.replyTo ? 'Répondre' : 'Nouveau message' }}</h2>
          <form class="space-y-2" @submit.prevent="send">
            <UFormField label="À"><UInput v-model="compose.to" list="contact-emails" placeholder="destinataire@exemple.fr (plusieurs : séparés par une virgule)" class="w-full" /></UFormField>
            <datalist id="contact-emails"><option v-for="e in contactEmails" :key="e.email" :value="e.email">{{ e.name }}</option></datalist>
            <UFormField v-if="showCc" label="Cc"><UInput v-model="compose.cc" list="contact-emails" class="w-full" /></UFormField>
            <UButton v-else size="xs" color="neutral" variant="link" label="Ajouter Cc" @click="showCc = true" />
            <UFormField label="Objet"><UInput v-model="compose.subject" class="w-full" /></UFormField>
            <UFormField label="Message"><UTextarea v-model="compose.text" :rows="12" class="w-full" /></UFormField>
            <input ref="composeFiles" type="file" multiple class="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-2 file:text-sm" @change="onComposeFiles">
            <p class="text-xs text-muted">Envoyé depuis {{ list?.passwordSet ? 'ta boîte' : '—' }} par SMTP ; une copie est rangée dans « Envoyés ». Pièces jointes : 15 Mo au total.</p>
            <div class="flex gap-2">
              <UButton type="submit" icon="i-lucide-send" label="Envoyer" :loading="busy === 'send'" :disabled="!compose.to.trim() || !compose.text.trim()" />
              <UButton color="neutral" variant="ghost" label="Annuler" @click="mode = 'list'" />
            </div>
          </form>
        </UCard>

        <!-- Rangement -->
        <div v-else-if="mode === 'filing'" class="space-y-3">
          <UCard>
            <h2 class="text-lg font-semibold">Ranger la réception</h2>
            <p class="mt-1 text-sm text-muted">
              Pour chaque e-mail de la réception qui correspond à une règle (réservation → <b>Logements/&lt;logement&gt;</b> ; comptable, banque, assurance, factures → <b>Comptabilité</b> ; dossiers libres avec règle),
              une <b>copie</b> va dans le dossier cible et l'<b>original</b> est déplacé dans <b>« {{ fdata?.treated }} »</b>. Un e-mail qui ne correspond à rien reste dans la réception. Rien n'est supprimé.
            </p>
            <div class="mt-3 flex flex-wrap items-end gap-3">
              <UFormField label="Dossier des originaux">
                <USelectMenu v-model="treatedChoice" :items="treatedItems" create-item value-key="value" class="w-56" @create="(v: string) => treatedChoice = v" @update:model-value="saveFiling" />
              </UFormField>
              <USwitch v-model="autoFile" :label="autoFile ? 'Rangement automatique à chaque synchronisation' : 'Rangement automatique désactivé'" @update:model-value="saveFiling" />
            </div>
            <div class="mt-3 flex gap-2">
              <UButton icon="i-lucide-eye" color="neutral" variant="outline" label="Voir l'aperçu" :loading="busy === 'preview'" @click="preview" />
              <UButton icon="i-lucide-folder-input" label="Ranger maintenant" :loading="busy === 'file'" :disabled="!plan || !plan.items.length" @click="confirming = true" />
            </div>
          </UCard>
          <UCard v-if="confirming && plan?.items.length" class="ring-2 ring-primary">
            <p class="text-sm">Ranger <b>{{ Math.min(plan.items.length, 50) }}</b> e-mail(s) maintenant ? Une copie ira dans chaque dossier cible et l'original sera déplacé dans « {{ fdata?.treated }} ». Les dossiers manquants seront créés dans ta boîte. Rien n'est supprimé.</p>
            <div class="mt-3 flex gap-2">
              <UButton icon="i-lucide-check" label="Confirmer le rangement" :loading="busy === 'file'" @click="fileNow" />
              <UButton color="neutral" variant="ghost" label="Annuler" @click="confirming = false" />
            </div>
          </UCard>
          <UCard v-if="plan">
            <p class="mb-2 text-sm font-medium">Aperçu : {{ plan.items.length }} message(s) seraient rangés (sur {{ fdata?.inboxCount }} en réception)</p>
            <ul class="mb-2 flex flex-wrap gap-1"><li v-for="(n, t) in planCounts" :key="t"><UBadge color="primary" variant="subtle" :label="`${t} · ${n}`" /></li></ul>
            <ul class="space-y-1 text-sm">
              <li v-for="i in plan.items.slice(0, 30)" :key="i.id" class="flex flex-wrap items-baseline justify-between gap-2">
                <span class="min-w-0 truncate">{{ i.from }} — {{ i.subject || '(sans objet)' }}</span>
                <span class="text-xs text-muted">→ {{ i.targets.join(', ') }}</span>
              </li>
            </ul>
            <p v-if="plan.items.length > 30" class="mt-1 text-xs text-muted">… et {{ plan.items.length - 30 }} autre(s). Le rangement traite 50 messages par passage.</p>
            <p v-if="!plan.items.length" class="text-sm text-muted">Rien à ranger pour le moment.</p>
          </UCard>
        </div>

        <!-- Liste + lecteur -->
        <template v-else>
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <UInput v-model="q" icon="i-lucide-search" placeholder="Rechercher (objet, expéditeur, aperçu…)" class="min-w-56 flex-1" />
            <USelect v-model="link" :items="linkItems" class="w-56" />
          </div>
          <p v-if="bookingId || contactId || logementId" class="mb-2 flex items-center gap-2 text-sm">
            <UBadge color="primary" variant="subtle" :label="logementId ? 'Mails du logement' : bookingId ? `Réservation n°${bookingId}` : `Contact n°${contactId}`" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" label="Retirer ce filtre" @click="clearTarget" />
          </p>
          <div class="grid gap-4" :class="selected ? 'xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_17rem]' : 'xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'">
            <div :class="selected ? 'hidden xl:block' : ''" class="min-w-0 space-y-2">
              <UCard v-for="m in items" :key="m.id" :class="selected?.id === m.id ? 'ring-2 ring-primary' : 'cursor-pointer'" @click="open(m)">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="truncate text-sm font-medium">{{ box === 'sent' ? `À : ${m.to[0] ?? '—'}` : (m.fromName || m.fromAddr) }}</p>
                  <span class="shrink-0 text-xs text-muted">{{ shortDate(m.date) }}</span>
                </div>
                <p class="truncate text-sm">{{ m.subject || '(sans objet)' }}</p>
                <p class="line-clamp-1 text-xs text-muted">{{ m.snippet }}</p>
                <div v-if="m.links.length || m.attachments.length" class="mt-1 flex flex-wrap gap-1">
                  <UBadge v-if="m.attachments.length" color="neutral" variant="outline" size="sm" icon="i-lucide-paperclip" :label="String(m.attachments.length)" />
                  <UBadge v-for="l in m.links" :key="l.kind + l.targetId" :color="l.kind === 'booking' ? 'info' : 'primary'" variant="subtle" size="sm"
                          :icon="l.kind === 'booking' ? 'i-lucide-calendar-days' : 'i-lucide-contact'" :label="l.label.split(' · ')[0]" />
                </div>
              </UCard>
              <UCard v-if="list && !items.length">
                <p class="text-sm text-muted">{{ list.sync.at ? 'Aucun e-mail dans cette vue.' : 'Aucun e-mail synchronisé. Clique sur « Synchroniser ».' }}</p>
              </UCard>
              <UButton v-if="list && items.length < list.total" block color="neutral" variant="outline" :loading="loading" :label="`Charger plus (${items.length} / ${list.total})`" @click="load(false)" />
            </div>

            <div v-if="selected" class="min-w-0">
              <div class="space-y-3 xl:sticky xl:top-20">
                <UButton class="xl:hidden" color="neutral" variant="ghost" icon="i-lucide-arrow-left" label="Retour à la liste" @click="selected = null" />
                <UCard>
                  <div class="flex items-start justify-between gap-2">
                    <h2 class="text-lg font-semibold">{{ selected.subject || '(sans objet)' }}</h2>
                    <UButton size="sm" icon="i-lucide-reply" label="Répondre" :disabled="!list?.passwordSet" @click="startReply" />
                  </div>
                  <p class="mt-1 text-sm text-muted">
                    De {{ selected.fromName }} &lt;{{ selected.fromAddr }}&gt;<br>
                    À {{ selected.to.join(', ') || '—' }}<br>
                    {{ when(selected.date) }} · dossier « {{ selected.folder }} »
                  </p>
                </UCard>

                <UCard v-if="selected.attachments.length">
                  <p class="mb-2 text-sm font-medium">Pièces jointes</p>
                  <ul class="space-y-2 text-sm">
                    <li v-for="(a, i) in selected.attachments" :key="i" class="flex flex-wrap items-center justify-between gap-2">
                      <span class="min-w-0 truncate"><UIcon name="i-lucide-paperclip" class="mr-1 align-[-2px]" />{{ a.name }} <span class="text-muted">· {{ size(a.size) }}</span></span>
                      <span class="flex gap-1">
                        <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-download" label="Télécharger" :to="`/api/mail/messages/${selected.id}/attachments/${i}`" external />
                        <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-folder-input" label="Aux documents" @click="startSave(i)" />
                      </span>
                    </li>
                  </ul>
                  <form v-if="saving !== null" class="mt-3 grid gap-2 sm:grid-cols-2" @submit.prevent="saveAttachment">
                    <USelect v-model="saveForm.logementId" :items="logementItems" />
                    <USelect v-model="saveForm.category" :items="categoryItems" />
                    <UInput v-model="saveForm.amount" inputmode="decimal" placeholder="Montant en € (facultatif)" />
                    <UInput v-model="saveForm.date" type="date" />
                    <div class="flex gap-2 sm:col-span-2">
                      <UButton type="submit" label="Enregistrer dans les Documents" :loading="busy === 'save'" />
                      <UButton color="neutral" variant="ghost" label="Annuler" @click="saving = null" />
                    </div>
                  </form>
                  <p v-if="saveMsg" class="mt-2 text-sm" :class="saveMsg.startsWith('✓') ? 'text-success' : 'text-error'">{{ saveMsg }}</p>
                </UCard>

                <UCard>
                  <p v-if="reading" class="text-sm text-muted">Lecture du message dans la boîte…</p>
                  <p v-else-if="detail?.bodyError" class="text-sm text-error">{{ detail.bodyError }}</p>
                  <template v-else>
                    <MailBody v-if="detail?.body?.html" :html="detail.body.html" />
                    <pre v-else class="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-sans text-sm">{{ detail?.body?.text || '(message sans texte)' }}</pre>
                  </template>
                  <p class="mt-2 text-xs text-muted">Mis en forme, mais sans script ni image distante (les pixels espions sont bloqués). Le corps est lu à la demande et n'est pas conservé dans l'appli.</p>
                </UCard>
              </div>
            </div>

            <!-- Colonne de droite : rattachements du message -->
            <aside v-if="selected" class="min-w-0 xl:sticky xl:top-20 xl:self-start">
              <UCard>
                <p class="mb-1 text-sm font-medium">Rattaché à</p>
                <div class="flex flex-wrap items-center gap-1">
                  <UBadge v-for="l in selected.links" :key="l.kind + l.targetId" :color="l.kind === 'booking' ? 'info' : 'primary'" variant="subtle" :icon="l.kind === 'booking' ? 'i-lucide-calendar-days' : 'i-lucide-contact'">
                    {{ l.label }} <span class="text-xs opacity-70">· {{ l.method === 'manual' ? 'manuel' : `auto ${l.score} %` }}</span>
                    <UButton size="xs" color="neutral" variant="link" icon="i-lucide-x" title="Retirer ce rattachement" @click="unlink(l)" />
                  </UBadge>
                  <span v-if="!selected.links.length" class="text-sm text-muted">Aucun rattachement.</span>
                </div>
                <div v-if="!selected.links.length" class="mt-3 border-t border-default pt-3">
                <p class="mb-1 text-sm font-medium">Suggestions (réservations au plus près)</p>
                <p v-if="suggesting" class="text-sm text-muted">Recherche…</p>
                <p v-else-if="!suggestions.length" class="text-sm text-muted">Aucune autre réservation à proposer.</p>
                <ul v-else class="space-y-2">
                  <li v-for="s in suggestions" :key="s.id" class="rounded-md border border-default p-2 text-sm">
                    <p>{{ s.label }}</p>
                    <p class="text-xs text-muted">{{ s.reason }}</p>
                    <UButton size="xs" class="mt-1" color="neutral" variant="outline" icon="i-lucide-link" label="Rattacher" @click="linkBooking(s.id)" />
                  </li>
                </ul>
              </div>
              <div class="mt-3 space-y-2">
                  <USelectMenu v-model="target" :items="targetItems" value-key="value" v-model:search-term="targetQ" :filter="false" placeholder="Rattacher à une réservation ou un contact…" class="w-full" />
                  <UButton size="sm" color="neutral" variant="outline" label="Rattacher" :disabled="!target" @click="linkManual" />
                </div>
              </UCard>
            </aside>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()

// ---------- état de navigation ----------
const mode = ref<'list' | 'compose' | 'filing'>('list')
const box = ref<string>(String(route.query.box || 'inbox')) // inbox | sent | spam | folder
const folderPath = ref(String(route.query.folder || ''))
const q = ref('')
const link = ref('all')
const bookingId = ref(Number(route.query.booking) || 0)
const contactId = ref(Number(route.query.contact) || 0)
const logementId = ref(Number(route.query.logement) || 0)
if (bookingId.value || contactId.value || logementId.value) box.value = 'all'

const list = ref<any>(null)
const items = ref<any[]>([])
const fdata = ref<any>(null)
const loading = ref(false)
const syncing = ref(false)
const busy = ref('')
const error = ref('')
const notice = ref('')
const PAGE = 30

async function loadFolders() { try { fdata.value = await $fetch('/api/mail/folders') } catch { /* menu vide */ } }
async function load(reset: boolean) {
  loading.value = true
  try {
    const r: any = await $fetch('/api/mail/messages', { query: {
      q: q.value || undefined, box: ['inbox', 'sent', 'spam'].includes(box.value) ? box.value : undefined, folder: box.value === 'folder' ? folderPath.value : undefined,
      link: link.value === 'all' ? undefined : link.value, booking: bookingId.value || undefined, contact: contactId.value || undefined, logement: logementId.value || undefined, limit: PAGE, offset: reset ? 0 : items.value.length,
    } })
    list.value = r
    items.value = reset ? r.items : [...items.value, ...r.items]
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Chargement impossible' }
  loading.value = false
}
await Promise.all([loadFolders(), load(true)])
let timer: ReturnType<typeof setTimeout> | undefined
watch([q, link, box, folderPath, bookingId, contactId, logementId], () => { clearTimeout(timer); timer = setTimeout(() => load(true), 250) })
function go(b: string, path = '') {
  mode.value = 'list'; box.value = b; folderPath.value = path; selected.value = null; bookingId.value = 0; contactId.value = 0; logementId.value = 0
  router.replace({ query: path ? { folder: path, box: 'folder' } : { box: b } })
}
const clearTarget = () => { bookingId.value = 0; contactId.value = 0; logementId.value = 0; box.value = 'inbox'; router.replace({ query: {} }) }

// ---------- menu vertical ----------
interface FolderRow { path: string; name: string; delimiter: string; role: string; managed: string; count: number; virtual?: boolean }
const menu = computed(() => {
  const f = fdata.value
  const badge = (n: number) => (n ? n : undefined)
  const active = (b: string, path = '') => mode.value === 'list' && box.value === b && folderPath.value === path
  const boxes = [
    { label: 'Réception', icon: 'i-lucide-inbox', badge: badge(f?.inboxCount ?? 0), active: active('inbox'), onSelect: () => go('inbox') },
    { label: 'Envoyés', icon: 'i-lucide-send', badge: badge(f?.sentCount ?? 0), active: active('sent'), onSelect: () => go('sent') },
    { label: 'Spam', icon: 'i-lucide-shield-alert', badge: badge(f?.spamCount ?? 0), active: active('spam'), onSelect: () => go('spam') },
  ]
  // Dossiers : arbre construit a partir des chemins (Logements / Gaston…) ; les dossiers de rangement absents sont annonces
  const rows: FolderRow[] = (f?.folders ?? []).filter((x: FolderRow) => !['inbox', 'sent', 'spam'].includes(x.role))
  const delim = rows[0]?.delimiter || '/'
  const tree: any[] = []
  const nodeFor = (segments: string[]): any => {
    let level = tree, node: any
    segments.forEach((seg, i) => {
      node = level.find(n => n.label === seg)
      if (!node) { node = { label: seg, icon: i === 0 ? 'i-lucide-folder' : 'i-lucide-folder-open', children: undefined, path: '' }; level.push(node) }
      if (i < segments.length - 1) { node.children ??= []; level = node.children }
    })
    return node
  }
  for (const r of rows.sort((a, b) => a.path.localeCompare(b.path))) {
    const node = nodeFor(r.path.split(delim))
    node.path = r.path
    node.badge = badge(r.count)
    node.active = active('folder', r.path)
    node.onSelect = () => go('folder', r.path)
    if (r.managed === 'treated') node.icon = 'i-lucide-archive-check'
    if (r.role === 'archive') node.icon = 'i-lucide-archive'
    if (r.role === 'trash') node.icon = 'i-lucide-trash-2'
    if (r.role === 'drafts') node.icon = 'i-lucide-file-pen'
    if (r.managed === 'compta') node.icon = 'i-lucide-calculator'
    if (r.managed === 'logements') node.icon = 'i-lucide-building-2'
    if (r.managed === 'logement') node.icon = 'i-lucide-home'
    if (r.virtual) node.class = 'opacity-60' // pas encore cree dans la boite : cree au premier rangement
  }
  const strip = (nodes: any[]): any[] => nodes.map(n => ({ ...n, children: n.children ? strip(n.children) : undefined, defaultOpen: !!n.children, ...(n.children && !n.path ? { onSelect: undefined } : {}) }))
  const actions = [
    { label: 'Nouveau dossier', icon: 'i-lucide-folder-plus', onSelect: () => { folderForm.value = folderPath.value ? `${folderPath.value}/` : '' } },
  ]
  return [boxes, [{ label: 'Dossiers', type: 'label' as const }, ...strip(tree)], actions]
})
function openFiling() { mode.value = 'filing'; selected.value = null; plan.value = null; confirming.value = false; loadFolders(); preview() }
const confirming = ref(false)
const folderForm = ref<string | null>(null)
async function newFolder() {
  const raw = folderForm.value
  if (!raw?.trim()) return
  folderForm.value = null
  const delim = fdata.value?.folders?.[0]?.delimiter || '/'
  const parts = raw.trim().split(delim === '/' ? '/' : /[/.]/).filter(Boolean)
  const name = parts.pop() ?? ''
  const parent = parts.join(delim)
  error.value = ''
  try { await $fetch('/api/mail/folders', { method: 'POST', body: { name, parent: parent || undefined } }); await loadFolders(); notice.value = 'Dossier créé.' } catch (e: any) { error.value = e?.data?.statusMessage || 'Création impossible' }
}

// ---------- synchronisation / association ----------
async function sync() {
  syncing.value = true; error.value = ''; notice.value = ''
  try { const r: any = await $fetch('/api/mail/sync', { method: 'POST' }); if (!r.ok) error.value = r.message; await Promise.all([loadFolders(), load(true)]) }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Synchronisation impossible' }
  syncing.value = false
}
async function relink() {
  busy.value = 'relink'; error.value = ''; notice.value = ''
  try { const r: any = await $fetch('/api/mail/relink', { method: 'POST' }); notice.value = `Association relancée : ${r.linked} rattachement(s) automatique(s).`; await load(true) }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec' }
  busy.value = ''
}

// ---------- rangement ----------
const plan = ref<any>(null)
const autoFile = ref(false)
const treatedChoice = ref('Traité')
watch(fdata, (f) => { if (f) { autoFile.value = !!f.autoFile; treatedChoice.value = f.treated } }, { immediate: true })
const treatedItems = computed(() => {
  const names = new Set<string>(['Traité', ...(fdata.value?.folders ?? []).filter((x: any) => !x.managed && !['inbox', 'sent', 'spam', 'trash', 'drafts'].includes(x.role) && !x.path.includes(x.delimiter)).map((x: any) => x.path)])
  return [...names].map(v => ({ label: v === 'Traité' ? 'Traité (créé si besoin)' : v, value: v }))
})
const planCounts = computed(() => (plan.value?.items ?? []).reduce((a: Record<string, number>, i: any) => { i.targets.forEach((t: string) => { a[t] = (a[t] || 0) + 1 }); return a }, {}))
async function saveFiling() {
  try { await $fetch('/api/mail/filing-settings', { method: 'PUT', body: { autoFile: autoFile.value, treatedFolder: treatedChoice.value } }); await loadFolders(); plan.value = null }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec' }
}
async function preview() {
  busy.value = 'preview'; error.value = ''
  try { plan.value = await $fetch('/api/mail/file', { method: 'POST', body: { dryRun: true } }) } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec' }
  busy.value = ''
}
async function fileNow() {
  if (!plan.value?.items.length) return
  confirming.value = false
  busy.value = 'file'; error.value = ''; notice.value = ''
  try {
    const r: any = await $fetch('/api/mail/file', { method: 'POST', body: { dryRun: false } })
    if (r.ok) notice.value = r.message; else error.value = r.message
    plan.value = null; await Promise.all([loadFolders(), load(true)])
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec du rangement' }
  busy.value = ''
}

// ---------- message ouvert ----------
const selected = ref<any>(null)
const detail = ref<any>(null)
const reading = ref(false)
async function open(m: any) {
  selected.value = m; detail.value = null; reading.value = true; saving.value = null; saveMsg.value = ''; suggestions.value = []; if (!m.links.length) loadSuggestions()
  try {
    detail.value = await $fetch(`/api/mail/messages/${m.id}`)
    if (detail.value.body?.attachments?.length) selected.value = { ...m, attachments: detail.value.body.attachments.map((a: any) => ({ name: a.name, size: a.size, type: a.type })) }
  } catch (e: any) { detail.value = { bodyError: e?.data?.statusMessage || 'Lecture impossible' } }
  reading.value = false
}
async function refreshSelected() {
  const id = selected.value?.id
  await load(true)
  const fresh = items.value.find(i => i.id === id)
  if (fresh) selected.value = { ...fresh, attachments: selected.value.attachments }
  if (fresh && !fresh.links.length) loadSuggestions() // rattachement retire : les suggestions reviennent
}
const linkItems = [
  { label: 'Tous les e-mails', value: 'all' }, { label: 'Liés à une réservation', value: 'booking' },
  { label: 'Liés à un contact', value: 'contact' }, { label: 'Non rattachés', value: 'none' },
]

// ---------- rattachements manuels ----------
const targetQ = ref('')
const target = ref<string | undefined>()
const targets = ref<{ bookings: any[]; contacts: any[] }>({ bookings: [], contacts: [] })
async function loadTargets() { targets.value = await $fetch('/api/mail/targets', { query: { q: targetQ.value } }) }
loadTargets()
let tt: ReturnType<typeof setTimeout> | undefined
watch(targetQ, () => { clearTimeout(tt); tt = setTimeout(loadTargets, 250) })
const targetItems = computed(() => [
  { type: 'label' as const, label: 'Réservations' }, ...targets.value.bookings.map(b => ({ label: b.label, value: `booking:${b.id}` })),
  { type: 'label' as const, label: 'Contacts' }, ...targets.value.contacts.map(c => ({ label: c.label, value: `contact:${c.id}` })),
])
// Suggestions : reservations dont les dates sont les plus proches de celle du message
const suggestions = ref<{ id: number; label: string; reason: string }[]>([])
const suggesting = ref(false)
async function loadSuggestions() {
  const id = selected.value?.id
  if (!id) return
  suggesting.value = true
  try { const r = await $fetch<any[]>(`/api/mail/messages/${id}/suggest`); if (selected.value?.id === id) suggestions.value = r } catch { suggestions.value = [] }
  suggesting.value = false
}
async function linkBooking(bookingId: number) {
  try { await $fetch(`/api/mail/messages/${selected.value.id}/links`, { method: 'POST', body: { kind: 'booking', targetId: bookingId } }); await refreshSelected() }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec' }
}
async function linkManual() {
  if (!target.value || !selected.value) return
  const [kind, id] = target.value.split(':')
  try { await $fetch(`/api/mail/messages/${selected.value.id}/links`, { method: 'POST', body: { kind, targetId: Number(id) } }); target.value = undefined; await refreshSelected() }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec' }
}
async function unlink(l: { kind: string; targetId: number }) {
  try { await $fetch(`/api/mail/messages/${selected.value.id}/links`, { method: 'DELETE', body: { kind: l.kind, targetId: l.targetId } }); await refreshSelected() }
  catch (e: any) { error.value = e?.data?.statusMessage || 'Échec' }
}

// ---------- pièces jointes -> Documents ----------
const saving = ref<number | null>(null)
const saveMsg = ref('')
const saveForm = reactive({ logementId: 0, category: 'autre_doc', amount: '', date: '' })
const { data: lgData } = await useFetch('/api/logements', { key: 'logements' })
const { data: cats } = await useFetch('/api/imports')
const logementItems = computed(() => [{ label: 'À classer (choisir plus tard)', value: 0 }, ...(lgData.value?.logements ?? []).map(l => ({ label: l.name, value: l.id }))])
const categoryItems = computed(() => {
  const groups: Record<string, string> = { charge: 'Charges', recette: 'Recettes', doc: 'Justificatifs' }
  return Object.entries(groups).map(([kind, label]) => [{ type: 'label' as const, label }, ...(cats.value?.categories ?? []).filter((c: any) => c.kind === kind).map((c: any) => ({ label: c.label, value: c.key }))])
})
function startSave(i: number) {
  saving.value = i; saveMsg.value = ''
  const b = selected.value.links.find((l: any) => l.kind === 'booking' && l.logementId)
  Object.assign(saveForm, { logementId: b?.logementId ?? 0, category: 'autre_doc', amount: '', date: String(selected.value.date).slice(0, 10) })
}
async function saveAttachment() {
  busy.value = 'save'; saveMsg.value = ''
  try {
    const r: any = await $fetch(`/api/mail/messages/${selected.value.id}/save-attachment`, { method: 'POST', body: { index: saving.value, ...saveForm } })
    saveMsg.value = r.duplicate ? '✓ Déjà présent dans les Documents.' : '✓ Enregistré dans les Documents.'; saving.value = null
  } catch (e: any) { saveMsg.value = e?.data?.statusMessage || 'Échec de l’enregistrement' }
  busy.value = ''
}

// ---------- nouveau message / réponse ----------
const compose = reactive({ to: '', cc: '', subject: '', text: '', replyTo: 0 })
const showCc = ref(false)
const composeFiles = ref<HTMLInputElement | null>(null)
let files: File[] = []
const { data: contactData } = await useFetch('/api/contacts')
const contactEmails = computed(() => (contactData.value?.contacts ?? []).filter((c: any) => c.email).map((c: any) => ({ email: c.email, name: c.name })))
function onComposeFiles(e: Event) {
  files = [...((e.target as HTMLInputElement).files ?? [])]
  if (files.reduce((n, f) => n + f.size, 0) > 15 * 1048576) { error.value = 'Pièces jointes : 15 Mo au total.'; files = []; if (composeFiles.value) composeFiles.value.value = '' }
}
function startCompose(prefill?: Partial<typeof compose>) {
  Object.assign(compose, { to: '', cc: '', subject: '', text: '', replyTo: 0, ...prefill }); files = []; showCc.value = false; error.value = ''; notice.value = ''
  mode.value = 'compose'
}
function startReply() {
  const m = selected.value
  const quoted = (detail.value?.body?.text || '').split('\n').slice(0, 60).map((l: string) => `> ${l}`).join('\n')
  startCompose({
    to: m.folder === fdata.value?.sent ? (m.to[0] ?? '') : m.fromAddr,
    subject: /^re\s*:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`,
    text: `\n\nLe ${when(m.date)}, ${m.fromName || m.fromAddr} a écrit :\n${quoted}`, replyTo: m.id,
  })
}
async function send() {
  busy.value = 'send'; error.value = ''; notice.value = ''
  const body = new FormData()
  body.append('to', compose.to); body.append('cc', compose.cc); body.append('subject', compose.subject); body.append('text', compose.text)
  if (compose.replyTo) body.append('replyTo', String(compose.replyTo))
  for (const f of files) body.append('files', f, f.name)
  try {
    const r: any = await $fetch('/api/mail/send', { method: 'POST', body })
    notice.value = `Message envoyé${r.savedInSent ? ' — copie dans « Envoyés »' : ' (copie dans Envoyés impossible)'}.`
    mode.value = 'list'; go('sent')
    $fetch('/api/mail/sync', { method: 'POST' }).then(() => Promise.all([loadFolders(), load(true)])).catch(() => {})
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Envoi impossible' }
  busy.value = ''
}

const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const shortDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })
const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`)
// Ouverture directe d'un message (lien depuis la page E-mails d'un logement)
if (route.query.open) { const m = items.value.find(i => i.id === Number(route.query.open)); if (m) open(m) }
</script>
