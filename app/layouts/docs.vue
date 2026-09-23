<template>
  <div>
    <UHeader title="LoussaHousing" to="/" class="print:hidden" :ui="{ container: 'max-w-none' }">
      <UNavigationMenu :items="links" />
      <template #right>
        <UButton color="neutral" variant="outline" icon="i-lucide-search" label="Rechercher…" class="hidden sm:flex" @click="searchOpen = true">
          <template #trailing><UKbd value="meta_k" /></template>
        </UButton>
        <UButton color="neutral" variant="ghost" icon="i-lucide-search" class="sm:hidden" @click="searchOpen = true" />
        <UColorModeSelect />
      </template>
      <template #body>
        <UNavigationMenu :items="links" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>
    <UMain>
      <UContainer class="max-w-none py-6">
        <UPage>
          <template #left>
            <UPageAside>
              <UNavigationMenu :items="navigation" orientation="vertical" :collapsed="false" />
            </UPageAside>
          </template>
          <slot />
        </UPage>
      </UContainer>
    </UMain>

    <UModal v-model:open="searchOpen" :ui="{ content: 'sm:max-w-xl' }">
      <template #content>
        <UCommandPalette
          :groups="searchGroups" placeholder="Rechercher dans le manuel…" :close="{ onClick: () => searchOpen = false }"
          @update:model-value="onSelect"
        />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const navigation = docsNavigation()
const searchGroups = docsSearchGroups()
const links = [{ label: 'Retour à l\'application', icon: 'i-lucide-arrow-left', to: '/' }]
const searchOpen = ref(false)
defineShortcuts({ meta_k: () => { searchOpen.value = !searchOpen.value } })
function onSelect(item: { to?: string } | { to?: string }[]) {
  const target = Array.isArray(item) ? item[0] : item
  if (target?.to) { searchOpen.value = false; router.push(target.to) }
}
</script>
