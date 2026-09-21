# Où déployer LoussaHousing gratuitement

Recherche du 2026-09-21. **Prérequis : la gestion des utilisateurs** (`docs/plan-gestion-utilisateurs.md`) : on ne met pas en ligne un tableau de bord qui contient des codes de serrure, des données de voyageurs et des accès Lodgify / Nuki / Homey derrière un simple mot de passe partagé.

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
| **Petit VPS payant** (autre fournisseur européen) | quelques euros par mois (prix à vérifier au moment du choix) | Oui | Plan B fiable si Oracle refuse ou récupère la machine |

## Oracle Always Free : les détails vérifiés

D'après la [page officielle des ressources Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm) :
- **ARM (Ampere A1)** : **2 processeurs et 12 Go** de mémoire au total (une machine de 2 processeurs, ou deux de 1). Cela correspond à une **réduction de moitié** par rapport aux anciens 4 processeurs et 24 Go, datée de juin 2026 par la presse ([article](https://softwarecrit.com/news-oracle-always-free-arm-limits-halved)) ; la date de fin de tolérance (18 août 2026) n'apparaît dans aucune publication d'Oracle.
- **AMD « micro »** : jusqu'à 2 machines, **1 Go** de mémoire chacune (juste pour notre pile complète ; à réserver à un rôle secondaire).
- **Disque** : 200 Go au total (systèmes + volumes) ; **5 sauvegardes** ; **10 To** de sortie de données par mois.
- **Récupération d'une machine inactive** : une machine Always Free est **récupérée** si, sur 7 jours, l'usage du processeur, du réseau **et** (pour l'ARM) de la mémoire reste **sous 20 %**. Notre appli, peu sollicitée, risque de tomber dans ce cas : **c'est le principal risque**. Pistes : passer le compte en « paiement à l'usage » (les ressources Always Free restent gratuites, mais Oracle a donné des réponses contradictoires sur la protection contre la récupération : à vérifier avant de s'y fier), ou prévoir la reconstruction rapide de la machine à partir des sauvegardes.
- **Inscription** : carte bancaire et numéro de mobile ; la carte n'est pas débitée sans passage à l'offre payante. Le **pays d'origine (région) se choisit à l'inscription et ne change plus** : viser Paris ou Marseille (données en France), en vérifiant la disponibilité de l'ARM.
- Une machine de 2 processeurs / 12 Go suffit largement à l'appli + n8n + Traefik.

## Recommandation

1. **Oracle Always Free en France** (ARM 2 processeurs / 12 Go), avec **sauvegardes quotidiennes chiffrées hors d'Oracle** et une procédure de reconstruction testée. Nom de domaine : **DuckDNS** gratuit (déjà prévu) ou un vrai domaine (~10 €/an, nécessaire pour Cloudflare).
2. **Plan B** : petit VPS payant (quelques euros par mois) si l'inscription Oracle échoue, si la machine est récupérée ou si la capacité manque.
3. **Alternative « maison »** si l'accès local à Homey / Nuki devient important : Raspberry Pi à Béglès + Cloudflare Tunnel. À décider après l'étape « utilisateurs ».

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
