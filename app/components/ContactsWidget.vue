<template>
  <UCard v-if="due.length">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-semibold">À relancer</h3>
        <UButton size="xs" color="neutral" variant="link" to="/contacts" label="Contacts" trailing-icon="i-lucide-arrow-right" />
      </div>
    </template>
    <ul class="space-y-2 text-sm">
      <li v-for="c in due" :key="c.id" class="flex flex-wrap items-center justify-between gap-2">
        <span><b>{{ c.name }}</b> <span class="text-muted">· {{ c.kindLabel }}</span></span>
        <span class="flex items-center gap-1">
          <UBadge :color="c.followUp! < today ? 'error' : 'warning'" variant="subtle" :label="c.followUp! < today ? `En retard (${fr(c.followUp!)})` : fr(c.followUp!)" />
          <UButton v-if="c.phone" size="xs" color="neutral" variant="ghost" icon="i-lucide-phone" :to="`tel:${c.phone.replace(/[^\d+]/g, '')}`" external />
          <UButton v-if="c.email" size="xs" color="neutral" variant="ghost" icon="i-lucide-mail" :to="`mailto:${c.email}`" external />
        </span>
      </li>
    </ul>
  </UCard>
</template>

<script setup lang="ts">
// Contacts dont la date de relance est depassee ou dans les 7 jours (n'apparait que s'il y en a)
const { data } = await useFetch('/api/contacts')
const today = computed(() => data.value?.today ?? '')
const limit = computed(() => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10))
const due = computed(() => (data.value?.contacts ?? []).filter(c => c.followUp && c.followUp <= limit.value).sort((a, b) => a.followUp!.localeCompare(b.followUp!)))
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
</script>
