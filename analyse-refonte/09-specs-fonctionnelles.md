# Spécifications fonctionnelles détaillées — Règles métier extraites du code

> Version 0.1 — 2026-05-21  
> Source : analyse du code PHP/SQL GPLearn (`/workspace/sources/GPLearn/`) + bases de données dev.  
> Compléter au fil des sessions avec les règles FP (PlanniFProWeb) et les cas limites validés.

---

## 1 — DROITS UTILISATEURS (RBAC)

### 1.1 Référentiel des 42 droits (source : `droits.xml`)

| ID | Nom fonctionnel | Défaut | Attribué | Retiré | User | Groupe |
|---|---|---|---|---|---|---|
| 1 | Administration Utilisateurs | ✗ | o | o | o | o |
| 2 | Visualisation Fiches Tiers | ✓ | o | o | o | o |
| 3 | Création/Modification Tiers | ✓ | o | o | o | o |
| 4 | Visualisation Comptes | ✓ | o | o | o | o |
| 5 | Création/Modification pièces comptable | ✓ | o | o | o | o |
| 6 | Visualisation Stages | ✓ | o | o | o | o |
| 7 | Création/Modification Stages | ✓ | o | o | o | o |
| 8 | Visualisation Plannings | ✓ | o | o | o | o |
| 9 | Création/Modification Plannings | ✓ | o | o | o | o |
| 10 | Déverrouiller les règlements | ✓ | o | o | o | o |
| 11 | Déverrouiller les Tiers | ✓ | o | o | **✓** | **✓** |
| 12 | Analytique/produits | ✗ | o | o | o | o |
| 13 | Analytique/ligne de facture | ✗ | o | o | o | o |
| 14 | Déverrouiller les factures | ✓ | o | o | o | o |
| 15 | Plannifier hors plafond de crédit | ✓ | o | o | o | o |
| 16 | Création/Modification Renseignements | ✓ | o | o | o | o |
| 17 | Visualisation Renseignements | ✓ | o | o | o | o |
| 18 | Enregistrement documents contractuels | ✓ | o | o | o | o |
| 19 | Visualisation documents contractuels | ✓ | o | o | o | o |
| 20 | Suppression des documents contractuels | ✓ | o | o | o | o |
| 21 | Agences/Familles/Banques (voir) | ✓ | o | o | o | o |
| 22 | Agences/Familles/Banques (modifier) | ✓ | o | o | o | o |
| 23 | TVA/Produits/Catégories (voir) | ✓ | o | o | o | o |
| 24 | TVA/Produits/Catégories (modifier) | ✓ | o | o | o | o |
| 25 | Modèles factures/Actes-Évènements (voir) | ✓ | o | o | o | o |
| 26 | Modèles factures/Actes-Évènements (modifier) | ✓ | o | o | o | o |
| 27 | Ressources (voir) | ✓ | o | o | o | o |
| 28 | Ressources (modifier) | ✓ | o | o | o | o |
| 29 | Textes attachés modèles/devis/factures | ✓ | o | o | o | o |
| 30 | Paramètres / Modalités de règlement | ✓ | o | o | o | o |
| 31 | Réimputer un produit | ✓ | o | o | o | o |
| 41 | Outils/Traitements : Recherches | ✓ | o | o | o | o |
| 42 | Outils/Traitements : Facturation Automatique | ✓ | o | o | o | o |
| 43 | Outils/Traitements : Clôtures | ✓ | o | o | o | o |
| 44 | Outils/Traitements : Exports Comptables | ✓ | o | o | o | o |
| 45 | Outils/Traitements : MGM | ✓ | o | o | o | o |
| 46 | Outils/Traitements : Remise en banques | ✓ | o | o | o | o |
| 47 | Outils/Traitements : Résultats aux examens | ✓ | o | o | o | o |
| 48 | Outils/Traitements : Plateforme Acappella | ✓ | o | o | o | o |
| 51 | Exploitations/États/Statistiques | ✓ | o | o | o | o |
| 61 | Déverrouiller les enr. de planning | ✓ | o | o | o | o |
| 62 | Déverrouiller les remises en banque | ✓ | o | o | **✓** | **✓** |

**Légende :** Défaut = accordé par défaut à tout nouvel utilisateur. Les droits 11 et 62 sont "protégés" : l'attribution/retrait ne peut se faire que par un utilisateur possédant lui-même ce droit (colonnes `user` et `dtgu` = `x`).

> **G2.1 — clarification :** `droits.xml` contient les 42 droits "standard" listés ci-dessus — c'est le fichier de référence de l'interface. La table `droits` en base peut contenir jusqu'à 96 entrées car certains centres ont créé des droits locaux supplémentaires ou des doublons historiques. La migration rebasera sur les 42 droits standard + analyse des droits custom.

