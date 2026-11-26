import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import { randomUUID as uuid } from 'crypto'
import { addDays, format, startOfWeek } from 'date-fns'

const db = createClient({ url: 'file:./db/erp.db' })

// ─── Schéma ────────────────────────────────────────────────────────────────

async function createSchema() {
  await db.executeMultiple(`
    DROP TABLE IF EXISTS lignes_factures;
    DROP TABLE IF EXISTS aff_plg_lfac;
    DROP TABLE IF EXISTS reglements;
    DROP TABLE IF EXISTS factures;
    DROP TABLE IF EXISTS creneau_personnes;
    DROP TABLE IF EXISTS creneaux;
    DROP TABLE IF EXISTS personnes;
    DROP TABLE IF EXISTS produits;
    DROP TABLE IF EXISTS ressources;
    DROP TABLE IF EXISTS utilisateurs;
    DROP TABLE IF EXISTS franchises;

    CREATE TABLE franchises (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      nom TEXT NOT NULL,
      ville TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE utilisateurs (
      id TEXT PRIMARY KEY,
      franchise_id TEXT REFERENCES franchises(id),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      prenom TEXT NOT NULL,
      nom TEXT NOT NULL,
      role TEXT DEFAULT 'secretaire',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE ressources (
      id TEXT PRIMARY KEY,
      franchise_id TEXT REFERENCES franchises(id),
      code TEXT NOT NULL,
      nom TEXT NOT NULL,
      type TEXT DEFAULT 'moniteur',
      couleur_hex TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE produits (
      id TEXT PRIMARY KEY,
      franchise_id TEXT REFERENCES franchises(id),
      code TEXT UNIQUE NOT NULL,
      nom TEXT NOT NULL,
      duree_minutes INTEGER DEFAULT 60,
      couleur_hex TEXT NOT NULL
    );

    CREATE TABLE personnes (
      id TEXT PRIMARY KEY,
      franchise_id TEXT REFERENCES franchises(id),
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT,
      tel_mobile TEXT,
      date_naissance TEXT,
      ville TEXT,
      date_inscription TEXT,
      filiere TEXT,
      permis_code TEXT DEFAULT 'B',
      nb_heures REAL DEFAULT 0,
      solde_credit REAL DEFAULT 0,
      code_obtenu INTEGER DEFAULT 0,
      date_code TEXT,
      source_base TEXT DEFAULT 'gp',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE creneaux (
      id TEXT PRIMARY KEY,
      franchise_id TEXT REFERENCES franchises(id),
      date TEXT NOT NULL,
      heure_debut TEXT NOT NULL,
      heure_fin TEXT NOT NULL,
      produit_id TEXT REFERENCES produits(id),
      ressource_id TEXT REFERENCES ressources(id),
      commentaire TEXT,
      verrou_planning INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX creneaux_date ON creneaux(franchise_id, date);

    CREATE TABLE creneau_personnes (
      creneau_id TEXT REFERENCES creneaux(id) ON DELETE CASCADE,
      personne_id TEXT REFERENCES personnes(id),
      abspres INTEGER,
      PRIMARY KEY (creneau_id, personne_id)
    );

    CREATE TABLE factures (
      id TEXT PRIMARY KEY,
      franchise_id TEXT REFERENCES franchises(id),
      numero INTEGER NOT NULL,
      date TEXT NOT NULL,
      date_echeance TEXT,
      personne_id TEXT REFERENCES personnes(id),
      libelle TEXT,
      montant_ht REAL DEFAULT 0,
      taux_tva REAL DEFAULT 0,
      montant_ttc REAL DEFAULT 0,
      montant_regle REAL DEFAULT 0,
      statut TEXT DEFAULT 'emise',
      is_verrouillee INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX factures_date ON factures(franchise_id, date);
    CREATE INDEX factures_personne ON factures(franchise_id, personne_id);

    CREATE TABLE lignes_factures (
      id TEXT PRIMARY KEY,
      facture_id TEXT REFERENCES factures(id) ON DELETE CASCADE,
      ordre INTEGER DEFAULT 0,
      libelle TEXT NOT NULL,
      code_produit TEXT,
      quantite REAL DEFAULT 1,
      prix_unitaire REAL NOT NULL,
      taux_tva REAL DEFAULT 0,
      montant_ht REAL NOT NULL,
      creneau_id TEXT REFERENCES creneaux(id)
    );

    CREATE TABLE reglements (
      id TEXT PRIMARY KEY,
      franchise_id TEXT REFERENCES franchises(id),
      facture_id TEXT REFERENCES factures(id),
      date TEXT NOT NULL,
      montant REAL NOT NULL,
      mode TEXT DEFAULT 'cheque',
      reference TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE conventions (
      id TEXT PRIMARY KEY,
      franchise_id TEXT REFERENCES franchises(id),
      id_source_fplearn INTEGER,
      id_source_plgfpro INTEGER,
      id_source_gpfp INTEGER,
      reference TEXT,
      designation TEXT NOT NULL,
      date_debut TEXT,
      date_fin TEXT,
      montant_total REAL DEFAULT 0,
      nb_heures_centre REAL DEFAULT 0,
      nb_heures_entreprise REAL DEFAULT 0,
      nb_places INTEGER DEFAULT 0,
      statut TEXT DEFAULT 'en_cours',
      activite_nom TEXT,
      type_action_nom TEXT,
      site_nom TEXT,
      source_base TEXT DEFAULT 'gpfp',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX conventions_dates ON conventions(franchise_id, date_debut);
    CREATE INDEX conventions_source ON conventions(id_source_fplearn);

    CREATE TABLE convention_financeurs (
      id TEXT PRIMARY KEY,
      convention_id TEXT REFERENCES conventions(id) ON DELETE CASCADE,
      franchise_id TEXT,
      type_financeur TEXT NOT NULL,
      nom_financeur TEXT,
      montant REAL DEFAULT 0
    );

    CREATE TABLE convention_stagiaires (
      id TEXT PRIMARY KEY,
      convention_id TEXT REFERENCES conventions(id) ON DELETE CASCADE,
      personne_id TEXT REFERENCES personnes(id),
      franchise_id TEXT,
      id_lop INTEGER,
      statut_presence TEXT DEFAULT 'inscrit'
    );

    CREATE INDEX conv_stagiaires_personne ON convention_stagiaires(personne_id);
  `)
  console.log('✅ Schéma créé')
}

