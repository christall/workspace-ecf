# Workspace /workspace — périmètre ECF

## Convention CLAUDE.md

Ces fichiers sont un outil pour Claude, pas de la documentation pour l'équipe.

**Mettre** : contexte métier non évident, pièges, contraintes inter-apps, décisions
architecturales avec leur raison, bugs connus.
**Ne pas mettre** : ce que le code dit déjà, documentation technique générique, structure de
fichiers.

**Mise à jour en continu** : consigner immédiatement toute découverte non évidente dans le
CLAUDE.md du sous-projet concerné — ou ici si c'est transverse.

**Vérification avant livraison** : vérifier la syntaxe du code modifié. Pour PHP : `php -l
fichier.php` sur chaque fichier touché. Une suppression de ligne peut casser une structure de
blocs (accolade orpheline, `else` sans `if`…) — ne pas supposer que la logique est correcte
parce que le diff semble propre. Pour les scripts shell : `bash -n`.

**Pas d'approximation** : avant de produire un chiffre, une analyse ou une conclusion, vérifier
les hypothèses dans les sources primaires (code exécuté, données réelles, config effective).

**Jamais d'URL inventée** : décrire la navigation en mots ou demander le lien.

---

## Scission du 26/11/2026 — ce workspace est ECF uniquement

- Ici : travail ECF/CERCA — `sources/`, `analyse-refonte/`, `erp/`, `nevea_scan_production/`,
  `sources/Echanges_claude_code/`, `ops/`.
- Les projets perso/lab (vdb, zest, forum/labo, Relaiflow/FactiFlow, tra/tra-lab/tra-crazy,
  iptv, voice-bridge) sont dans un **autre workspace physique**. Ne pas les réintroduire ici.
- `routeur/` est un **outil partagé** assumé (proxy multi-modèles pour les seconds avis), pas un
  projet métier : s'il est présent, son `.env` reste hors git.
- La config Claude (settings, MCP, mémoire) de ce workspace est alignée ECF.

---

## Exécution — conteneur Docker

- **Image** : `node:22-slim` (Debian 12), PHP 8.2 CLI (`php -l` pour du code 7.4), python3,
  mysql-client, sqlite3, openssh-client ; locale `fr_FR.UTF-8` ; **2 Go** ; `--cap-drop ALL` ;
  port 3000.
- **`claude.bat`** : conteneur `claude-ecf-<session>`, image `mon-claude-ecf`, monte
  `/workspace` et `C:\pnpm-store`. Pas de montage des credentials, des clés SSH Windows ni des
  certs Tailscale (retirés le 26/11/2026).
- **`Dockerfile` racine** = recette Claude (tmux, ttyd, claude-code, pnpm 12.15.0). Les
  `Dockerfile.codex` / `Dockerfile.opencode` sont des recettes séparées : ne jamais écraser le
  `Dockerfile` racine avec.
- `docker-entrypoint.sh` et `entrypoint.sh` sont des vestiges non utilisés par l'image ; ne pas
  les recâbler sans raison.
- `/workspace` est un bind mount 9p d'un dossier Windows local (plus de Google Drive depuis le
  02/11/2026). Le 9p est ~48x plus lent que le disque du conteneur sur les métadonnées : limiter
  `git status` / `git diff` à des pathspecs ciblés, surtout dans les dépôts `sources/*`.
- **pnpm 12** est épinglé dans l'image. Seul `sources/applisWeb/debordement-app` utilise pnpm
  (`packageManager: pnpm@10.34.3`). `--store-dir /pnpm-store` est obligatoire (pnpm 12 ignore
  `PNPM_STORE_DIR` et les clés `.npmrc`), et purger `/workspace/.pnpm-store` s'il réapparaît.
  `erp/` utilise npm via son `install.sh` et n'est pas dans `install-deps.sh`.

---

## Dépôt git du workspace

