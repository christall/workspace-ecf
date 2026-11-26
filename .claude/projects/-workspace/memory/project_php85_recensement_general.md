---
name: project-php85-recensement-general
description: Recensement généralisé PHP8.5 sur tous les dossiers de sources/ — reprise via sources/RECENSEMENT-PHP8.5.md
metadata:
  node_type: memory
  type: project
  originSessionId: cb883549-f82e-4863-8e86-186bbe2d5208
  modified: 2026-10-30T09:29:27.701Z
---

Chantier PHP8.5, vue d'ensemble généralisée (au-delà de GPLearn seul, cf. [[project-gplearn-php8-chantier]] pour le détail GPLearn). **Reprise : `sources/RECENSEMENT-PHP8.5.md`** (créé le 30/10/2026) — tableau par dossier (campagne principale / rattrapage recette / push GitLab / cas ouverts), consolide `sources/CHANTIER-PHP8-WAMP.md` et `sources/MISSION-PHP8-RATTRAPAGE.md` sans les remplacer.

Points clés au 30/10/2026 :
- Une mission du 26/10 (`MISSION-PHP8-RATTRAPAGE.md`, découverte en creusant ce jour-là — ne pas la re-découvrir à chaque fois) a déjà généralisé une vérification recette↔php8.5 à 7 apps (GPLearn, myroad_back/front, webservices, ecfcoach_back/front, PlanniFProWeb). `ecfcerca_ecom` est **explicitement hors périmètre** (décision Christophe, 26/10) — ne pas le réintégrer sans re-décision. `scripts-sql`/`svnCERCA` ont quelques fichiers `.php` isolés jamais audités (12 + 1) ; `myroad/` est un dossier vide.
- Les 7 branches `php8.5_corrigée` sont toutes poussées sur GitLab (vérifié le 30/10 — myroad_front l'a été ce jour-là, en résolvant une divergence de push avec Christophe).
- TomBoutin travaille en parallèle sur myroad_back/myroad_front, indépendamment de la mission du 26/10 et sans passer par `CHANTIER-PHP8-WAMP.md`. Un correctif de Christophe a été perdu une fois dans la fusion avec son travail (myroad_front, `localhost_mysql_sockets ?? null` — retrouvé et restauré le 30/10, non commité). **Toujours vérifier `git log --all -- <fichier>` avant de retoucher un fichier du périmètre php8.5** pour repérer ce genre d'édition concurrente.
- Deux trous restent dans le recensement : la campagne principale (pas juste le rattrapage recette) n'est pas faite sur PlanniFProWeb, et `ecfcoach_back` n'a pas été re-balayé au-delà de `connection.php` depuis le 23/10.

⚠️ **Lien avec la sortie de Google Drive en cours** (cf. [[project-gplearn-php8-chantier]]) : plusieurs correctifs de ce chantier (dont celui de myroad_front ci-dessus) sont **non commités**, volontairement — Claude édite `sources/` mais ne committe jamais. Tant que la continuité se fait conteneur-à-conteneur sur la même machine (même dossier disque monté), rien n'est perdu. Si la sortie de Drive se fait un jour par un **nouveau clone** plutôt qu'en conservant les dossiers de travail actuels, tout correctif non commité à ce moment-là serait perdu — vérifier l'état des commits avant toute bascule de ce type.
