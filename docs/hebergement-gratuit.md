# Où déployer LoussaHousing

Recherche du 2026-09-21, complétée le 2026-09-22. **Prérequis rempli** : la gestion des utilisateurs (`docs/plan-gestion-utilisateurs.md`) est construite (comptes, rôles, mot de passe oublié).

**État au 2026-09-22** : le user a un nom de domaine (`loussahousing.fr`) et une **IP fixe** à Béglès → piste retenue en premier : héberger sur le Mac mini de Béglès (celui utilisé pour développer), DNS classique + Traefik (pas Cloudflare Tunnel, inutile avec une IP fixe), redirection de ports 80/443 sur la Bbox. **Bloquant actuel : le disque du Mac est presque plein** (sous les 2 Go libres, continue de baisser) — à assainir avant tout `docker build`/`npm install` de production, cf. [[project-open-items]]. Oracle et le VPS ci-dessous restent le plan B si Béglès ne convient pas (fiabilité de la connexion, panne, etc.).

## Ce que l'appli exige de l'hébergement

- Un **processus Node qui reste allumé** (relevé IMAP toutes les N minutes, planification), donc pas de « mise en veille ».
- Un **disque qui survit aux redémarrages** : base SQLite et fichiers déposés (`/app/.data`, volume Docker).
- Docker Compose : appli + n8n + Traefik + filtre d'accès à Docker (`docs/deploiement.md`). Environ 1 à 2 Go de mémoire suffisent.
- HTTPS, un nom de domaine, des **sauvegardes** hors de la machine (données sensibles).

## Comparatif

