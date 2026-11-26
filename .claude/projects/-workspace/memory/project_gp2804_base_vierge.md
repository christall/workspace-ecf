---
name: gp2804_base_vierge
description: "Base vierge gp2804 créée en recette le 24/11/2026 comme copie de gp3301 (variante simple de la méthode, 1 script) — nom d'agence par défaut à ajuster par Christophe"
metadata:
  node_type: memory
  type: project
  originSessionId: fe9e60f6-4f39-4149-848f-a03258333e28
  modified: 2026-11-24T07:59:08.774Z
---

**gp2804 créée sur la recette le 24/11/2026** par copie de gp3301 (variante « base vierge →
base vierge » de `sources/scripts-sql/GPLearn/METHODE-BASE-VIERGE.md` § 7-bis) — script unique
`OperationsPonctuelles/clone_gp3301_vers_gp2804.sh`. Contenu : 301 tables / 28 vues / 386
routines / 157 triggers ; 48 tables référentielles copiées ; agence `2804` ; 69 produits sans
prix ; `dossier` « ECF 2804 » v537 ; 5 groupes génériques (Agence renommé `2804`,
g_user_agences→2804) ; 0 utilisateur ; `trace` purgée (les triggers d'audit journalisaient la
construction — ~4000 lignes) ; `subdir_robot_etats`→gp2804 ; déclarée bases_serveurs.
Exclusions volontaires de la copie : `user`, `gus_user` (pas d'utilisateur), `trace` (audit de
la source). Le joker `support` de `PLogin_` voyage avec les routines — inerte (pas de compte
support).

**À ajuster par Christophe** : nom officiel de l'agence 2804 (posé « ECF 2804 », codep
'28000', ville vide faute d'information).

**Why** : demande du 24/11/2026 « crée une gp2804 copie de gp3301 » + manuel rédigé/enrichi
(méthode généralisée, cf. [[project_gp3301_base_vierge]]).

**How to apply** : pour une 3e base vierge, dupliquer `clone_gp3301_vers_gp2804.sh` en
changeant SRC/DST + le code agence (et le nom du groupe Agence). Test applicatif
`?base=gp2804` + création d'utilisateur côté Christophe comme pour gp3301.
