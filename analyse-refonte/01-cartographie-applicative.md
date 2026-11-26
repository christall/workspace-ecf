# Cartographie du parc applicatif CERCA/ECF

## Vue d'ensemble

Le parc applicatif couvre la gestion complète d'un réseau de franchises d'auto-écoles (ECF/CERCA) avec une activité secondaire de formation professionnelle. Il est hébergé sur un seul serveur Linux et composé d'une vingtaine d'applications PHP/JS avec MySQL.

---

## Applications principales

### 1. GPLearn (`/home/applisWeb/gplearn_tom/` et `gplearn_chris/`)

**Rôle** : ERP central de gestion d'auto-école. Application principale utilisée quotidiennement par les secrétaires, moniteurs, responsables d'agence.

**Utilisateurs** : secrétaires agence, moniteurs, responsables réseau, comptables.

**Modules** :

| Module | Rôle |
|---|---|
| **Planning** | Planification des leçons, examens, stages. Utilise dhtmlxScheduler. Multi-vues : ressource, produit, élève, stage. Gestion des séquences, modèles, verrouillage. |
| **Élèves** | Fiche élève complète : état civil, permis demandés, dossier pédagogique, suivi ETG/pratique, documents, contrat, financement, ANTS, e-formulaires. |
| **Stages** | Gestion des stages (AAC/conduite accompagnée, plateau, ponctuel). Inscriptions, planning stage, documents attachés. |
| **Examens** | Gestion des examens ETG et pratiques. Prévisionnels, convocations, saisie résultats, classement rang, interface Préfecture (CEPC, EVINI). |
| **Facturation** | Devis, factures, lignes de factures, affectation planning ↔ lignes facture, modèles, soldes. |
| **Encaissements** | Saisie règlements, bordereaux de remise, lettrage. |
| **Conventions** | Conventions de formation, contrats financement (OPCO, CPF, France Travail). |
| **Bordereaux** | Bordereaux de remise en banque. |
| **Pédagogie** | Contenu pédagogique théorique (fiches, vidéos, timeo), suivi de progression élève, quizz ETG, évaluations. |
| **BackOffice** | Paramétrage agence : ressources (moniteurs), types de stages, tarifs, modèles de documents (DOCX), droits utilisateurs, liens e-commerce, synchronisation Novius. |
| **Messagerie** | Messagerie interne entre utilisateurs. Messages SMS et email. |
| **Traitements** | Batchs : export Sage Compta, archivage docs, inscription stages web, synchronisation e-commerce Novius. |
| **Statistiques** | Tableaux de bord CA, inscriptions, examens par agence. |

