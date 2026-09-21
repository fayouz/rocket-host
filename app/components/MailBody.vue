<template>
  <iframe ref="frame" :srcdoc="doc" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" class="w-full rounded-md bg-white" :style="{ height: `${height}px` }" title="Contenu du message" @load="fit" />
</template>

<script setup lang="ts">
// HTML deja nettoye par le serveur. Le cadre n'execute aucun script (sandbox sans allow-scripts) et la CSP interdit tout chargement distant ;
// allow-same-origin sert uniquement a mesurer la hauteur du contenu.
const props = defineProps<{ html: string }>()
const frame = ref<HTMLIFrameElement | null>(null)
const height = ref(300)
const doc = computed(() => `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><base target="_blank"><style>body{margin:12px;font:14px/1.5 system-ui,sans-serif;color:#111;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style>${props.html}`)
function fit() {
  const d = frame.value?.contentDocument
  if (d) height.value = Math.min(Math.max(d.documentElement.scrollHeight + 4, 120), 4000)
}
</script>
