# VPS Dashboard — Design Spec

Date: 2026-09-18
Status: Approved by Imran, ready for implementation plan

## 1. Objectif

Page web personnelle unique remplaçant l'ouverture manuelle de chaque VPS dans la
console Hetzner. Un utilisateur (Imran), plusieurs VPS Hetzner. Doit répondre en moins
de 3 secondes, sans clic, à : combien de VPS, lesquels sont online, RAM/disk
utilisés vs totaux, prix mensuel, commande SSH.

Non-objectifs explicites : pas de monitoring avancé, pas de graphiques, pas de CPU
détaillé, pas de logs, pas de Kubernetes, pas de Prometheus/Grafana, pas
d'historique de métriques, pas de 50 métriques.

## 2. Stack

- Next.js 15 (App Router), TypeScript strict, Tailwind CSS
- SQLite via `better-sqlite3` (pas d'ORM)
- API Hetzner Cloud appelée uniquement côté serveur (`fetch` natif, pas de SDK)
- Agent Node.js autonome (zéro dépendance npm) déployé sur chaque VPS
- Docker (Dockerfile + docker-compose) pour le déploiement du dashboard
- Auth : mot de passe unique + cookie de session signé (pas de next-auth)
- Vitest pour les tests ciblés

Package manager : pnpm. Projet mono-repo simple (pas de monorepo workspace) : le
dashboard Next.js est à la racine, l'agent est un sous-dossier `agent/` non buildé
par Next.js.

## 3. Structure du projet

```
vps-dashboard/
  app/
    page.tsx                    # dashboard principal
    login/page.tsx
    settings/page.tsx
    api/
      auth/login/route.ts
      auth/logout/route.ts
      servers/route.ts          # GET (list+live), POST (create)
      servers/[id]/route.ts     # GET, PATCH, DELETE
      servers/[id]/refresh/route.ts
      servers/sync/route.ts
    layout.tsx
    globals.css
  components/
    ServerCard.tsx
    SummaryBar.tsx
    StatusDot.tsx
    UsageBar.tsx
    CopySshButton.tsx
    Header.tsx
  lib/
    db.ts                       # better-sqlite3 init + migrations inline
    auth.ts                     # session cookie sign/verify
    hetzner.ts                  # client API Hetzner (fetch)
    agent-client.ts             # appel GET /health avec timeout + auth
    servers.ts                  # logique métier : merge live+cache, prix effectif
    types.ts
  middleware.ts                 # protège tout sauf /login et assets
  agent/
    agent.js                    # agent autonome, zéro dépendance
    install-agent.sh
  data/                         # volume Docker, fichier sqlite (gitignored)
  Dockerfile
  docker-compose.yml
  .env.example
  README.md
```

## 4. Modèle de données

Table unique `servers` (SQLite) :

| colonne | type | notes |
|---|---|---|
| id | INTEGER PK autoincrement | |
| hetzner_server_id | INTEGER, nullable, unique | null si ajouté manuellement |
| name | TEXT | |
| ssh_user | TEXT | default `root` |
| ip | TEXT | IPv4 publique, requise |
| ipv6 | TEXT, nullable | |
| agent_url | TEXT | ex: `http://<ip>:9090` |
| agent_token | TEXT | jamais renvoyé au frontend |
| server_type | TEXT, nullable | cache Hetzner, ex `cx22` |
| vcpu | INTEGER, nullable | cache Hetzner |
| ram_total_gb | REAL, nullable | cache Hetzner (ou dernière valeur agent) |
| disk_total_gb | REAL, nullable | cache Hetzner (ou dernière valeur agent) |
| datacenter | TEXT, nullable | cache Hetzner |
| price_monthly | REAL, nullable | override manuel, prioritaire |
| hetzner_price_monthly | REAL, nullable | cache Hetzner |
| created_at | TEXT (ISO) | |
| updated_at | TEXT (ISO) | |

Prix effectif affiché = `price_monthly ?? hetzner_price_monthly ?? null` (affiché
`—` si les deux sont null).

Aucune métrique live (RAM/disk used, uptime, status) n'est persistée : toujours
recalculée à la demande en interrogeant l'agent.

Migration : un seul `CREATE TABLE IF NOT EXISTS` exécuté au démarrage dans `lib/db.ts`.
Pas de système de migration versionné (une seule table, YAGNI).

## 5. API Hetzner (source de vérité statique)

`lib/hetzner.ts` expose deux fonctions server-side uniquement :
- `listServers()` → `GET https://api.hetzner.cloud/v1/servers`
- `getServerTypePricing()` → `GET https://api.hetzner.cloud/v1/pricing` (ou le prix
  inclus directement dans la réponse serveur selon ce que renvoie l'API — à vérifier
  à l'implémentation, fallback sur `server_type.prices`)

`HETZNER_API_TOKEN` lu uniquement côté serveur (`process.env`), jamais exposé au
client. Le frontend n'appelle jamais directement `api.hetzner.cloud`.

## 6. Agent (`agent/agent.js`)

Serveur HTTP minimal en Node.js pur (`node:http`), zéro dépendance npm.

`GET /health` avec header `Authorization: Bearer <VPS_AGENT_TOKEN>` :
- Token absent ou invalide → `401`
- Sinon → `200` avec :
```json
{
  "status": "online",
  "ram": { "used": 1.8, "total": 4 },
  "disk": { "used": 18, "total": 40 },
  "uptime": 123456
}
```

Calculs :
- RAM : lecture de `/proc/meminfo` (`MemTotal`, `MemAvailable`) — `used = total -
  available`, plus précis que `os.freemem()` qui ignore le cache/buffers.
- Disk : `child_process.execSync('df -k /')`, parse de la ligne de données.
- Uptime : `os.uptime()`.

Timeout très court côté appelant (dashboard), pas côté agent. Port par défaut 9090
(configurable via `PORT` env).

`install-agent.sh` : script bash autonome contenant le code de `agent.js` en heredoc
(pas de dépendance à une URL publique de téléchargement). Il :
1. crée `/opt/vps-agent/`
2. écrit `agent.js`
3. génère un `VPS_AGENT_TOKEN` aléatoire si non fourni en argument, l'affiche à la fin
4. écrit un service systemd `vps-agent.service` (restart automatique, lancé avec
   `node`, `Environment=VPS_AGENT_TOKEN=...`)
5. démarre et active le service

Usage documenté dans le README :
```
scp agent/install-agent.sh root@<ip>:/root/
ssh root@<ip> 'bash install-agent.sh'
```

## 7. Endpoints dashboard

Tout passe par le serveur Next.js ; le frontend n'appelle jamais Hetzner ni les
agents directement.

- `GET /api/servers` — lit la DB, puis `Promise.allSettled` sur un appel `GET
  {agent_url}/health` par serveur (timeout 2.5s). Merge : succès → status
  `online` + valeurs live ; échec/timeout → status `offline` + dernières valeurs
  statiques connues en DB. C'est l'endpoint pollé toutes les 15s par le dashboard.
- `GET /api/servers/:id` — même logique, un seul serveur.
- `POST /api/servers/:id/refresh` — force un nouvel appel agent (et éventuellement
  un refresh Hetzner de ce serveur précis) puis renvoie l'état à jour.
- `POST /api/servers/sync` — appelle Hetzner, upsert par `hetzner_server_id` (name,
  ip, ipv6, server_type, vcpu, ram_total_gb, disk_total_gb, datacenter,
  hetzner_price_monthly). Ne touche jamais `agent_url`, `agent_token`, `ssh_user`,
  ni `price_monthly` (override manuel) s'ils sont déjà définis.
- `POST /api/servers` — création manuelle (name, ip, ssh_user, agent_url,
  agent_token, price_monthly).
- `PATCH /api/servers/:id` — modification des champs éditables.
- `DELETE /api/servers/:id` — suppression.
- `POST /api/auth/login` / `POST /api/auth/logout` — session.

Validation des inputs sur tous les endpoints d'écriture (zod ou validation manuelle
légère — décision d'implémentation, pas de dépendance lourde nécessaire).

## 8. Auth

- `DASHBOARD_PASSWORD` en variable d'env, jamais hardcodée.
- Cookie de session : payload `{ exp }` signé HMAC-SHA256 avec un secret dérivé de
  `DASHBOARD_PASSWORD` (ou `SESSION_SECRET` dédié — décision d'implémentation).
  httpOnly, secure (en prod), sameSite=lax, expiration ~7 jours.
- `middleware.ts` protège toutes les routes sauf `/login` et les assets statiques ;
  redirige vers `/login` si cookie absent/invalide.
- Pas de table `users`, pas de next-auth : un seul mot de passe, pas de compte.

## 9. Frontend / UX

**Header** : titre "VPS Dashboard", sous-titre "Infrastructure overview", à droite
"Last updated: Ns ago" + bouton refresh manuel.

**Barre de résumé** : nombre de VPS, RAM totale, RAM utilisée, total €/mois —
calculés côté client à partir de la réponse `/api/servers`.

**Cartes VPS** (grille 3 colonnes desktop / 1 colonne mobile) : statut (dot coloré),
nom, menu ⋮ (edit/delete → vers /settings ou modal), IP publique, commande SSH
copiable, barre RAM (used/total + barre de progression sobre), barre Disk
(idem), prix mensuel, bouton "Copy SSH" (feedback "Copied" temporaire, 2s), lien
"Open Hetzner" (vers `console.hetzner.cloud/projects/.../servers/{hetzner_server_id}`
si dispo, sinon bouton masqué).

**États** : 🟢 online / 🟠 connecting (pendant un fetch en cours côté client) / 🔴
offline (texte "Unable to reach VPS", infos statiques conservées). Chaque carte gère
son erreur indépendamment (jamais de crash de page entière).

**Polling** : `setInterval` 15s sur `/api/servers` depuis un composant client
(`"use client"`), pas de librairie de data-fetching externe (pas de SWR/React Query
— gestion d'état simple avec `useState`/`useEffect`, cohérent avec "peu de
dépendances").

**Page `/settings`** : liste des VPS avec formulaire d'édition (name, ip, ssh_user,
agent_url, agent_token, price_monthly), bouton "Add VPS" (formulaire vide), bouton
"Sync with Hetzner", bouton delete par ligne avec confirmation.

**Responsive** : grille 3 colonnes desktop, 1 colonne mobile (breakpoint Tailwind
`md`).

## 10. Design visuel

Dark mode par défaut (pas de toggle — hors scope). Inspiration Linear/Vercel/Apple/
Hetzner Console dark. Cartes sobres à bordure fine (`border border-white/10` ou
équivalent), border-radius modéré, beaucoup d'espace, typographie propre (police
système ou Inter), barres de progression très sobres (pas de dégradé flashy),
animations discrètes uniquement (transition sur hover/copy feedback). Pas de
glassmorphism excessif, pas de template SaaS générique.

## 11. Déploiement

- `Dockerfile` multi-stage : `deps` (pnpm install), `build` (next build), `runtime`
  (node:20-alpine, copie du build standalone + `agent/` pour référence, expose 3000).
- `docker-compose.yml` : un service `dashboard`, volume `./data:/app/data` pour la
  persistance du fichier SQLite, `env_file: .env`, port `3000:3000`.
- `.env.example` : `HETZNER_API_TOKEN`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`
  (optionnel), `DATABASE_PATH` (default `./data/vps-dashboard.db`).
- `README.md` : install locale, config Hetzner API, config SQLite, installation de
  l'agent sur un VPS (`install-agent.sh`), config du token agent, lancement Docker,
  déploiement sur un VPS Hetzner.

## 12. Tests

Vitest, ciblé sur le critique (pas de couverture exhaustive) :
- vérification du token agent (comparaison à temps constant, rejet si absent/invalide)
- calcul du prix effectif (`price_monthly ?? hetzner_price_monthly ?? null`)
- merge live/cache dans `lib/servers.ts` (agent online vs offline)
- parsing `/proc/meminfo` et sortie `df -k /` dans l'agent

## 13. Hors scope (rappel explicite)

Pas de monitoring avancé, pas de graphiques, pas de CPU détaillé, pas de logs, pas de
Kubernetes, pas de Prometheus/Grafana, pas d'historique de métriques, pas de
multi-utilisateur, pas de stockage de clé SSH privée, pas de exécution de commandes
distantes autre que l'appel `/health` de l'agent.