- Dépôt local `/workspace`, branche `master`, remote `origin` =
  `git@github.com:christall/workspace-ecf.git` (privé, compte perso de Christophe — ce n'est pas
  un dépôt d'entreprise).
- Clé SSH dédiée : `/workspace/.secrets-ssh/workspace-ecf_ed25519` (deploy key en écriture sur
  `workspace-ecf`, jamais dans git). Un hook `SessionStart` la recopie vers `/root/.ssh-github/`
  avec `chmod 600` ; `core.sshCommand` du dépôt pointe dessus. `/root` étant volatil, sans ce
  hook un push échoue après rebuild.
- L'ancien remote `git-claude-code` est le dépôt **perso** : ne jamais pousser ce workspace
  dessus.
- **`sources/` est gitignoré dans ce dépôt** : le code ECF n'est pas versionné ici, chaque app a
  son propre `.git` (voir `sources/CLAUDE.md`).
- **Règle de commit** : Christophe valide avant tout commit ou push. Les contenus `sources/` ne
  sont jamais commités par Claude.

---

## Périmètre — dossiers

- `sources/` — ~20 apps PHP/MySQL legacy en production. Vue d'ensemble, carte des apps, chantier
  PHP 8 et Jira/Tempo : `sources/CLAUDE.md` (source de vérité). Journal du chantier :
  `sources/CHANTIER-PHP8-WAMP.md` et `sources/RECENSEMENT-PHP8.5.md`.
- `analyse-refonte/` — gouvernance de la refonte (`11-tableau-gouvernance.md` : décisions G1-G10,
  D1-D23 ; `07-mcd-unifie.md` : MCD cible). Sources de vérité.
- `erp/` — refonte Next.js 15 App Router + TypeScript ; aujourd'hui SQLite/libSQL
  (`db/erp.db`, SQL direct), cible PostgreSQL avec 1 schéma par franchise + RLS non migrée.
- `nevea_scan_production/` — scans HTML de production Nevea (matière d'analyse).
- `sources/Echanges_claude_code/` — échanges et accès API (Jira, Tempo).
- `ops/` — scripts d'exploitation, dont `php2shell-protect.sh` (pile Apache/PHP 7.4 legacy).

---

## Architecture CERCA — points critiques

- **Multi-tenant GPLearn** : une base MySQL par agence (`gp****`) + `gpcontrolserveurs` (auth
  centrale — si down, tout est down).
- **Couplage direct** : la plupart des apps accèdent à MySQL sans API intermédiaire.
- **ECFCoach sync** (`synchro.php` / `synchro_retours.php`) : protocole offline-first avec IDs
  temporaires négatifs, à maintenir pendant toute la transition ERP (~3-6 mois).
- **Drupal Intranet** (`applisWeb/intranet/`) : fin de vie depuis 2016, risque sécurité élevé —
  ne pas y toucher sauf urgence.
- **Déploiement** : CI/CD GitLab `code.fabrick.io`, push sur `recette`/`production` → runners
  `gp_recette`/`gp_prod` → `git reset --hard` dans `/var/www/html/<app>`. Les symlinks manuels
  sur le serveur sont détruits à chaque déploiement. Christophe committe/pushe depuis Windows.
- **MySQL recette** accessible depuis le conteneur : `gp-mysql-rct.cerca-ecf.lan` =
  192.168.1.130, user `proc_stock` (identifiants dans `sources/CLAUDE.md`). Prod hors d'atteinte.
- Le **DNS interne CERCA ne résout pas** depuis le conteneur : utiliser l'IP. Pas d'accès SSH à
  GitLab depuis le conteneur (clé non autorisée).
- **`sources/` n'est jamais déployé par rsync sur la VM OVH** : le circuit recette/prod est
  GitLab.

---

## ERP refonte

- Sources de vérité : `analyse-refonte/11-tableau-gouvernance.md` et `07-mcd-unifie.md`.
- Stack cible : PostgreSQL + Next.js/TypeScript, 1 schéma PostgreSQL par franchise avec Row Level
  Security. Activité = discriminant métier (décision D23).

---

## Pièges git / .gitignore

- Un motif sans `/` de tête matche à **toute profondeur** : `plugins/` avait bloqué du code
  applicatif dans `sources/*/src/plugins/`. Corrigé en `/plugins/` (ancré racine).
- `./config.js` ne matche rien : la forme ancrée est `/config.js`. Une règle d'ignore ne
  s'applique **jamais** à un fichier déjà suivi — vérifier `git check-ignore -v <chemin>` **et**
  `git ls-files -- <chemin>`.
- Dans les dépôts `sources/*` (partagés avec Windows), ne jamais écrire `user.name` /
  `user.email` dans `.git/config` : Christophe committe avec sa config globale Windows. Pour un
  commit demandé explicitement, passer l'identité par variables d'environnement ponctuelles.

---

## Jira & Tempo

- Jira via MCP Atlassian : `.mcp.json` (portée projet, sans secret) + OAuth
  (`claude mcp login atlassian --no-browser`). `enableAllProjectMcpServers: true` et permissions
  `mcp__atlassian__*` (avec `ask` sur `executeDestructive`) dans `.claude/settings.json`.
- Les tokens OAuth vivent dans `~/.claude.json` (volatil) : refaire le login après chaque
  rebuild. Détail des pièges (sprint/Epic, cloudId, accès REST) dans `sources/CLAUDE.md`
  § Jira & Tempo.
- Tempo : env `TEMPO_TOKEN_FILE` / `TEMPO_API_BASE` / `TEMPO_AUTHOR_ACCOUNT_ID` dans
  `settings.json` et chaque variante ; token dans
  `sources/Echanges_claude_code/api key-tempo jira.txt`.
- **Variantes de settings** : `.natif`, `.natif_`, `.deepseek` (et `.routeur` si l'outil est
  utilisé). Toute variante doit reprendre le bloc MCP + les 3 env Tempo, sinon la bascule coupe
  Jira. La bascule se fait à la main (pas de script dédié).
- **Aucune clé API dans un fichier suivi par git** : `.claude/settings.local.json` est **non
  suivi** (local à la machine : `autoMemoryDirectory` + surcharges locales) ; `.deepseek` et
  `.routeur` sont gitignorés ; ne jamais committer une clé, ni la mettre dans
  `.claude/settings.json` qui est suivi.

---

## Mémoire et après rebuild

- Banc durable : `/workspace/.claude/projects/-workspace/memory/`, configuré par
  `autoMemoryDirectory` dans `.claude/settings.local.json` (fichier non suivi par git). ⚠️
  cette clé est ignorée si elle est écrite dans `.claude/settings.json`.
- `/root` est volatil : après `claude.bat … build`, le hook `SessionStart` restaure la clé SSH ;
  refaire le login MCP Atlassian.
- Plusieurs sessions/conteneurs et plusieurs outils (Claude, Codex, OpenCode) peuvent écrire le
  même `/workspace` : relire avant d'éditer, ne jamais lancer `git add -A`, `git reset --hard`
  ou `git clean -fd` sur l'arbre, ne pas supprimer un fichier qu'on n'a pas créé.
- Ne jamais afficher un secret réel dans la conversation (les transcripts sont sur disque) :
  écrire la valeur directement dans un fichier sans la faire passer par la sortie.

---

## Vérification avant livraison

- `php -l` sur chaque fichier PHP touché ; `bash -n` sur les scripts shell.
- Vérifier les hypothèses dans les sources primaires avant tout chiffre ou conclusion.
- Ne jamais générer d'URL : décrire la navigation ou demander le lien.
