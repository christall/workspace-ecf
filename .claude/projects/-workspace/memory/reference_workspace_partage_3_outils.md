---
name: workspace-partag-par-3-outils-dans-3-conteneurs
description: "Le même /workspace physique est monté dans 3 Docker (Claude Code, Codex, OpenCode) — écritures concurrentes, .git et banc mémoire communs, précautions obligatoires ; l'autre workspace perso est un dossier distinct"
metadata:
  node_type: memory
  type: reference
  originSessionId: cccddfc9-32a1-4705-a0d2-34ad8fa441e6
  modified: 2026-11-26T14:38:22.509Z
---

**Fait (affirmé par Christophe le 19/11/2026)** : `/workspace` n'est pas un dossier par outil.
C'est **un seul dossier Windows monté dans trois conteneurs Docker distincts** — Claude Code,
Codex, OpenCode. Les trois voient et écrivent les **mêmes fichiers**, le **même `.git`** et le
**même banc mémoire**. Depuis la scission du 26/11/2026, c'est vrai pour ce workspace ECF ; le
workspace perso est un **autre dossier physique**, invisible d'ici.

**Preuve observée le 19/11/2026** : `MEMORY.md` a gagné une ligne entre deux lectures de la même
session — écriture d'un autre outil en cours de route, sans que rien ne le signale.

## Conséquences opérationnelles

- **Relire avant d'éditer** tout fichier partagé (surtout `MEMORY.md`, les `CLAUDE.md`, les
  scripts) : entre la lecture et l'écriture, un autre outil a pu le modifier.
- **Ne jamais lancer de commande destructive sur l'arbre** : `git checkout -- .`,
  `git reset --hard`, `git clean -fd`, `rm -rf` détruiraient le travail non commité des autres.
  Pour annuler *ma* modification : cibler le fichier précis.
- **Pas de `git add -A` / `git commit -a`** : ça embarquerait les modifications en cours des
  autres. Stager par chemin explicite et relire `git diff` avant de committer.
- **`.git/index.lock` partagé** : ne pas le supprimer à l'aveugle — vérifier qu'aucune opération
  n'est en cours.
- **`git status` est un agrégat des trois outils**, pas mon état : les entrées inconnues ne sont
  pas forcément à moi.
- **Ne jamais supprimer, déplacer ni réorganiser un fichier que je n'ai pas créé** (mémoire,
  worktree, script temporaire, brouillon).
- **Les environnements diffèrent** : binaires et `~/.codex` propres à chaque `/root` ; les
  node_modules vivent sur le montage 9p, pas sur des volumes nommés (le `claude.bat` actuel n'en
  monte plus). L'absence d'un outil **dans ce conteneur** ne prouve rien sur les autres.
- **Chaque outil a ses conventions** : Claude Code lit `CLAUDE.md` et ce banc mémoire via
  `autoMemoryDirectory` ; Codex lit `AGENTS.md`. Un fait important pour les trois doit être écrit
  dans le `CLAUDE.md` du dossier, pas seulement en mémoire.
- L'autre workspace (perso) a son propre `.git`, son propre banc et ses propres conteneurs :
  ne pas supposer qu'un fichier y est présent ou absent sans le vérifier.