| Option | Coût | Convient ? | Points d'attention |
|---|---|---|---|
| **Oracle Cloud « Always Free »** (machine virtuelle) | 0 € | **Oui, meilleure piste gratuite** | Voir ci-dessous : offre réduite en 2026, risque de récupération d'une machine peu utilisée, carte bancaire et téléphone demandés à l'inscription, capacité parfois indisponible |
| **Serveur à la maison** (Raspberry Pi 5 ou petit PC, à Béglès par exemple) + **Cloudflare Tunnel** | Matériel ~80–120 € une fois ; tunnel gratuit ; **il faut un nom de domaine** (~10 €/an) | Oui, si le domicile est fiable | Aucun port à ouvrir, HTTPS automatique. Avantage : accès **local** direct au Homey et au pont Nuki. Inconvénients : panne de courant ou d'internet, sécurité physique, dépannage sur place |
| **Render (offre gratuite)** | 0 € | **Non** | Le service s'endort après 15 minutes d'inactivité (relevés IMAP arrêtés) ; pas de disque durable sur l'offre gratuite d'après nos lectures (SQLite perdue à chaque redémarrage) |
| **Koyeb (offre gratuite)** | 0 € | **Non, probablement** | Un service qui s'endort quand personne ne l'utilise ; disque durable non confirmé |
| **Fly.io, Railway** | Payant (Fly.io n'a plus d'offre gratuite pour les nouveaux comptes ; Railway : crédit d'essai) | Techniquement oui, mais pas gratuit | À écarter si l'objectif est 0 € |
| **Petit VPS payant** (voir comparatif ci-dessous) | ~7 à 15 €/mois | Oui | Plan B fiable si Oracle refuse ou récupère la machine, ou si Béglès pose problème |

## Oracle Always Free : les détails vérifiés

D'après la [page officielle des ressources Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm) :
- **ARM (Ampere A1)** : **2 processeurs et 12 Go** de mémoire au total (une machine de 2 processeurs, ou deux de 1). Cela correspond à une **réduction de moitié** par rapport aux anciens 4 processeurs et 24 Go, datée de juin 2026 par la presse ([article](https://softwarecrit.com/news-oracle-always-free-arm-limits-halved)) ; la date de fin de tolérance (18 août 2026) n'apparaît dans aucune publication d'Oracle.
- **AMD « micro »** : jusqu'à 2 machines, **1 Go** de mémoire chacune (juste pour notre pile complète ; à réserver à un rôle secondaire).
- **Disque** : 200 Go au total (systèmes + volumes) ; **5 sauvegardes** ; **10 To** de sortie de données par mois.
- **Récupération d'une machine inactive** : une machine Always Free est **récupérée** si, sur 7 jours, l'usage du processeur, du réseau **et** (pour l'ARM) de la mémoire reste **sous 20 %**. Notre appli, peu sollicitée, risque de tomber dans ce cas : **c'est le principal risque**. Pistes : passer le compte en « paiement à l'usage » (les ressources Always Free restent gratuites, mais Oracle a donné des réponses contradictoires sur la protection contre la récupération : à vérifier avant de s'y fier), ou prévoir la reconstruction rapide de la machine à partir des sauvegardes.
- **Inscription** : carte bancaire et numéro de mobile ; la carte n'est pas débitée sans passage à l'offre payante. Le **pays d'origine (région) se choisit à l'inscription et ne change plus** : viser Paris ou Marseille (données en France), en vérifiant la disponibilité de l'ARM.
- Une machine de 2 processeurs / 12 Go suffit largement à l'appli + n8n + Traefik.

## Comparatif VPS (plan B), classé par prix avec indice de confiance (2026-09-22)

Le user parle anglais : le manque de support en français n'est plus un critère d'élimination.

| Rang | Fournisseur | Prix/mois | RAM | Convient à notre pile ? | Confiance |
|---|---|---|---|---|---|
| — | **Oracle Always Free** | **0 €** | 12 Go | ✅ Largement | 🟢 Élevée — page officielle Oracle lue directement |
| 1 | RackNerd | ~1,80 € | 512 Mo | ❌ Trop juste | 🟡 Moyenne — chiffre de blog, jamais confirmé sur le site |
| 2 | Bluehost NVME 2 | ~1,95 € | 2 Go | ⚠️ Engagement 24 mois, hébergeur US (localisation des données à vérifier) | 🟡 Moyenne |
| 3 | IONOS | ~2 € (annoncé) | inconnue à ce prix | ❓ Impossible à dire | 🔴 Faible — aucune caractéristique associée à ce tarif dans mes sources |
| 4 | Vultr | ~2,50 € (annoncé) | probablement < 2 Go | ❌ Probablement trop juste | 🔴 Faible |
| 5 | **netcup VPS nano** | **3,69 €** | 2 Go | ✅ Oui, juste | 🟢 Élevée — page officielle netcup lue directement |
| 6 | DigitalOcean | ~4 $ (~3,70 €) | probablement 512 Mo–1 Go à ce prix | ❓ À vérifier | 🔴 Faible |
| 7 | Contabo VPS S | ~4,50 à 6,99 € | 8 Go | ✅ Large marge | 🟡 Moyenne — specs solides, prix qui varie du simple au double selon la source (promo/liste/engagement), réputation support/perf en retrait |
| 8 | Hetzner CX23 | ~5,50 € | 4 Go | ✅ Oui | 🟡 Moyenne — disponibilité de cette offre incertaine en ce moment |
| 9 | netcup VPS Lite 1 | 5,86 € | 4 Go | ✅ Oui, confortable | 🟢 Élevée — même source que #5 |
| 10 | OVH Value | ~7 € TTC | 2 Go | ✅ Oui, juste | 🟢 Élevée — plusieurs sources convergentes, France |
| 11 | Hostinger | ~6,49 $ (~6 €) | inconnue à ce prix | ❓ À vérifier | 🔴 Faible |
| 12 | OVH Essentiel | ~15 € TTC | 4 Go | ✅ Oui, confortable | 🟢 Élevée — France |

**Conclusion** : parmi les offres où prix et caractéristiques sont fiables (🟢/🟡), **netcup VPS nano (3,69 €, sans engagement) est le moins cher qui convient**, suivi de Contabo VPS S si l'incertitude sur son prix réel et les réserves sur son support sont acceptables. Les lignes 🔴 ne sont pas des recommandations : pas assez de matière pour les comparer honnêtement sans vérifier directement sur le site du fournisseur. Rien ne bat **Oracle Always Free à 0 €**, au prix du risque de récupération de la machine.

## Recommandation (mise à jour 2026-09-22)

1. **Béglès (Mac mini, IP fixe, domaine `loussahousing.fr`)** — retenu en premier : gratuit (matériel déjà là), accès **local** à Homey, DNS classique + Traefik (pas besoin de Cloudflare Tunnel avec une IP fixe). À faire avant : assainir le disque du Mac (voir état plus haut), réserver son IP locale par DHCP, rediriger les ports 80/443 sur la Bbox.
2. **Plan B : OVH Essentiel** (~15 € TTC/mois, voir comparatif) si Béglès s'avère peu fiable (coupures, disque, dépannage sur place).
3. **Oracle Always Free** reste une option gratuite si le user préfère ne pas dépendre de sa machine personnelle, avec le risque de récupération déjà détaillé.

Le mot « gratuit » a ici un prix caché : **la fiabilité**. Les codes d'accès des voyageurs transitent par cette machine ; une panne ou une récupération peut couper le tableau de bord (pas les serrures ni les codes déjà créés sur Nuki).

## À trancher

1. Oracle gratuit d'abord (avec plan B payant), ou directement un petit VPS payant fiable ?
2. Nom de domaine : DuckDNS (gratuit) ou domaine à toi (~10 €/an) ?
3. Sauvegardes hors machine : où (ton Mac, disque externe, stockage objet gratuit) ?
4. L'idée « serveur à Béglès » vaut-elle d'être étudiée ?

## Sources

- [Ressources Always Free, documentation Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)
- [Réduction de l'offre ARM (juin 2026)](https://softwarecrit.com/news-oracle-always-free-arm-limits-halved)
- [Offres gratuites 2026 : Render, Koyeb, Railway](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026) ; [Fly.io après la fin de l'offre gratuite](https://expresstech.io/7-fly-io-alternatives-in-2026-real-pricing-after-the-free-tier-died/)
- [Cloudflare Tunnel sur Raspberry Pi](https://raspberrytips.com/cloudflare-selfhosted-website/)
- [Prix VPS OVHcloud 2026](https://www.cachem.fr/ovh-gamme-vps-changements/) ; [Comparatif VPS 2026 (Hetzner, Contabo, OVH)](https://www.experte.com/server/cheap-vps) ; [Tarifs Hetzner Cloud 2026](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/) ; [Tarifs netcup VPS Lite](https://www.netcup.com/en/server/vps-lite)
