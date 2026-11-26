# ERP CERCA/ECF — Nouveau système en développement

Remplace le parc legacy PHP/MySQL (~20 apps) par un ERP unifié.
Stack : Next.js 15 App Router + TypeScript + Tailwind + Radix UI.
Contexte refonte complet dans `../analyse-refonte/`.

## BDD — état actuel vs cible (point critique)

**Actuel (MVP)** : SQLite via libSQL (`db/erp.db`). SQL direct, pas d'ORM. Placeholders `?`.
**Cible** : PostgreSQL avec 1 schéma par franchise + Row Level Security.

La migration SQLite → PostgreSQL n'est pas encore faite. Ne pas concevoir de features en supposant RLS actif.

## Auth et multi-tenancy

- JWT dans cookie `erp_token` (8h), signé HS256 via `jose`
- **Middleware Edge** (`middleware.ts`) : vérifie la signature JWT uniquement — rapide, pas d'accès BDD
- **`getSession()`** (`lib/auth.ts`) : revalide `franchise_id` depuis la BDD à chaque appel — immunise contre les migrations de données. À utiliser dans toutes les API routes, pas le middleware.
- Isolation multi-tenant : `franchise_id` filtré manuellement dans chaque query. Pas de RLS pour l'instant.

## Pattern Next.js App Router

- Pages = Server Components par défaut (fetch direct, pas de useEffect)
- Fichiers `*Client.tsx` = Client Components (interactivité, React Query)
- `@tanstack/react-query` pour le state client — `QueryProvider` wrappé dans le layout `(app)`

## Import depuis GPLearn legacy

`db/import-gplearn.ts` : import MySQL GPLearn → SQLite ERP.
Variables de connexion source dans `.env.import` (non commité).
À utiliser pour alimenter la démo/recette depuis les données réelles.

## Sources de vérité

| Fichier | Contenu |
|---|---|
| `../analyse-refonte/11-tableau-gouvernance.md` | Décisions G1-G10, D1-D23 — **consulter avant toute décision archi** |
| `../analyse-refonte/07-mcd-unifie.md` | MCD v0.9, schéma cible PostgreSQL |
| `../analyse-refonte/09-specs-fonctionnelles.md` | Specs détaillées par module |

## Docker dev

Port : 3003. `node_modules` dans un volume Docker séparé (`erp_deps`) — ne pas monter depuis Windows, ça casse les binaires natifs.
`pnpm install` à exécuter **dans le conteneur**, pas depuis WSL directement.

## Contrainte ECFCoach (critique)

L'API `synchro.php` / `synchro_retours.php` de `../sources/ecfcoach_back/` doit rester compatible pendant ~3-6 mois après basculement. Le nouveau backend ERP devra reproduire le protocole exact (IDs négatifs offline, delta timestamps). Voir `../sources/ecfcoach_back/CLAUDE.md`.
