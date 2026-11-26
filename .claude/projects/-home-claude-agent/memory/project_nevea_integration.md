---
name: Intégration NEVEA — détails techniques
description: API NEVEA, pipeline import, fiche apprenant 600+ champs, vulnérabilités
type: project
originSessionId: c839d15c-2c69-439c-87f6-00e81c69f3d4
---
NEVEA est l'ERP régional Formation Professionnelle externe — système maître pour les actions FP.

**Why:** Comprendre l'intégration NEVEA est indispensable pour concevoir la couche d'import/sync du nouveau système.
**How to apply:** Quand on conçoit le module FP ou la migration, prévoir l'interface NEVEA dès le départ.

## Accès API

- Base URL : `https://ecf-cerca.nevea.fr/api/v1/vendor/ecf/cerca/`
- Auth : `authtype=open&privateid=<NEVEA_PRIVATE_ID>` — migré dans `.env` (variable `NEVEA_PRIVATE_ID`)
- Endpoint apprenants d'une action : `/apprenant/?modid={idaction_nevea}&fields=document.attributes,document.properties.all&slice=all`
- Endpoint liste apprenants (autre format) : `/?app=FORMATION&action=VIEWMODULE_LISTE_APPRENANTS&rest=true&modid={id}`

## Ce que NEVEA envoie (robot_import_nevea.inc.php)

Tables peuplées côté plgfpro :
- `sites` → via `pfp_nevea_site` (id_pfp ↔ id_nevea)
- `typeactions` → via `pfp_nevea_catalogue` (pfp_idtypeaction ↔ id_nevea)
- `actions` → via `pfp_nevea_action` (id_pfp ↔ id_nevea)
- `planning` (créneaux) → créés depuis les modules NEVEA

Tables peuplées côté fplearn (via lien_crm.php) :
- `sites_sit`, `catalogue_cat`, `opportunite_opp`, `ressource_res`, `ressource_type_rty`
- `lien_site_externe_lsx`, `lien_catalogue_ext_lcx`, `lien_opportunite_externe_oex`, `lien_ressource_externe_rxe`

## Fiche apprenant NEVEA — catégories de champs (600+)

La fiche apprenant NEVEA est un modèle de **traçabilité des certifications professionnelles** :

| Domaine | Champs | Exemples |
|---|---|---|
| Identité | ~15 | nom, prénom, civilité, naissance, adresse, email, société |
| Permis de conduire | ~30 | date_permis_A/A1/A2/B/B96/BE/C/C1/CE/D/D1/DE, date médicale, préfecture |
| CACES Chariots | ~20 | passage/résultat/date/testeur cat 1-6, heures, rattrapage |
| CACES Engins | ~30 | passage/résultat/date/testeur cat 1-10, heures, telecom |
| CACES PEMP | ~20 | passage/résultat/date/testeur 1A/1B/2A/2B/3A/3B, heures |
| CACES Grues auxiliaires | ~15 | passage/résultat/date/testeur G1A/G1B/G2A/G2B/G2C |
| CACES Grues mobiles | ~15 | passage/résultat/date/testeur Gmacab/Gmasol/Gmecab/Gmesol |
| CACES Pont roulant | ~10 | commande sol/cabine, avec/sans fil, résultats |
| Habilitations électriques | ~30 | B0V/BTA/H0V/HTA/BR/BC/BN/H1V/H2V/HC/HN - niveaux superviseur/ouvrier |
| FIMO/FCO | ~15 | num/date FIMO, FCO, passerelle voyageur/marchandise/hab |
| Qualifications pro | ~20 | TP conducteur, CAP conduite, SST, WEBF |
| Suivi parcours | ~30 | devenir 0/3/6/9/12 mois, statut, remunération, sortie |
| Divers | ~50 | num ANPE, COTOREP, AFT, megabase GUID/login... |

**Implication pour le MCD :** ne pas aplatir ces 600 champs dans `persons`. Créer une entité `person_certifications` avec un modèle structuré par type de certification (CACES, habilitation, permis, FIMO/FCO...).

## Paramètres de synchro (dans plgfpro.parametres)

- `nevea_last_synchro_date_time` : timestamp dernière synchro complète
- `nevea_last_action_lit_apprenants_dt` : dernière lecture apprenants
- `pfp2gp_last_lecture_planning_dt` : dernier export planning vers gplearn
- `nevea_last_synchro_id` : dernier ID NEVEA traité

## Modules → Produits GPLearn (mapping dans plgfpro.modules.produit_gplearn)

```sql
-- Correspondances connues (commentaires dans le code) :
-- modules %theo%dist%  → 'WEBX'  (théorie à distance)
-- modules %theo%       → 'TH'    (théorie présentiel)
-- modules %prat%       → 'PRAT'  (pratique)
-- modules %test%       → 'PC'    (passage/évaluation)
-- modules %exam%       → 'PC'    (examen)
-- modules %voyag%      → 'Camp'  (voyage/déplacement)
```

## Vulnérabilité à corriger

`privateid` NEVEA hardcodé dans le code source (`eleves.php`) — migré dans `NEVEA_PRIVATE_ID` via `fix-webservices.py`.
