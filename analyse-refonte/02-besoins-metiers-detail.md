# Besoins métiers détaillés — CERCA/ECF

## Domaine 1 : Gestion des Élèves (Tiers)

### Données élève (table `tiers`)
Un élève est identifié par un code unique par agence. Ses données couvrent :
- **État civil** : nom, prénom, nom de naissance, date/lieu de naissance, nationalité, sexe
- **Contact** : adresse, CP, ville, tél, email, email accompagnateur, email prescripteur
- **Permis demandés** : B, A, A1, AR, EB, C, EC, D, DR, ED (champs booléens)
- **Antécédents permis** : date 1er permis, délivré avec ECF, annulation, formation partielle
- **ANTS** : numéro NEPH, identifiant e-form
- **Financier** : code d'accès portail, mot de passe, plafond crédit, facturation en cours
- **Handicap** : lié via `tiers_handicap`
- **Origine prospect** : via `tiers_orig_prosp`
- **Financements envisagés** : via `tiers_financ_envis`

### Cycle de vie d'un élève
1. **Renseignement** → prospect entrant (table `renseignements`)
2. **Inscription** → création fiche tiers + dossier
3. **Constitution dossier** → pièces justificatives (table `elements_dossier`)
4. **Contrat** → devis accepté, signature (blockchain via `block_chains`)
5. **Planification** → affectation aux créneaux planning
6. **Suivi pédagogique** → évaluations, progression théorie/pratique
7. **Examen** → ETG puis pratique, résultats, ANTS
8. **Solde** → solde du compte élève
9. **Départ/Archivage**

### Fonctionnalités avancées élève
- **Jauges de progression** (avancée théorique / pratique)
- **Permis à points** (suivi solde points)
- **Livret de formation** (LivretComplet.php)
- **Documents contractuels** : contrat PDF, signature électronique blockchain
- **E-formulaire** (webform externe)
- **ANTS** : pré-enregistrement permis, pièces jointes
- **Messagerie** : messages internes depuis la fiche
- **Vie du dossier** : historique chronologique de toutes les actions
- **Rapport VDD** (Vie Du Dossier)
- **Accès portail élève** (myRoad) : code_acces + password

---

## Domaine 2 : Planning

### Entité centrale : `plg_arg` (argument de planning)
Chaque créneau planning est un enregistrement avec :
- date, heure début/fin
- produit (code leçon/service)
- commentaire
- rattachement examen (`idexam`)
- e-commerce (réservable en ligne)
- nb_places, type_eval (évaluation)
- verrouillage (verrou_plg, verrou_ress, verrou_elv)

### Liaisons du créneau
- **Ressources** (moniteurs) : via `plg_ress` (1 créneau → N moniteurs)
- **Stages** : via `plg_stg` (1 créneau → 1 stage)
- **Élèves** : via `stg_elv` (stage → élèves) ou `plg_stg` + `stg_elv`
- **Étiquettes** : via `plg_etiq` (marqueurs visuels)
- **Séquences** : via `plg_liens` (créneaux liés en séquence)
- **Pédagogie** : via `tpedago_plg_elv` (progression élève sur ce créneau)
- **Facturation** : via `aff_plg_lfac` (créneau → ligne de facture)
- **Commentaires individuels** : via `plg_cmt_trs`
- **Réservations** : via `plg_arg_resa` (réservations e-commerce)
- **Redevances** : `mopl_plg_arg` (part franchiseur)

### Vues planning
- **Vue ressource** : planning d'un moniteur (colonne = moniteur)
- **Vue produit** : planning d'un produit/service
- **Vue élève** : planning d'un élève
- **Vue stage** : planning d'un stage
- **Vue jour mono** : vue journalière toutes ressources

### Modèles de planning
- `modeles_planning` : gabarits réutilisables
- Import/transposition de modèles
- Répétition de créneaux (daily/weekly)

### Disponibilités
- `disp_horaires` : horaires habituels de la ressource
- `dispo_dates` : disponibilités ponctuelles
- `dispo_tiers` : disponibilités élève

### Verrouillages
- Verrou planning (empêche modification créneau)
- Verrou ressource (moniteur vérifié)
- Verrou élève (présence confirmée)
- Verrou bordereaux/remise en banque

---

## Domaine 3 : Stages

### Entité `stage`
- début, fin, ponctuel (oui/non)
- Type de stage (`type_stage`) : AAC, plateau, code, conduite...
- Lié à un ou plusieurs créneaux planning via `plg_stg`
- Lié à un ou plusieurs produits via `stage_site_prod`

### Inscriptions : `stg_elv`
- Chaque ligne = 1 élève inscrit à 1 stage
- Base multi-tenant : un élève peut être dans une base différente (`stg_elv.base`)
- Documents attachés : `stg_docs_attaches`
- Options stage : `stg_opt`

### Stage calendrier (`stage_calendrier_cal`)
- Gestion des dates de stages sur calendrier
- Liaison agences-calendriers : `stage_agences_cal`
- Places : `plc_stg`

---

## Domaine 4 : Examens

