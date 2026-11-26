---
name: MCD fplearn et liens externes
description: Architecture CRM fplearn (Formation Professionnelle) — entités, tables de liaison, systèmes externes connectés (NEVEA, PlanniFPro, GPLearn, Formagest, ArganClient)
type: reference
originSessionId: 0b5f260b-8f37-403b-a916-e0f16fb6e4cc
---
## fplearn — CRM pivot Formation Professionnelle ECF-CERCA

Volumes : 161 076 personnes physiques, 141 080 opportunités, 1 780 RDV, 519 ressources, 34 sites.

### Entités principales

```
personne_physique_pph (pph_IDpersonne_physique PK, pph_nom, pph_prenom,
  pph_date_naissance, pph_adresse, pph_email, pph_json_data text)

personne_morale_pmo (pmo_IDpersonne_morale PK, pmo_raison_sociale UNIQUE,
  pmo_adresse, pmo_code_postal, pmo_ville, pmo_telephone, pmo_email...)

opportunite_opp (opp_IDopportunite PK, opp_idsite→sites_sit, opp_idmarche→marche_mar,
  opp_idcatalogue→catalogue_cat, opp_designation, opp_date_debut/fin, opp_montant,
  opp_statut→statuts_opportunites_sto, opp_etape→etapes_opportunites_eto)

ressource_res (res_id PK, res_idtype→ressource_type_rty, res_nom, res_code,
  res_actif, res_idpersonne_physique→pph, res_idpersonne_morale→pmo)
  ← Formateurs, salles, véhicules, pistes, simulateurs...

sites_sit (sit_idsite PK, sit_nom)  ← 34 sites ECF-CERCA

catalogue_cat (cat_idcatalogue PK, cat_idparent→soi-même, cat_nom)
  ← Arbre formations FP : Permis lourd, FIMO, FCO, CACES, BEPECASER, MSRE...
```

### Tables de liaison vers systèmes EXTERNES

Principe : (application, base_de_donnees, table, IDExterne) — découplage total.

```
lien_personne_physique_externe_pex  (pph ↔ systèmes externes)
lien_personne_morale_externe_mex    (pmo ↔ systèmes externes)
lien_opportunite_externe_oex        (opp ↔ systèmes externes)
lien_catalogue_ext_lcx              (catalogue ↔ systèmes externes)
lien_ressource_externe_rxe          (ressource ↔ systèmes externes)
```

### Carte des systèmes externes

| Application | Base | Volume | Rôle |
|---|---|---|---|
| **nevea** | ecf/cerca | 104 863 pph + 50 945 opp | Plateforme nationale FP (OPCO, QUALIOPI) |
| **PlanniFPro** | plgfpro | 519 ress + 50 933 opp | Planning formateurs |
| **Formagest** | Formagest-CERCA | 37 420 opp | Logiciel de gestion FP |
| **gplearn** | gpfp | 29 823 pph | GPLearn auto-école |
| **ArganClient** | ac8620, ac1702... | ~100 000 | Ancien système par agence |

### Points clés

1. **fplearn = CRM pivot** : relie tous les systèmes via tables `*_externe_*`.
2. **Pattern générique** : (application, base, table, IDExterne) — fonctionne avec n'importe quelle base.
3. **Une pph peut être multi-liée** : même personne dans NEVEA + GPLearn + ArganClient.
