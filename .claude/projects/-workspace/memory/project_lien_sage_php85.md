---
name: project-lien-sage-php85
description: "Lien Sage prod cassé par l'upgrade PHP 7.4→8.5 ; consignes de réinstallation remises à Christophe le 25/11/2026, exécution à sa charge, à vérifier ensuite"
metadata:
  node_type: memory
  type: project
  originSessionId: a0c0b0e8-ecba-485c-b20c-a3f3f6b60599
  modified: 2026-11-26T09:24:01.885Z
---

Le 25/11/2026, Christophe a signalé : le lien Sage (PlanniFProWeb + Remunerations/applisWeb)
est mort sur la VM Prod après l'upgrade PHP 7.4 → 8.5 — l'extension PECL `sqlsrv` est compilée
par version de PHP, elle ne se charge plus. Christophe a demandé des consignes sans toucher à
la machine distante (pas d'accès SSH depuis le conteneur).

**Consignes remises** : `sudo bash …/Remunerations/lienSage/install_sqlsrv_linux.sh 8.5`
(si pecl échoue sur 8.5 : PIE `pie install microsoft/sqlsrv` + `pdo_sqlsrv`, ou build GitHub
5.14.0 — la 5.14.0 n'est pas sur PECL), puis vérifier `php -m | grep -i sqlsrv` + connexion
réelle à `srvsql2.cerca-ecf.lan\sqlpaie` (avec TrustServerCertificate, pas via `tests.php`
qui donne des faux échecs) + pages Remunerations/PlanniFProWeb.

**Ticket Jira créé le 26/11/2026** : **ECT-490** « connexion serveur prod php8.5 à Sage » —
tâche assignée à Christophe, enfant de l'Epic ECT-476 « PHP shell » (vérifié par JQL
`parent = ECT-476`), description = les consignes complètes. **Sprint ajouté le 26/11**
(id 5449 « Sprint #2610 - 202610 », actif, board 2106 — le ticket n'apparaissait pas sur la
board sans lui ; piège : `additional_fields` stringifie l'id sprint, utiliser `fields`
+ `customfield_10115` numérique — consigné dans `sources/CLAUDE.md` § Jira & Tempo).

**À vérifier à la reprise** (demander à Christophe) : extension installée et lien fonctionnel
en prod ; sinon reprendre les points secondaires (présence du dossier lienSage sur la lignée
prod — suivi sur `recette` mais ref local `production` inutilisable ici ; variables
`PAIE_SQL_*`/`SALAIRE_DB_*`/`SAGE_SQL_*` dans `_ENV_COMMUN`/`_ENV_SPECIF`). Détail technique
complet dans `sources/applisWeb/CLAUDE.md` § Lien Sage (cf. [[reference_carte_dossiers_workspace]]).
