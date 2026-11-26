---
name: MCD plgfpro — Planning Formateurs Pro
description: Architecture base plgfpro — planning FP, formateurs, compétences, heures, synchronisation CDC (rdrd_*/udrd_*), intégrations NEVEA/Formagest
type: reference
originSessionId: 0b5f260b-8f37-403b-a916-e0f16fb6e4cc
---
## plgfpro — Planning Formateurs Formation Professionnelle

Volumes : 385 812 créneaux planning, 78 628 actions, 1 789 ressources, 656 814 affectations, 917 000 entrées heures_trav.

### Entités principales

```
sites (idsite PK, nom, responsable, agence:6, fgest_database, adr1, cp, ville...)
typeress (idtpress PK, nom, unite, tarif_jour, tarif_km, location:bool, couleur)
  Types: Formateurs, Salles, V-Voiture, V-Autocar, V-Porteurs, V-Véhicule articulé,
         V-Engins, CACES, Pistes, Simulateur, Jury, Administratif, Gestionnaire...

ressources (idress PK, idtpress→typeress, nom, code_acces UNIQUE, password,
            email, administrateur, superadmin, vacataire, interimaire, desactive)

typeactions (idtpaction PK, idactivite→activites, nom, famille_fgest, famille_argan)
activites (idactivite PK, nom, masquer)

actions (idaction PK, idtpaction→typeactions, nom, ref_nevea, debut, fin,
         code_produit, idsite→sites, famille, nb_places, terminee, intra,
         fgest_nb_elv, fgest_database, duree_theorique)

modules (idmodule PK, nom, famille_argan, produit_gplearn:4,
         heures_jours, coeff_temps_travail, hors_heures_trav, ticket_resto, desactive)
  ← 329 modules : Théorie PL, Plateau C/CE/D/BE, FIMO/FCO, CACES R482-R490,
    BEPECASER, MSRE, Taxi, SST, AIPR, TMD, PAP, Éco conduite...

planning (idplg PK, idmodule→modules, idsite→sites, idaction→actions,
          date_debut, date_fin, hdeb, hfin, qte, comment, idstatuts→statuts)

plg_ress (idress→ressources, idplg→planning → PK)
plg_jours (idplg→planning, idjour → PK, jour:smallint, hdeb, hfin, repetition:enum)
```

### Compétences

```
competence (idcompetence PK, nom)
competence_ress (idress, idmodule → PK, priorite, validite)
besoin_competence (idplg, idtpress → PK, nb)
besoin_comp_mod (idmodule, idtpress → PK, nb)
```

### Suivi des heures formateurs

```
heures_trav (idress, idtpaction, idsite, idmodule, jour → PK,
             duree_calc, duree_sais, duree_val :time, verrou)
justif_heures (jour, idress → PK, justif_sais, justif_val, tk_resto_sais/val)
```

### Mécanisme CDC delta (rdrd_* / udrd_*)

Synchronisation bidirectionnelle entre plgfpro et les systèmes connectés :
```
rdrd_planning / udrd_planning   ← créneaux planning
rdrd_plg_ress / udrd_plg_ress   ← affectation ressources
rdrd_plg_jours / udrd_plg_jours ← jours/horaires
```
Structure : `(idsession, idtransac, oper:enum(delete/update1/update2/insert), [PK cible], [colonnes])`

### Points clés

1. **Pas de logique SQL** : aucune procédure, aucun trigger. Tout est PHP.
2. **CDC via rdrd_*/udrd_*** : journal de changements alimentant `mopl_plg_*` dans GP-Learn.
3. **modules.produit_gplearn** : pont vers codes produits GP-Learn (TH, PRAT, LCC, PC, WEBX...).
4. **Ressources polymorphes** : formateurs, salles, véhicules (27 types), pistes, simulateurs.
5. **Suivi RH complet** : contrats, affectations, disponibilités, heures calculées/saisies/validées, kilométrages, habilitations.