### 1.1bis Règle de délégation des droits (G2.2)

| Acteur | Peut attribuer |
|---|---|
| Utilisateur avec rôle `admin` | N'importe quel droit à n'importe quel utilisateur |
| Utilisateur standard | Uniquement les droits qu'il possède lui-même |

Les droits ultra-sensibles (réouverture clôture, déchiffrement CNIL) sont marqués `est_delegable_par_possesseur = false` — seul l'admin peut les attribuer même s'il les possède.

### 1.2 Vérification des droits dans le code

```php
// Pattern standard — vérifié avant chaque action sensible
$Q = dbQuery($base, ["select FUserALeDroit($iduser, $iddroit) as ok"]);
$R = mysql_fetch_object($Q);
if (!$R->ok) { /* refus */ }
```

`FUserALeDroit(iduser, iddroit)` : fonction stockée MySQL qui vérifie dans `dts_user` (droits directs) et `dts_gu` (droits par groupe). Retourne 1 si accordé.

### 1.3 Mapping vers le nouveau RBAC

Dans le nouveau système, les 42 droits deviennent des `permissions (ressource, action)` dans le RBAC. Exemples de mapping :

| Droits legacy | Permission nouvelle |
|---|---|
| 2 + 3 | `personnes:read` / `personnes:write` |
| 4 + 5 | `comptes:read` / `comptes:write` |
| 8 + 9 | `planning:read` / `planning:write` |
| 61 | `planning:unlock` |
| 14 | `factures:unlock` |
| 10 | `reglements:unlock` |
| 42 | `traitements:facturation_auto` |
| 43 | `traitements:clotures` |
| 15 | `planning:bypass_credit_limit` |

**⚠ Points à trancher :** Les droits "voir" vs "modifier" sont-ils toujours pertinents ou faut-il affiner la granularité (ex: `planning:read_own` vs `planning:read_all`) ?

### 1.4 Plafond de crédit (droit 15 / G2.5)

Le plafond de crédit est paramétré par entité (franchise ou site). La valeur `0` signifie "pas de plafond". Le droit 15 (`planning:bypass_credit_limit`) permet à un responsable d'ajouter un créneau même si l'élève a consommé son plafond. Permission : `planning:bypass_credit_limit`.

---

## 2 — TARIFICATION EN CASCADE

### 2.1 Structure de `tarifs_apf`

Source : `BackOffice/load_tarifs_agence_permis_filiere.php`

La table `tarifs_apf` contient tous les tarifs surchargeant le prix de base d'un produit. Les colonnes clés : `produit, agence, idpermis, idfiliere, prixu, couleur`.

```
idpermis=0 ET idfiliere=0  → surcharge au niveau agence seule
idpermis≠0 ET idfiliere=0  → surcharge agence + permis
idpermis≠0 ET idfiliere≠0  → surcharge agence + permis + filière (le plus précis)
```

### 2.2 Algorithme de résolution (à implémenter en TypeScript)

```
resoudreTarif(produit, agence, idpermis, idfiliere, accord_cadre?) :
  1. Si accord_cadre → chercher dans tarifs_accords_cadres (priorité absolue)
  2. Chercher tarifs_apf WHERE produit=P AND agence=A AND idpermis=X AND idfiliere=Y
  3. Si pas trouvé → chercher WHERE idpermis=X AND idfiliere=0
  4. Si pas trouvé → chercher WHERE idpermis=0 AND idfiliere=0
  5. Si pas trouvé → utiliser produits.prix_unitaire (prix de base)
  → Retourner : prix_unitaire, code_tva, compte_compta, compte_facav, couleur
```

**Note :** La table `tarifs` (produit × famille) est **ignorée** — elle n'est plus utilisée dans le processus actuel.

---

## 3 — FACTURATION AUTOMATIQUE

### 3.1 Séquence d'exécution (source : `Traitements/sql/facturation_auto.sql.php`)

Le traitement de facturation automatique est déclenché manuellement par un utilisateur ayant le droit 42. Il s'exécute dans cet ordre :

```
1. SET @VPlgDu, @VPlgAu, @VFactLe (dates de la période à traiter)

2. CALL PFacAutoPlgAFact(@VPlgDu, @VPlgAu)
   → Affecte les créneaux planning (plg_arg) non encore facturés
     à leurs lignes de facture correspondantes (aff_plg_lfac)
     pour tous les tiers ayant des créneaux dans la plage de dates

3. CALL PFacAutoForfaitsAConsommer()
   → Calcule pour chaque tiers les forfaits restant à consommer
     (lignes de facture de type forfait dont la qté n'est pas épuisée)

4. [OPTIONNEL si AffPlg='on'] CALL PFacAutoAffectationForfait()
   → Affecte les créneaux planning non encore facturés aux forfaits disponibles
     (alloue des créneaux aux lignes de forfait existantes)

5. [OPTIONNEL si CreerFac='on'] CALL PFacAutoCreerFactures(groupProd, date, libelle)
   → Crée les nouvelles factures pour les tiers dont les créneaux sont affectés
     groupProd : 1 = grouper par produit, 0 = une ligne par créneau
     date : date de facturation (saisie opérateur)
     libelle : libellé de la facture (ex: 'Facturation automatique [2026-05-21]')
```