// ─── Données ────────────────────────────────────────────────────────────────

const ELEVES = [
  { prenom: 'Emma',      nom: 'Martin',    email: 'emma.martin@gmail.com',    tel: '06 12 34 56 78', dob: '2006-03-15', ville: 'Toulouse',     filiere: 'AAC',          heures: 12.5, solde: 450,  code: 1, date_code: '2025-03-15' },
  { prenom: 'Lucas',     nom: 'Bernard',   email: 'lucas.bernard@gmail.com',  tel: '06 23 45 67 89', dob: '2005-07-22', ville: 'Toulouse',     filiere: 'Traditionnel', heures: 8.0,  solde: 680,  code: 1, date_code: '2025-02-10' },
  { prenom: 'Camille',   nom: 'Dubois',    email: 'camille.dubois@hotmail.fr',tel: '07 34 56 78 90', dob: '2006-11-08', ville: 'Blagnac',      filiere: 'AAC',          heures: 22.0, solde: 200,  code: 1, date_code: '2024-11-20' },
  { prenom: 'Nathan',    nom: 'Moreau',    email: 'nathan.moreau@gmail.com',  tel: '06 45 67 89 01', dob: '2005-04-30', ville: 'Colomiers',    filiere: 'Traditionnel', heures: 5.5,  solde: 920,  code: 0, date_code: null },
  { prenom: 'Léa',       nom: 'Robert',    email: 'lea.robert@gmail.com',     tel: '07 56 78 90 12', dob: '2006-09-12', ville: 'Toulouse',     filiere: 'AAC',          heures: 35.0, solde: 50,   code: 1, date_code: '2024-09-05' },
  { prenom: 'Hugo',      nom: 'Simon',     email: 'hugo.simon@gmail.com',     tel: '06 67 89 01 23', dob: '2006-01-25', ville: 'Muret',        filiere: 'Traditionnel', heures: 2.0,  solde: 1200, code: 0, date_code: null },
  { prenom: 'Manon',     nom: 'Laurent',   email: 'manon.laurent@yahoo.fr',   tel: '07 78 90 12 34', dob: '2005-06-18', ville: 'Toulouse',     filiere: 'Traditionnel', heures: 18.5, solde: 310,  code: 1, date_code: '2025-01-08' },
  { prenom: 'Théo',      nom: 'Michel',    email: 'theo.michel@gmail.com',    tel: '06 89 01 23 45', dob: '2006-02-14', ville: 'Ramonville',   filiere: 'AAC',          heures: 28.0, solde: 130,  code: 1, date_code: '2024-10-22' },
  { prenom: 'Chloé',     nom: 'Leroy',     email: 'chloe.leroy@gmail.com',    tel: '07 90 12 34 56', dob: '2005-10-05', ville: 'Toulouse',     filiere: 'Traditionnel', heures: 11.0, solde: 540,  code: 1, date_code: '2025-02-28' },
  { prenom: 'Baptiste',  nom: 'Roux',      email: 'baptiste.roux@hotmail.fr', tel: '06 01 23 45 67', dob: '2005-12-20', ville: 'Balma',        filiere: 'Traditionnel', heures: 16.0, solde: 380,  code: 1, date_code: '2024-12-15' },
  { prenom: 'Inès',      nom: 'David',     email: 'ines.david@gmail.com',     tel: '07 12 34 56 78', dob: '2006-05-03', ville: 'Toulouse',     filiere: 'AAC',          heures: 4.0,  solde: 1050, code: 0, date_code: null },
  { prenom: 'Maxime',    nom: 'Bertrand',  email: 'maxime.bertrand@gmail.com',tel: '06 23 45 67 89', dob: '2004-08-17', ville: 'Toulouse',     filiere: 'Traditionnel', heures: 9.5,  solde: 600,  code: 1, date_code: '2025-01-20', permis: 'A' },
  { prenom: 'Julie',     nom: 'Morel',     email: 'julie.morel@yahoo.fr',     tel: '07 34 56 78 90', dob: '2005-03-28', ville: 'Labège',       filiere: 'Traditionnel', heures: 14.0, solde: 420,  code: 1, date_code: '2024-11-05' },
  { prenom: 'Alexandre', nom: 'Garnier',   email: 'alex.garnier@gmail.com',   tel: '06 45 67 89 01', dob: '2006-07-09', ville: 'Toulouse',     filiere: 'AAC',          heures: 6.0,  solde: 800,  code: 0, date_code: null },
  { prenom: 'Pauline',   nom: 'Faure',     email: 'pauline.faure@gmail.com',  tel: '07 56 78 90 12', dob: '2004-11-14', ville: 'Castanet',     filiere: 'Traditionnel', heures: 42.0, solde: 0,    code: 1, date_code: '2024-07-30' },
  { prenom: 'Romain',    nom: 'Giraud',    email: 'romain.giraud@gmail.com',  tel: '06 67 89 01 23', dob: '2006-04-21', ville: 'Toulouse',     filiere: 'Traditionnel', heures: 1.0,  solde: 1400, code: 0, date_code: null },
  { prenom: 'Sofia',     nom: 'Bonnet',    email: 'sofia.bonnet@hotmail.fr',  tel: '07 78 90 12 34', dob: '2006-08-06', ville: 'Tournefeuille',filiere: 'AAC',          heures: 19.0, solde: 280,  code: 1, date_code: '2025-03-01' },
  { prenom: 'Nicolas',   nom: 'Lambert',   email: 'nico.lambert@gmail.com',   tel: '06 89 01 23 45', dob: '2005-01-30', ville: 'Toulouse',     filiere: 'Traditionnel', heures: 7.0,  solde: 730,  code: 0, date_code: null },
  { prenom: 'Elise',     nom: 'Rousseau',  email: 'elise.rousseau@gmail.com', tel: '07 90 12 34 56', dob: '2006-06-13', ville: 'Toulouse',     filiere: 'AAC',          heures: 24.5, solde: 170,  code: 1, date_code: '2024-12-08' },
  { prenom: 'Mathieu',   nom: 'Petit',     email: 'mathieu.petit@yahoo.fr',   tel: '06 01 23 45 67', dob: '2005-09-25', ville: 'Portet',       filiere: 'Traditionnel', heures: 3.5,  solde: 1100, code: 0, date_code: null },
]

