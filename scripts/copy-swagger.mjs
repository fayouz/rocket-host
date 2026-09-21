// Copie les 2 fichiers de Swagger UI dans public/_docs-ui (servis par l'appli elle-meme : pas de CDN). Dossier ignore par git.
import { copyFileSync, mkdirSync } from 'node:fs'
const from = 'node_modules/swagger-ui-dist', to = 'public/_docs-ui'
mkdirSync(to, { recursive: true })
for (const f of ['swagger-ui-bundle.js', 'swagger-ui.css']) copyFileSync(`${from}/${f}`, `${to}/${f}`)
