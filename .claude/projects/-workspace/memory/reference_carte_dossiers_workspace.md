---
name: carte-des-dossiers-de-travail-ecf-et-des-claude-md
description: "Carte du périmètre ECF après la scission du 26/11/2026 — rôle des dossiers, règles de frontière vis-à-vis de sources/ et de l'autre workspace perso"
metadata:
  node_type: memory
  type: reference
  originSessionId: cccddfc9-32a1-4705-a0d2-34ad8fa441e6
  modified: 2026-11-26T14:38:18.659Z
---

**Réflexe** : avant de toucher un dossier, lire son `CLAUDE.md`. Le `CLAUDE.md` racine porte le
transverse (conteneur, git, Jira/Tempo, réseaux). Depuis la scission du 26/11/2026, ce workspace
est **ECF uniquement** ; les projets perso/lab vivent dans un autre workspace physique.

## Périmètre ECF

- `sources/` — ~20 apps legacy PHP/MySQL en production. Vue d'ensemble et conventions dans
  `sources/CLAUDE.md` : **on édite, on ne committe jamais** (Christophe gère git depuis
  Windows), déploiement GitLab `code.fabrick.io` vers recette/prod. Gitignoré dans le dépôt
  workspace ; chaque app a son `.git`.
  - `GPLearn/` — ERP central multi-tenant : une base `gp****` par agence + `gpcontrolserveurs`
    (auth centrale, single point of failure). `bellacom/` = export vers prestataire externe.
  - `PlanniFProWeb/` — planning formateurs FP, base `plgfpro`, synchro CDC (`rdrd_*`/`udrd_*`),
    intégrations NEVEA/Formagest/CRM.
  - `scripts-sql/GPLearn/` — archive de scripts correctifs one-off + pattern de référence pour
    les fusions de bases (drop/restore des triggers de clôture, comptages + SIGNAL).
  - `applisWeb/` — apps complémentaires : `bddTools` (admin MySQL multi-serveurs), `campus`
    (webinaires internes), `nevea` (exports Sage), `debordement-app` (Next.js, pnpm),
    `Remunerations`, `Argan`, `Intranet` (fin de vie)…
  - `ecfcoach_back|front/` — PWA offline-first tablettes moniteurs (IndexedDB), synchro delta
    toutes les 2 min, IDs temporaires négatifs (`synchro*.php`).
  - `myroad_back|front/` — app élèves, lecture temps réel de GPLearn (pas d'offline) ;
    `front/lnk/` est en réalité une couche d'accès MySQL PHP.
  - `webservices/` — services transverses : SMS OVH, mail SwiftMailer, push FCM/APN, ANTS
    (SOAP + certificat X.509), batchs, CRM.
  - `ecfcerca_ecom/` — e-commerce formations, synchro produits GPLearn, paiement PCI.
- `erp/` — refonte Next.js 15 App Router + TypeScript ; **aujourd'hui SQLite/libSQL
  (`db/erp.db`, SQL direct), cible PostgreSQL 1 schéma/franchise + RLS non migrée**.
- `analyse-refonte/` — gouvernance (décisions G1-G10, D1-D23) et MCD cible : sources de vérité
  de la refonte.
- `nevea_scan_production/` — scans HTML de production Nevea (matière d'analyse).
- `sources/Echanges_claude_code/` — échanges et accès API (Jira/Tempo).
- `ops/` — scripts d'exploitation, dont `php2shell-protect.sh` (pile Apache/PHP 7.4 legacy).
- `routeur/` — **outil partagé** (proxy multi-modèles), pas un projet métier ; `.env` hors git.

## Règles de frontière

- `sources/` **n'est jamais déployé par rsync sur la VM OVH** : circuit recette/prod séparé via
  GitLab, Christophe committe/pushe depuis Windows.
- Les projets perso/lab (vdb, zest, forum, Relaiflow, tra*, voice-bridge) sont **hors de ce
  workspace** : ne pas les réintroduire ici, ne pas copier leurs mémoires dans ce banc.
- La VM OVH et ses apps perso relèvent de l'autre workspace ; seule la pile Apache/PHP legacy
  qui héberge des sites ECF reste concernée par `ops/php2shell-protect.sh`.
- Depuis le conteneur : `git fetch` sur `code.fabrick.io` échoue (clé SSH non autorisée) ; le
  DNS interne CERCA ne résout pas → passer par l'IP (recette `192.168.1.130`).
