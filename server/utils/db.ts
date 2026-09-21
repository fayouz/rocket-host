// Mini base SQLite : reglages que l'API Lodgify/Nuki ne fournit pas.
export async function initDb() {
  const db = useDatabase()
  // Ajout de colonne idempotent (deux initialisations simultanees au rechargement a chaud ne doivent pas s'entrechoquer)
  const addColumn = async (sql: string) => { try { await db.exec(sql) } catch (e: any) { if (!/duplicate column/i.test(String(e?.message))) throw e } }
  await db.exec('PRAGMA busy_timeout = 8000') // rechargement a chaud : l'ancien processus peut encore tenir la base quelques instants
  await db.exec('CREATE TABLE IF NOT EXISTS property_alias (property_id INTEGER PRIMARY KEY, alias TEXT NOT NULL)')
  // Logements : entite propre a l'appli, associee (ou non) a un logement Lodgify. Les autres tables restent indexees par l'id Lodgify.
  await db.exec('CREATE TABLE IF NOT EXISTS logement (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, lodgify_property_id INTEGER UNIQUE)')
  await db.exec('CREATE TABLE IF NOT EXISTS lock_link (lock_id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL)')
  await db.exec(`CREATE TABLE IF NOT EXISTS access_code (
    booking_id INTEGER PRIMARY KEY, lock_id INTEGER NOT NULL, code TEXT NOT NULL,
    valid_from TEXT NOT NULL, valid_until TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned', error TEXT, created_at TEXT)`)
  // Regles de messages automatiques Lodgify (l'API ne les expose pas : copiees depuis Parametres > Notifications personnalisees)
  await db.exec(`CREATE TABLE IF NOT EXISTS message_rule (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, anchor TEXT NOT NULL, offset_days INTEGER NOT NULL,
    send_time TEXT NOT NULL, channels TEXT NOT NULL)`)
  const rules = await db.sql`SELECT COUNT(*) AS n FROM message_rule`
  if (!Number((rules.rows[0] as any).n)) {
    await db.sql`INSERT INTO message_rule (name, anchor, offset_days, send_time, channels) VALUES ('Instructions d''accès', 'arrival', 0, '14:00', 'airbnb,booking,manual')`
    await db.sql`INSERT INTO message_rule (name, anchor, offset_days, send_time, channels) VALUES ('Instructions de départ', 'departure', 0, '08:00', 'airbnb,booking,manual')`
    await db.sql`INSERT INTO message_rule (name, anchor, offset_days, send_time, channels) VALUES ('Après la première nuit', 'arrival', 1, '07:00', 'airbnb,booking')`
  }
  // Assignations des taches de menage, copiees de Lodgify > PM Modules > Taches (l'API ne les expose pas)
  await db.exec('CREATE TABLE IF NOT EXISTS cleaning_task (booking_id INTEGER PRIMARY KEY, assignee TEXT NOT NULL, status TEXT NOT NULL, synced_at TEXT NOT NULL)')
  const tasks = await db.sql`SELECT COUNT(*) AS n FROM cleaning_task`
  if (!Number((tasks.rows[0] as any).n)) {
    const snap: [number, string, string][] = [
      [1000001, 'Prénom Nom', 'À compléter'], [1000002, 'Prénom Nom', 'À compléter'], [1000003, 'Prénom Nom', 'À compléter'],
      [1000004, 'Cleaning-staff', 'Non assignée'], [1000005, 'Cleaning-staff', 'Non assignée'],
    ]
    for (const [id, who, st] of snap) await db.sql`INSERT OR IGNORE INTO cleaning_task (booking_id, assignee, status, synced_at) VALUES (${id}, ${who}, ${st}, '2026-09-19')`
  }
  // Stock : catalogue d'articles, niveau par logement (ok/low/empty), lien secret par logement (QR code)
  await db.exec(`CREATE TABLE IF NOT EXISTS stock_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, asin TEXT NOT NULL DEFAULT '',
    reorder_qty INTEGER NOT NULL DEFAULT 1, subscription INTEGER NOT NULL DEFAULT 0)`)
  await db.exec(`CREATE TABLE IF NOT EXISTS stock_level (
    property_id INTEGER NOT NULL, item_id INTEGER NOT NULL, level TEXT NOT NULL DEFAULT 'ok', updated_at TEXT NOT NULL,
    PRIMARY KEY (property_id, item_id))`)
  // Documents par logement (factures, taxes, assurances...) : metadonnees ici, fichiers dans .data/documents/ (jamais dans git)
  await db.exec(`CREATE TABLE IF NOT EXISTS document (
    id INTEGER PRIMARY KEY AUTOINCREMENT, logement_id INTEGER NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL,
    doc_date TEXT NOT NULL, amount REAL, note TEXT NOT NULL DEFAULT '', file_path TEXT NOT NULL, original_name TEXT NOT NULL,
    mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL)`)
  // Imports (n8n -> appli) : provenance des documents (dedoublonnage par source + id externe, ou par contenu), lignes de releves
  // de plateformes (commissions, taxes de sejour, reversements) et journal. logement_id = 0 : pas encore affecte a un logement.
  const docCols = ((await db.prepare('PRAGMA table_info(document)').all()) as any[]).map(c => String(c.name))
  if (!docCols.includes('source')) await addColumn("ALTER TABLE document ADD COLUMN source TEXT NOT NULL DEFAULT 'manuel'")
  if (!docCols.includes('external_id')) await addColumn('ALTER TABLE document ADD COLUMN external_id TEXT')
  if (!docCols.includes('sha256')) await addColumn('ALTER TABLE document ADD COLUMN sha256 TEXT')
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS document_external ON document (source, external_id) WHERE external_id IS NOT NULL')
  await db.exec(`CREATE TABLE IF NOT EXISTS platform_transaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, external_id TEXT NOT NULL, logement_id INTEGER NOT NULL DEFAULT 0,
    tx_date TEXT NOT NULL, kind TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
    booking_ref TEXT, label TEXT NOT NULL DEFAULT '', imported_at TEXT NOT NULL, UNIQUE (source, external_id))`)
  await db.exec('CREATE TABLE IF NOT EXISTS import_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, source TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL DEFAULT \'\')')
  // Lecture d'une boite e-mail en IMAP (Reglages > E-mail) : configuration SANS mot de passe (il reste dans .env : IMAP_PASSWORD),
  // regles "expediteur -> source / categorie / logement" et etat du dernier releve.
  await db.exec(`CREATE TABLE IF NOT EXISTS imap_config (
    id INTEGER PRIMARY KEY CHECK (id = 1), enabled INTEGER NOT NULL DEFAULT 0, host TEXT NOT NULL DEFAULT 'ssl0.ovh.net', port INTEGER NOT NULL DEFAULT 993,
    secure INTEGER NOT NULL DEFAULT 1, user TEXT NOT NULL DEFAULT '', folder TEXT NOT NULL DEFAULT 'INBOX', interval_min INTEGER NOT NULL DEFAULT 15,
    since_days INTEGER NOT NULL DEFAULT 30, last_uid INTEGER NOT NULL DEFAULT 0, uid_validity INTEGER NOT NULL DEFAULT 0,
    last_run_at TEXT, last_result TEXT NOT NULL DEFAULT '')`)
  await db.exec('INSERT OR IGNORE INTO imap_config (id) VALUES (1)')
  const imapCols = ((await db.prepare('PRAGMA table_info(imap_config)').all()) as any[]).map(c => String(c.name))
  if (!imapCols.includes('provider')) await addColumn("ALTER TABLE imap_config ADD COLUMN provider TEXT NOT NULL DEFAULT 'ovh-mxplan'")
  await db.exec(`CREATE TABLE IF NOT EXISTS imap_rule (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sender TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', source TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'autre_doc', logement_id INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1)`)
  // Mini CRM : contacts (comptable, artisans, assureur...), logements concernes (aucun lien = tous), historique des echanges
  await db.exec(`CREATE TABLE IF NOT EXISTS contact (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'autre', company TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '', phone2 TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', follow_up TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  await db.exec('CREATE TABLE IF NOT EXISTS contact_logement (contact_id INTEGER NOT NULL, logement_id INTEGER NOT NULL, PRIMARY KEY (contact_id, logement_id))')
  await db.exec('CREATE TABLE IF NOT EXISTS contact_interaction (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER NOT NULL, at TEXT NOT NULL, note TEXT NOT NULL)')
  // Interface e-mail : cache local des EN-TETES + apercu (300 caracteres) des messages ; le corps et les pieces jointes sont relus
  // dans la boite a la demande, jamais stockes. mail_link : rattachement d'un message a une reservation ou a un contact
  // (method : auto | manual | removed — "removed" empeche l'association automatique de revenir).
  await db.exec(`CREATE TABLE IF NOT EXISTS mail_message (
    id INTEGER PRIMARY KEY AUTOINCREMENT, folder TEXT NOT NULL, uid INTEGER NOT NULL, uid_validity INTEGER NOT NULL DEFAULT 0, message_id TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '', from_addr TEXT NOT NULL DEFAULT '', to_addrs TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL, snippet TEXT NOT NULL DEFAULT '', attach_json TEXT NOT NULL DEFAULT '[]', synced_at TEXT NOT NULL, UNIQUE (folder, uid_validity, uid))`)
  await db.exec('CREATE INDEX IF NOT EXISTS mail_message_date ON mail_message (date)')
  await db.exec(`CREATE TABLE IF NOT EXISTS mail_link (
    message_id INTEGER NOT NULL, kind TEXT NOT NULL, target_id INTEGER NOT NULL, score INTEGER NOT NULL DEFAULT 100, method TEXT NOT NULL DEFAULT 'auto',
    PRIMARY KEY (message_id, kind, target_id))`)
  await addColumn('ALTER TABLE imap_config ADD COLUMN sync_mail INTEGER NOT NULL DEFAULT 0')
  await addColumn('ALTER TABLE imap_config ADD COLUMN mail_days INTEGER NOT NULL DEFAULT 60')
  await addColumn('ALTER TABLE imap_config ADD COLUMN mail_synced_at TEXT')
  await addColumn("ALTER TABLE imap_config ADD COLUMN mail_result TEXT NOT NULL DEFAULT ''")
  // Envoi (SMTP) et dossiers de la messagerie. Dossiers = etiquettes propres a l'appli (rien n'est deplace dans la boite) :
  // « Logements » (+ un sous-dossier par logement) et « Comptabilite » sont systeme et se remplissent automatiquement ;
  // les autres sont libres, avec des regles expediteur / objet. mail_folder_item.method : auto | manual | removed.
  await addColumn("ALTER TABLE imap_config ADD COLUMN smtp_host TEXT NOT NULL DEFAULT 'ssl0.ovh.net'")
  await addColumn('ALTER TABLE imap_config ADD COLUMN smtp_port INTEGER NOT NULL DEFAULT 465')
  await addColumn('ALTER TABLE imap_config ADD COLUMN smtp_secure INTEGER NOT NULL DEFAULT 1')
  await addColumn("ALTER TABLE imap_config ADD COLUMN from_name TEXT NOT NULL DEFAULT ''")
  await addColumn("ALTER TABLE imap_config ADD COLUMN sent_folder TEXT NOT NULL DEFAULT ''")
  await addColumn("ALTER TABLE imap_config ADD COLUMN spam_folder TEXT NOT NULL DEFAULT ''")
  // Dossiers = miroir des vrais dossiers IMAP (rien de virtuel). managed : logements | logement | compta | treated = dossiers de rangement
  // crees et remplis par l'appli. Ancien schema (dossiers virtuels, jamais utilise) : recree.
  const folderCols = ((await db.prepare('PRAGMA table_info(mail_folder)').all()) as any[]).map(c => String(c.name))
  if (folderCols.length && !folderCols.includes('path')) {
    await db.exec('DROP TABLE IF EXISTS mail_folder_item')
    await db.exec('DROP TABLE IF EXISTS mail_folder_rule')
    await db.exec('DROP TABLE mail_folder')
  }
  await db.exec(`CREATE TABLE IF NOT EXISTS mail_folder (
    id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, name TEXT NOT NULL, delimiter TEXT NOT NULL DEFAULT '/',
    role TEXT NOT NULL DEFAULT '', managed TEXT NOT NULL DEFAULT '', logement_id INTEGER NOT NULL DEFAULT 0, gone INTEGER NOT NULL DEFAULT 0)`)
  await db.exec("CREATE TABLE IF NOT EXISTS mail_folder_rule (id INTEGER PRIMARY KEY AUTOINCREMENT, folder_path TEXT NOT NULL, sender TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '')")
  await addColumn('ALTER TABLE imap_config ADD COLUMN auto_file INTEGER NOT NULL DEFAULT 0')
  await addColumn("ALTER TABLE imap_config ADD COLUMN treated_folder TEXT NOT NULL DEFAULT 'Traité'")
  // Un logement n'est initialise (tous les articles du catalogue proposes) qu'une seule fois : ensuite il choisit ses articles
  await db.exec('CREATE TABLE IF NOT EXISTS stock_init (property_id INTEGER PRIMARY KEY)')
  await db.exec('CREATE TABLE IF NOT EXISTS property_token (property_id INTEGER PRIMARY KEY, token TEXT NOT NULL UNIQUE)')
  const items = await db.sql`SELECT COUNT(*) AS n FROM stock_item`
  if (!Number((items.rows[0] as any).n)) {
    // Liste type a ajuster dans la page Stock (references Amazon a renseigner)
    for (const name of ['Papier toilette', 'Savon mains', 'Gel douche', 'Shampoing', 'Liquide vaisselle', 'Éponges', 'Sacs poubelle', 'Capsules café', 'Produit multi-surfaces', 'Pastilles lave-vaisselle'])
      await db.sql`INSERT INTO stock_item (name) VALUES (${name})`
  }
  // Valeurs de depart (une seule fois, tant que les tables sont vides)
  const { rows } = await db.sql`SELECT COUNT(*) AS n FROM lock_link`
  if (!Number((rows[0] as any).n)) {
    await db.sql`INSERT OR IGNORE INTO property_alias (property_id, alias) VALUES (734941, 'Gaston')`
    await db.sql`INSERT OR IGNORE INTO lock_link (lock_id, property_id) VALUES (18082548588, 734941)`
  }
}

// Noms d'usage par id Lodgify : logement.name, a defaut l'ancien alias (avant creation du logement)
export async function getAliases(): Promise<Record<number, string>> {
  const db = useDatabase()
  const legacy = (await db.sql`SELECT property_id, alias FROM property_alias`).rows as any[]
  const current = (await db.sql`SELECT lodgify_property_id, name FROM logement WHERE lodgify_property_id IS NOT NULL`).rows as any[]
  return {
    ...Object.fromEntries(legacy.map(r => [Number(r.property_id), String(r.alias)])),
    ...Object.fromEntries(current.map(r => [Number(r.lodgify_property_id), String(r.name)])),
  }
}

export async function getLockLinks(): Promise<Record<number, number>> {
  const { rows } = await useDatabase().sql`SELECT lock_id, property_id FROM lock_link`
  return Object.fromEntries(rows.map((r: any) => [Number(r.lock_id), Number(r.property_id)]))
}

export async function setLockLink(lockId: number, propertyId: number | null) {
  const db = useDatabase()
  if (propertyId === null) await db.sql`DELETE FROM lock_link WHERE lock_id = ${lockId}`
  else await db.sql`INSERT INTO lock_link (lock_id, property_id) VALUES (${lockId}, ${propertyId}) ON CONFLICT(lock_id) DO UPDATE SET property_id = excluded.property_id`
}
