<template>
  <UPage v-if="page">
    <UPageHeader :title="page.title" :description="page.description" :headline="page.group" />
    <UPageBody>
      <section v-for="s in page.sections" :key="s.id" class="mb-8 scroll-mt-20">
        <h2 :id="s.id" class="mb-3 text-xl font-semibold">{{ s.title }}</h2>
        <p v-for="(p, i) in s.paragraphs" :key="i" class="mb-3 text-muted leading-relaxed">{{ p }}</p>
        <ul v-if="s.list" class="list-disc space-y-1 pl-5 text-muted">
          <li v-for="(item, i) in s.list" :key="i">{{ item }}</li>
        </ul>
      </section>

      <USeparator />
      <UPageLinks title="Autres pages" :links="siblingLinks" />
    </UPageBody>

    <template v-if="page.sections.length > 1" #right>
      <UPageAside>
        <p class="mb-2 text-sm font-semibold">Sur cette page</p>
        <nav class="space-y-1 border-s border-default text-sm">
          <a v-for="s in page.sections" :key="s.id" :href="`#${s.id}`" class="block border-s-2 border-transparent py-1 ps-3 -ms-px text-muted hover:border-default hover:text-default">{{ s.title }}</a>
        </nav>
      </UPageAside>
    </template>
  </UPage>
  <div v-else class="py-12 text-center text-muted">Page introuvable.</div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'docs' })
const route = useRoute()
const page = computed(() => findDocPage(route.params.slug as string))
if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Page introuvable', fatal: true })

useHead({ title: () => `${page.value?.title} — Manuel` })

const siblingLinks = computed(() => DOC_PAGES
  .filter(p => p.slug !== page.value?.slug)
  .slice(0, 4)
  .map(p => ({ label: p.title, icon: p.icon, to: `/docs/${p.slug}` })))
</script>
