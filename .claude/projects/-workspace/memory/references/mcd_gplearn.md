---
name: MCD GPLearn
description: Modèle Conceptuel de Données complet de GPLearn — architecture multi-bases, entités, relations et points clés de conception
type: reference
originSessionId: 0b5f260b-8f37-403b-a916-e0f16fb6e4cc
modified: 2026-11-05T16:57:54.994Z
---
## Architecture des bases de données GPLearn — ECF-CERCA

### Organisation multi-bases

| Type | Bases | Rôle |
|---|---|---|
| **GP-Learn** (par groupe d'agences) | `gp1301`, `gp1702`, `gp1901`, `gp3101`, `gp8704`... | Base opérationnelle de chaque groupe d'agences — toutes les données (tiers, factures, planning…) |
| **GPLearn_services** | `gp_services_cerca`, `gpfp` | Base de services partagés ECF-CERCA (référentiel, modèles partagés) |
| **GP-Learn_services** | `acfact`, `gpvierge`, `gpinfo` | Services transverses (compta, base vierge...) |
| **Autres** | `fplearn`, `plgfpro`, `gpcontrolserveurs` | CRM FP, planning formateurs pro, contrôle serveurs |

Chaque base `gp****` peut regrouper plusieurs agences (ex : `gp1702` = 9 agences dont La Rochelle, Saintes, St Jean d'Angely, Rochefort, Aytré...).

---

### Procédures stockées et triggers : existent bel et bien (corrigé 04/11/2026)

**La version précédente de cette section affirmait le contraire — vérifiée fausse empiriquement**
(`information_schema` sur recette, 04/11/2026, pendant l'investigation du ticket EtatEcartsTTCSage —
cf. `sources/GPLearn/CLAUDE.md`) : chaque base `gp*` a en réalité **~384-387 procédures/fonctions
stockées** (dont `PrepareTSitu_tiersprod`, utilisée par l'export Sage Compta) et **~94-160 triggers**
(cf. aussi `Triggers_facturation.sql`/`triggers_trace_facturation.sql`, déjà documentés dans
`sources/GPLearn/CLAUDE.md` § Traçage factures/lfacture — la contradiction avec cette mémoire
était déjà visible par recoupement, sans même requêter). Une partie non négligeable de la logique
métier vit donc dans ces procédures/triggers, pas uniquement en PHP — vérifier
`information_schema.ROUTINES`/`TRIGGERS` avant de conclure qu'un comportement n'existe que côté PHP.

Reverifié et confirmé exact à cette même date : **aucun event**, et **aucune FK** sur les bases
`gp****` elles-mêmes (1 seule FK trouvée au total sur tout le serveur recette, sur
`gpcontrolserveurs` — base d'auth centrale, pas une base agence).

---

### Référentiel

```
agences (code:4 PK, nom, siret, plafcrd, nb_h_volant, nb_h_piste, nb_h_tgd,
         horaires TEXT, lat DECIMAL(10,7), lng DECIMAL(10,7)...)
familles (code:2 PK, nom)
permis (idpermis PK, titre_court)
filieres (idfiliere PK, titre_court)
tva (code PK, nom, taux)
natures (idnature PK, nom, devisable, plannifiable, facturable, encaissable, prospect...)
```

### Personnes / Tiers

```
tiers (code PK auto_increment, nom, prenom, datenaiss, adr*, tel, email,
       famille→familles, agenceresp→agences, agenceinsc→agences,
       idpermis→permis, idfiliere→filieres, idfinanceur→financeurs,
       facture_cl, encaiss_cl)
renseignements (id PK, idtiers→tiers, tampon, titre, texte blob)
contrats (idtiers, iduser, doc longblob, iddoc_sign...)
```

### Catalogue & Tarification

```
produits (idproduit PK, code:4 UNIQUE, nom, prixu, ctva→tva,
          volant:bool, horsplg:bool, horsacti:bool,
          famille→familles, agence→agences)
tarifs (produit→produits, famille→familles → PK composite, prixu)
tarifs_apf (produit, agence, idpermis, idfiliere → PK composite, prixu)
accord_cadre_acc (idaccord_cadre PK, nom, date_debut, date_fin, signataire...)
accord_cadre_tarif_act (idaccord_cadre, idproduit → PK, prix_accord_cadre, prix_maximum, remise)
```

### Facturation

```
modeles (numero PK, libelle, agence→agences, idpermis→permis, idfiliere→filieres,
         ident_offre:enum(A-F), vendu_en_ligne...)
lmodele (nummod→modeles, numlig → PK, produit→produits, qte, ctva→tva, montht, montttc,
         typerem:enum(M/P), remisepc, remisetot)

factures (numero PK, date, tiersfact→tiers, tierscons→tiers,
          age_cpt→agences, idmodele→modeles, libelle, echeance, lettrage, verrouillee)
lfacture (numfact→factures, numlig → PK, produit→produits, qte, ctva→tva, montht, montttc,
          typerem, remisepc, remisetot, agence, famille, libelle, validite)
reglts (numero PK, dtreg, date, tierspar→tiers, tierspour→tiers, libelle, montant, type...)
```

### Planning & Conduite

```
plg_arg (idplgarg PK, date, hdeb, hfin, produit→produits, qte, idexam→examen,
         horsfact, verrou_plg/ress/elv, nb_places, type_eval:enum(A/B/N))
plg_ress (idplgarg→plg_arg, ress→age_ress → PK)
abspres (idtiers→tiers, idplgarg→plg_arg → PK, abspres:tinyint, obs)
aff_plg_lfac (numlig, numfact→factures, idplgarg→plg_arg, qte, tiers)
plg_stg (idstage→stage, idplgarg→plg_arg)
```

### Stages

```
stage (idstage PK, id_type_stage→type_stage, agence→agences,
       nom, debut, fin, tarif, idmodele→modeles)
stg_elv (idstage→stage, tiers→tiers, idguser, base → PK)
ecom_commandes (id PK, idstage→stage, idmodele, montant, sexe, nom, prenom,
                email, tel, stripe_session, idtiers,
                statut:enum(pending/paid/cancelled/expired), created_at, updated_at)
```

### Examens (tables phase 2)

```
examens (idexam PK, nom, resultat:enum(Oui/Non/Note/Nb_de_fautes/Sans/NbHr/Oui_Nb_fautes))
  → référentiel des types d'épreuves

examen (idexam PK, date, hdeb, hfin, exam_idage→agences, exam_cle, exam_num, unites,
        type_exam:enum(ETG/NF/ALA/B/C/EB))
  → sessions d'examen réelles

antec_exam (tiers→tiers, idexam→examens → PK, nb, dtpres, dtobt)
  → antécédents de passage par élève

opt_exam (idopt_exam PK, idexam→examen, nom)
  → options/épreuves au sein d'un examen

res_ex (idplgarg→plg_arg, tiers→tiers → PK, idopt_exam, resultat, resultat2,
        json_values BLOB)
  → résultats bruts par créneau+élève

res_ex_cepc (idplgarg, idtiers → PK, A..N:char(1), obs_A..obs_N:text, tmstamp)
  → grille CEPC conduite (14 thèmes A-N, chacun avec note+observation)

res_ex_evini (idplgarg, idtiers → PK, ~60 tinyint(1) profil conducteur,
              PROP_module_prop, PROP_accept, PROP_volume_tot/cond/theo,
              iddoc_sig_eleve/parent/formateur)
  → évaluation initiale (fiche profil conducteur au 1er contact)

previ_exam (annee, mois, id_repart_exam, typexam → PK, droits, obj_ratiopc_1er_pres,
            obj_ratiopc_aac, coeff)
  → planning prévisionnel des examens par agence/mois

previ_exam_eleves (idtiers, annee, mois, id_repart_exam, typexam, xoption:enum(prevu/liste_attente),
                   ordre:smallint, semaine:int)
  → inscriptions prévisionnelles aux examens

controles_examens (idexam_controle, familles, type_controle:enum(inscription/enregistrement/
                   presentation/.../validite-etg), idexam, delai_maxi, delai_mini)
  → règles réglementaires de conformité (délais min/max entre étapes)
```

### Modèles documents et forfaits

```
modeles (numero PK, libelle, agence→agences, idpermis→permis, idfiliere→filieres,
         vendu_en_ligne, publie_web, ident_offre:enum(A-F),
         ecommerce_descr/obs/ptsfots TEXT, code_permis/filiere_ecommerce,
         ecommerce_acompte, ecommerce_option_code, doc_contrat LONGBLOB)
  → forfaits de formation GP (ex: "Pack AAC 20h") vendables en ligne

docx_modele_agence/dossier/famille/filiere/handicap/orig_pros/permis/permis_filiere/type_stage
  → tables de mapping modèle_docx → contexte d'application (7 tables)

modeles_email (id PK, nom, sujet TEXT, email TEXT)
  → templates email réutilisables

modeles_sms (id PK, nom, sms TEXT)
  → templates SMS réutilisables

automates_personnalises (id PK, nom, type_robot, moment, produits TEXT,
                         ans_decalage, jours_decalage, minutes_decalage,
                         email_accompagnement TEXT, mise_en_forme, pedago TEXT)
  → règles d'envoi automatique (robot planifié selon événement)

plgfpro.docx_modeles (id PK, nom, classe_element_attache:enum(dossier/site/activite/...),
                       id_element_attache, doc LONGBLOB, publie_generique)
  → templates Word/ODT FP (blob en base → MinIO à migrer)

plgfpro.modeles_plg (idmodeleplg PK, idtypeaction, idsite, nom, date_debut, date_fin,
                     duree_theorique)
  → gabarits de planning FP réutilisables

plgfpro.modeles_plg_plg (idplg, idmodeleplg → PK, idmodule, date_debut/fin, hdeb/hfin,
                          qte, comment)
  → créneaux constituant un gabarit
```

### Vente en ligne (configuration boutique)

```
modeles_vente_enligne_agences (idmodele, agence → PK)
modeles_vente_enligne_familles (idmodele, famille → PK)
modeles_vente_enligne_filieres (idmodele, idfiliere → PK)
modeles_vente_enligne_permis (idmodele, idpermis → PK)
  → règles de publication : quels modèles afficher selon contexte agence/famille/filière/permis

modele_ecommerce_pdtweb (idmodele, code_produit_web → PK, num_ligne, libelle,
                          description TEXT, formation_produit_Web)
  → produits web associés à un modèle (détail boutique en ligne)
```

### Rémunérations GP (temps moniteurs)

```
heures_saisies (idress PK, date PK, agence PK, famille:2 PK,
                elem_paye:enum(hprod/hadmin/rtt/jferie/maladie/recup/cp/cep/cet/
                               formation/deplacement/reunion/partiel) PK,
                sec_calc, sec_sais, sec_val)
  → suivi temps GP en secondes (équivalent de heures_trav FP mais plus riche en types)
  → 11 484 lignes dans gp_services_cerca

heures_saisies_justif (idress PK, date PK, justif_sais TEXT, tk_resto_sais,
                        justif_val TEXT, tk_resto_val)
  → justificatifs + ticket resto pour les heures GP
```

### Géolocalisation AAC

```
trajets_geoloc_aac (idtiers PK, debut PK datetime, fin datetime,
                    km_total, km_rn/ville/rd/ar/indeterminee, kmjour/kmnuit,
                    km_soleil/brume/nuage/pluie/neige/meteo_indet, observations, manuel)
  → synthèse trajet AAC par apprenant + session (127 460 lignes dans gp3101)

trajets_geoloc_details (idtiers PK, tmstamp PK, lat, lng, vitesse, distance, accuracy,
                         journuit, meteo:enum(soleil/brume/nuage/bruine/pluie/neige/indeterminee),
                         voie:enum(ville/rd/rn/ar/indeterminee))
  → trace GPS temps réel (12 634 points dans gp3101)
```

### Consolidation réseau (compilcerca)

```
compilcerca_stats_agences (base, siret, age, fam, idpermis, idfiliere, prod_fp, an, mois → PK,
    n_tiers, n_contacts, ex_pres_th/ci × 2, ex_obt_th/ci × 2, CrdFact, ArrFact, CAFacHT/TTC,
    enc, hprod, secprod, sectrav, oss_*, redvetg, cess_ca, fact_tca...)
  → ~50 KPI par agence/permis/filière/mois — agrégats calculés (0 ligne dans gp3101, alimenté central)

compilcerca_remis_bq_agences (base, age, siret, an, mois, bq, jal, cptbq, rbq)
  → rapprochements bancaires par agence/mois
```

---

### Planning GPLearn — architecture découverte 2026-05-20

Table ressources = **`intervt`** (pas `ressources`). Champs clés : `code` PK, `type`→`typeress`, `nom`, `agence_def`, `desactive`.
- Multi-site : `age_ress (idress, agence)` — un moniteur peut intervenir sur N agences
- Groupes de planning : `g_user` (type: 1=Agence, 2=Fonction, 3=Planning)
  - Sites du groupe : `g_user_agences`
  - Ressources (colonnes) du groupe : `gu_ressplg (idguser, idress, tri)`
  - Users abonnés au groupe : `gus_user (iduser, idguser)`
- Créneaux : `plg_arg (date, hdeb, hfin, produit, qte)` + `plg_ress (idplgarg, ress)` pour les ressources affectées
- Procedure `PDefPlanningsRessources(iduser)` → calcule tous les plannings accessibles + leurs ressources

Dans le MCD refonte → §6.7 `ressources_sites`, §6.8-6.11 `groupes_planning*` + `utilisateurs_groupes_planning`

---

### Architecture organisationnelle ECF-CERCA (clarifiée 2026-05-20)

Hiérarchie réelle à 3 niveaux :
```
Groupe ECF-CERCA
  └── Entreprises (CERCA, autres entreprises du groupe)
        └── Centres de formation (= 1 base gp**** chacun)
              └── Bureaux/Agences (= lignes dans la table `agences`)
```

- **CERCA** = 1 entreprise → N centres de formation → chaque centre = 1 base `gp****`
- **Autres entreprises du groupe** = aussi N sites, chacun = 1 base `gp****`
- Ex: `gp3101`, `gp8801` = sites d'autres entreprises (pas CERCA)
- Sur le serveur de dev : seulement quelques bases de travail (non réelles)
- Dans le MCD refonte : `entreprises` → `franchises` (= centres de formation) → `sites` (= bureaux)
- Le tenant d'isolation RLS reste `franchise_id` (niveau centre de formation)
- Utilisateurs niveau entreprise : `franchise_id` NULL, `entreprise_id` non-null

### Points clés de conception

1. **Multi-tenant par groupe d'agences** : chaque `gp****` est une instance complète et autonome.
2. **Pas de triggers ni FK** : zéro logique en base. Tout est en PHP.
3. **Tarification en cascade** : `produits.prixu` → `tarifs` → `tarifs_apf` → `accord_cadre_tarif_act`. Le plus spécifique prime.
4. **Modèles → Factures** : `modeles`/`lmodele` sont les gabarits. Propagation inter-agences via `propages_modeles.php`.
5. **Tiers bifacette** : `factures.tiersfact` = qui paye, `tierscons` = qui bénéficie.
6. **Planning ↔ Facturation** : double liaison via `aff_plg_lfac` et la vue `plgtiers`. `horsfact=1` = non facturable.
7. **E-commerce** : `ecom_commandes` stocke les paiements en ligne pour les stages.
8. **Horaires agence** : `agences.horaires` (texte libre) — utilisé par ecfcerca_ecom.
9. **Examens** : `examen` (sessions) ≠ `examens` (référentiel types). Résultats sur 3 niveaux : brut (`res_ex`), grille conduite (`res_ex_cepc`), évaluation initiale (`res_ex_evini`).
10. **Rémunérations GP** : `heures_saisies` (en secondes, 13 types d'éléments) ≠ `plgfpro.heures_trav` (en heures, axé FP). À unifier dans le nouveau système.
11. **compilcerca** : tables d'agrégats calculés par scripts batch — pas de données transactionnelles. Dans le nouveau système : vues matérialisées PostgreSQL ou pipeline ETL vers entrepôt de données.
