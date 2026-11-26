/**
 * Import depuis une base GPLearn (MySQL) vers l'ERP (SQLite)
 *
 * Usage :
 *   MYSQL_HOST=localhost MYSQL_USER=root MYSQL_PASSWORD=secret MYSQL_DATABASE=gp1702 npm run db:import
 *
 * Variables d'environnement :
 *   MYSQL_HOST      — hôte MySQL (défaut: 127.0.0.1)
 *   MYSQL_PORT      — port MySQL (défaut: 3306)
 *   MYSQL_USER      — utilisateur MySQL (défaut: root)
 *   MYSQL_PASSWORD  — mot de passe MySQL
 *   MYSQL_DATABASE  — base GPLearn à importer (ex: gp1702)
 *   IMPORT_MOIS     — nombre de mois de planning à importer (défaut: 3)
 */

import mysql from 'mysql2/promise'
import { createClient } from '@libsql/client'
import { randomUUID } from 'crypto'
import { addMonths, format, subMonths } from 'date-fns'
import { config } from 'dotenv'
import { existsSync } from 'fs'

// Charge .env.import s'il existe
if (existsSync('.env.import')) config({ path: '.env.import' })

const MYSQL_CFG = {
  host:        process.env.MYSQL_HOST     || '127.0.0.1',
  port:        parseInt(process.env.MYSQL_PORT || '3306'),
  user:        process.env.MYSQL_USER     || 'root',
  password:    process.env.MYSQL_PASSWORD || '',
  database:    process.env.MYSQL_DATABASE || 'gp1702',
  dateStrings: true,   // retourne les DATE/DATETIME comme "2026-04-03" et non comme Date objects
}
const IMPORT_MOIS = parseInt(process.env.IMPORT_MOIS || '6')
// MERGE_INTO=gp1702 → ajoute les données dans la franchise existante sans écraser les autres sources
const MERGE_INTO  = process.env.MERGE_INTO || ''
// SOURCE_BASE = nom de la source pour le champ source_base des personnes
const SOURCE_BASE = MERGE_INTO ? MYSQL_CFG.database : MYSQL_CFG.database

const sqlite = createClient({ url: 'file:./db/erp.db' })

// ─── Helpers ────────────────────────────────────────────────────────────────

function d(v: unknown): string | null {
  if (!v) return null
  const s = String(v)
  if (s === '0000-00-00' || s.startsWith('0000')) return null
  return s.slice(0, 10)
}

function s(v: unknown): string {
  return v != null ? String(v).trim() : ''
}

function n(v: unknown): number {
  return Number(v) || 0
}

// Vérifie si l'ERP est déjà initialisé (tables existantes)
async function checkSchema() {
  const r = await sqlite.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='franchises'")
  if (r.rows.length === 0) {
    console.error('❌ La base SQLite n\'est pas initialisée. Lancez d\'abord : npm run db:seed')
    process.exit(1)
  }
}

// ─── Import ──────────────────────────────────────────────────────────────────

