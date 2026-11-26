# Moteur de génération de documents (états / PDF)

## Vue d'ensemble

GPLearn dispose d'un moteur de génération de documents complet permettant aux agences de produire des PDFs personnalisés (contrats, factures, fiches de renseignements, devis...) à partir de templates Word/ODT stockés en base de données.

**Fichiers principaux :**
- `Etats/etats.php` — bibliothèque de fonctions `*VarList()` : construction du dictionnaire de jokers
- `Etats/docxx.inc.php` — pipeline principal : récupération template → soffice → injection → soffice → PDF
- `Etats/Factures/docxx.php` — variante pour factures/devis
- `Etats/Stages/docxx.php` — variante pour stages
- `Etats/docxx_nf_inc.php` — variante sans facture

---

## Pipeline de génération

```
1. Sélection du template
   docx_modele_permis_filiere  (le plus spécifique)
     └─ fallback docx_modele_permis
           └─ fallback docx_modele_famille
   → r->doc (blob binaire .docx ou .odt)

2. Écriture sur disque
   file_put_contents($tempname.".docx", $r->doc)

3. soffice étape 1 — aplatissement
   soffice --convert-to fdocx → $tempname.fdocx   (flat XML monofichier)
   ou
   soffice --convert-to fodt  → $tempname.fodt

4. Construction du dictionnaire $varList
   tiersVarList()        → {trs:*}    (~150 champs tiers)
   agenceVarList()       → {age:*}    (~80 champs agence)
   FacDevModVarList()    → {ENT:*} {FAC:*} {LIG##:*} {ECH##:*}
   stageVarList()        → {stg:*}
   planningVarList()     → {plg:*}
   tarifsVarList()       → {pdtPrix:CODE} {pdtNom:CODE}
   offresVarlist()       → {ofr#:*} {age#/per#/fil#/ofr#:*}  (matrice 4D)
   imgList2varList()     → {img:nom}
   dossierVarList()      → {doss:*}

5. Injection dans le XML plat
   jokersImages($data, $varList)        → remplace {img:NOM_WxH} par base64 ODT draw:frame
   traiteJokers($data, $jokers, "§","§") → jokers §anciens§ (fiche de renseignements)
   traiteJokers($data, $varList, "{","}") → jokers {modernes}

6. soffice étape 2 — conversion PDF
   soffice --convert-to pdf → $tempname_.pdf

7. Post-traitement optionnel
   pdftk cat output → assemblage multi-pages (fiche rens. = 2-3 pages)
   + ajout automatique page "permis 1€" si tiers.p1euro=1
```

---

## Syntaxe des jokers

### Jokers simples
```
{trs:nom}           → tiers.nom
{trs:prenom}        → tiers.prenom
{age:siret}         → agences.siret
{plg:date}          → planning slot date
{stg:debut}         → stage.debut
{ENT:total_ttc}     → facture total TTC
{LIG01:produit}     → ligne 1 de facture, champ produit
{ECH01:date}        → échéance 1, date
{pdtPrix:CIRC}      → tarif du produit CIRC pour ce tiers
{img:LogoAgence_200x50} → image LogoAgence redimensionnée 200×50px
```

### Jokers conditionnels (x_*)
```
{ENT:x_AAC}         → 'x' si filière AAC, '' sinon  (cases à cocher Word)
{ENT:x_CS}          → 'x' si filière CS
{ENT:x_BOITE_AUTO}  → 'x' si boîte automatique
{ENT:x_CIRCU}       → 'x' si formation sur voie ouverte
{ENT:x_THEO_DIST}   → 'x' si théorie à distance
{age:x_dispo_label_oui} → 'x' si labellisé préfecture
```

### Jokers matriciels (offres tarifaires)
Les offres commerciales sont dimensionnées par agence × permis × filière :
```
{ofr2:prix}                           → offre 2, prix de base
{age1/ofr2:prix}                      → offre 2, tarif agence 1
{per3/ofr2:prix}                      → offre 2, tarif permis 3
{age1/per3/fil2/ofr2:prix}            → offre 2, tarif agence+permis+filière
```

### Jokers images signatures formateurs
```
{img:sign-formateur_100x30}           → signature du formateur référent
{img:sign-formateur-resp_80x25}       → signature responsable pédagogique
```
Sources dans `documents.contenu` via `intervt.iddoc_signature`.

### Ancien format §§ (fiche de renseignements)
```
§nom§                → tiers.nom
§prenom§             → tiers.prenom
§adresseagence§      → agence.adr1 + agence.adr2
```

