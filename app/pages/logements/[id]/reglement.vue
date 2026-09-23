<script setup lang="ts">
// Deplace dans l'onglet "Règlement intérieur" de la page Livret Accueil (menu consolide, V3). Redirige les anciens liens.
const route = useRoute()
await navigateTo(`/logements/${route.params.id}/livret?onglet=reglement`, { replace: true })
</script>
