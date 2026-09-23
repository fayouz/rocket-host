<template>
  <div>
    <div class="mb-2 flex flex-wrap gap-4 text-xs">
      <span v-for="s in series" :key="s.label" class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-full" :style="{ backgroundColor: s.color }" />
        <span class="text-muted">{{ s.label }}</span>
      </span>
    </div>
    <svg :viewBox="`0 0 ${width} ${height}`" class="w-full" :style="{ height: `${height}px` }" preserveAspectRatio="none">
      <line v-for="y in 3" :key="y" x1="0" :x2="width" :y1="(y * (height - padBottom)) / 4" :y2="(y * (height - padBottom)) / 4" stroke="currentColor" class="text-default" stroke-width="1" opacity="0.15" />
      <polyline
        v-for="s in series" :key="s.label" :points="points(s.data)" fill="none" :stroke="s.color" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"
      />
      <g v-for="s in series" :key="`${s.label}-dots`">
        <circle v-for="(v, i) in s.data" :key="i" :cx="x(i)" :cy="y(v)" r="3" :fill="s.color" />
      </g>
    </svg>
    <div class="mt-1 flex text-xs text-muted">
      <span v-for="(l, i) in labels" :key="i" class="flex-1 text-center">{{ l }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  series: { label: string; color: string; data: number[] }[]
  labels: string[]
  height?: number
}>(), { height: 180 })

const width = 600
const padBottom = 8
const max = computed(() => Math.max(1, ...props.series.flatMap(s => s.data)))
function x(i: number) {
  const n = props.labels.length
  return n <= 1 ? width / 2 : (i / (n - 1)) * width
}
function y(v: number) {
  return (height.value - padBottom) - (v / max.value) * (height.value - padBottom - 10)
}
const height = computed(() => props.height)
function points(data: number[]) {
  return data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
}
</script>