async function run() {
  await checkSchema()
  await sqlite.execute('PRAGMA busy_timeout=5000')
  await sqlite.execute('PRAGMA foreign_keys=OFF')

  console.log(`\n🔌 Connexion MySQL → ${MYSQL_CFG.user}@${MYSQL_CFG.host}:${MYSQL_CFG.port}/${MYSQL_CFG.database}`)
  const db = await mysql.createConnection(MYSQL_CFG)
  console.log('✅ MySQL connecté\n')

  const code = MYSQL_CFG.database // ex: gp1702
  // Toujours partir du 1er janvier de l'année courante (ou plus tôt si IMPORT_MOIS > 5)
  const debutAnnee = new Date(new Date().getFullYear(), 0, 1)
  const debutMois = subMonths(new Date(), IMPORT_MOIS)
  const dateDebut = format(debutMois < debutAnnee ? debutMois : debutAnnee, 'yyyy-MM-dd')
  const dateFin   = format(addMonths(new Date(), 1), 'yyyy-MM-dd')

  // ── 1. Franchise ────────────────────────────────────────────────────────
  const [[agence]] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM agences LIMIT 1')
  let franchiseId: string

  if (MERGE_INTO) {
    // Mode fusion : trouver la franchise cible existante
    const target = await sqlite.execute({ sql: 'SELECT id FROM franchises WHERE code=?', args: [MERGE_INTO] })
    if (target.rows.length === 0) {
      console.error(`❌ Franchise cible '${MERGE_INTO}' introuvable. Importez d'abord cette base.`)
      process.exit(1)
    }
    franchiseId = target.rows[0].id as string
    console.log(`🔀 Mode fusion : import ${code} → franchise ${MERGE_INTO} (${franchiseId})`)
    // Supprimer uniquement les données de cette source, pas les autres
    await sqlite.execute({ sql: 'DELETE FROM creneau_personnes WHERE personne_id IN (SELECT id FROM personnes WHERE franchise_id=? AND source_base=?)', args: [franchiseId, code] })
    await sqlite.execute({ sql: 'DELETE FROM personnes WHERE franchise_id=? AND source_base=?', args: [franchiseId, code] })
    await sqlite.execute({ sql: 'DELETE FROM creneaux WHERE franchise_id=? AND commentaire LIKE ?', args: [franchiseId, `src:${code}%`] })
    await sqlite.execute({ sql: 'DELETE FROM conventions WHERE franchise_id=? AND source_base=?', args: [franchiseId, code] })
    console.log(`✅ Données ${code} précédentes effacées (fusion)`)
  } else {
    const existing = await sqlite.execute({ sql: 'SELECT id FROM franchises WHERE code=?', args: [code] })
    if (existing.rows.length > 0) {
      franchiseId = existing.rows[0].id as string
      console.log(`ℹ️  Franchise ${code} déjà présente — mise à jour`)
      await sqlite.execute({
        sql: 'UPDATE franchises SET nom=?, ville=? WHERE id=?',
        args: [`ECF CERCA — ${s(agence?.nom || code)}`, s(agence?.ville || ''), franchiseId],
      })
    } else {
      franchiseId = randomUUID()
      await sqlite.execute({
        sql: 'INSERT INTO franchises (id, code, nom, ville) VALUES (?,?,?,?)',
        args: [franchiseId, code, `ECF CERCA — ${s(agence?.nom || code)}`, s(agence?.ville || '')],
      })
      console.log(`✅ Franchise créée : ${code}`)
    }
    // Basculer utilisateurs et nettoyer l'ancienne franchise (gp3101 seed)
    await sqlite.execute({ sql: 'UPDATE utilisateurs SET franchise_id=? WHERE email=?', args: [franchiseId, 'admin@cerca.fr'] })
    await sqlite.execute({ sql: 'UPDATE utilisateurs SET franchise_id=? WHERE email=?', args: [franchiseId, 'sec@cerca.fr'] })
    await sqlite.execute({ sql: 'UPDATE utilisateurs SET franchise_id=? WHERE email=?', args: [franchiseId, 'm.brunet@cerca.fr'] })
    await sqlite.execute({ sql: 'DELETE FROM creneau_personnes WHERE creneau_id IN (SELECT id FROM creneaux WHERE franchise_id != ?)', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM reglements WHERE franchise_id != ?', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM lignes_factures WHERE facture_id IN (SELECT id FROM factures WHERE franchise_id != ?)', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM factures WHERE franchise_id != ?', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM creneaux WHERE franchise_id != ?', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM personnes WHERE franchise_id != ?', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM ressources WHERE franchise_id != ?', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM produits WHERE franchise_id != ?', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM franchises WHERE id != ?', args: [franchiseId] })
    console.log('✅ Utilisateurs basculés sur la franchise importée')
  }

  // gpfp utilise type_stage.nom comme filière et des types de ressources différents
  const isGpfp = code === 'gpfp'

  // ── 2. Ressources ─────────────────────────────────────────────────────────
  const COULEURS = ['#6366f1','#ec4899','#14b8a6','#f97316','#84cc16','#3b82f6','#a855f7','#ef4444','#22c55e','#eab308']
  const ressourceMap: Record<string, string> = {}

  // gpfp utilise des types numériques différents de gp1702 (1=moniteur, 2=vehicule)
  // gpfp: 309/315/316/107 = formateurs, 310/312/320/321 = salles/pistes, reste = véhicules/engins
  const mapTypeGpfp = (t: number): string => {
    if ([309, 315, 316, 107].includes(t)) return 'moniteur'
    if ([310, 312, 320, 321].includes(t)) return 'salle'
    if (t > 0) return 'vehicule'
    return 'autre'
  }

  const [moniteurs] = await db.query<mysql.RowDataPacket[]>(
    `SELECT code, COALESCE(nom_etatcivil, nom) as nom_etatcivil, prenom, type, no_autorisation_enseigner
     FROM intervt WHERE desactive=0 OR desactive IS NULL ORDER BY type, nom_etatcivil`
  )

  if (!MERGE_INTO) {
    // Import complet : supprimer et recréer
    await sqlite.execute({ sql: 'DELETE FROM ressources WHERE franchise_id=?', args: [franchiseId] })
  } else {
    // Mode fusion : supprimer les ressources gpfp précédentes, garder les gp1702
    await sqlite.execute({ sql: "DELETE FROM ressources WHERE franchise_id=? AND code LIKE 'gpfp:%'", args: [franchiseId] })
    // Reconstruire la map avec les ressources gp1702 existantes
    const existantes = await sqlite.execute({ sql: 'SELECT id, code FROM ressources WHERE franchise_id=?', args: [franchiseId] })
    for (const r of existantes.rows) ressourceMap[r.code as string] = r.id as string
  }

  let ci = Object.keys(ressourceMap).length
  for (const m of moniteurs) {
    const rawCode = s(m.code)
    // En mode fusion, préfixer les codes gpfp pour éviter les collisions avec gp1702
    const code = MERGE_INTO ? `gpfp:${rawCode}` : rawCode
    const id = randomUUID()
    const nom = [s(m.nom_etatcivil), s(m.prenom)].filter(Boolean).join(' ') || rawCode
    const type = isGpfp ? mapTypeGpfp(n(m.type)) : (n(m.type) === 1 ? 'moniteur' : n(m.type) === 2 ? 'vehicule' : 'autre')
    await sqlite.execute({
      sql: 'INSERT INTO ressources (id, franchise_id, code, nom, type, couleur_hex) VALUES (?,?,?,?,?,?)',
      args: [id, franchiseId, code, nom, type, COULEURS[ci++ % COULEURS.length]],
    })
    // Les créneaux gpfp référencent l'ancien code sans préfixe → on mappe les deux
    ressourceMap[rawCode] = id
    ressourceMap[code] = id
  }
  console.log(`✅ ${moniteurs.length} ressources importées (${isGpfp ? 'gpfp type mapping' : 'gp type mapping'})`)

  // ── 3. Produits — ignoré en mode fusion ──────────────────────────────────
  const COULEURS_PRODUITS: Record<string, string> = {
    '*LI': '#3b82f6', '*TH': '#22c55e', '*EP': '#ef4444', '*EE': '#eab308',
    '*AA': '#a855f7', '*CO': '#f97316', '*FT': '#14b8a6',
  }
  const produitMap: Record<string, string> = {}
  if (!MERGE_INTO) {
    const [produits] = await db.query<mysql.RowDataPacket[]>(
      'SELECT code, nom, duree, couleur FROM produits WHERE horsplg=0'
    )
    await sqlite.execute({ sql: 'DELETE FROM produits WHERE franchise_id=?', args: [franchiseId] })
    for (const p of produits) {
      const id = randomUUID()
      const code = s(p.code)
      const couleur = COULEURS_PRODUITS[code] ||
        (n(p.couleur) ? `#${n(p.couleur).toString(16).padStart(6, '0')}` : '#64748b')
      await sqlite.execute({
        sql: 'INSERT INTO produits (id, franchise_id, code, nom, duree_minutes, couleur_hex) VALUES (?,?,?,?,?,?)',
        args: [id, franchiseId, code, s(p.nom), n(p.duree), couleur],
      })
      produitMap[code] = id
    }
    console.log(`✅ ${produits.length} produits importés`)
  } else {
    const existants = await sqlite.execute({ sql: 'SELECT id, code FROM produits WHERE franchise_id=?', args: [franchiseId] })
    for (const p of existants.rows) produitMap[p.code as string] = p.id as string
    console.log(`ℹ️  Produits conservés (${existants.rows.length} existants)`)
  }

  // ── 4. Personnes (tiers / stagiaires) ────────────────────────────────────
  // gpfp utilise type_stage.nom comme filière (FP : CACES, FCO, FIMO…)
  // gp1702 utilise filieres.titre_court (GP : AAC, Traditionnel…)

  const tiersQuery = isGpfp
    ? `SELECT t.code, t.nom, t.prenom, t.email, t.tel, t.tel2, t.datenaiss,
              t.codep, t.ville, t.dateinscr, t.famille as permis_code,
              t.cryptage_cnil, t.maxcrdprod as plafcrd,
              ts.nom as nom_filiere
       FROM tiers t
       LEFT JOIN stg_elv se2 ON se2.tiers=t.code
       LEFT JOIN stage stg ON stg.idstage=se2.idstage
       LEFT JOIN type_stage ts ON ts.id=stg.id_type_stage
       WHERE COALESCE(t.cryptage_cnil, 0) = 0
         AND t.code IN (
           SELECT DISTINCT se.tiers FROM stg_elv se
           JOIN plg_stg ps ON ps.idstage=se.idstage
           JOIN plg_arg pa ON pa.idplgarg=ps.idplgarg
           WHERE pa.date >= '2024-01-01'
         )
       GROUP BY t.code
       ORDER BY t.nom, t.prenom`
    : `SELECT t.code, t.nom, t.prenom, t.email, t.tel, t.tel2, t.datenaiss,
              t.codep, t.ville, t.dateinscr, t.famille as permis_code,
              t.cryptage_cnil, t.maxcrdprod as plafcrd,
              f.titre_court as nom_filiere
       FROM tiers t
       LEFT JOIN filieres f ON f.idfiliere=t.idfiliere
       WHERE COALESCE(t.cryptage_cnil, 0) = 0
         AND t.idnature IN (SELECT idnature FROM natures WHERE facturable=1 OR nom LIKE '%lève%')
         AND (t.dateinscr >= '2024-01-01'
              OR t.code IN (
                SELECT DISTINCT se.tiers FROM stg_elv se
                JOIN plg_stg ps ON ps.idstage=se.idstage
                JOIN plg_arg pa ON pa.idplgarg=ps.idplgarg
                WHERE pa.date >= '2024-01-01'
              ))
       ORDER BY t.nom, t.prenom`

  const [tiers] = await db.query<mysql.RowDataPacket[]>(tiersQuery)

  if (!MERGE_INTO) {
    await sqlite.execute({ sql: 'DELETE FROM creneau_personnes WHERE personne_id IN (SELECT id FROM personnes WHERE franchise_id=?)', args: [franchiseId] })
    await sqlite.execute({ sql: 'DELETE FROM personnes WHERE franchise_id=?', args: [franchiseId] })
  }
  const personneMap: Record<string, string> = {}

  for (const t of tiers) {
    const id = randomUUID()
    await sqlite.execute({
      sql: `INSERT INTO personnes (id, franchise_id, nom, prenom, email, tel_mobile,
            date_naissance, ville, date_inscription, filiere, permis_code, solde_credit, source_base)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id, franchiseId,
        s(t.nom) || '(nom inconnu)', s(t.prenom),
        s(t.email), s(t.tel) || s(t.tel2),
        d(t.datenaiss), s(t.ville) || s(t.codep),
        d(t.dateinscr),
        s(t.nom_filiere) || (isGpfp ? 'Formation Pro' : 'Traditionnel'),
        s(t.permis_code) || 'B',
        n(t.plafcrd),
        code,
      ],
    })
    personneMap[String(t.code)] = id
  }
  console.log(`✅ ${tiers.length} personnes importées (source: ${code})`)

  // ── 5. Planning ───────────────────────────────────────────────────────────
  let creneaux: mysql.RowDataPacket[] = []
  console.log(`⏳ Chargement du planning (${dateDebut} → ${dateFin})…`)
  // En mode fusion : supprimer les créneaux gpfp précédents, garder les gp1702
  if (MERGE_INTO) {
    await sqlite.execute({
      sql: `DELETE FROM creneau_personnes WHERE creneau_id IN (SELECT id FROM creneaux WHERE franchise_id=? AND commentaire LIKE 'src:gpfp:%')`,
      args: [franchiseId]
    })
    await sqlite.execute({ sql: "DELETE FROM creneaux WHERE franchise_id=? AND commentaire LIKE 'src:gpfp:%'", args: [franchiseId] })
  }
  {
  // Requête séparée pour chaque table — plus robuste sur grandes bases
  const [creneaux_] = await db.query<mysql.RowDataPacket[]>(
    `SELECT pa.idplgarg, pa.date, pa.hdeb, pa.hfin, pa.produit, pa.comment,
            pa.verrou_plg, pa.verrou_ress, pa.verrou_elv
     FROM plg_arg pa
     WHERE pa.date BETWEEN ? AND ? AND pa.hdeb > '00:00:00'
     ORDER BY pa.date, pa.hdeb`,
    [dateDebut, dateFin]
  )
  creneaux = creneaux_
  console.log(`   → ${creneaux.length} créneaux MySQL chargés`)

  const plgIds = creneaux.map(c => n(c.idplgarg))
  if (plgIds.length === 0) {
    console.log('✅ Aucun créneau dans la période')
  } else {
    // Ressources par créneau
    const idList = plgIds.join(',')
    const [ressPlg] = await db.query<mysql.RowDataPacket[]>(
      `SELECT idplgarg, ress FROM plg_ress WHERE idplgarg IN (${idList}) ORDER BY idplgarg`
    )
    const ressMap: Record<number, string> = {}
    for (const r of ressPlg) ressMap[n(r.idplgarg)] = s(r.ress)

    // Élèves par créneau (via stg_elv + plg_stg)
    const [elevesPlg] = await db.query<mysql.RowDataPacket[]>(
      `SELECT ps.idplgarg, se.tiers, ap.abspres
       FROM plg_stg ps
       JOIN stg_elv se ON se.idstage=ps.idstage
       LEFT JOIN abspres ap ON ap.idplgarg=ps.idplgarg AND ap.idtiers=se.tiers
       WHERE ps.idplgarg IN (${idList})`
    )
    const elevesMap: Record<number, {tiers: string; abspres: number | null}[]> = {}
    for (const e of elevesPlg) {
      if (!elevesMap[n(e.idplgarg)]) elevesMap[n(e.idplgarg)] = []
      elevesMap[n(e.idplgarg)].push({ tiers: s(e.tiers), abspres: e.abspres != null ? n(e.abspres) : null })
    }

    if (!MERGE_INTO) {
      await sqlite.execute({
        sql: `DELETE FROM creneau_personnes WHERE creneau_id IN (SELECT id FROM creneaux WHERE franchise_id=?)`,
        args: [franchiseId]
      })
      await sqlite.execute({ sql: 'DELETE FROM creneaux WHERE franchise_id=?', args: [franchiseId] })
    }

    let creneauxCount = 0, elevesCount = 0
    for (const c of creneaux) {
      const produitId = produitMap[s(c.produit)]
      if (!produitId) continue

      const ressCode = ressMap[n(c.idplgarg)]
      const ressourceId = ressCode ? (ressourceMap[ressCode] ?? null) : null

      const creneauId = randomUUID()
      await sqlite.execute({
        sql: `INSERT INTO creneaux (id, franchise_id, date, heure_debut, heure_fin,
              produit_id, ressource_id, commentaire, verrou_planning)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [
          creneauId, franchiseId,
          d(c.date), s(c.hdeb).slice(0,5), s(c.hfin).slice(0,5),
          produitId, ressourceId,
          MERGE_INTO ? `src:gpfp:${n(c.idplgarg)}` : (s(c.comment) || null),
          (n(c.verrou_plg) || n(c.verrou_ress) || n(c.verrou_elv)) ? 1 : 0,
        ],
      })
      creneauxCount++

      for (const e of (elevesMap[n(c.idplgarg)] || [])) {
        const personneId = personneMap[e.tiers]
        if (!personneId) continue
        try {
          await sqlite.execute({
            sql: 'INSERT OR IGNORE INTO creneau_personnes (creneau_id, personne_id, abspres) VALUES (?,?,?)',
            args: [creneauId, personneId, e.abspres],
          })
          elevesCount++
        } catch { /* ignore doublons */ }
      }
    }
    console.log(`✅ ${creneauxCount} créneaux importés (${dateDebut} → ${dateFin}), ${elevesCount} présences`)
  }
  } // fin bloc planning

  // ── 6. Factures — ignorées en mode fusion ────────────────────────────────
  let facCount = 0
  if (MERGE_INTO) {
    const existing = await sqlite.execute({ sql: 'SELECT COUNT(*) as n FROM factures WHERE franchise_id=?', args: [franchiseId] })
    console.log(`ℹ️  Factures conservées (${existing.rows[0]?.n ?? 0} existantes, mode fusion)`)
  } else {
  // Les factures et règlements se lient via le champ `lettrage` (par tiers)
  const MODE_MAP: Record<string, string> = {
    'C': 'cheque', 'V': 'virement', 'E': 'especes', 'P': 'prelevement',
    'B': 'cb', 'K': 'cb', 'T': 'virement', 'X': 'cb',
  }

  const [factures] = await db.query<mysql.RowDataPacket[]>(
    `SELECT f.numero, f.date, f.echeance, f.libelle, f.tiersfact, f.verrouillee, f.lettrage,
            COALESCE(SUM(lf.montttc), 0) as montant_ttc,
            COALESCE(SUM(lf.montht),  0) as montant_ht
     FROM factures f
     LEFT JOIN lfacture lf ON lf.numfact = f.numero
     WHERE f.date >= ?
     GROUP BY f.numero
     ORDER BY f.date DESC`,
    [dateDebut]
  )

  // Règlements : on récupère tout pour la période + les lettres actives
  const [reglements] = await db.query<mysql.RowDataPacket[]>(
    `SELECT numero, date, montant, type, tierspour, lettrage
     FROM reglts WHERE date >= ? AND lettrage > '' ORDER BY date`,
    [dateDebut]
  )

  // Index règlements par (tierspour, lettrage) → plusieurs règlements possibles
  const reglIndex: Record<string, {montant:number; mode:string; date:string}[]> = {}
  for (const r of reglements) {
    const k = `${r.tierspour}|${s(r.lettrage)}`
    if (!reglIndex[k]) reglIndex[k] = []
    reglIndex[k].push({ montant: n(r.montant), mode: MODE_MAP[s(r.type)] || 'cheque', date: d(r.date) || '' })
  }

  await sqlite.execute({
    sql: `DELETE FROM lignes_factures WHERE facture_id IN (SELECT id FROM factures WHERE franchise_id=?)`,
    args: [franchiseId]
  })
  await sqlite.execute({ sql: 'DELETE FROM reglements WHERE franchise_id=?', args: [franchiseId] })
  await sqlite.execute({ sql: 'DELETE FROM factures WHERE franchise_id=?', args: [franchiseId] })

  for (const f of factures) {
    const personneId = personneMap[String(f.tiersfact)]
    if (!personneId) continue

    const montantTTC = n(f.montant_ttc)
    if (montantTTC <= 0) continue

    // Règlements liés via lettrage
    const reglKey = `${f.tiersfact}|${s(f.lettrage)}`
    const reglFac = s(f.lettrage) ? (reglIndex[reglKey] || []) : []
    const montantRegle = reglFac.reduce((acc, r) => acc + r.montant, 0)
    const reste = Math.max(0, montantTTC - montantRegle)

    let statut = 'emise'
    if (reste <= 0.01) statut = 'reglee'
    else if (montantRegle > 0) statut = 'partielle'
    else {
      const ech = d(f.echeance)
      if (ech && new Date(ech) < new Date()) statut = 'en_retard'
    }

    const facId = randomUUID()
    const dateEch = d(f.echeance) || d(f.date) || format(new Date(), 'yyyy-MM-dd')

    await sqlite.execute({
      sql: `INSERT INTO factures (id, franchise_id, numero, date, date_echeance, personne_id,
            libelle, montant_ht, taux_tva, montant_ttc, montant_regle, statut, is_verrouillee)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        facId, franchiseId, n(f.numero),
        d(f.date) || '', dateEch, personneId,
        s(f.libelle) || 'Formation conduite',
        n(f.montant_ht), 0, montantTTC, montantRegle, statut, n(f.verrouillee),
      ],
    })

    for (const r of reglFac) {
      await sqlite.execute({
        sql: `INSERT INTO reglements (id, franchise_id, facture_id, date, montant, mode)
              VALUES (?,?,?,?,?,?)`,
        args: [randomUUID(), franchiseId, facId, r.date, r.montant, r.mode],
      })
    }
    facCount++
  }
  console.log(`✅ ${facCount} factures importées avec règlements`)
  } // fin bloc !MERGE_INTO factures

  // ── 7. Conventions (fplearn.opportunite_opp + plgfpro.actions) ───────────
  // Requête cross-base (même serveur MySQL)
  let convCount = 0
  try {
    const [conventions] = await db.query<mysql.RowDataPacket[]>(
      `SELECT
         o.opp_IDopportunite as id_opp,
         o.opp_designation as designation,
         o.opp_montant as montant,
         o.opp_date_debut as date_debut,
         o.opp_date_fin as date_fin,
         oex_pfp.oex_IDExterne as id_action_pfp,
         a.nom as action_nom, a.nb_places,
         act.nom as activite_nom,
         ta.nom as type_action_nom,
         s.nom as site_nom,
         oex_gp.oex_IDExterne as id_stage_gpfp,
         COUNT(DISTINCT lop.lop_IDlien_opportunite_personnes_lop) as nb_stagiaires
       FROM fplearn.opportunite_opp o
       LEFT JOIN fplearn.lien_opportunite_externe_oex oex_pfp
         ON oex_pfp.oex_IDopportunite=o.opp_IDopportunite
         AND oex_pfp.oex_application='PlanniFPro' AND oex_pfp.oex_table='actions'
       LEFT JOIN plgfpro.actions a ON a.idaction=oex_pfp.oex_IDExterne
       LEFT JOIN plgfpro.typeactions ta ON ta.idtpaction=a.idtpaction
       LEFT JOIN plgfpro.activites act ON act.idactivite=ta.idactivite
       LEFT JOIN plgfpro.sites s ON s.idsite=a.idsite
       LEFT JOIN fplearn.lien_opportunite_externe_oex oex_gp
         ON oex_gp.oex_IDopportunite=o.opp_IDopportunite
         AND oex_gp.oex_application='gplearn' AND oex_gp.oex_table='stage'
       LEFT JOIN fplearn.lien_opportunite_personnes_lop lop
         ON lop.lop_IDopportunite=o.opp_IDopportunite
       WHERE o.opp_date_debut >= ?
       GROUP BY o.opp_IDopportunite
       ORDER BY o.opp_date_debut DESC
       LIMIT 3000`,
      [dateDebut]
    )

    await sqlite.execute({ sql: 'DELETE FROM conventions WHERE franchise_id=?', args: [franchiseId] })

    const conventionMap: Record<number, string> = {}
    for (const c of conventions) {
      const convId = randomUUID()
      await sqlite.execute({
        sql: `INSERT INTO conventions (id, franchise_id, id_source_fplearn, id_source_plgfpro, id_source_gpfp,
              designation, date_debut, date_fin, montant_total, nb_places,
              activite_nom, type_action_nom, site_nom, source_base)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          convId, franchiseId,
          n(c.id_opp) || null, n(c.id_action_pfp) || null, n(c.id_stage_gpfp) || null,
          s(c.designation) || s(c.action_nom) || '(sans titre)',
          d(c.date_debut), d(c.date_fin),
          n(c.montant), n(c.nb_places),
          s(c.activite_nom) || null, s(c.type_action_nom) || null, s(c.site_nom) || null,
          code,
        ],
      })
      conventionMap[n(c.id_opp)] = convId
      convCount++
    }

    // Stagiaires des conventions (batch par tranche de 200 opp)
    const oppIds = conventions.map(c => n(c.id_opp)).filter(Boolean)
    let stagCount = 0
    for (let i = 0; i < oppIds.length; i += 200) {
      const batch = oppIds.slice(i, i + 200).join(',')
      const [stagiaires] = await db.query<mysql.RowDataPacket[]>(
        `SELECT lop.lop_IDopportunite as id_opp,
                lop.lop_IDlien_opportunite_personnes_lop as id_lop,
                pph.pph_nom as nom, pph.pph_prenom as prenom,
                pex.pex_IDExterne as id_tiers_gpfp
         FROM fplearn.lien_opportunite_personnes_lop lop
         JOIN fplearn.personne_physique_pph pph ON pph.pph_IDpersonne_physique=lop.lop_IDpersonne_physique
         LEFT JOIN fplearn.lien_personne_physique_externe_pex pex
           ON pex.pex_IDpersonne_physique=lop.lop_IDpersonne_physique
           AND pex.pex_application='gplearn' AND pex.pex_base_de_donnees='gpfp'
         WHERE lop.lop_IDopportunite IN (${batch})`
      )
      for (const st of stagiaires) {
        const convId = conventionMap[n(st.id_opp)]
        if (!convId) continue
        const personneId = st.id_tiers_gpfp ? (personneMap[String(st.id_tiers_gpfp)] ?? null) : null
        await sqlite.execute({
          sql: `INSERT INTO convention_stagiaires (id, convention_id, personne_id, franchise_id, id_lop)
                VALUES (?,?,?,?,?)`,
          args: [randomUUID(), convId, personneId, franchiseId, n(st.id_lop)],
        })
        stagCount++
      }
    }
    console.log(`✅ ${convCount} conventions importées (${stagCount} stagiaires)`)
  } catch (e) {
    console.warn(`⚠️  Conventions ignorées (fplearn non accessible) : ${(e as Error).message}`)
  }

  await sqlite.execute('PRAGMA foreign_keys=ON')
  await db.end()
  sqlite.close()
  console.log(`\n🎉 Import ${code} terminé !`)
  console.log(`   ${tiers.length} personnes · ${creneaux.length} créneaux · ${facCount} factures · ${convCount} conventions`)
  console.log(`   Lancez npm run dev et connectez-vous`)
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })
