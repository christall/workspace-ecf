---
name: workspace-split-20261126
description: "Scission des deux workspaces (26/11/2026) — celui-ci est ECF-only ; nettoyage exécuté, dépôt workspace-ecf créé, restes à finir (routeur à réinstaller, commit initial/push)"
metadata:
  node_type: memory
  type: project
  originSessionId: cccddfc9-32a1-4705-a0d2-34ad8fa441e6
  modified: 2026-11-26T14:48:06.292Z
---

Décision Christophe du 26/11/2026 : séparation en deux workspaces physiques.

- **Ici** (`/workspace`) = travail ECF : `sources/`, `analyse-refonte/`, `erp/`,
  `nevea_scan_production/`, `sources/Echanges_claude_code/`, `ops/`, + Jira/Tempo.
- **Autre workspace** = perso/lab : vdb, zest, forum, Relaiflow, tra*, iptv, voice-bridge.

**Épuration exécutée le 26/11/2026 :**
- 1665 fichiers perso supprimés du working tree (non commités à ce stade).
- Remote perso `git-claude-code` retiré ; nouveau remote `origin` =
  `git@github.com:christall/workspace-ecf.git` (privé, compte perso). Clé dédiée
  `.secrets-ssh/workspace-ecf_ed25519`, hook `SessionStart` vers `/root/.ssh-github/`,
  `core.sshCommand` posé. Authentification testée OK (`git ls-remote`).
- `Dockerfile` racine restauré en recette Claude (il contenait la recette Codex) ;
  dépendances Python du routeur remises ; `claude.bat` renommé `claude-ecf-*` /
  `mon-claude-ecf`, montages credentials/SSH/tailscale retirés ; `install-deps.sh` réduit à
  `sources/applisWeb/debordement-app`.
- Ménage : caches, transcripts, `MEMORY-STRUCTURE.md`, `settings.json` racine (hook
  auto-commit) et variantes de settings perso supprimés ; `.pnpm-store` purgé.
- Banc mémoire : 25 mémoires perso supprimées, `MEMORY.md` filtré, 3 références réécrites
  (carte des dossiers ECF, emplacement mémoire, workspace 3 outils).
- `CLAUDE.md` racine réécrit en périmètre ECF seul ; section Jira/Tempo de `sources/CLAUDE.md`
  corrigée (MCP actif, variantes à jour).
- `.claude/settings.json.deepseek` restauré depuis l'historique, sorti de l'index git et
  ajouté au `.gitignore` (la clé DeepSeek reste utilisable localement ; Christophe a décidé de
  la réinitialiser côté DeepSeek).
- `.claude/settings.local.json` sorti du suivi git (fichier local : `autoMemoryDirectory` +
  surcharges locales) ; `routeur/switch-model.sh` supprimé, la bascule DeepSeek/natif se fait à
  la main. Les surcharges DeepSeek vont dans `settings.local.json`, jamais dans `settings.json`
  (suivi par git).

**Restes à finir :**
- Routeur réinstallé le 26/11 : `curl` ajouté au Dockerfile, dépendances Python présentes, URL
  de base corrigée en `http://localhost:8787` (sans `/v1`). Rebuild nécessaire pour `curl` ;
  lancer `routeur/start.sh` ensuite.
- Faire le commit initial sur une branche orpheline (historique neuf, sans l'historique perso)
  puis pousser sur `workspace-ecf` — en attente de l'accord de Christophe.
- L'ancienne clé `id_ed25519` (perso) traîne encore dans `.secrets-ssh/` ; copiée dans l'autre
  workspace, supprimable ici.
- `sources/` reste gitignoré (chaque app a son propre git) : le dépôt `workspace-ecf` ne
  sauvegarde que `erp/`, `analyse-refonte/`, la mémoire, la config et les docs.
