# Outil de planification transitoire — Planning Partagé GP/FP

> Version 0.2 — 2026-05-22  
> Objectif : disposer rapidement d'une vue unifiée et d'une surface de saisie commune pour les ressources partagées entre GPLearn et PlgFPro, **en attendant la refonte complète**.

---

## 1. Contexte et problème

GPLearn et PlgFPro maintiennent chacun leur propre planning sans se connaître. Les ressources **mixtes** (pistes/plateaux, véhicules PL, moniteurs GP+FP, salles) peuvent être réservées simultanément dans les deux systèmes sans qu'aucun des deux ne le détecte.

Situations problématiques actuelles :
- Une piste réservée pour un cours de code plateau en FP, ET pour une leçon GP le même créneau
- Un moniteur mixte planifié dans PlgFPro le matin et dans GPLearn l'après-midi sans cohérence globale
- Aucune vue transversale disponible pour les responsables

La refonte complète (MCD PostgreSQL unifié) résoudra cela structurellement, mais est à horizon 12-18 mois. Cet outil **temporise** sans bloquer le projet long terme.

---

## 2. Périmètre

### Ressources concernées (4 types mixtes uniquement)

| Type | Source GP | Source FP | Clé de jointure |
|---|---|---|---|
| Pistes / plateaux | `gp****.intervt` | `plgfpro.ressources` | `intervt.reference_externe = ressources.code_acces` |
| Véhicules PL | `gp****.intervt` | `plgfpro.ressources` | `intervt.reference_externe = ressources.code_acces` |
| Moniteurs mixtes | `gp****.intervt` | `plgfpro.ressources` | `intervt.reference_externe = ressources.code_acces` |
| Salles | `gp****.intervt` | `plgfpro.ressources` | `intervt.reference_externe = ressources.code_acces` |

La **clé de jointure naturelle** est `plgfpro.ressources.code_acces = gp****.intervt.reference_externe`. Une ressource mixte est toute entrée de `plgfpro.ressources` dont le `code_acces` correspond à un `reference_externe` dans `intervt`. Aucun mapping manuel n'est nécessaire.

Les identifiants manquants seront complétés progressivement dans les bases existantes. En attendant, toute ressource sans correspondance est **silencieusement ignorée** — elle reste gérée dans son système natif, sans apparaître dans le bridge.

### Hors périmètre de cet outil
- Gestion des élèves/apprenants
- Facturation
- Compétences pédagogiques
- Toute ressource mono-mode

---

## 3. Architecture technique

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (React)                          │
│              FullCalendar — vue semaine/jour                │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST / JSON
┌──────────────────────▼──────────────────────────────────────┐
│              planning-bridge (Node.js / Express)            │
│                                                             │
│  GET /resources          — liste ressources mixtes          │
│  GET /slots?date=&res=   — créneaux consolidés              │
│  POST /reservations      — créer réservation partagée       │
│  DELETE /reservations/:id                                   │
└────────┬──────────────────┬──────────────────┬──────────────┘
         │                  │                  │
    ┌────▼────┐        ┌────▼────┐       ┌─────▼─────┐
    │ MySQL   │        │ MySQL   │       │  SQLite   │
    │ GPLearn │        │PlgFPro  │       │ (bridge)  │
    │gp****.  │        │planning │       │reservations│
    │plg_arg  │        │         │       │           │
    └─────────┘        └─────────┘       └───────────┘
```

### Choix techniques justifiés

| Choix | Raison |
|---|---|
| **Node.js** | Déjà dans la stack CERCA (GPLearn migrations, campus) |
| **SQLite** pour le bridge | Zero infra supplémentaire, suffisant pour le volume des réservations partagées (<1 000/semaine), migrable vers PostgreSQL |
| **Lecture seule** sur GP et FP | On ne touche pas aux bases existantes — zéro risque |
| **FullCalendar** (React) | Bibliothèque mature, supporte multi-ressource, drag-and-drop, vues jour/semaine/mois |
| **Accès multi-gp\*** | Le bridge se connecte à toutes les bases `gp****` déclarées en config |

---

## 4. Modèle de données du bridge

### Découverte automatique des ressources mixtes

Les ressources mixtes sont identifiées dynamiquement par la jointure suivante, exécutée au démarrage du bridge (ou à la demande via `GET /resources/refresh`) :

```sql
-- Exécuté pour chaque base gp****
SELECT
  r_fp.id            AS fp_ressource_id,
  r_fp.code_acces    AS code_commun,
  r_fp.libelle       AS libelle_fp,
  r_fp.type          AS type_fp,
  i_gp.id            AS gp_intervt_id,
  i_gp.libelle       AS libelle_gp,
  'gp0042'           AS gp_base        -- paramétré par centre
