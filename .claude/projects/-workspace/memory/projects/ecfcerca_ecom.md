---
name: Projet ecfcerca_ecom
description: Site e-commerce ECF-CERCA — tunnel de paiement, middle office entreprises/blocs, thèmes, webhooks
type: project
originSessionId: 0b5f260b-8f37-403b-a916-e0f16fb6e4cc
---
## Racine

`/workspace/sources/ecfcerca_ecom/`

## Architecture

- `back/api/` — endpoints PHP (agences, agence, offres, offre, catalogue, checkout, sessions, stages, commande)
- `back/sqlConnect.php` — connexion multi-bases via `dbQuery($base, $sql_array)` + TDbConnectorMySQL (mysql_*)
- `back/helpers.php` — `getEcfConfig()` (JOIN entreprises), `getOption()`, `geocodeAgence()`, `jsonError()`
- `back/webhook/stripe.php` — webhook Stripe (création tiers + devis + email MyRoad)
- `back/webhook/paiement.php` — callback unifié Payplug + SystemPay + `paymentConfirmed()` partagée
- `back/api/checkout.php` — POST, crée commande + lance paiement (Payplug > SystemPay > Stripe)
- `back/admin/api/load.php` — charge config entreprise par token (middle office)
- `back/admin/api/save.php` — sauvegarde config entreprise par token
- `front/admin/index.html` — middle office : identité, hero, présentation, badges, financements, blocs
- `front/` — HTML/JS Tailwind CDN + Leaflet

## Modèle de données config (gpcontrolserveurs)

### Table `entreprises` (NEW — remplace les colonnes éditoriales d'ecom_sites)
```
id, nom, admin_token(UNIQUE), couleur, logo_url,
hero_titre, hero_sous_titre, presentation, hero_image_url,
horaires_json, badges(JSON), financements_json(JSON), blocks_json(JSON), actif
```

### Table `ecom_sites` (allégée)
```
base(PK), domaine, id_entreprise(FK→entreprises), actif
```
- Une entreprise peut couvrir **plusieurs bases** GPLearn
- URL admin : `front/admin/index.html?token=<admin_token>`

## Migrations SQL (à exécuter dans gpcontrolserveurs)

| Fichier | Contenu |
|---------|---------|
| `sql/01_...` | Création ecom_sites initiale |
| `sql/04_...` | Ajout colonnes éditoriales ecom_sites (obsolètes avec entreprises) |
| `sql/07_...` | ecom_commandes.agence (bases GPLearn) |
| `sql/08_...` | badges + financements_json dans ecom_sites (obsolète, migré vers entreprises) |
| `sql/09_entreprises.sql` | **Création table entreprises + migration depuis ecom_sites** |
| `sql/10_entreprises_blocks.sql` | **Ajout blocks_json dans entreprises** |

## Tunnel de paiement

### Flux complet (après paiement confirmé)
1. `ecom_commandes.statut` → `'paid'` (anti-doublon sur `pending`)
2. INSERT `tiers` (avec `PCodeAccesEleve`)
3. SET `@Vnummod` → INSERT `factures` (SELECT depuis `modeles`) → INSERT `lfacture` (SELECT depuis `lmodele`)
4. INSERT `reglts` (encaissement)
5. INSERT `stg_elv` (si `idstage > 0`)
6. `@include_once envoiEMail.inc.php` + `function_exists()` guard (dev-safe)
7. Lien MyRoad via `https://myroad.fr/lnk/_gen_lnk_.php?data=myroad|$base|$idtiers`

### Sans date (idstage=0)
- `ecom_commandes.agence` stocke le code agence
- `LEFT JOIN stage s ON s.idstage=c.idstage AND c.idstage > 0`
- `LEFT JOIN agences a ON a.code=ifnull(s.agence, c.agence)`
- Bouton "Réserver sans date" dans `offre.html`, texte "À convenir avec l'agence" dans formulaire.html

## Middle office — blocs de contenu

5 types de blocs contraints (non-techniciens) :
- `texte` — titre + paragraphe
- `image_texte` — URL image + titre + texte + position gauche/droite
- `cta` — titre + accroche + bouton (libellé + URL)
- `chiffres` — 2-4 items {valeur, libellé}
- `separateur` — aucun champ

Stockés dans `entreprises.blocks_json` (JSON array).
Admin : section 6 dans `front/admin/index.html` (picker visuel + cartes pliables ↑/↓).
Rendu : `renderBlocks()` dans `front/agence.html` → `<div id="blocks-container">` entre financements et formations.

## Bug `offres.php` filtre agence.html (CORRIGÉ)

`offres.php` expose maintenant `idpermis` dans chaque groupe.
`agence.html` passe `g.idpermis` (numérique) au lieu de `g.label` (texte) dans `data-p`.

## Couleurs officielles ECF

- Bleu : `#124483` (primary)
- Rouge : `#da1f26` (accent)
- Police : Affogato (CDN chartegraphique.ecf-services.fr)

## Système de thèmes

6 thèmes (css/themes.css + js/theme.js) : ECF Bleu, Nuit, Contraste, Ardoise, Sépia, Menthe.
`--c` (couleur agence) non overridée par les thèmes.

## À faire (prochaines sessions)

- Tester le middle office avec token réel (générer tokens dans entreprises)
- Page Qualiopi
- Vérifier email en production (envoiEMail.inc.php dispo sur serveur)
</content>
</invoke>