### 3.2 Règles de gestion (à confirmer en production)

- Un créneau `plg_arg` est facturable si : `horsfact = 0` ET `verrou_plg = 1` (verrouillé = réalisé)
- La facturation au forfait suit la priorité : forfait le plus ancien d'abord (FIFO par date de facture)
- La facturation à l'unité crée une ligne de facture par créneau (ou groupe par produit si option activée)
- **Plafond de crédit** : si `tiers.plafcrd > 0` et solde dépassé, la planification est bloquée (sauf droit 15)

### 3.3 Clôtures

| Clôture | Effet |
|---|---|
| `cloturefac` | Verrouille les factures d'une période — elles ne peuvent plus être modifiées |
| `clotureenc` | Verrouille les encaissements d'une période |
| Clôture production | Verrouille les créneaux planning facturés (`verrou_plg`) |
| Contrôle clôture | Vérifie la cohérence avant clôture (orphelins, anomalies) |

**Droits requis :** droit 43 pour lancer les clôtures. Droit 14 pour déverrouiller une facture après clôture.

**Réouverture clôture (G4.5) :** une clôture peut être annulée mais uniquement par un utilisateur avec le rôle `super_admin`. Action journalisée dans `journal_audit`. Ce droit n'est pas délégable.

**Cron mensuel (G4.1) :** la clôture est déclenchée automatiquement dans la nuit du 3 au 4 de chaque mois via `robot_cloture.php` → `Stats_Agences_Ecf_cloture.sql`. À reproduire comme un job planifié dans le nouveau système.

### 3.4 Lettrage règlement ↔ facture (G4.3)

| Situation | Lettre |
|---|---|
| Lettrage automatique **partiel** (montant ≠ total facture) | **minuscule** — 'a', 'b'... |
| Lettrage **équilibré** (total règlements = total facture) | **MAJUSCULE** — 'A', 'B'... |

Processus : un trigger ou un job de réconciliation vérifie après chaque règlement si la somme des règlements de même lettre égale la facture concernée. Si oui, les lettres minuscules sont élevées en majuscule.

---

## 4 — PLANNING — VERROUILLAGES

### 4.1 Trois niveaux de verrou sur `plg_arg`

| Champ | Signification | Qui peut déverrouiller |
|---|---|---|
| `verrou_plg` | Créneau planning validé (séance réalisée) | Droit 61 |
| `verrou_ress` | Ressource (moniteur) confirmée sur ce créneau | Droit 61 |
| `verrou_elv` | Présence élève confirmée | Droit 61 |

**Règle :** `verrou_plg = 1` est le prérequis à la facturation automatique. Le verrou est posé manuellement ou automatiquement selon le paramétrage agence.

**Irréversibilité après clôture (G3.4) :** quand `sessions_formation.is_cloturee = true`, les trois verrous du créneau deviennent irréversibles — même le droit 61 ne peut pas déverrouiller. L'API doit refuser la demande avec un message explicite.

**Chevauchement (G3.5) :** détection en temps réel à la saisie d'un créneau. Si une ressource est déjà affectée sur une plage qui se chevauche, l'UI affiche un **avertissement non bloquant** (bandeau orange). L'opérateur peut forcer la saisie.

**Disponibilités (G3.2) :** la saisie et la modification des disponibilités d'un moniteur/formateur sont réservées à la secrétaire ou au responsable. Le moniteur n'a pas accès à ses propres disponibilités dans l'interface (contrairement à myRoad apprenant).

### 4.2 Répétition de créneaux (source : `Planning/repeter_plg.php`)

Options confirmées (G3.3) : **répétition personnalisée** (choix libre des jours, de la fréquence, de la date de fin). Le moteur **saute automatiquement les jours fériés** (table `jours_feries`) et les fermetures agence.

Le créneau original devient le gabarit, les copies sont générées sur la plage demandée en excluant les dates présentes dans `jours_feries` (national ou franchise).

---

## 5 — DISPONIBILITÉS RESSOURCES

### 5.1 Structure legacy (source : `Planning/sql/dispos.sql.php`)

```sql
-- dispo_dates : période de disponibilité
SELECT dd.iddispo_dates, dd.idress, dd.du, dd.au, dd.semaines_cycle
FROM dispo_dates dd
JOIN intervt r ON r.code = dd.idress

-- disp_horaires : détail des plages horaires dans la période
SELECT dh.iddispo_dates, (dh.jour+6)%7 AS jour, dh.semaine, dh.hdeb, dh.hfin
FROM disp_horaires dh
```

