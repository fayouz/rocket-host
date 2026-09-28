<template>
  <div v-if="data" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">Utilisateurs</h2>
      <UButton icon="i-lucide-user-plus" label="Nouvel utilisateur" @click="openCreate" />
    </div>
    <UTabs v-model="tab" :items="tabs" :content="false" />

    <template v-if="tab === 'comptes'">
      <p class="text-sm text-muted">
        Un compte est créé <b>sans mot de passe</b> : la personne le choisit en suivant un <b>lien d'invitation à usage unique</b> (72 h). Le lien t'est montré une seule fois ;
        tu peux aussi l'envoyer par e-mail d'un clic. Le rôle et les logements autorisés s'appliquent immédiatement.
      </p>
      <UCard v-for="u in data.users" :key="u.id" :class="{ 'opacity-60': !u.active }">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium">{{ u.displayName }} <span class="font-normal text-muted">· {{ u.username }}</span><span v-if="u.id === me?.id" class="ml-2 text-xs text-muted">(toi)</span></p>
            <p class="text-sm text-muted">{{ u.email || 'Pas d\'adresse e-mail' }} · {{ u.role === 'admin' ? 'Tous les logements' : (u.logements.length ? u.logements.map(nameOf).join(', ') : 'Aucun logement') }}</p>
            <p class="text-xs text-muted">{{ u.lastLoginAt ? `Dernière connexion : ${dt(u.lastLoginAt)}` : 'Jamais connecté' }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <UBadge color="neutral" variant="outline" :label="roleLabel[u.role]" />
            <UBadge v-if="!u.active" color="neutral" label="Désactivé" />
            <UBadge v-else-if="u.pending" color="warning" variant="subtle" label="Invitation en attente" />
            <UBadge v-else-if="u.mustChange" color="info" variant="subtle" label="Mot de passe provisoire" />
            <UBadge v-else color="success" variant="subtle" label="Actif" />
          </div>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" label="Modifier" @click="openEdit(u)" />
          <UButton v-if="u.active" size="xs" color="neutral" variant="outline" icon="i-lucide-link" :label="u.pending ? 'Lien d\'invitation' : 'Réinitialiser le mot de passe'" @click="invite(u, false)" />
          <UButton v-if="u.active && u.email" size="xs" color="neutral" variant="outline" icon="i-lucide-mail" label="Envoyer par e-mail" @click="invite(u, true)" />
          <UButton v-if="!u.pending" size="xs" color="neutral" variant="ghost" icon="i-lucide-log-out" label="Fermer les sessions" @click="revoke(u)" />
          <UButton v-if="u.id !== me?.id" size="xs" color="neutral" variant="ghost" :icon="u.active ? 'i-lucide-user-x' : 'i-lucide-user-check'" :label="u.active ? 'Désactiver' : 'Réactiver'" @click="toggle(u)" />
          <UButton v-if="u.id !== me?.id" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" label="Supprimer" @click="remove(u)" />
        </div>
      </UCard>
      <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
    </template>

    <template v-else>
      <p class="text-sm text-muted">Les 100 derniers événements : connexions, échecs, changements de mot de passe, gestion des comptes. Aucun mot de passe ni lien n'y figure.</p>
      <UCard>
        <p v-if="!audit.length" class="text-sm text-muted">Aucun événement.</p>
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
    <UModal v-model:open="formOpen" :title="editingId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'">
      <template #body>
        <form class="space-y-3" @submit.prevent="save">
          <UFormField label="Identifiant" :hint="editingId ? 'non modifiable' : 'minuscules, chiffres, . _ -'"><UInput v-model="form.username" :disabled="!!editingId" class="w-full" autocomplete="off" /></UFormField>
          <UFormField label="Nom affiché"><UInput v-model="form.displayName" class="w-full" /></UFormField>
          <UFormField label="E-mail" hint="pour envoyer l'invitation (facultatif)"><UInput v-model="form.email" type="email" class="w-full" /></UFormField>
          <UFormField label="Rôle"><USelect v-model="form.role" :items="roleItems" class="w-full" /></UFormField>
          <p class="text-xs text-muted">{{ roleHelp[form.role] }}</p>
          <UFormField v-if="form.role !== 'admin'" label="Logements autorisés">
            <div class="flex flex-wrap gap-3">
              <label v-for="l in data.logements" :key="l.id" class="flex items-center gap-1.5 text-sm"><input v-model="form.logements" type="checkbox" :value="l.id"> {{ l.name }}</label>
            </div>
          </UFormField>
          <p v-if="formError" class="text-sm text-error" role="alert">{{ formError }}</p>
          <div class="flex gap-2">
            <UButton type="submit" :label="editingId ? 'Enregistrer' : 'Créer et obtenir le lien'" :loading="busy" />
            <UButton color="neutral" variant="ghost" label="Annuler" @click="formOpen = false" />
          </div>
        </form>
      </template>
    </UModal>

    <!-- Lien d'invitation (affiché une seule fois) -->
    <UModal v-model:open="linkOpen" :title="linkInfo?.purpose === 'reset' ? 'Lien de réinitialisation' : 'Lien d\'invitation'">
      <template #body>
        <div v-if="linkInfo" class="space-y-3">
          <UAlert color="warning" variant="subtle" icon="i-lucide-triangle-alert" title="Ce lien n'est affiché qu'une seule fois"
                  :description="`Il est personnel, à usage unique, et expire le ${dt(linkInfo.expiresAt)}. Quiconque le possède peut choisir le mot de passe de ${linkInfo.name} : transmets-le seulement à cette personne.`" />
          <UInput :model-value="linkInfo.link" readonly class="w-full" @focus="($event.target as HTMLInputElement).select()" />
          <p v-if="linkInfo.emailSent" class="text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> Envoyé par e-mail à {{ linkInfo.email }}.</p>
          <p v-if="linkInfo.emailError" class="text-sm text-error" role="alert">E-mail non envoyé : {{ linkInfo.emailError }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton icon="i-lucide-copy" :label="copied ? 'Copié' : 'Copier le lien'" @click="copy" />
            <UButton color="neutral" variant="ghost" label="Fermer" @click="linkOpen = false" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
type Role = 'admin' | 'gestionnaire' | 'comptable' | 'menage'
const { user: me } = useAuth()
const { data, refresh } = await useFetch('/api/users')
const tab = ref(useRoute().query.tab === 'journal' ? 'journal' : 'comptes') // ?tab=journal : lien « Journal d'audit » du menu
const tabs = [{ label: 'Comptes', icon: 'i-lucide-users', value: 'comptes' }, { label: 'Journal', icon: 'i-lucide-scroll-text', value: 'journal' }]
const audit = ref<{ id: number; at: string; username: string; action: string; detail: string; ip: string }[]>([])
watch(tab, async (t) => { if (t === 'journal') audit.value = (await $fetch<{ entries: typeof audit.value }>('/api/audit')).entries }, { immediate: true })

const roleLabel: Record<string, string> = { admin: 'Administrateur', gestionnaire: 'Gestionnaire', comptable: 'Comptable', menage: 'Ménage' }
const roleHelp: Record<string, string> = {
  admin: 'Tout, y compris les réglages, les comptes et les connecteurs.',
  gestionnaire: 'Réservations, codes, documents, Bilan, stock et domotique de ses logements. Pas les réglages, ni l\'e-mail, ni les contacts.',
  comptable: 'Documents et Bilan de ses logements, en lecture seule.',
  menage: 'Stock de ses logements uniquement.',
}
const roleItems = (['admin', 'gestionnaire', 'comptable', 'menage'] as Role[]).map(r => ({ label: roleLabel[r]!, value: r }))
const nameOf = (id: number) => data.value?.logements.find(l => l.id === id)?.name ?? `#${id}`
const dt = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const actionLabel: Record<string, string> = {
  connexion: 'Connexion', connexion_echec: 'Échec de connexion', deconnexion: 'Déconnexion', mot_de_passe_change: 'Mot de passe changé', mot_de_passe_echec: 'Mot de passe actuel refusé',
  utilisateur_cree: 'Compte créé', utilisateur_modifie: 'Compte modifié', utilisateur_supprime: 'Compte supprimé', invitation_creee: 'Invitation créée', reinitialisation_creee: 'Réinitialisation créée',
  invitation_envoyee: 'Invitation envoyée par e-mail', oubli_demande: 'Mot de passe oublié (demande)', oubli_envoye: 'Mot de passe oublié : e-mail envoyé', oubli_echec: 'Mot de passe oublié : échec d\'envoi', reinitialisation_secours: 'Réinitialisation de secours (serveur)', compte_active: 'Compte activé', mot_de_passe_reinitialise: 'Mot de passe réinitialisé', sessions_fermees: 'Sessions fermées',
}

const error = ref('')
const msg = (e: any) => e?.data?.statusMessage || 'Échec, réessaie.'

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
  if (send && !confirm(`Envoyer le lien d'${u.pending ? 'invitation' : 'réinitialisation'} par e-mail à ${u.email} ?`)) return
  try {
    const r = await $fetch<{ link: string; purpose: string; expiresAt: string; emailSent: boolean; emailError: string }>(`/api/users/${u.id}/invite`, { method: 'POST', body: { send } })
    linkInfo.value = { ...r, name: u.displayName, email: u.email }; copied.value = false; linkOpen.value = true
    await refresh()
  } catch (e) { error.value = msg(e) }
}
async function copy() { try { await navigator.clipboard.writeText(linkInfo.value!.link); copied.value = true } catch { /* sélection manuelle possible */ } }
async function act(fn: () => Promise<unknown>) { error.value = ''; try { await fn() } catch (e) { error.value = msg(e) } await refresh() }
const revoke = (u: { id: number; displayName: string }) => confirm(`Fermer toutes les sessions de ${u.displayName} ?`) && act(() => $fetch(`/api/users/${u.id}/revoke-sessions`, { method: 'POST' }))
const toggle = (u: { id: number; displayName: string; email: string; role: Role; logements: number[]; active: boolean }) =>
  (u.active ? confirm(`Désactiver ${u.displayName} ? Ses sessions sont fermées immédiatement.`) : true) &&
  act(() => $fetch(`/api/users/${u.id}`, { method: 'PUT', body: { displayName: u.displayName, email: u.email, role: u.role, logements: u.logements, active: !u.active } }))
const remove = (u: { id: number; displayName: string }) => confirm(`Supprimer définitivement le compte de ${u.displayName} ?`) && act(() => $fetch(`/api/users/${u.id}`, { method: 'DELETE' }))
</script>