---

## Stockage des templates

Les templates binaires (.docx, .odt, .pdf) sont stockés directement en base dans 9 tables de modèles, organisées par contexte métier :

| Table | Contexte | Sélection |
|---|---|---|
| `docx_modele_permis_filiere` | Template spécifique permis + filière | Priorité 1 (le plus spécifique) |
| `docx_modele_permis` | Template par permis | Priorité 2 |
| `docx_modele_famille` | Template par famille | Priorité 3 (défaut) |
| `docx_modele_filiere` | Par filière AAC/CS/... | |
| `docx_modele_agence` | Par agence | |
| `docx_modele_type_stage` | Par type de stage | |
| `docx_modele_handicap` | Élèves handicapés | |
| `docx_modele_orig_pros` | Par origine prospect | |
| `docx_modele_dossier` | Dossier global | |

La logique de sélection (`cherche_contrat.sql.php`) choisit le template le plus spécifique disponible pour le tiers (permis+filière > permis > famille).

Chaque ligne de template contient :
- `nom` : nom du fichier (.docx, .odt, .pdf)
- `doc` : blob binaire du fichier
- `is_fich_rens` : boolean (fiche de renseignements — pipeline spécial multi-pages)
- `is_devis_facture` : boolean (déclenche FacDevModVarList)

---

## Dépendances système

- **LibreOffice / soffice** : 2 appels par génération (flatten + pdf), exécuté en `sudo`
- **pdftk** : assemblage multi-pages pour fiches de renseignements
- **html2pdf** (PHP) : chemin alternatif pour templates HTML
- **PHPExcel** : export Excel des tableaux (deprecated depuis 2017)

---

## Implications pour la refonte

### Ce qui doit être conservé
1. **Le concept de templates utilisateurs** : les agences créent/gèrent leurs propres modèles Word — fonctionnalité métier critique
2. **La syntaxe de jokers** `{prefix:champ}` : des centaines de templates en production contiennent ces jokers — migration incompatible = tout recréer
3. **La hiérarchie de templates** (permis+filière > permis > famille) : logique métier
4. **Les jokers conditionnels** `{x_*}` pour les cases à cocher (conformité CERFA, contrats réglementés)

### Ce qui doit changer
1. **Stockage** : passer des blobs MySQL vers un object storage (S3/MinIO) avec métadonnées en DB
2. **soffice** : conserver via un **microservice Docker dédié** (LibreOffice headless) appelé via API interne — ne pas l'embarquer dans le backend Node.js
3. **Pipeline asynchrone** : la génération PDF (2× soffice) peut prendre 5-15s — passer par **BullMQ** (déjà dans l'archi cible) pour ne pas bloquer les requêtes HTTP
4. **PHPExcel** : remplacer par `xlsx` (Node.js)
5. **pdftk** : remplacer par `pdf-lib` (Node.js) pour l'assemblage
6. **html2pdf PHP** : remplacer par Puppeteer pour les templates HTML

### Architecture cible du service PDF
```
Frontend (Next.js)
  → POST /api/documents/generate {templateId, context}
  → BullMQ queue "pdf-generation"
    → Worker Node.js :
        1. Récupère template (MinIO)
        2. Construit varList (queries Drizzle ORM)
        3. Injecte jokers dans XML flat (ODT)
        4. Appelle microservice LibreOffice : POST /convert {fodt → pdf}
        5. Stocke PDF résultat (MinIO)
        6. Notifie via WebSocket ou SSE
  ← URL signée vers le PDF
```

### Table `document_templates` (nouveau MCD)
```
id                 uuid PK
tenant_id          uuid FK tenants
name               varchar(200)
file_key           varchar(500)      -- chemin MinIO
mime_type          varchar(50)       -- application/vnd.odt, application/docx
scope_type         enum('permis_filiere','permis','famille','filiere','agence','type_stage','other')
scope_permis       varchar(10) NULL
scope_filiere      varchar(20) NULL
scope_agence_id    uuid FK sites NULL
scope_family_id    uuid NULL
is_enrollment_form boolean           -- is_fich_rens
is_invoice         boolean           -- is_devis_facture
is_active          boolean
created_by         uuid FK users
created_at         timestamptz
updated_at         timestamptz
```

### Note migration
Les blobs `docx_modele_*.doc` doivent être exportés vers MinIO lors de la migration. Les templates contenant des jokers `§§` (ancien format) doivent être convertis ou le moteur doit rester compatible avec les deux syntaxes pendant la période de transition.