**Stack technique** :
- Backend : PHP 7+ (rétrocompatible PHP 5 via couches d'abstraction)
- Base de données : MySQL, accès direct via `mysqli_*` / couche maison `TDbConnector`
- Frontend : dhtmlX (grilles, planificateur, onglets, fenêtres) — bibliothèque JavaScript propriétaire années 2010
- PDF : FPDF/mPDF
- DOCX : PHPWord via Composer
- Pas de framework MVC — architecture "page PHP + requêtes SQL directes"

**Architecture multi-tenant** :
- Chaque agence = une base MySQL dédiée (`gp1301`, `gp8803`, etc.)
- La base `gpcontrolserveurs` centralise authentification et liste des bases
- La session est créée dans `gpcontrolserveurs.sessions` à la connexion
- Le routing se fait via le paramètre `?base=gp1301`

**Points faibles** :
- SQL injecté directement depuis `$_REQUEST` (risque injection malgré escape)
- Utilisation de `mysql_*` dépréciées dans certains fichiers anciens
- Pas de ORM, pas de couche d'abstraction métier
- Frontend non responsive (conçu pour desktop uniquement)
- dhtmlX ancien = UI lourde, non accessible, impossible à moderniser progressivement
- Pas de tests automatisés
- Logique métier éparpillée entre PHP, JS, et procédures stockées MySQL
- Mots de passe MD5 dans certains endroits anciens

---

### 2. myRoad / myRoad Back (`/home/webservices/myRoad/` et `myroad_back_tom/`)

**Rôle** : Application web/mobile destinée aux **élèves**. Interface pour suivre son parcours, réserver des leçons, payer en ligne, accéder aux résultats.

**Fonctionnalités** :
- Consultation du dossier élève (solde, planning, résultats)
- Inscription à des stages
- Paiement en ligne
- ECF Debrief (résultats détaillés passage examen)
- Suivi pédagogique

**Stack** : PHP backend (versionnée `v0001.0033` à `v0001.0039`), frontend HTML/CSS/JS simple

**Versionnage** : chaque version = un dossier, déploiement manuel via copie de dossier.

---

### 3. ECFCoach (`ecfcoach_back/` + `ecfcoach_front/`)

**Rôle** : **PWA installable** (Android APK, iOS IPA, Windows EXE) utilisée par les **moniteurs en agence sur tablette**. C'est le **livret de formation numérique** : le moniteur évalue les élèves en temps réel pendant et après les leçons. Fonctionne **offline** avec une base IndexedDB locale, synchro bidirectionnelle avec GPLearn toutes les 2 minutes.

**Stack** :
- Back : PHP pur versionnée (`v0001.0038`), endpoints de synchro JSON
- Front : Vanilla JS, CSS, PWA (service worker `sw.js`), Cordova/PhoneGap pour les builds natifs
- Stockage local : **IndexedDB** (réplique partielle de GPLearn), fallback WebSQL legacy

**Modules front** :

| Module | Fonctionnalité |
|---|---|
| `AppliPedago_jourCoach` | Vue "journée du coach" — liste des leçons du jour |
| `AppliPedago_planning` | Vue planning du moniteur sur N semaines |
| `AppliPedago_L_seance` | Fiche de la leçon en cours |
| `AppliPedago_L_eval` | Évaluations pédagogiques (critères `Tpedago_plg_elv`) |
| `AppliPedago_L_abs_pres` | Saisie présence/absence + émargement signé |
| `AppliPedago_cepc` | **CEPC** — 14 critères A-N + bilan avant examen |
| `AppliPedago_L_fiche` | Fiche élève (consultation + modif. coordonnées) |
| `AppliPedago_L_parcours` | Parcours pédagogique chronologique de l'élève |
| `AppliPedago_L_histopdg` | Historique pédagogique par critère |
| `AppliPedago_L_messagerie` | Messagerie moniteur ↔ élève |
| `AppliPedago_L_aac` | Module AAC (EVINI — évaluation initiale) |
| `AppliPedago_RechercheEleves` | Recherche d'élèves |

**Synchro descendante** (`synchro_gplearn.php`) — serveur → tablette, delta par `synchro_tmstamp` :

| Raison | Données téléchargées |
|---|---|
| `3j` | Élèves + créneaux sur J-1/J+1 du moniteur |
| `Ns` | Planning du moniteur sur N semaines |
| `Xm` | Créneaux supprimés depuis dernière synchro (via `plg_ress_x`) |

**Tables IndexedDB locales** (réplique partielle GPLearn) : `plg_arg`, `tiers`, `agences`, `tpedago`, `Tpedago_plg_elv`, `abspres`, `plg_emarg`, `res_ex_cepc`, `res_ex_evini`, `res_ex_evini2`, `res_ex_evini_moto`, `famille_pedago`, `filiere_pedago`, `permis_pedago`, `typestg_pedago`, `action_pedago`, `produits_pedago`, `documents`, `stage`, `plg_stg`, `stg_elv`, `plg_ress`, `plg_cmt_trs`, `intervt`…

**Synchro montante** (`synchro_retours_gplearn.php`) — tablette → GPLearn :

| Table | Champs remontés |
|---|---|
| `abspres` | `abspres`, `obs` — présence/absence |
| `Tpedago_plg_elv` | `note`, `observations` — évaluations critères |
| `plg_emarg` | `iddoc`, `tampon` — émargement signé (blob base64) |
| `res_ex_cepc` | 14 critères A-N + observations — **CEPC complet** |
| `res_ex_evini` / `evini2` / `evini_moto` | ~50-70 champs — **EVINI** voiture/moto |
| `documents` | Photos, PDFs signés (base64 → binaire) |
| `tiers` | Coordonnées modifiées par le moniteur |
| `stage`, `plg_stg`, `stg_elv` | Ajout d'un élève à une leçon depuis la tablette |

**Point technique critique — IDs temporaires négatifs** : toute création offline (document, stage) reçoit un ID négatif côté tablette. À la remontée, le serveur génère le vrai ID et envoie un mapping (`aIdDocs`, `aIdStages`) pour requalifier les références locales.

**Implications refonte** :
- ECFCoach est **fortement couplé** à GPLearn (accès direct aux tables MySQL)
- CEPC et EVINI sont **exclusivement alimentés depuis ECFCoach** — pas de saisie dans GPLearn
- Pendant la transition, une **API de compatibilité** `synchro.php` / `synchro_retours.php` devra être maintenue contre le nouveau backend
- Le protocole de synchro (delta incremental + `plg_ress_x` pour suppressions + IDs négatifs) est à reproduire dans le nouveau système
- Les tables `res_ex_cepc`, `res_ex_evini*` sont modélisées dans le MCD v0.8 (`evaluations_cepc`, `evaluations_evini`)

---

### 4. PlanniFProWeb (`/home/applisWeb/PlanniFProWeb/` et `PlanniFProWeb_tom/`)

**Rôle** : Planning dédié à la **Formation Professionnelle** (instructeurs, sites, parc véhicules, CACES...).

**Fonctionnalités** :
- Planning instructeurs formation pro
- Gestion parc (véhicules/machines)
- Affectation ressources aux actions de formation
- Interface pour les organismes de formation partenaires

**Stack** : PHP + dhtmlX (identique à GPLearn), base `plgfpro`.

---

### 5. campus (`/home/applisWeb/campus/`)

**Rôle** : **Portail de webinaires** ECF CERCA pour les formateurs et moniteurs du réseau. Ce n'est pas un LMS ni un espace apprenant — uniquement un outil de communication interne RH/formation.

**Stack** : Next.js 15.1.3, React 19, TypeScript, Tailwind CSS. Bootstrappé avec `create-next-app`. **Aucune base de données propre** — toutes les données viennent de Microsoft Graph API (M365/Teams).

**Fonctionnement :**
- `GET /api/events` → interroge Microsoft Graph API (Azure AD, client credentials) pour lister les webinaires Teams organisés par `campus@ecf-cerca.fr`. Filtre : `status=published` + date de fin future.
- Page unique : affiche les webinaires groupés en 8 catégories (Sécurité routière, Enseignement, Outils numériques, SCOP, Qualité, FP, Commercialisation, Informatique). Catégorie extraite d'un `<p>N</p>` dans la description Teams. Lien direct vers `events.teams.microsoft.com` pour l'inscription.
- `POST /api/send-message` → formulaire de contact vers `campus@ecf-cerca.fr` via Nodemailer/Outlook365.

**Intégrations** : Microsoft Graph API (webinaires Teams), Nodemailer/Outlook365 (email contact). Aucune connexion aux bases MySQL/GPLearn.

**Statut** : **Opérationnel et autonome.** Pas abandonné — projet fonctionnel avec credentials Azure actifs.

**Décision refonte (G10.2)** : À **conserver tel quel**, hors périmètre de la refonte ERP. Évolution future possible : lier les inscriptions Teams à une fiche `personnes` du futur ERP pour le suivi des participations aux webinaires.

⚠️ `.env` contient `AZURE_CLIENT_SECRET` et `OUTLOOK_PASSWORD` — vérifier l'exclusion `.gitignore`.

---

### 6. Remunerations (`/home/applisWeb/Remunerations/`)

**Rôle** : Calcul et suivi des **rémunérations des moniteurs**.

**Fonctionnalités** :
- Saisie/import des heures travaillées
- Calcul des ratios de rémunération
- Génération des bulletins / cessions
- Historique et soldes

**Stack** : PHP + dhtmlX, base `remunerations`.

---

### 7. Argan Client (`/home/applisWeb/Argan/`)

**Rôle** : Portail web pour les **agences affiliées** (interface de consultation/gestion côté client CERCA).

**Stack** : PHP, dhtmlX.

---

### 8. tezos-digisign (`/home/applisWeb/tezos-digisign/`)

**Rôle** : Signature électronique de documents sur blockchain **Tezos**.

**Fonctionnalités** : génération de clés, signature de contrats, vérification d'authenticité.

**Stack** : Docker compose, reverse proxy Nginx.

**Base** : `block_chains`.

---

### 9. compilcerca (`/home/applisWeb/applisweb/` → module Argan)

**Rôle** : Consolidation financière multi-agences. Vue agrégée du CA, encaissements, factures sur l'ensemble du réseau.

**Base** : `compilcerca` (74 tables d'agrégation).

---

### 10. Intranet (`/home/applisWeb/intranet/`)

**Rôle** : Intranet réseau CERCA — documentation, actualités, formations internes, webforms.

**Stack** : **Drupal 6/7** (très ancien, fin de support depuis 2016). Base `intranet`.

---

## Services transverses (`/home/webservices/`)

| Service | Rôle |
|---|---|
| `smsWS/` | Envoi SMS via passerelle (OVH/autre) |
| `sendMail/` | Envoi email via Swift Mailer |
| `notifications-push/` | Service Node.js d'envoi de notifications push mobile |
| `robots/` | Robots batchs : client Argan, fin de mois CERCA, géolocalisation |
| `sessions/` | Gestion centralisée des sessions |
| `ecommerce/` | Backend e-commerce (vente en ligne de formations) |
| `ants/` | Interface ANTS (Agence Nationale des Titres Sécurisés) — pré-inscription permis |
| `sql/` | Requêtes SQL partagées entre services |

---

## Résumé des technologies en place

| Technologie | Utilisation | Statut |
|---|---|---|
| PHP 7 (sans framework) | GPLearn, myRoad, services | Fonctionnel mais vieillissant |
| dhtmlX (JS propriétaire) | Frontend GPLearn, PlanniFPro, Remunerations | Obsolète, non maintenu |
| MySQL 5.7/8 | Toutes les données | Robuste, bien utilisé |
| Next.js / React | campus (nouveau) | Moderne, à développer |
| Drupal 6/7 | Intranet | En fin de vie — risque sécurité |
| Node.js | Notifications push | OK |
| Docker/Tezos | Digisign | Isolé |
| mPDF / FPDF | Génération PDF | OK |
| PHPWord | Génération DOCX | OK |
| dhtmlxScheduler | Planning | Fonctionnel mais UI datée |
