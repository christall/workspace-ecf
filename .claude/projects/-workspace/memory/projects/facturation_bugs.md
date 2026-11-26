---
name: Bugs facturation GPLearn
description: Analyse des 4 dysfonctionnements de facturation GPLearn — localisation, causes et pistes de correction
type: project
originSessionId: 0b5f260b-8f37-403b-a916-e0f16fb6e4cc
---
## Fichiers clés

### PHP (couche applicative)
- `Planning/sql/enreg_presences.sql.php` — enregistrement absences/présences + correction facturation
- `Traitements/sql/facturation_auto.sql.php` — facturation automatique mensuelle
- `module_facturation/sql/affplgfac_affecter.sql.php` — affectation manuelle leçon→facture
- `module_facturation/sql/affplgfac_retirer.sql.php` — retrait affectation

### Procédures stockées (Scripts_MySQL/GPLearn/)
- `Operations.sql` — PFacAutoPlgAFact, PFacAutoForfaitsAConsommer, PFacAutoAffectationForfait, PFacAutoCreerFactures, FInscrireDesinscrireEleveAuStage
- `EnregistrementPlanning.sql` — PEnregistrePlg_ctr, PEnrPlg_correction_fact, PEnrPlg_fac_auto, PPrepareEnrPlg
- `Affectations_de_planning.sql` — Fplg_qaff, Flforf_qaff
- `Triggers_facturation.sql` — triggers sur factures, lfacture, aff_plg_lfac

### Tables centrales
- `plg_arg` — leçons planning (idplgarg, qte, horsfact, produit)
- `stg_elv` — élèves inscrits à un stage
- `aff_plg_lfac` — affectation leçon↔ligne de facture (idplgarg, numfact, numlig, tiers, qte)
- `lfacture` — lignes de facture (forfait: 0=direct simple, 1=forfait avance, 2=direct imputé)
- `abspres` — absences/présences (idtiers, idplgarg, abspres: null=présent, 1=excusé, 2=non excusé)

---

## Bug 1 — Leçon pas désaffectée (HF, absence excusée, retrait élève)

### Absence excusée (enreg_presences.sql.php L18-32)
**Bug confirmé (L26-32) :** L'ordre des colonnes dans le SET est incorrect :
```sql
set lf.qte = lf.qte-x.qte,           -- mis à jour EN PREMIER
    lf.montttc = round((lf.qte-x.qte)*lf.montttc/lf.qte, 2),  -- lf.qte = déjà new_qte !
    lf.montht  = round((lf.qte-x.qte)*lf.montht /lf.qte, 2)
```
**Fix :** Inverser l'ordre — mettre `lf.qte=lf.qte-x.qte` EN DERNIER.

### Mise HF (horsfact=1) — pas gérée
`PEnrPlg_correction_fact` ne détecte pas le changement de `horsfact`.
**Piste fix :** ajouter détection des plannings qui passent horsfact=0→1 et supprimer leurs aff_plg_lfac.

### Retrait élève (FInscrireDesinscrireEleveAuStage L580-609)
- Forfait=1 (forfait avance) : aff_plg_lfac supprimé mais lfacture.qte NON mis à jour.

---

## Bug 2 — Leçon ajoutée ne s'impute pas toujours

`PFacAutoAffectationForfait` n'impute QUE sur des forfaits EXISTANTS et NON SOLDÉS.
**Risque double-appel :** PEnrPlg_fac_auto ET FInscrireDesinscrireEleveAuStage peuvent appeler les mêmes procédures → affectation en double.

---

## Bug 3 — Facturation auto : forfaits pas consommés avant nouvelles factures

**Bug :** `PFacAutoAffectationForfait` est optionnel (checkbox AffPlg). Si l'utilisateur coche "Créer factures" sans "Affecter planning", lignes directes créées même pour des leçons qui auraient dû consommer des forfaits.
**Fix :** Appeler systématiquement `PFacAutoAffectationForfait` avant `PFacAutoCreerFactures`.

---

## Bug 4 — Doublement de qté quand élève ajouté dans une leçon collective

`plg_arg.qte` = durée TOTALE de la leçon (tous élèves). Quand 2ème élève ajouté, son T_plg_a_facturer.qte = qte_totale → doublement des affectations.
**Piste fix :** Calculer la qte par élève (diviser par nb d'élèves) dans PFacAutoPlgAFactFromTiersStage.

---

## Séquence complète PEnregistrePlg_ctr
```
PPrepareEnrPlg → PEnregistrePlg_ctr
  → PControleEnrePlg_intouchables / PlafCrd
  → PEnrPlg_correction_fact
  → PEnregistrePlg
  → PEnrPlg_fac_auto
  → PEnrPlg_Exam / CtrlDoublons
```
