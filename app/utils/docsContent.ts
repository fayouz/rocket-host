// Contenu du manuel /docs, ecrit a la main (pas de @nuxt/content dans ce projet : depot prive, pas besoin d'un
// systeme de fichiers markdown pour une dizaine de pages). A completer a chaque nouvelle fonctionnalite marquante,
// comme docs/*.md mais destine a l'hote plutot qu'a un developpeur.
export interface DocSection {
  id: string
  title: string
  paragraphs?: string[]
  list?: string[]
}
export interface DocPage {
  slug: string
  title: string
  description: string
  group: string
  icon: string
  sections: DocSection[]
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    description: 'Ce que fait LoussaHousing et comment ce manuel est organisé.',
    group: 'Prise en main',
    icon: 'i-lucide-house',
    sections: [
      {
        id: 'a-quoi-ca-sert',
        title: 'À quoi ça sert',
        paragraphs: [
          'LoussaHousing centralise la gestion de tes logements en location courte durée : réservations (synchronisées depuis Lodgify), codes de porte (Nuki), ménage, stock, e-mails, documents, rentabilité, et les pages voyageur (livret d\'accueil, écran TV).',
          'L\'objectif : éviter de jongler entre Lodgify, Nuki, ta boîte mail et un tableur pour savoir qui arrive, qui part, si le ménage est fait et si le stock tient.',
        ],
      },
      {
        id: 'comment-lire-ce-manuel',
        title: 'Comment lire ce manuel',
        paragraphs: [
          'Les pages sont groupées par thème dans le menu de gauche : prise en main, puis tout ce qui concerne un logement (réservations, serrures, ménage), puis les pages voyageur (livret et écran TV), puis le reste (e-mails, rentabilité, réglages).',
        ],
        list: [
          'Chaque page décrit à quoi sert l\'écran correspondant dans l\'application et les décisions à connaître (pas une liste exhaustive de tous les boutons)',
          'Pour l\'API et les rôles exacts par route, voir Réglages > API (Swagger)',
          'Pour l\'historique des évolutions déjà livrées, voir Réglages > Nouveautés',
        ],
      },
    ],
  },
  {
    slug: 'connexion',
    title: 'Comptes et rôles',
    description: 'Qui peut voir/faire quoi dans l\'application.',
    group: 'Prise en main',
    icon: 'i-lucide-shield-check',
    sections: [
      {
        id: 'roles',
        title: 'Les rôles',
        paragraphs: [
          'Chaque compte a un rôle qui détermine ce qu\'il peut voir. Les rôles se combinent dans le code (ex. « AG ») mais concrètement :',
        ],
        list: [
          'Administrateur (A) : accès complet, y compris Réglages, e-mails, contacts, rentabilité',
          'Gestion (G) : réservations, serrures, codes, ménage, stock, livret/écran TV — pas les réglages ni la rentabilité',
          'Contacts/Documents (C) : accès limité aux documents et contacts',
          'Ménage (M) : accès limité au nécessaire pour faire le ménage (à venir : assistant ménage dédié)',
        ],
      },
      {
        id: 'mot-de-passe-oublie',
        title: 'Mot de passe oublié',
        paragraphs: [
          'Un lien « Mot de passe oublié » est disponible sur l\'écran de connexion. Les nouveaux comptes reçoivent un lien d\'activation à usage unique créé par l\'administrateur (Réglages > Utilisateurs).',
        ],
      },
    ],
  },
  {
    slug: 'reservations',
    title: 'Réservations',
    description: 'Voir les séjours d\'un logement et leur statut.',
    group: 'Logements',
    icon: 'i-lucide-calendar-check',
    sections: [
      {
        id: 'source',
        title: 'D\'où viennent les réservations',
        paragraphs: [
          'La liste est synchronisée depuis Lodgify (qui agrège lui-même Airbnb, Booking.com, etc.). Chaque réservation affiche la plateforme d\'origine, les dates, le statut (réservé/annulé) et si un code de porte a été créé.',
        ],
      },
      {
        id: 'apercu-livret',
        title: 'Aperçu du livret en encart',
        paragraphs: [
          'Un aperçu miniature du livret voyageur (welcomescreen) est affiché à droite de la liste, pour voir en un coup d\'œil ce que voit le voyageur sans quitter la page. Bouton « Rafraîchir » pour recharger l\'aperçu après un changement, « Ouvrir » pour le voir en grand.',
        ],
      },
    ],
  },
  {
    slug: 'serrures-codes',
    title: 'Serrures et codes',
    description: 'Gestion des codes de porte Nuki par réservation.',
    group: 'Logements',
    icon: 'i-lucide-key-round',
    sections: [
      {
        id: 'creation-automatique',
        title: 'Création automatique',
        paragraphs: [
          'Un code est prévu automatiquement pour chaque réservation à venir, mais il n\'est envoyé à la serrure Nuki qu\'après ton clic sur « Créer sur Nuki » (onglet Serrures) ou « Générer sur la serrure » (détail d\'une réservation). Son statut est « prévu », « créé » ou en erreur (à vérifier manuellement dans ce cas).',
        ],
      },
      {
        id: 'etat-serrure',
        title: 'Onglet Serrures',
        paragraphs: [
          'À gauche la liste des serrures du logement ; à droite la serrure choisie : état en direct et batterie en en-tête, les codes clavier des réservations à venir, et l\'historique des passages.',
        ],
      },
    ],
  },
  {
    slug: 'menage-stock',
    title: 'Ménage et stock',
    description: 'Suivi des turnovers et du réassort.',
    group: 'Logements',
    icon: 'i-lucide-sparkles',
    sections: [
      {
        id: 'menage',
        title: 'Ménage',
        paragraphs: [
          'Un ménage est programmé automatiquement entre un départ et l\'arrivée suivante (turnover). Le tableau de bord « Aujourd\'hui » liste les ménages du jour tous logements confondus.',
        ],
      },
      {
        id: 'stock',
        title: 'Stock',
        paragraphs: [
          'Le catalogue de consommables (café, papier toilette, produits d\'accueil…) est commun à tous les logements, avec une quantité et un seuil par logement. Un article sous le seuil apparaît comme « à racheter » sur le tableau de bord.',
        ],
      },
    ],
  },
  {
    slug: 'domotique',
    title: 'Domotique',
    description: 'Équipements Homey pilotables par logement.',
    group: 'Logements',
    icon: 'i-lucide-cpu',
    sections: [
      {
        id: 'principe',
        title: 'Principe',
        paragraphs: [
          'Les équipements Homey (chauffage, prises, capteurs…) d\'un logement sont visibles et pilotables depuis l\'onglet Domotique de ce logement. Les équipements marqués comme mis à disposition apparaissent aussi comme widget dans le livret et l\'écran TV, pour que le voyageur les pilote lui-même (ex. chauffage).',
        ],
      },
    ],
  },
  {
    slug: 'livret-accueil',
    title: 'Livret d\'accueil',
    description: 'La page mobile destinée au voyageur (welcomescreen).',
    group: 'Livret & Écran TV',
    icon: 'i-lucide-book-heart',
    sections: [
      {
        id: 'principe',
        title: 'Principe',
        paragraphs: [
          'Chaque logement a un lien secret (`/g/<jeton>`) et un QR code, sans compte à créer côté voyageur. Il regroupe : mot de bienvenue, Wi-Fi, instructions d\'arrivée/départ, accès, règlement intérieur, conseils du quartier, FAQ, et la domotique mise à disposition.',
        ],
      },
      {
        id: 'placeholder-guest',
        title: 'Personnaliser avec le prénom du voyageur',
        paragraphs: [
          'Dans le mot de bienvenue, écrire `{{guest}}` est remplacé automatiquement par le prénom du voyageur en cours de séjour (ex. « Bienvenue {{guest}} ! » devient « Bienvenue Mélissa ! »). Sans séjour en cours (aperçu, logement non synchronisé), un mot générique est utilisé à la place.',
        ],
      },
      {
        id: 'pages',
        title: 'Pages et widgets',
        paragraphs: [
          'Le contenu est organisé en pages (onglet Écran TV > carte « Pages ») : chaque page a un nom et regroupe un ou plusieurs widgets (météo, Wi-Fi, arrivée, départ…). Un widget non assigné à une page ne s\'affiche nulle part.',
          'Deux modes de navigation au choix (réglage « Navigation », partagé avec l\'écran TV) : Défilement (les pages s\'enchaînent en sections) ou Onglets (un carrousel balayable avec une barre de menu par icônes en bas, une page par slide).',
          'Chaque page peut avoir son propre fond d\'écran (en mode Onglets), qui remplace le fond du logement pour cette page seulement.',
        ],
      },
      {
        id: 'regenerer',
        title: 'Régénérer le lien',
        paragraphs: [
          'Le lien peut être régénéré si besoin (ex. affiché quelque part et à remplacer) : l\'ancien lien est immédiatement invalidé, et le lien de l\'écran TV change aussi puisqu\'il partage le même jeton.',
        ],
      },
    ],
  },
  {
    slug: 'ecran-tv',
    title: 'Écran TV',
    description: 'Le même contenu, en plein écran, pour un écran fixe dans le logement.',
    group: 'Livret & Écran TV',
    icon: 'i-lucide-tv',
    sections: [
      {
        id: 'principe',
        title: 'Principe',
        paragraphs: [
          'Même lien secret que le livret (`/tv/<jeton>`), pensé pour rester ouvert en permanence sur une tablette ou un écran Android avec Fully Kiosk Browser (voir `docs/ecran-tv-android.md` pour l\'installation). Grand texte, voyageur du jour affiché s\'il y en a un.',
        ],
      },
      {
        id: 'rechargement',
        title: 'Rechargement automatique',
        paragraphs: [
          'L\'écran se recharge tout seul un peu avant l\'arrivée du prochain voyageur, pour repartir sur un état propre sans intervention.',
        ],
      },
      {
        id: 'reglages-communs',
        title: 'Réglages communs avec le livret',
        paragraphs: [
          'Fond d\'écran, disposition (colonnes), widgets affichés et mode de navigation se règlent au même endroit que le livret (onglet Livret Accueil > Écran TV d\'un logement) et s\'appliquent aux deux surfaces.',
        ],
      },
    ],
  },
  {
    slug: 'emails-documents',
    title: 'E-mails et documents',
    description: 'Boîte mail classée par réservation, et fichiers par logement.',
    group: 'Autres',
    icon: 'i-lucide-mail',
    sections: [
      {
        id: 'emails',
        title: 'E-mails',
        paragraphs: [
          'La boîte IMAP est relevée et les messages sont automatiquement rattachés à un logement et, quand c\'est reconnaissable, à une réservation précise, avec des suggestions de rattachement quand ce n\'est pas certain.',
        ],
      },
      {
        id: 'documents',
        title: 'Documents',
        paragraphs: [
          'Chaque logement a un onglet Documents en deux parties : « Pièces comptables » (factures, taxes… avec catégorie et montant, qui alimentent le Bilan) et « Fichiers » (espace libre : contrats, diagnostics, photos, notices…), pour éviter de les chercher dans une boîte mail ou un dossier partagé.',
        ],
      },
    ],
  },
  {
    slug: 'rentabilite',
    title: 'Rentabilité',
    description: 'Revenus et charges, vue d\'ensemble et par logement.',
    group: 'Autres',
    icon: 'i-lucide-line-chart',
    sections: [
      {
        id: 'principe',
        title: 'Principe',
        paragraphs: [
          'Vue d\'ensemble des revenus (réservations) et des charges par logement, pour suivre la rentabilité sans tableur séparé. Réservé au rôle Administrateur.',
        ],
      },
    ],
  },
  {
    slug: 'reglages',
    title: 'Réglages généraux',
    description: 'Utilisateurs, stock, imports, e-mail, livret/écran TV.',
    group: 'Autres',
    icon: 'i-lucide-settings',
    sections: [
      {
        id: 'utilisateurs',
        title: 'Utilisateurs',
        paragraphs: [
          'Créer des comptes, définir leur rôle par logement, envoyer un lien d\'activation ou de réinitialisation de mot de passe.',
        ],
      },
      {
        id: 'stock',
        title: 'Stock',
        paragraphs: [
          'Le catalogue commun de consommables et leurs seuils par logement (voir aussi la page Ménage et stock).',
        ],
      },
      {
        id: 'livret-ecran-tv',
        title: 'Livret & écran TV',
        paragraphs: [
          'Réglages généraux qui s\'appliquent par défaut à tous les logements (fond par défaut, widgets), personnalisables ensuite logement par logement.',
        ],
      },
      {
        id: 'imports-et-imap',
        title: 'Imports et e-mail (IMAP)',
        paragraphs: [
          'Connexion à Lodgify/Nuki (imports) et à la boîte mail (IMAP) qui alimente la page E-mails.',
        ],
      },
    ],
  },
]

