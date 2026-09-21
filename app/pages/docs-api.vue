<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">API — documentation Swagger</h1>
      <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-download" label="openapi.json" to="/api/docs/openapi.json" external target="_blank" />
    </div>
    <p class="text-sm text-muted">Générée depuis la table des permissions : elle indique, pour chaque route, les rôles autorisés et le périmètre. « Try it out » utilise ta session (les écritures agissent réellement).</p>
    <div id="swagger" class="swagger-host rounded-lg border border-default bg-white p-2 text-black" />
  </div>
</template>

<script setup lang="ts">
useHead({ link: [{ rel: 'stylesheet', href: '/_docs-ui/swagger-ui.css' }] })
onMounted(async () => {
  await new Promise<void>((ok, ko) => {
    if ((window as any).SwaggerUIBundle) return ok()
    const s = document.createElement('script')
    s.src = '/_docs-ui/swagger-ui-bundle.js'; s.onload = () => ok(); s.onerror = () => ko(new Error('Swagger UI introuvable'))
    document.head.appendChild(s)
  })
  ;(window as any).SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger', docExpansion: 'none', defaultModelsExpandDepth: -1, tryItOutEnabled: false })
})
</script>