FROM plgfpro.ressources r_fp
JOIN gp0042.intervt i_gp
  ON i_gp.reference_externe = r_fp.code_acces
WHERE r_fp.code_acces IS NOT NULL
  AND r_fp.code_acces != ''
ORDER BY r_fp.type, r_fp.libelle;
```

Le résultat alimente la table `ressources_mixtes` du bridge. **Aucun mapping manuel.**

### `ressources_mixtes` (cache local, auto-peuplé)

```sql
CREATE TABLE ressources_mixtes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code_commun     TEXT NOT NULL UNIQUE, -- = plgfpro.ressources.code_acces
                                        --   = gp****.intervt.reference_externe
  type            TEXT NOT NULL,        -- 'piste' | 'vehicule_pl' | 'moniteur' | 'salle'
  libelle         TEXT NOT NULL,        -- libelle_fp de référence
  centre_id       TEXT NOT NULL,        -- ex: 'gp0042'
  -- Côté GP
  gp_base         TEXT NOT NULL,        -- ex: 'gp0042'
  gp_intervt_id   INTEGER NOT NULL,     -- gp****.intervt.id
  -- Côté FP
  fp_ressource_id INTEGER NOT NULL,     -- plgfpro.ressources.id
  actif           INTEGER NOT NULL DEFAULT 1,
  synchro_le      TEXT                  -- datetime dernière synchro
);
```

### `reservations` (créneaux partagés saisis dans cet outil)

```sql
CREATE TABLE reservations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ressource_id  INTEGER NOT NULL REFERENCES ressources_mixtes(id),
  date          TEXT NOT NULL,        -- ISO 8601 YYYY-MM-DD
  heure_debut   TEXT NOT NULL,        -- HH:MM
  heure_fin     TEXT NOT NULL,        -- HH:MM
  mode          TEXT NOT NULL,        -- 'GP' | 'FP' | 'commun'
  motif         TEXT,                 -- libellé libre
  utilisateur   TEXT,                 -- login de l'auteur
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  -- Référence croisée optionnelle (si créé depuis GP ou FP)
  source        TEXT,                 -- 'gp' | 'fp' | 'bridge'
  source_id     INTEGER               -- ID dans le système source
);
```

> Les créneaux lus depuis GPLearn (`plg_arg`) et PlgFPro (`planning`) ne sont pas mis en cache : ils sont lus **en temps réel** à chaque requête `/slots` et à chaque `POST /reservations`. Cela garantit que la détection de conflit reflète toujours l'état courant des deux systèmes. Seules les **réservations saisies dans le bridge** sont stockées dans SQLite.

---

## 5. API du bridge

### `GET /resources?centre=gp0042`
Retourne la liste des ressources mixtes configurées pour ce centre.

```json
[
  { "id": 1, "type": "piste", "libelle": "Piste principale", "centre_id": "gp0042" },
  { "id": 2, "type": "moniteur", "libelle": "Dupont Jean (GP+FP)", "centre_id": "gp0042" }
]
```

### `GET /slots?date_debut=2026-06-02&date_fin=2026-06-06&ressource_id=1`
Retourne TOUS les créneaux pour une ressource et une plage de dates, toutes sources confondues.

```json
[
  {
    "source": "gp",
    "source_id": 4521,
    "date": "2026-06-02",
    "heure_debut": "09:00",
    "heure_fin": "10:00",
    "mode": "GP",
    "eleve": "Martin Sophie",
    "moniteur": "Dupont Jean",
    "conflit": false
  },
  {
    "source": "fp",
    "source_id": 887,
    "date": "2026-06-02",
    "heure_debut": "09:30",
    "heure_fin": "11:00",
    "mode": "FP",
    "apprenant": "Groupe TRM Juin",
    "formateur": "Dupont Jean",
    "conflit": true   // ← chevauchement avec le créneau GP ci-dessus
  },
  {
    "source": "bridge",
    "source_id": 12,
    "date": "2026-06-03",
    "heure_debut": "14:00",
    "heure_fin": "16:00",
    "mode": "commun",
    "motif": "Réunion sécurité plateau"
  }
]
```

### `POST /reservations`
Crée une réservation dans le bridge. Avant insertion, le bridge interroge **en temps réel** les bases GP (`plg_arg`) et FP (`planning`) ainsi que sa propre table `reservations` pour la ressource et le créneau demandés. Retourne `409 Conflict` avec le détail des créneaux bloquants si chevauchement détecté — la réservation n'est pas créée. La correction se fait dans le système source (GP ou FP), pas dans le bridge.

```json
{
  "ressource_id": 1,
  "date": "2026-06-04",
  "heure_debut": "08:00",
  "heure_fin": "12:00",
  "mode": "FP",
  "motif": "Formation TRM — exercices plateau"
}
```

### `GET /conflicts?date_debut=&date_fin=&centre=`
Retourne uniquement les créneaux en conflit sur la plage — vue dédiée pour les responsables.

---

## 6. Détection des conflits

Algorithme appliqué dans le bridge à chaque requête `/slots` :

```javascript
function detecterConflits(creneaux) {
  // Trier par ressource_id, date, heure_debut
  creneaux.sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));

  for (let i = 0; i < creneaux.length; i++) {
    for (let j = i + 1; j < creneaux.length; j++) {
      if (creneaux[j].heure_debut >= creneaux[i].heure_fin) break;
      // Chevauchement : heure_debut[j] < heure_fin[i]
      creneaux[i].conflit = true;
      creneaux[j].conflit = true;
    }
  }
  return creneaux;
}
```

Règle : deux créneaux sont en conflit si et seulement si :
- Même ressource mixte
- Même date
- `heure_debut_B < heure_fin_A` ET `heure_debut_A < heure_fin_B`

---

## 7. Interface utilisateur

### Vue principale — Calendrier multi-ressources

```
┌─────────────────────────────────────────────────────────────────────┐
│ Centre : [gp0042 ▼]    Semaine du 02/06/2026  [< Préc] [Suiv >]    │
│ Ressources : [✓] Pistes  [✓] Véhicules PL  [✓] Moniteurs  [✓] Salles│
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│          │  Lundi 2 │  Mardi 3 │  Merc. 4 │  Jeudi 5 │  Vendredi 6 │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ 08:00    │          │          │ [FP]████ │          │              │
│ 09:00    │ [GP]▓▓▓  │          │ [FP]████ │          │              │
│ 09:30    │ [FP]⚠▓▓  │          │ [FP]████ │          │              │ ← ⚠ conflit
│ 10:00    │ [GP]▓▓▓  │          │ [FP]████ │          │              │
│ 10:00    │          │          │          │          │              │
│ ...      │          │          │          │          │              │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘
  [GP] = bleu  [FP] = vert  [Bridge] = gris  ⚠ = conflit
  Clic sur case vide → créer réservation bridge
  Clic sur créneau → détail (lecture seule pour GP/FP, modifiable pour bridge)
