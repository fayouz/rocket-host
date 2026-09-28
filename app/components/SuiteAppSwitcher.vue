<template>
  <!-- Selecteur d'applications de la suite Rocket (liste publiee par Rocket Auth). Invisible sans Rocket Auth. -->
  <UPopover v-if="data?.enabled && (data.apps.length || data.account)">
    <UTooltip text="Applications Rocket">
      <UButton color="neutral" variant="ghost" square icon="i-lucide-grid-3x3" aria-label="Applications Rocket" />
    </UTooltip>
    <template #content>
      <div class="w-72 p-2">
        <p class="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-dimmed">Suite Rocket</p>
        <div class="grid grid-cols-3 gap-1">
          <a v-for="app in data.apps" :key="app.id + app.url" :href="app.url" :title="app.description || app.name"
            class="flex flex-col items-center gap-1 rounded-md p-2 text-center text-xs hover:bg-elevated">
            <UIcon :name="app.icon || 'i-lucide-app-window'" class="size-6 text-primary" />
            <span class="line-clamp-2">{{ app.name }}</span>
          </a>
        </div>
        <UButton v-if="data.account" :to="data.account" external target="_blank" block size="sm" color="neutral" variant="ghost" icon="i-lucide-user-cog" label="Mon compte Rocket" class="mt-2" />
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
interface SuiteApp { id: string; name: string; url: string; icon?: string; description?: string }
const { data } = await useFetch<{ enabled: boolean; apps: SuiteApp[]; account?: string | null }>('/api/auth/rocket/apps', { key: 'suite-apps', default: () => ({ enabled: false, apps: [] }) })
</script>
