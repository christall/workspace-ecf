---
name: emplacement-durable-des-m-moires-pas-root
description: Banc de mémoire = /workspace/.claude/projects/-workspace/memory (mount Windows + git) ; /root/.claude est effacé au rebuild — autoMemoryDirectory dans settings.local.json ; banc ECF depuis la scission du 26/11/2026
metadata:
  node_type: memory
  type: reference
  originSessionId: cccddfc9-32a1-4705-a0d2-34ad8fa441e6
  modified: 2026-11-26T14:48:00.553Z
---

Banc de mémoire unique de ce workspace : `/workspace/.claude/projects/-workspace/memory/` — sur
le disque Windows monté et suivi par git. Le chemin `/root/.claude/projects/<slug>/memory/`
annoncé par le prompt système est le home du conteneur Docker : **effacé dès que
`claude.bat … build` recrée le conteneur** (`docker rm -f`).

Depuis la scission du 26/11/2026, ce banc est **ECF uniquement** : les mémoires perso/lab (vdb,
zest, forum, Relaiflow, tra, routeur-DeepSeek) ont été retirées et vivent dans le banc de
l'autre workspace. Ne pas les recopier ici.

**`MEMORY.md` est l'index du banc.** Écrit par les sessions via `autoMemoryDirectory` et commité
dans le dépôt `workspace-ecf`. Codex/OpenCode tournent aussi sur le même `/workspace` (autre
conteneur, autre `/root`) : tout fichier partagé peut être modifié entre la lecture et
l'écriture → relire avant d'éditer.

**Why:** constaté le 26/10/2026 : `MEMORY.md` indexait 27 mémoires dont les fichiers avaient
disparu — écrites par des sessions tournant sur `/root`, jamais synchronisées, perdues au
rebuild. Réglé par `autoMemoryDirectory`.

**How to apply:**
- `autoMemoryDirectory` (chemin absolu) vit dans `/workspace/.claude/settings.local.json`,
  fichier **non suivi par git** (local à la machine : il porte aussi les surcharges locales,
  ex. la bascule DeepSeek). ⚠️ **Il est ignoré s'il est écrit dans `.claude/settings.json`**
  (refus volontaire pour raison de sécurité : un dépôt cloné ne doit pas pouvoir rediriger la
  mémoire). Scopes honorés : settings **local**, user, managed, `--settings`.
- ⚠️ **Plusieurs sessions écrivent en parallèle** (conteneurs `claude-ecf-<session>`, Codex,
  OpenCode). Ne jamais déplacer ni réorganiser le dossier.
- Les lignes de `MEMORY.md` sans fichier correspondant sont des traces de mémoires perdues :
  elles restent tant que le sujet peut redevenir actuel ; les lignes perso ont été retirées lors
  de la scission.
- Deux formats de frontmatter coexistent : `type:` à plat (anciennes) et `metadata:` → `type:`
  (récentes). Les deux sont lus.
- Les transcripts et caches Claude vivent sous `/workspace` : ne jamais y afficher un secret.