```

### Vue conflits (tableau de bord responsable)

Liste de tous les conflits actifs sur les 30 prochains jours, avec :
- Ressource concernée
- Date et horaire du chevauchement
- Sources en conflit (GP vs FP, GP vs bridge, etc.)
- Bouton "Marquer résolu" (ajout d'une note, sans modifier les sources)

### Formulaire de réservation bridge

- Ressource (sélection dans la liste mixte)
- Date
- Heure début / Heure fin
- Mode (GP / FP / Commun)
- Motif (texte libre)
- Vérification temps réel des conflits avant validation

---

## 8. Authentification et droits

### Authentification — LDAP (identique à GPLearn)

Le bridge réutilise le même annuaire LDAP que GPLearn. Un utilisateur qui a déjà accès au planning GPLearn se connecte avec les mêmes identifiants — aucune gestion de compte supplémentaire.

```
Browser → POST /auth/login { login, password }
         → bind LDAP avec les credentials
         → succès → session JWT (email + groupes LDAP)
```

### Identification de l'utilisateur dans PlgFPro

Après authentification LDAP, le bridge recherche l'utilisateur dans `plgfpro.ressources` par son **email** :

```sql
SELECT id, libelle, est_responsable
FROM plgfpro.ressources
WHERE email = :email_ldap
LIMIT 1;
```

### Niveaux d'accès

| Condition | Accès |
|---|---|
| Non authentifié | Aucun accès |
| Authentifié LDAP, email **absent** de `plgfpro.ressources` | Lecture seule (vision calendrier) |
| Authentifié LDAP, email présent, `est_responsable = false` | Lecture seule |
| Authentifié LDAP, email présent, `est_responsable = true` | **Lecture + écriture** (créer / supprimer réservations bridge) |

> Le champ `est_responsable` dans `plgfpro.ressources` fait office de gate d'autorisation — aucune table de droits supplémentaire dans le bridge.

---

## 9. Configuration multi-centres

Fichier `config.json` (ou variables d'environnement) :

```json
{
  "centres": [
    {
      "id": "gp0042",
      "libelle": "Bordeaux Mérignac",
      "gp_db": {
        "host": "192.168.1.10",
        "database": "gp0042",
        "user": "readonly_user",
        "password": "..."
      },
      "fp_db": {
        "host": "192.168.1.10",
        "database": "plgfpro",
        "user": "readonly_user",
        "password": "..."
      }
    }
  ],
  "bridge_db": "./data/planning_bridge.sqlite"
}
```

> L'accès aux bases GP et FP est **en lecture seule** (utilisateur MySQL dédié sans INSERT/UPDATE/DELETE).

---

## 10. Plan de développement

### Phase A — Lecture + visualisation (1 semaine)

- [ ] Setup projet Node.js + Express
- [ ] Authentification LDAP (`POST /auth/login` → JWT) + lookup `plgfpro.ressources` par email
- [ ] Connecteurs MySQL (lecture `plg_arg` GP + `planning` FP)
- [ ] Auto-découverte ressources mixtes via jointure `code_acces`/`reference_externe` → SQLite
- [ ] API `/resources` et `/slots`
- [ ] Interface React : vue semaine FullCalendar, codes couleurs GP/FP/Bridge
- [ ] Détection conflits + marquage visuel

### Phase B — Saisie bridge (3-4 jours)

- [ ] API `POST /reservations` avec validation conflit
- [ ] Formulaire de réservation dans l'UI
- [ ] API `DELETE /reservations/:id`
- [ ] Vue conflits (tableau de bord)

### Phase C — Multi-centres (2-3 jours)

- [ ] Sélecteur de centre dans l'UI
- [ ] Config multi-connexions MySQL
- [ ] Déploiement sur infrastructure CERCA

**Total estimé : ~2 semaines**

---

## 11. Migration vers le futur MCD PostgreSQL

Quand la refonte est prête, les données du bridge migrent proprement :

| Bridge SQLite | Cible PostgreSQL |
|---|---|
| `reservations` WHERE `source='bridge'` | → `creneaux_planning` avec `mode='les_deux'` |
| `ressources_mixtes` | → `ressources` + `types_ressources` (mode='les_deux') |
| `config.centres[]` | → `franchises` + mapping FK |

Les créneaux GP et FP (lus à la volée dans le bridge) seront migrés par les scripts de migration décrits dans `10-strategie-migration.md`.

Le bridge peut rester actif en lecture seule pendant la phase de migration pour assurer la continuité.

---

## 12. Questions restantes

| # | Question | Impact |
|---|---|---|
| T2 | Le bridge doit-il être accessible depuis l'extérieur (HTTPS) ou seulement en intranet ? | Déploiement (différé) |