### Types d'examens
- **ETG** (Épreuve Théorique Générale = code de la route)
- **Pratique** (permis de conduire)
- **ALA** (Apprentissage de la Loi sur l'Alcool)
- **EB** (plateau moto)
- **C**, **B**, **D**, **A**...

### Flux examen
1. **Prévi examen** (`previ_exam`) : prévisionnel = réservation d'unités auprès de la Préfecture
2. **Créneau examen** : enregistrement dans `plg_arg` avec `idexam`
3. **Élèves convoqués** : via `stg_elv` + classement `plg_rang_exam`
4. **Résultats** : saisie dans `res_ex` (résultat global), `res_ex_cepc` (détail CEPC), `res_ex_evini`/`res_ex_evini2` (interface Préfecture)
5. **Impression** : convocations, listes, bulletins (Printel)
6. **Antécédents** : `antec_exam` (historique présentations)
7. **Interface Préfecture** : CEPC (portail examinateurs), EVINI (résultats), EVINI Moto

### Gestion des unités examen
- `examen.unites` : pool d'unités allouées
- `FConsoUExam()` : calcul consommation
- `FUnitesExam()` : unités disponibles
- Alerte si dépassement plafond

---

## Domaine 5 : Facturation & Comptabilité

### Devis
- `devis` : en-tête, `ldevis` : lignes
- Transformable en modèle ou en facture
- Signature blockchain (`block_chains.lex_sign`)

### Factures
- `factures` : en-tête (numéro, date, tiers facturé, tiers consommateur)
- `lfacture` : lignes (produit, quantité, prix, forfait/unité)
- `factures_echeances` : échéances de paiement
- Types : forfait, à l'unité, à la présentation

### Affectation planning ↔ facture
- `aff_plg_lfac` : lien créneau planning → ligne de facture
- Calcul automatique `PFacAutoPlgAFactFromTiers_` 
- Affectation forfaits : `PFacAuto1ForfaitsAConsommer`, `PFacAutoAffectationForfait`
- Contrôle clôture production

### Règlements/Encaissements
- `reglts` : règlements (espèces, CB, chèque, virement, SEPA...)
- `bordereaux` : remise en banque
- `bordereau_tiers` : lignes bordereau
- Lettrage : rapprochement règlement ↔ facture

### Export comptable
- Export Sage Compta (journal des ventes, encaissements)
- Export en formats JX/JNX pour Sage
- Lien Sage via `lienSage/`
- Batchs : `robot_export_sagecompta_jour.php`, `robot_export_sagecompta_production_mois.php`

### Clôtures
- Clôture encaissements : `clotureenc`
- Clôture facturation : `cloturefac`
- Clôture production : verrouille les créneaux planning facturés
- Contrôle clôture : `controle_cloture`

### Conventions de formation
- `conventions` : convention entre agence et financeur (OPCO, France Travail, CPF)
- `conv_fin` : financeurs de la convention
- `convention_formations` : formations liées
- `financeurs` : référentiel financeurs
- Facturation spécifique conventions (factures liées à la convention)

---

## Domaine 6 : Ressources (Moniteurs/Formateurs)

### Données ressource
- Identifié par un code (lié à `tiers`)
- Type : moniteur, secrétaire, formateur...
- Disponibilités : `disp_horaires`, `dispo_dates`
- Suivi activité : `suivi_ressources`, `doc_suivi_ress`
- Véhicule, site d'affectation
- Heures saisies : `heures_saisies`, `heures_saisies_justif`

### Signature ressource
- Signature numérique (image) pour documents
- `enreg_sig_ress.php` dans BackOffice

---

## Domaine 7 : BackOffice (Paramétrage)

### Gestion utilisateurs
- `g_user` : utilisateurs de l'application
- `groupe_droits` : groupes de droits
- `droits.xml` : 42 droits granulaires :
  - Administration Utilisateurs, Visualisation/Modification Tiers, Comptes, Stages, Planning, Facturation, Renseignements, Documents contractuels, Agences/Familles, TVA/Produits, Modèles, Ressources...
- `dts_user` : droits par utilisateur
- `dts_gu` : droits par groupe

### Paramétrage agence
- `agences` : liste des agences du réseau
- `familles` : familles de produits
- `filieres` : filières de formation
- `permis` : types de permis
- `type_stage` : types de stages avec paramètres
- `produits` : catalogue produits/services (leçons, stages, examens...)
- `tarifs` : grille tarifaire par agence/filière/permis
- `tva` : taux de TVA
- `natures` : natures de règlement
- `banques` : banques de l'agence
- `sites_sit` : sites de l'agence

### Modèles de documents
- `modeles` : modèles de factures
- `modeles_email` : modèles d'emails
- `modeles_sms` : modèles SMS
- `lmodele` : lignes de modèles
- Modèles DOCX : `docx_modele_*` (contrats, dossiers, par filière/permis)

### E-commerce / Vente en ligne
- `modele_ecommerce_pdtweb` : produits vendables en ligne
- `modeles_vente_enligne_*` : paramétrage par agence/famille/filière/permis
- `complements_ecommerce` : données complémentaires
- Synchronisation Novius (CMS e-commerce externe)

---

## Domaine 8 : Pédagogie numérique

### Contenu pédagogique
- `tpedago` : modules pédagogiques (théorie)
  - Catégorie 0 = théorie ETG obligatoire
- `tpedago_eval` : critères d'évaluation
- `tpedago_mpf_ref` : référentiel MPF
- `pedago_fiches_descr` : fiches descriptives (texte)
- `pedago_fiche_descr_images` : images des fiches
- `pedago_videos` : vidéos pédagogiques
- `pedago_timeo` : contenu Timéo (plateforme e-learning externe)
- `pedago_boutons_ecfcoach` : boutons de l'app ECFCoach

### Suivi élève
- `tpedago_plg_elv` : note d'un élève sur un module pédagogique lors d'un créneau
  - note > 66 = acquis
  - note = 33 = en cours (ETG périmé > 5 ans)
- `_t_theo_valid_` : table temporaire de validation théorique
- `FLoadETG()` : fonction vérifiant si l'ETG est valide (< 5 ans)
- `pdg_quizz_valid` : validation quizz

### Application mobile (appliPedago / ECFCoach)
- API PHP versionnée pour les apps mobiles
- Contenu pédagogique accessible sur tablette
- ECFCoach : mode kiosque salle d'attente

---

## Domaine 9 : CRM & Communication

### Prospects / Renseignements
- `renseignements` : demandes de contact, prospects
- `origines_prospects` : canal d'acquisition (web, bouche à oreille, panneaux...)
- `tiers_orig_prosp` : origines d'un tiers

### Événements & RDV
- `evennements` : événements liés à un tiers
- `rdv_rdv` : rendez-vous
- Types RDV : `type_de_rdv_trv`

### SMS & Email
- `modeles_sms` : gabarits SMS
- `modeles_email` : gabarits email
- `automates_personnalises` : règles d'envoi automatique (déclencheurs)
- Service SMS : `webservices/smsWS/` (passerelle OVH)
- Service Email : `webservices/sendMail/` (Swift Mailer)

### Questionnaires de satisfaction
- `questionnaire_gp` : base dédiée
- Envoyé après examen ou passage

---

## Domaine 10 : Formation Professionnelle (FP)

### Différences avec l'auto-école
- Catalogue de formations (`catalogue_cat`, `catalogue_pedago_cpg`)
- Actions de formation (`action_pedago`)
- Marchés (`marche_mar`) : appels d'offres, contrats cadre
- Référentiel de compétences (`besoin_competence`, `competence_ress`)
- Suivi compétences instructeurs (`suivi_competence_ressource`)
- NEVEA : plateforme de gestion régionale (interface spécifique)
- Affectation sur parcours (`rdrd_*`, `udrd_*`)

### Applications dédiées FP
- **fplearn** / **fpl_becquet** / **pfpcassar** : instances GPLearn adaptées FP
- **PlanniFProWeb** : planning dédié FP avec gestion parc et compétences
- **plgfpro** : base de données dédiée planning FP

---

## Domaine 11 : Rémunérations

### Calcul rémunération moniteurs
- Heures saisies dans GPLearn → import dans `remunerations`
- Ratios par agence/famille/site
- PFQ (prime de formation qualifiante)
- Cessions (part réseau)
- Génération des fiches de paie / bordereaux de cession
- Export comptable

---

## Domaine 12 : Consolidation réseau (compilcerca)

### Données consolidées
- CA réalisé par agence (toutes bases `gp*`)
- Encaissements multi-agences
- Factures, avoirs
- Heures saisies réseau
- Stats élèves, inscriptions, examens
- Salaires (vue réseau)

### Alimentation
- Robots PHP qui agrègent les données des bases agences
- `compilcerca.bases_agences` : liste des bases à consolider

---

## Domaine 13 : Géolocalisation & Trajets

### Géolocalisation
- `trajets_coach_trs` : trajets des coaches (moniteurs itinérants)
- `trajets_coach_trs_details` : points GPS du trajet
- `trajets_geoloc_aac` : trajets app AAC élève
- `trajets_geoloc_details` : points GPS
- `geo_meteo.codes_postaux` : référentiel géographique

### ANTS
- Interface avec l'Agence Nationale des Titres Sécurisés
- `trs_ants` : transmissions ANTS
- `ants_adjouter_pj.php` : ajout pièces jointes ANTS
- Pré-enregistrement télématique du permis

---

## Matrice des risques métier

| Risque | Impact | Probabilité |
|---|---|---|
| Perte de données multi-tenant (mauvais changement de base) | Critique | Faible |
| Facturation incorrecte (affectation planning) | Élevé | Moyen |
| Blocage ANTS (interface Préfecture) | Élevé | Moyen |
| Perte de session utilisateur | Moyen | Moyen |
| Corruption de clôture comptable | Critique | Faible |
| Données élève non conformes RGPD | Élevé | Moyen |
| Indisponibilité planning (verrous) | Élevé | Faible |
