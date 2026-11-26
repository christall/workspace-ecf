---
name: project-ect359-agence-inscription
description: "ECT-359 (épique ECT-23 PROJET FP) : répercuter le site d'affectation NEVEA dans gpfp au lieu de l'agence du site plgfpro — chaîne de données vérifiée en recette le 25/11/2026, inconnues à trancher avant de coder"
metadata:
  node_type: memory
  type: project
  originSessionId: 1d204190-cfb9-43be-a222-d75e47cbd9c4
  modified: 2026-11-26T09:02:54.013Z
---

Ticket **ECT-359** « Agence inscription gpfp à corriger » (Story, epic ECT-23 PROJET FP, reporter Tom Boutin,
assigné Christophe, statut To Do (Dev), créé 14/09/2026). Exemple du ticket : session « CLASSE VIRTUELLE DU
24/09/2026 » — NEVEA affiche site d'affectation **(4101)** = BLOIS, GPFP affiche **7913**.

**Chaîne vérifiée en recette (25/11/2026, données réelles)** :
- NEVEA module « CLASSE VIRTUELLE CODE DE LA ROUTE (ETG)/NP03792609043 T010 » (24/09) → `fplearn.opportunite_opp` 142405
  (`opp_idsite=5`) → `gplearn` stage **22640** (`stage.agence=7913`).
- `pfp_nevea_site` : NEVEA site 2857 → plgfpro site 2 « La Crèche » → `sites.agence=7913`.
- `gpfp.agences` : 4101=**BLOIS** (vraie agence) ; 7913/4403/4105/1610... = 16 agences sur 103 avec `nom=code`
  (agences fantômes, aucune créée par du code de `sources/` — `insert into agences` introuvable).
- `plgfpro.sites` « Blois » (8) et « COA BLOIS » (63) portent `agence=4105` (PAS 4101) — incohérence à élucider.
  `sites.ag_nevea` = codes courts (01-65), inutilisables comme code agence GP.

**Où le code écrit l'agence** : `PlanniFProWeb/serverside/lien_nevea/robot_import_nevea.inc.php:579-602`
(`injection_elv_app_base_gpfp` : `tiers.agenceresp` ET `tiers.agenceinsc` = `plgfpro.sites.agence`) et
`PlanniFProWeb/serverside/lien_crm/lien_crm.php` (`crm2gpl_action` : `stage.agence` idem). L'UI stage GPFP
affiche `tiers.agenceresp/agenceinsc` (`GPLearn/Stages/sql/eleves_stage.sql.php:54,109-121`).

**Donnée NEVEA « affectation » — vérifié en direct le 25/11/2026, le canal API apprenants existe et répond** :
- **API vendor apprenants** (documentée en commentaire `eleves.php:8-9`, NON utilisée par le robot) :
  `https://ecf-cerca.nevea.fr/api/v1/vendor/ecf/cerca/apprenant/?modid=<id module>&fields=document.attributes,document.properties.all&slice=all&dcpopen-authorization=<token>`
  — répond HTTP 200 avec le token `dcpopen` déjà présent dans `lit_data_nevea()` (le `privateid` des commentaires, lui, est périmé → 403).
  **128 attributs `app_*` par apprenant**, dont `app_id_agence_propo` (id site NEVEA, ex. 2849) et `app_agence_propo`
  (libellé, ex. « ECF CERCA BLOIS ») — **varie par apprenant au sein d'une même session** (classe virtuelle du 24/09,
  module NEVEA 34785857 : BLOIS, NERSAC, RILHAC RANCON, COA LES SORINIERES, SAINTE FEYRE, COA DONZENAC).
  **Aucun champ « affectation » ni « agence de production »** dans la structure — le plus proche du « site d'affectation »
  du ticket = `app_agence_propo` (mêmes valeurs que la colonne « Site de rattachement (propo.) » du rapport scrapé : les deux canaux concordent).
- **Sémantique des codes (confirmé Christophe le 25/11/2026)** : 1610 = Nersac, 4105 = **IFP (formapro) Blois**,
  4101 = **ICE (grand public) Blois** ; gpfp = la base gplearn des données formapro issues de NEVEA/PlanniFPro.
  Donc `plgfpro.sites.agence` (Blois→4105, Nersac→1610) est **correct** — pas un placeholder. Mon hypothèse
  « 4105 faux car pas de base gp4105 » était erronée : les codes FP de gpfp.agences n'ont pas à refléter les
  bases grand public (gp4101/gp4102/gp4104).