**Logique :**
- `dispo_dates.du / au` : plage de dates d'application
- `dispo_dates.semaines_cycle` : cycle de semaines (1 = toutes, 2 = semaines paires/impaires...)
- `disp_horaires.jour` : jour de la semaine (0=lundi…6=dimanche, après conversion `(jour+6)%7`)
- `disp_horaires.semaine` : semaine dans le cycle
- `disp_horaires.hdeb / hfin` : plage horaire de disponibilité

### 5.2 Disponibilités apprenants (source : `Planning/sql/dispos_tiers.sql.php`)

```sql
SELECT dt.*, (dayofweek(dt.date)+6)%7 AS jour
FROM dispo_tiers dt WHERE tiers = @vidtiers
```

Structure plus simple : disponibilité par date précise (pas de plage + horaire).

---

## 6 — AUTOMATES DE COMMUNICATION

### 6.1 Déclencheurs identifiés (source : `Traitements/automate_communication_batch.php`)

| Code déclencheur | Événement | Cible |
|---|---|---|
| `crea_pros` | Création prospect (J-1) | `tiers.dtinscont = hier` |
| `insc_eleve` | Inscription élève (J-1) | `tiers.dateinscr = hier` |
| `sur_lecon` | Après une leçon (J-1) | `plg_arg.date = hier` + filtre optionnel produits |
| `sur_validpeda` | Après validation pédagogique (J-1) | même filtre que sur_lecon |
| `apres_x_echec` | Après échec examen | *(à implémenter)* |
| `apres_x_succes` | Après réussite examen | *(à implémenter)* |
| `credit_age` | Sur crédit âgé | *(à implémenter)* |

**Champs tiers utilisés pour l'envoi :** `email`, `email_comm` (email commercial opt-in), `email_auto` (email automatique opt-in), `notif` (préférences notification).

**Exécution :** script PHP batch lancé quotidiennement, passe en revue toutes les bases GP-Learn.

### 6.2 Mapping vers `automates_notifications` (nouveau MCD)

| Legacy `moment` | Nouveau `type_declencheur` |
|---|---|
| `crea_pros` | `creation_prospect` |
| `insc_eleve` | `inscription_apprenant` |
| `sur_lecon` | `realisation_creneau` |
| `sur_validpeda` | `validation_pedagogique` |
| `apres_x_echec` | `echec_examen` |
| `apres_x_succes` | `reussite_examen` |
| `credit_age` | `credit_age` |
| *(nouveau)* | `devis_envoye` (J+14 rappel) |
| *(nouveau)* | `contrat_envoye` (J+14 rappel) |
| *(nouveau)* | `j_avant_examen` (J-X rappel convocation) |

---

## 7 — CONVENTIONS DE FORMATION

### 7.1 Flux d'établissement des factures convention (source : `Conventions/sql/etablir_factures.sql.php`)

La facturation convention est distincte de la facturation automatique ordinaire. Elle crée des factures liées à une convention (financement OPCO, France Travail, CPF…).

**⚠ À analyser :** lire `etablir_factures.sql.php` en détail pour extraire le calcul des montants par financeur.

---

## 8 — RENSEIGNEMENTS / CRM GP

### 8.1 Structure `renseignements` (source : `Eleves/sql/`)

```sql
SELECT r.id, r.tampon, r.titre,
  concat(u.prenom, ' ', u.nom) AS utilisateur
FROM renseignements r
JOIN tiers t ON t.code = r.idtiers
LEFT JOIN user u ON r.iduser = u.iduser
```

- `tampon` : horodatage automatique (format 'Y-m-d H-i-s')
- `titre` : libellé court de l'interaction
- `renseignements.renseignements` : corps en RTF (converti depuis HTML via `html2rtf()`)
- Droit requis pour écriture : **droit 5** (Création/Modification pièces comptable) — **mapping à vérifier** (semble incorrect, probablement droit 16)

---

## 9 — POINTS À ANALYSER (sessions suivantes)

| Module | Fichier clé | Règle à extraire |
|---|---|---|
| Unités examen | `Examens/previs_exam.php` | Calcul FConsoUExam / FUnitesExam |
| Affectation bordereaux | `Bordereaux/` | Logique de remise en banque |
| Export Sage | `Traitements/robot_export_sagecompta_*.php` | Format JX/JNX, codes journaux |
| Clôture production | `Traitements/` | Séquence exacte |
| ANTS | `webservices/ants/` | Format échange, types de pièces jointes |
| Conventions FP | `Conventions/sql/etablir_factures.sql.php` | Calcul montants par financeur |
| Rémunérations | `Remunerations/` | Ratios, PFQ, cessions |