const MONITEURS = [
  { code: 'MB', nom: 'Michel Brunet',    couleur: '#6366f1' },
  { code: 'SL', nom: 'Sophie Lavallée', couleur: '#ec4899' },
  { code: 'PF', nom: 'Pierre Fontaine', couleur: '#14b8a6' },
  { code: 'ML', nom: 'Marie Lecomte',   couleur: '#f97316' },
  { code: 'TG', nom: 'Thomas Girard',   couleur: '#84cc16' },
]

const PRODUITS = [
  { code: '*LI', nom: 'Leçon conduite',   duree: 60,  couleur: '#3b82f6' },
  { code: '*TH', nom: 'Cours de code',    duree: 120, couleur: '#22c55e' },
  { code: '*EP', nom: 'Examen pratique',  duree: 60,  couleur: '#ef4444' },
  { code: '*EE', nom: 'Examen ETG',       duree: 30,  couleur: '#eab308' },
  { code: '*AA', nom: 'Eval. initiale',   duree: 90,  couleur: '#a855f7' },
  { code: '*CO', nom: 'Conduite accomp.', duree: 120, couleur: '#f97316' },
]

function weightedProduit() {
  const weights = [70, 12, 5, 3, 5, 5]
  const total = 100
  let r = Math.random() * total
  for (let i = 0; i < PRODUITS.length; i++) {
    r -= weights[i]
    if (r <= 0) return PRODUITS[i]
  }
  return PRODUITS[0]
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

async function seed() {
  await createSchema()

  const franchiseId = uuid()
  await db.execute({
    sql: 'INSERT INTO franchises (id, code, nom, ville) VALUES (?, ?, ?, ?)',
    args: [franchiseId, 'gp3101', 'ECF CERCA — Toulouse', 'Toulouse'],
  })
  console.log('✅ Franchise créée')

  const hash = await bcrypt.hash('Demo1234!', 10)
  for (const [email, prenom, nom, role] of [
    ['admin@cerca.fr', 'Admin', 'CERCA', 'admin'],
    ['sec@cerca.fr', 'Aurélie', 'Vidal', 'secretaire'],
    ['m.brunet@cerca.fr', 'Michel', 'Brunet', 'moniteur'],
  ]) {
    await db.execute({
      sql: 'INSERT INTO utilisateurs (id, franchise_id, email, password_hash, prenom, nom, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [uuid(), franchiseId, email, hash, prenom, nom, role],
    })
  }
  console.log('✅ Utilisateurs créés  (admin@cerca.fr / sec@cerca.fr / m.brunet@cerca.fr — mot de passe: Demo1234!)')

  const ressourceIds: Record<string, string> = {}
  for (const m of MONITEURS) {
    const id = uuid()
    await db.execute({
      sql: 'INSERT INTO ressources (id, franchise_id, code, nom, type, couleur_hex) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, franchiseId, m.code, m.nom, 'moniteur', m.couleur],
    })
    ressourceIds[m.code] = id
  }
  console.log('✅ Ressources créées')

  const produitIds: Record<string, string> = {}
  for (const p of PRODUITS) {
    const id = uuid()
    await db.execute({
      sql: 'INSERT INTO produits (id, franchise_id, code, nom, duree_minutes, couleur_hex) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, franchiseId, p.code, p.nom, p.duree, p.couleur],
    })
    produitIds[p.code] = id
  }
  console.log('✅ Produits créés')

  const personneIds: string[] = []
  for (const e of ELEVES) {
    const id = uuid()
    const dateInscr = format(addDays(new Date(), -Math.floor(Math.random() * 400 + 30)), 'yyyy-MM-dd')
    await db.execute({
      sql: `INSERT INTO personnes (id, franchise_id, nom, prenom, email, tel_mobile, date_naissance,
            ville, date_inscription, filiere, permis_code, nb_heures, solde_credit, code_obtenu, date_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, franchiseId, e.nom, e.prenom, e.email, e.tel, e.dob,
        e.ville, dateInscr, e.filiere,
        'permis' in e ? (e as typeof e & {permis?: string}).permis ?? 'B' : 'B',
        e.heures, e.solde, e.code, e.date_code,
      ],
    })
    personneIds.push(id)
  }
  console.log('✅ Élèves créés')

  const today = new Date()
  const monday = startOfWeek(today, { weekStartsOn: 1 })
  const slots = ['07:30','08:30','09:30','10:30','11:30','14:00','15:00','16:00','17:00']
  let count = 0

  for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const day = addDays(monday, weekOffset * 7 + dayOffset)
      const dateStr = format(day, 'yyyy-MM-dd')
      const isPast = day < today

      for (const moniteurCode of Object.keys(ressourceIds)) {
        for (const slot of slots) {
          if (Math.random() > 0.28) {
            const produit = weightedProduit()
            const heureDebut = slot
            const heureFin = addMinutes(slot, produit.duree)
            const creneauId = uuid()

            await db.execute({
              sql: `INSERT INTO creneaux (id, franchise_id, date, heure_debut, heure_fin,
                    produit_id, ressource_id, verrou_planning) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [creneauId, franchiseId, dateStr, heureDebut, heureFin,
                     produitIds[produit.code], ressourceIds[moniteurCode], isPast ? 1 : 0],
            })

            const nbEleves = produit.code === '*TH' ? Math.floor(Math.random() * 4) + 3 : 1
            const chosen = new Set<number>()
            while (chosen.size < Math.min(nbEleves, personneIds.length)) {
              chosen.add(Math.floor(Math.random() * personneIds.length))
            }
            for (const idx of Array.from(chosen)) {
              const abspres = isPast ? (Math.random() > 0.1 ? 0 : Math.random() > 0.5 ? 1 : 2) : null
              try {
                await db.execute({
                  sql: 'INSERT OR IGNORE INTO creneau_personnes (creneau_id, personne_id, abspres) VALUES (?, ?, ?)',
                  args: [creneauId, personneIds[idx], abspres],
                })
              } catch { /* ignore doublons */ }
            }
            count++
          }
        }
      }
    }
  }

  console.log(`✅ Planning créé (${count} créneaux sur 3 semaines)`)

  // ─── Factures ────────────────────────────────────────────────────────────
  const PRIX = { '*LI': 45, '*TH': 30, '*EP': 120, '*EE': 60, '*AA': 80, '*CO': 50 }
  const MODES = ['cheque', 'especes', 'cb', 'virement', 'prelevement']
  let numFac = 1

  // Génère 1 à 3 factures par élève pour les leçons passées
  for (const personneId of personneIds) {
    const leconsPasses = await db.execute({
      sql: `SELECT c.id, c.date, p.code as code_produit, p.nom as produit_nom
            FROM creneau_personnes cp
            JOIN creneaux c ON c.id = cp.creneau_id
            JOIN produits p ON p.id = c.produit_id
            WHERE cp.personne_id = ? AND c.date < ? AND cp.abspres = 0
            ORDER BY c.date LIMIT 15`,
      args: [personneId, format(today, 'yyyy-MM-dd')],
    })

    if (leconsPasses.rows.length === 0) continue

    // Groupe les leçons en 1-2 factures
    const nbFac = leconsPasses.rows.length > 8 ? 2 : 1
    const batchSize = Math.ceil(leconsPasses.rows.length / nbFac)

    for (let fi = 0; fi < nbFac; fi++) {
      const lignes = leconsPasses.rows.slice(fi * batchSize, (fi + 1) * batchSize)
      if (lignes.length === 0) continue

      const firstDate = lignes[0].date as string
      const facDate = format(addDays(new Date(firstDate), 3), 'yyyy-MM-dd')
      const echeance = format(addDays(new Date(facDate), 30), 'yyyy-MM-dd')

      let montantHT = 0
      const lignesData: { libelle: string; code: string; qte: number; pu: number; ht: number; creneauId: string }[] = []

      for (const l of lignes) {
        const code = l.code_produit as string
        const pu = PRIX[code as keyof typeof PRIX] ?? 45
        montantHT += pu
        lignesData.push({ libelle: l.produit_nom as string, code, qte: 1, pu, ht: pu, creneauId: l.id as string })
      }

      const tva = 0  // exonéré TVA (auto-école)
      const montantTTC = montantHT

      // Statut aléatoire réaliste
      const r = Math.random()
      let statut: string, montantRegle: number
      if (r < 0.45) { statut = 'reglee'; montantRegle = montantTTC }
      else if (r < 0.65) { statut = 'partielle'; montantRegle = Math.round(montantTTC * (0.3 + Math.random() * 0.5)) }
      else if (r < 0.80) { statut = 'en_retard'; montantRegle = 0 }
      else { statut = 'emise'; montantRegle = 0 }

      // Factures très anciennes → toutes réglées
      if (new Date(facDate) < addDays(today, -60) && statut === 'en_retard') {
        statut = 'reglee'; montantRegle = montantTTC
      }

      const facId = uuid()
      await db.execute({
        sql: `INSERT INTO factures (id, franchise_id, numero, date, date_echeance, personne_id,
              libelle, montant_ht, taux_tva, montant_ttc, montant_regle, statut)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [facId, franchiseId, numFac++, facDate, echeance, personneId,
               `Facture formation conduite`, montantHT, tva, montantTTC, montantRegle, statut],
      })

      for (let i = 0; i < lignesData.length; i++) {
        const l = lignesData[i]
        await db.execute({
          sql: `INSERT INTO lignes_factures (id, facture_id, ordre, libelle, code_produit, quantite, prix_unitaire, taux_tva, montant_ht, creneau_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [uuid(), facId, i + 1, l.libelle, l.code, l.qte, l.pu, 0, l.ht, l.creneauId],
        })
      }

      // Règlements pour les factures réglées ou partielles
      if (montantRegle > 0) {
        const mode = MODES[Math.floor(Math.random() * MODES.length)]
        await db.execute({
          sql: `INSERT INTO reglements (id, franchise_id, facture_id, date, montant, mode)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [uuid(), franchiseId, facId, format(addDays(new Date(facDate), Math.floor(Math.random() * 15)), 'yyyy-MM-dd'), montantRegle, mode],
        })
      }
    }
  }

  console.log(`✅ Facturation créée (${numFac - 1} factures avec règlements)`)
  console.log('\n🚀 Base prête. Lancez: npm run dev')
  console.log('   Connexion: admin@cerca.fr / Demo1234!')
  db.close()
}

seed().catch(e => { console.error(e); process.exit(1) })
