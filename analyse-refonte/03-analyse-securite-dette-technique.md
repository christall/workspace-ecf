# Analyse sécurité & dette technique

## Vulnérabilités critiques identifiées

### 1. Mots de passe maîtres en dur dans le code

**Fichier** : `myroad_back_tom/v*/connection.php:58` et `appliPedago/v*/connection.php:58`

```php
// TROUVÉ DANS LE CODE :
if ($pass == '1nfoCerc@' || $pass == 'Péda6oM@sters') { /* accès forcé */ }
```

**Impact** : Quiconque connaît ces mots de passe peut se connecter avec n'importe quel compte sur n'importe quelle base. **Risque maximum.**

---

### 2. Injection SQL via `$_REQUEST` direct

**Présent dans** : GPLearn, myRoad, PlanniFProWeb, appliPedago, eCommerce

```php
// Exemple réel (planning.sql.php) :
$aSql[]="select '$_GET[from]', '$_GET[to]', $_GET[typeress] into @vmin_date...";
// Exemple réel (devis.sql.php) :
$Asql = array("select distinct numero from devis F where F.tiers='$_REQUEST[idtiers]'");
```

Bien que `mysql_secure_params()` soit appelé à la connexion, son implémentation est fragile :
- Elle modifie `$_REQUEST` globalement mais pas `$_GET`/`$_POST` séparément dans tous les flux
- Des fichiers anciens court-circuitent ce mécanisme
- Certains fichiers construisent les requêtes avant la sécurisation

---

### 3. Hachage MD5 des mots de passe

**Présent dans** : `charger1tiers.sql.php`, `connection.php` (myRoad, appliPedago)

```php
"update ignore ident_u_tiers set mot_de_passe=md5('$rIdAc->password') where..."
```

MD5 est cassable en millisecondes avec des tables arc-en-ciel. **Toutes les données de connexion élèves sont compromettables.**

---

### 4. Credentials hardcodés

**ECFCoach** (`sqlConnect.php:107`) :
```php
// Accès base 4D Formagest :
$this->link = new PDO("4D:...", "Super_utilisateur", "malupa7625");
```

**eCommerce** (`lien_megabase_eval_ini.php:14`) :
```php
// Auth SOAP prévisible :
$password = md5("PWD-CERCA-".date("Ymd")."-$base-$idplg");
```

---

### 5. Certificats iOS et keystores Android exposés

**Fichier** : `/home/webservices/ecfcoach_back_tom/` — `.p12`, `.pem`, `.keystore` dans le dépôt

Ces fichiers permettent de signer des APKs et IPA malveillants au nom de CERCA ECF.

---

### 6. CORS permissif sur tous les services

```php
header("Access-Control-Allow-Origin: *");
```

Présent sur tous les backends PHP. Tout site web peut effectuer des appels authentifiés vers ces APIs.

---

### 7. API endpoints non authentifiés (PlanniFProWeb)

**100+ fichiers** dans `PlanniFProWeb/serverside/` appelables directement sans vérification d'authentification systématique. Chaque action métier (créer module, modifier ressource, exporter) est un fichier PHP indépendant.

---

### 8. Upload de fichiers sans validation

- `myroad_back_tom/image_maj.php` : upload photo sans check MIME
- `PlanniFProWeb/docx_robots_tasks.php` : upload DOCX sans validation
- `gplearn_tom/Eleves/upload.php` : upload documents élève

---

### 9. Intranet Drupal 6 en fin de vie

Drupal 6 a arrêté son support de sécurité en **2016**. La base `intranet` est exposée depuis 8+ ans sans correctifs de sécurité.

---

### 10. Session et authentification faibles

- Sessions stockées en base `gpcontrolserveurs.sessions` sans expiration stricte
- Token myRoad stocké en fichier texte dans `/home/tmp/MyRoad_tokens/`
- localStorage plaintext côté client (token non chiffré)
- Pas de CSRF tokens sur les formulaires

---

### 11. Pseudonymisation CNIL — cron `cryptage_cnil_batch.php`

Un cron tourne périodiquement sur toutes les bases `gp*` et chiffre en place les données PII des élèves inactifs depuis N mois (`robot_cryptage_cnil_n_mois`, paramétrable par base).

**Ce qu'il fait :**
- Sélectionne les `tiers` sans événement récent dans `trs_evt` et dont les dates d'inscription sont antérieures à N mois
- Applique `AES_ENCRYPT(valeur, tiers.code)` sur ~35 champs PII : nom_jf, nomnaiss, profession, no_neph, ville/dept/pays_naiss, nationalite, adresse complète, téléphones, email, coordonnées bancaires (bqetab, bqrib...), accompagnateurs, prescripteur, données PAP (PV auto-école)
- Obfusque `pap_date_pv` et `pap_heure_pv` en ajoutant `floor(code/25)` jours/secondes
- Multiplie les coordonnées GPS (`coord_lat_x`, `coord_lng_y`) par `code/25`
- Pose le flag `cryptage_cnil = 1` sur le `tiers`
- Déclenche également `archivage_tiers` (archivage + suppression éventuelle)

