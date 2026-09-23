<template>
  <div>
    <div v-if="series.length > 1" class="mb-2 flex flex-wrap gap-4 text-xs">
      <span v-for="s in series" :key="s.label" class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-full" :style="{ backgroundColor: s.color }" />
        <span class="text-muted">{{ s.label }}</span>
      </span>
    </div>
    <svg :viewBox="`0 0 ${width} ${height}`" class="w-full overflow-visible" :style="{ height: `${height}px` }" preserveAspectRatio="none">
      <defs>
        <linearGradient v-for="s in series.filter(s => s.fill)" :id="gradId(s.label)" :key="s.label" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="s.color" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="s.color" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line v-for="i in 3" :key="i" x1="0" :x2="width" :y1="(i * plotHeight) / 4" :y2="(i * plotHeight) / 4" stroke="currentColor" class="text-default" stroke-width="1" opacity="0.15" />
      <template v-for="s in series" :key="s.label">
        <path v-if="s.fill" :d="`${smoothPath(pts(s.data))} L ${x(s.data.length - 1)},${plotHeight} L ${x(0)},${plotHeight} Z`" :fill="`url(#${gradId(s.label)})`" stroke="none" />
        <path :d="smoothPath(pts(s.data))" fill="none" :stroke="s.color" stroke-width="2.5" stroke-linecap="round" />
        <circle v-for="(v, i) in s.data" :key="i" :cx="x(i)" :cy="y(v)" r="3" :fill="s.color" />
      </template>
    </svg>
    <div class="mt-1 flex text-xs text-muted">
      <span v-for="(l, i) in labels" :key="i" class="flex-1" :class="i === 0 ? 'text-left' : i === labels.length - 1 ? 'text-right' : 'text-center'">{{ l }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  series: { label: string; color: string; data: number[]; fill?: boolean }[]
  labels: string[]
  height?: number
}>(), { height: 180 })

const width = 600
const plotHeight = computed(() => props.height - 20) // reserve la ligne de libelles sous le graphe
const max = computed(() => Math.max(1, ...props.series.flatMap(s => s.data)))
const min = computed(() => Math.min(0, ...props.series.flatMap(s => s.data)))
const span = computed(() => Math.max(1, max.value - min.value))
function x(i: number) {
  const n = props.labels.length
  return n <= 1 ? width / 2 : (i / (n - 1)) * width
}
function y(v: number) {
  return plotHeight.value - ((v - min.value) / span.value) * (plotHeight.value - 10) - 5
}
function pts(data: number[]): [number, number][] {
  return data.map((v, i) => [x(i), y(v)])
}
function gradId(label: string) {
  return `ac-grad-${label.replace(/[^a-z0-9]/gi, '')}`
}
</script>