- **L'écart réel** : le « (4101) » du ticket = ICE grand public Blois, code porté **uniquement côté NEVEA**
  (aucun site plgfpro ne porte agence 4101 — vérifié : le champ `agence` des sites plgfpro n'a jamais 4101 ;
  `pfp_nevea_site` mappe le site NEVEA 2849 « ECF CERCA BLOIS » vers le site plgfpro « Blois » IFP par
  correspondance de nom floue `idsite_pfp()`). La chaîne actuelle (module → site plgfpro → agence) ne peut donc
  **jamais** produire 4101 : elle donne 7913 (La Crèche, site organisateur du module) ou 4105 (IFP). C'est ça que
  Tom voit : agence d'inscription ≠ site d'affectation NEVEA.
- Endpoint famille SITE NEVEA (`/api/v1/families/SITE/documents/?docid=2849`) = 403 depuis le conteneur (token vendor
  scopé module/apprenant) — le code 4101 est probablement un attribut du document site NEVEA ; à vérifier depuis le
  serveur avec le NEVEA_PRIVATE_ID courant (ou via l'UI NEVEA).
- Le robot, lui, continue d'utiliser le REST VIEWMODULE_LISTE_APPRENANTS (5 champs) + scraping fiche (FDL_CARD,
  `getInfosApprenantNevea()`, pas d'« affectation ») + scraping rapport production (RAPPORT_CPRODUIT,
  `NeveaLitDonnesDeProduction()`/`parseApprenants()`, colonnes « Site de rattachement (A.F.) »/(propo.) » stockées dans
  `opx_json_data`).

**Captures du ticket lues le 25/11/2026 (gpt-4o vision via la clé OpenAI de `routeur/.env` — le routeur ne
transporte pas les images, appel direct API OpenAI)** :
- Capture NEVEA (1413×560, posée par Christophe dans `sources/Echanges_claude_code/06eeaac6-...png`) = **liste des
  apprenants du module** avec une colonne « **Site d'affectation** » par apprenant : ABROUD/BRUNEAU/CARROUE →
  « ECF CERCA BLOIS », autres → « ECF CERCA NERSAC », « ECF COA LES SORINIERES », « ECF COA DONZENAC » —
  **identiques aux `app_agence_propo` de l'API**. Contre-vérification ciblée : **aucun nombre entre parenthèses**
  dans l'image.
- Capture GPFP (1074×251, attachement Jira id 60901, téléchargée via l'op MCP `downloadJiraIssueAttachment` avec
  URL signée + python3) = écran « élèves du stage » : colonnes « **Agence Resp** » et « **Agence Inscrip°** » par
  élève = **7913** (majorité), 1610 (COLO), 1910 (MOURIACOU) — le symptôme du ticket.
- **Le « (4101) » du ticket est l'interprétation de Tom** (« ECF CERCA BLOIS » → 4101), pas un texte de NEVEA :
  tapé à la main dans la description (changelog du 14/09 12:31, saisie unique), absent de la capture. Hypothèse
  Christophe confirmée. JQL `text ~ "4101"` sur le projet ECT : aucune autre occurrence en contexte FP (les autres
  tickets mentionnent la base GP gp4101, hors sujet).
- **Conclusion design** : « site d'affectation » = la colonne par apprenant = `app_agence_propo`/`app_id_agence_propo`
  (API vendor) = « Site de rattachement (propo.) » (rapport scrapé). Correctif = écrire cette donnée dans
  `tiers.agenceinsc` (et `agenceresp` ? les deux colonnes sont visibles dans GPFP — à trancher avec Tom). Reste le
  **mapping site NEVEA → code agence** : BLOIS→4101 attendu par Tom, la chaîne pfp_nevea_site→plgfpro donnerait 4105
  (IFP, le matching de nom flou a mappé le site ICE « ECF CERCA BLOIS » sur le site plgfpro IFP « Blois ») ;
  NERSAC→1610 fonctionne déjà.

**Approfondissement 25/11/2026 (piste « champ analytique » de Christophe)** :
- Aucun champ « analytique »/« code agence » dans les API : apprenants (128 clés `app_*` — seulement
  `app_agence_propo`/`app_id_agence_propo`), modules (clés md_* sur 536 modules — seulement md_siteid/md_sitelib/
  md_lieuform*, md_catacode = code catalogue). Familles vendor site/agence/personne/societe = 404 (seules
  module/apprenant existent). REST liste = 5 champs. 0 occurrence de « analyt » dans le code.
- Le seul endroit « analytique » connu : la colonne **« Section analytique »** du rapport de production scrapé
  (RAPPORT_CPRODUIT) — **vide** pour les apprenants de la classe virtuelle en recette. Elle est capturée
  dynamiquement par `parseApprenants()` → `opx_json_data`, mais jamais consommée.
