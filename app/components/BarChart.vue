<template>
  <div class="flex items-end gap-2 sm:gap-3" :style="{ height: `${height}px` }">
    <div v-for="d in data" :key="d.label" class="flex h-full flex-1 flex-col items-center justify-end gap-1 min-w-0">
      <span class="text-xs font-medium text-muted">{{ format(d.value) }}</span>
      <div
        class="w-full rounded-t transition-all" :class="d.highlight ? 'bg-primary' : 'bg-primary/40'"
        :style="{ height: `${barHeight(d.value)}px` }"
      />
      <span class="truncate text-xs text-muted">{{ d.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: { label: string; value: number; highlight?: boolean }[]
  height?: number
  format?: (n: number) => string
}>(), { height: 160, format: (n: number) => String(n) })

const max = computed(() => Math.max(1, ...props.data.map(d => d.value)))
const trackHeight = computed(() => props.height - 36) // reserve : libelle valeur + libelle mois
function barHeight(v: number) {
  if (v <= 0) return 2
  return Math.max(3, Math.round((v / max.value) * trackHeight.value))
}
</script>