export function findDocPage(slug: string | string[]) {
  const s = Array.isArray(slug) ? slug[0] : slug
  return DOC_PAGES.find(p => p.slug === s)
}

// Pas de @nuxt/content dans ce projet : UContentNavigation/UContentSearch (qui en dependent) ne se resolvent pas,
// on reconstruit l'equivalent avec UNavigationMenu (deja utilise ailleurs dans l'appli) et UCommandPalette.
export function docsNavigation() {
  const groups = new Map<string, { label: string; defaultOpen: boolean; children: { label: string; to: string; icon: string }[] }>()
  for (const p of DOC_PAGES) {
    if (!groups.has(p.group)) groups.set(p.group, { label: p.group, defaultOpen: true, children: [] })
    groups.get(p.group)!.children.push({ label: p.title, to: `/docs/${p.slug}`, icon: p.icon })
  }
  return [...groups.values()]
}

export function docsSearchGroups() {
  const groups = new Map<string, { id: string; label: string; items: { label: string; suffix: string; icon: string; to: string }[] }>()
  for (const p of DOC_PAGES) {
    if (!groups.has(p.group)) groups.set(p.group, { id: p.group, label: p.group, items: [] })
    groups.get(p.group)!.items.push({ label: p.title, suffix: p.description, icon: p.icon, to: `/docs/${p.slug}` })
  }
  return [...groups.values()]
}