- **Tables de lien existantes** : plgfpro `pfp_nevea_site(id_nevea→id_pfp)` (2 colonnes, pas de code agence),
  `pfp_nevea_catalogue` (avec pfp_code_pafg/cata_code), `pfp_nevea_action`, et une table orpheline `sites_nevea`
  (idsite, nom — 8 lignes, ex. 8→« ECF CERCA BLOIS » — pas de code agence) + `sites.ag_nevea` varchar(10) (valeurs
  01-65, jamais écrite par le code). fplearn : `lien_site_externe_lsx` (sites : PlanniFPro + nevea, écrit par
  `pfp2crm_site`), `sites_sit`, `lien_opportunite_sites_los` — aucun concept agence.
- **Sondes restantes (Basic Auth, à lancer depuis gp-app)** : fiche site NEVEA (FDL_CARD&id=2849) grep
  « analytique|agence|code » ; famille AGENCE API `?docid=2849&slice=all` ; fiche apprenant grep « analytique » ;
  fiche module grep « analytique|agence ». Si le code est sur la fiche site → ajouter le scraping dans le robot +
  alimenter `pfp_nevea_site` (nouvelle colonne) ou `sites.ag_nevea`, et le lien fplearn via lsx.

**RÉSOLU le 25/11/2026 — champ trouvé + codé (non déployé)** : les agences Névéa (famille « nos agences »,
38 documents) portent `si_codeagence` (=4105 pour ECF CERCA BLOIS) et `si_sectionanalytique` (=05) — lisibles par
API Basic Auth (`/api/v1/families/AGENCE/documents/?slice=all` + `/api/v1/documents/<id>.json`). Le « 4101 » de Tom
était une erreur de transcription (4101 = ICE grand public, hors gpfp ; le champ « code commune » = 41018 en est
peut-être la source). Aucun champ « site de production » dans Névéa → décision Christophe : `agenceresp` = agence du
site organisateur du module (chaîne antérieure inchangée), `agenceinsc` = site d'affectation de l'apprenant, résolu
via `pfp_nevea_site` → `sites.agence` (aucune table nouvelle ; fplearn déjà lié via `lsx`).
**Code livré le 25/11/2026** (working tree PlanniFProWeb branche `php8.5_corrigée`, php -l OK, NON commité) :
`robot_import_nevea.inc.php` (`Nevea_lit_agences_apprenants()` + résolution `$agenceInsc` dans
`injection_elv_app_base_gpfp()`, `agenceinsc` seul modifié) ; `rattrappe_agence_pfp_nevea.php` (réconcilie
pfp_nevea_site/sites.agence ↔ si_codeagence) ; `rattrappe_agenceinsc_gpfp.php` (backfill tiers.agenceinsc des
stages liés). Docs dans PlanniFProWeb/CLAUDE.md § Import Nevea. **Reste (Christophe)** : valider les 2 mappings
(SAINTE FEYRE→Guéret→2313, COA DONZENAC→Brive→1910), committer depuis Windows, déployer, exécuter les rattrapages
en recette d'abord (dry-run puis confirmer=1). **Fichier de reprise** :
`sources/PlanniFProWeb/REPRISE-ECT359-20261126.md` (hook de reprise : « reprends le chantier ECT-359 »).
26/11 : ajout diagnostics HTTP aux 2 rattrapages (errno/erreur curl affichés, fallback getenv pour
NEVEA_HTTP_USER/PASS, option `no_ssl_check=1` pour WAMP Windows) après un run Windows échoué silencieusement —
l'exécution nominale se fait sur gp-app (env + réseau), le run Windows exige VPN pour plgfpro.

**Inconnues à trancher avant de coder** : (1) quel champ NEVEA est exactement le « site d'affectation (4101) »
du screenshot — demander à Christophe de vérifier dans NEVEA ; (2) mapping libellé site NEVEA → code agence GP
(plgfpro.sites.agence est incohérent : Blois→4105) ; (3) portée : seulement `agenceinsc` (affichage) ou aussi
`agenceresp`+`stage.agence` — `agenceresp` pilote la facturation (leçon [[project-etatecartsttcsage-agence-inscription]]),
à trancher avec la compta.

**Options de correction** : A) utiliser la colonne du rapport déjà stockée (+ mapping) dans
`injection_elv_app_base_gpfp()` ; B) scraper « affectation » de la fiche apprenant (XPath à ajouter) ; C) attribut
module API. Dans tous les cas : rattrapage des tiers/stages déjà importés (pattern `rattrappe_stg_elv.php`,
dry-run par défaut, recette d'abord). Liens : [[project-forum-mission021]] non — plutôt ECT-141 « Epurer les
agences sur GPFP » (Rémy, To Do) = pendant nettoyage ; ECT-358 (terminé 17/11) même zone d'import.
