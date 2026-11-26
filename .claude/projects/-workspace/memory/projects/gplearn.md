---
name: Projet GPLearn
description: Application PHP de gestion auto-école ECF-CERCA, structure et modules clés
type: project
originSessionId: 0b5f260b-8f37-403b-a916-e0f16fb6e4cc
---
Application PHP/MySQL de gestion d'auto-école pour ECF-CERCA.
Racine : `/workspace/sources/GPLearn`

**Modules principaux :**
- `BackOffice/` — administration centrale (agences, modèles de factures, propagation)
- `module_facturation/` — facturation (lignes, modèles, import/export)
- `Traitements/` — traitements batch (export compta, facturation batch)
- `Eleves/`, `Stages/`, `Planning/` — pédagogie et planning

**Fichiers clés facturation :**
- `BackOffice/propages_modeles.php` — propagation des modèles de factures d'une agence source vers des agences cibles
- `BackOffice/sql/enregistrer1lmodele.sql.php` — sauvegarde d'une ligne de modèle
- `BackOffice/sql/lignes_modele.sql.php` — lecture des lignes d'un modèle
- `module_facturation/sql/importer1modele.sql.php` — import d'un modèle dans une facture réelle
- `module_facturation/sql/facture_en_modele.sql.php` — transformation d'une facture en modèle

**Tables BD clés :**
- `modeles` — entêtes de modèles de factures (agence, idpermis, idfiliere, ident_offre)
- `lmodele` — lignes de modèles (nummod, numlig, produit, qte, montht, montttc)
- `agences` — agences avec champs `nb_h_volant`, `nb_h_piste`, `nb_h_tgd`
- `produits` — catalogue produits (code, prixu, ctva, volant, horsplg...)
- `tarifs_apf` — grille tarifaire locale par agence/permis/filière

**Why:** Application multi-agences, chaque agence peut avoir ses propres heures de conduite (volant/piste/TGD) et ses tarifs.
**How to apply:** Lors de modifications liées à la facturation, tenir compte de la logique de propagation et de la grille tarifaire locale.
