---
name: project-etatecartsttcsage-agence-inscription
description: "Ticket compta 13/10/2026 — rapprochement EtatEcartsTTCSage échoue sur facture préfixée agence d'inscription — CORRIGÉ ET DÉPLOYÉ (confirmé 09/11 par diff sur origin/production, commit 398288fe)"
metadata:
  node_type: memory
  type: project
  originSessionId: bc5bdbd6-0ce2-4329-8020-c77e10c120e1
  modified: 2026-11-09T16:05:39.719Z
---

Ticket Éléonore MICHAUD (compta, 13/10/2026, transmis par Sébastien POUZINEAU 16/10) :
`Traitements/EtatEcartsTTCSage.php` ne rapprochait pas les factures GPLearn/Sage quand le
numéro de pièce Sage est préfixé par l'agence d'inscription plutôt que par l'agence courante
du tiers (ex. `1602-221367` sur une base `gp1620`).

**Statut (06/11/2026)** : corrigé en local, PAS commité/déployé (Claude ne committe jamais dans
`sources/` — cf. CLAUDE.md racine) ; les fichiers modifiés sont indexés (staged) sur la branche
**`ECT-455`** (basée sur `recette`, aucun commit `php8.5*` embarqué — vérifié), à committer par
Christophe depuis Windows. Détail complet, root cause vérifiée sur données réelles recette (pas
juste par lecture de code), et gaps connus non traités : `sources/GPLearn/CLAUDE.md`
§ « Export Sage Compta » → sous-section « Rapprochement GPLearn ↔ Sage » (CLAUDE.md compacté le
06/11 — les sections Sage datées ont été fusionnées en une seule, chercher ce titre, pas l'ancien).

**Complément 06/11/2026** : ajout de `exclusionsPreFusion()` dans le même fichier — exclut les
21 678 factures historiques gp4102/gp4103 (agenceinsc) important dans gp4101, antérieures à la
prise d'effet Sage du 01/07/2026 (confirmé Christophe, normal qu'elles n'y soient pas). Même
section CLAUDE.md pour le détail, dont un piège NULL/SQL à trois valeurs réellement rencontré
en vérifiant (pas juste théorique).

**Why:** `facturesGPLearn()` utilisait `tiers.agenceresp` au lieu du même calcul que l'export réel
(`lfacture.agence` → `produits.agence` → `tiers.agenceresp`) — mismatch systématique après une
fusion de bases (agenceresp réécrit vers la base d'accueil, lfacture.agence garde l'ancienne
agence).
**How to apply:** avant de redéployer, Christophe doit relire/tester en recette — pas de question
ouverte côté compta à trancher ici (contrairement aux autres tickets Sage du même chantier, cf.
[[project_glpi13179_sage_regroupement]] pour le style). Si repris plus tard, relire la section
CLAUDE.md ci-dessus plutôt que de re-dériver depuis le code.

**Complément 06/11/2026 (suite)** : Christophe a testé en cochant toutes les bases — erreur SQL
cryptique sur `acfact`/`gp1620` (pas liées à mon fix : déclarées dans `bases_serveurs` mais
absentes du serveur recette, piège déjà documenté ailleurs dans le code — cf. CLAUDE.md pour le
détail). Ajouté `baseReellementPresente()`, même pattern que `fps_base_ok()` existant. Un
diagnostic temporaire posé puis retiré une fois la vraie cause trouvée — ne pas s'étonner si ça
réapparaît dans un vieux diff, c'est nettoyé dans la version actuelle du fichier.

**Complément 08/11/2026** : `listeBases()` ne retourne plus un tableau codé en dur mais appelle
`basesSageEligibles()` (nouveau fichier `Traitements/bases_sage_eligibles.inc.php`), partagé
avec `robot_export_sagecompta_jour.php` — une seule liste à maintenir au lieu de deux copies.
Demande initiale de Christophe mal comprise une fois en cours de route (j'ai cru qu'il voulait
garder le codé en dur, il voulait en réalité une lecture dynamique) — vérifié avant de coder que
`bases_serveurs` ne porte aucune colonne permettant de dériver cette liste automatiquement
(détail et bases témoins dans CLAUDE.md), d'où le choix de partager la liste du robot plutôt que
d'inventer une requête fausse.

**Correction de statut, 09/11/2026 (après-midi)** : contrairement à "pas encore commité/
déployé" ci-dessus, `Traitements/EtatEcartsTTCSage.php` est en réalité **déjà déployé** —
vérifié par diff de contenu direct (pas en se fiant au nom d'une branche) : byte-à-byte
identique entre le working tree et `origin/production` au commit `398288fe` (08/11 08:52:51,
"sélection des base compta cerca"), fetch frais du jour (13:11). Trouvé en vérifiant par
ricochet le statut d'un autre ticket Sage (cf. [[project_glpi13179_sage_regroupement]], entrée
du 09/11 sur `ExportSageCompta.inc.php`/commit `e45304c8`, même mécanisme de vérification). Ne
pas se fier aux statuts "pas commité" plus haut dans ce fichier sans revérifier par diff.