**Problèmes de sécurité :**
- **La clé AES est `tiers.code`** (l'ID entier de la personne), stocké en clair dans la même table → le chiffrement est trivialement réversible par quiconque accède à la base. C'est de la pseudonymisation, pas de l'anonymisation.
- L'obfuscation des dates et coordonnées (÷25) est arithmétiquement réversible de la même façon.
- `mysql_escape_string` utilisé dans le contexte — injection SQL latente.

**Impact sur la migration :**
- Les `tiers` avec `cryptage_cnil = 1` ont des champs PII chiffrés en base. La migration doit les **déchiffrer** (`AES_DECRYPT(valeur, code)`) avant insertion dans `persons`.
- Les champs bancaires (`bqetab`, `bqrib`, `tvaintraco`) révèlent aussi la présence de données de paiement dans `tiers` — à prendre en compte dans le MCD.

**Ce que le nouveau système doit faire :**
- Pseudonymisation via hachage irréversible (SHA-3 + sel global) pour les champs non nécessaires après N mois
- Anonymisation réelle (suppression ou remplacement par données fictives) pour les données sans base légale de conservation
- Flag `gdpr_anonymized_at` (timestamptz) dans `persons` à la place du flag binaire `cryptage_cnil`

---

## Dette technique par application

### GPLearn (dette : Élevée)

| Problème | Impact |
|---|---|
| PHP sans framework + SQL direct | Maintenance impossible à l'échelle |
| dhtmlX v4 (2012) | Plus maintenu, aucune alternative d'évolution |
| mysql_* fonctions obsolètes | Incompatibles PHP 8+ **— contournées par un shim `php7.php`** qui redéfinit toutes les `mysql_*` en wrappers `mysqli_*` (présent dans ~20 emplacements). Résout la compatibilité PHP 7, **mais ne corrige pas l'injection SQL** : les requêtes restent construites par concaténation, `mysql_query($sql)` exécute toujours du SQL brut. |
| 3 387 fichiers PHP, logique éparpillée | Impossible à tester |
| Procédures stockées complexes | Logique métier invisible dans le code |
| Pas de tests | Toute modification = risque de régression |
| Dossiers `gplearn_tom` / `gplearn_chris` | Espaces de travail personnels (Tom et Chris) versionnés par Git — pas deux branches de prod |

### PlanniFProWeb (dette : Critique)

| Problème | Impact |
|---|---|
| 100+ fichiers PHP = 1 action | Impossible à comprendre et maintenir |
| PHPExcel deprecated (2017) | Failles non corrigées |
| Couplage fort à Formagest 4D | Un changement Formagest = réécriture |
| Pas de versioning clair | Modifications in-place, pas de rollback |

### myRoad / appliPedago / ECFCoach (dette : Élevée)

| Problème | Impact |
|---|---|
| Versionnage par copie de dossier | Pas de diff, pas de rollback propre |
| Synchronisation bi-directionnelle non atomique | Risque de corruption silencieuse |
| IndexedDB offline mal géré | Désynchronisations clients |

### campus (dette : Faible)

C'est la seule application moderne. Stack Next.js 15 / React 19 / TypeScript. Mais très limitée fonctionnellement (2 API routes).

---

## Conformité RGPD

### Données sensibles identifiées dans les bases

- Nom, prénom, date de naissance, adresse, email, téléphone (données personnelles de base)
- Photo élève (`tiers.bitmap`)
- Données médicales / handicap (`tiers_handicap`)
- Résultats d'examens (donnée de vie quotidienne protégée)
- Coordonnées bancaires (`tiers.bqetab`, `bqguichet`, `bqcompte`, `bqrib`)
- Numéro NEPH (identifiant État)
- Géolocalisation en temps réel (`trajets_geoloc_*`)
- Mots de passe (même hashés, c'est une donnée sensible)

### Problèmes de conformité

- Pas de mécanisme de suppression/anonymisation automatique
- Les bases `sv*` (sauvegardes) contiennent des données qui devraient être purgées
- Mots de passe MD5 = obligation de notification de violation si fuite
- Géolocalisation sans consentement explicite documenté
- Données des mineurs (élèves < 18 ans) sans protection renforcée apparente
- Durée de conservation non documentée

---

## Résumé des priorités

### Immédiat (risque actif)
1. **Supprimer les mots de passe maîtres hardcodés** (1nfoCerc@, Péda6oM@sters, malupa7625)
2. **Déplacer certificats iOS/Android** hors du dépôt git
3. **Patcher Drupal 6** ou désactiver l'intranet
4. **Migrer les mots de passe MD5** vers bcrypt/argon2

### Court terme (1-3 mois)
5. Prepared statements PDO sur tous les endpoints publics
6. Rate limiting sur authentification
7. CORS restreint (origines spécifiques)
8. Audit logging (qui fait quoi, quand)

### Moyen terme (refonte)
9. Réécriture avec stack sécurisée
10. Mise en conformité RGPD complète
11. Tests automatisés
12. Pipeline CI/CD
