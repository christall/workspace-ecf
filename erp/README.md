# ERP CERCA — Démo

Application de démonstration pour la décision de refonte du système de gestion ECF CERCA.

## Prérequis

- **Node.js 18+** (https://nodejs.org)
- Pas besoin de base de données externe — SQLite intégré

## Installation

**Windows :**
```
install.bat
```

**Linux / macOS / WSL :**
```bash
chmod +x install.sh
./install.sh
```

**Manuellement :**
```bash
npm install
npm run db:seed
npm run dev
```

Ouvrir http://localhost:3000

## Comptes de démo

| Email | Rôle | Mot de passe |
|-------|------|--------------|
| admin@cerca.fr | Administrateur | Demo1234! |
| sec@cerca.fr | Secrétaire | Demo1234! |
| m.brunet@cerca.fr | Moniteur | Demo1234! |

## Ce qui est démontré

### 🗓️ Planning (écran principal)
- Vue par jour avec colonnes par moniteur
- Navigation jour par jour, onglets semaine
- Créneaux colorés par type (leçon, code, examen, EVINI...)
- Clic sur un créneau → fiche détail avec élèves et statut présence
- Verrouillage des créneaux passés visible (🔒)

### 👥 Élèves
- Liste paginée avec recherche en temps réel
- Soldes en rouge quand insuffisants
- Fiche complète : état civil, progression, historique leçons, présence/absence

### 📊 Tableau de bord
- Statistiques temps réel : leçons du jour, élèves actifs, CA estimé, examens semaine
- Résumé du planning du jour

## Données de démo

- 1 franchise : ECF CERCA — Toulouse (gp3101)
- 5 moniteurs : Michel Brunet, Sophie Lavallée, Pierre Fontaine, Marie Lecomte, Thomas Girard
- 20 élèves avec données réalistes (filières AAC/Traditionnel, heures, soldes, permis)
- ~3 semaines de planning (passé + courant + futur)

## Importer des données réelles depuis GPLearn

Pour remplacer les données fictives par les vraies données d'un centre (ex: gp1702) :

```bash
# Windows
set MYSQL_HOST=localhost
set MYSQL_USER=root
set MYSQL_PASSWORD=votre_mot_de_passe
set MYSQL_DATABASE=gp1702
npm run db:import

# Linux / WSL / macOS
MYSQL_HOST=localhost MYSQL_USER=root MYSQL_PASSWORD=secret MYSQL_DATABASE=gp1702 npm run db:import
```

Ce que l'import récupère :
- **Élèves** : tous les `tiers` non chiffrés CNIL avec filière et permis
- **Ressources** : tous les `intervt` actifs (moniteurs, véhicules)
- **Produits** : catalogue complet
- **Planning** : N derniers mois (défaut 3, modifiable via `IMPORT_MOIS=6`)
- **Factures + règlements** : sur la même période

Les données fictives du seed sont remplacées par les vraies données. L'ERP et le seed restent fonctionnels en parallèle.

## Stack technique

- **Next.js 15** (App Router, TypeScript)
- **SQLite** via @libsql/client (zéro configuration)
- **Tailwind CSS** + composants Radix UI
- **Auth** JWT httpOnly cookies
- Multi-tenant RLS prêt pour PostgreSQL en production
