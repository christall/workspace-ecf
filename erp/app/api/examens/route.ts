import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

const EXAM_CODES = ['AE', 'EI', 'RVP', 'RVPT', 'RETG', 'RVT2', 'RVPr']

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const fid = session.franchise_id
  const { searchParams } = new URL(req.url)
  const periode = searchParams.get('periode') || 'futur' // futur | passe | mois

  const today = new Date().toISOString().slice(0, 10)
  const dateFilter = periode === 'futur'
    ? `AND c.date >= '${today}'`
    : periode === 'mois'
    ? `AND c.date >= date('${today}', '-30 days') AND c.date <= '${today}'`
    : `AND c.date < '${today}'`

  const examCodes = EXAM_CODES.map(() => '?').join(',')

  const [creneaux, stats, recents] = await Promise.all([
    query(
      `SELECT c.id, c.date, c.heure_debut, c.heure_fin,
              p.code as produit_code, p.nom as produit_nom, p.couleur_hex,
              r.nom as ressource_nom,
              pe.id as eleve_id, pe.prenom, pe.nom as nom_eleve, pe.filiere, pe.code_obtenu
       FROM creneaux c
       JOIN produits p ON p.id = c.produit_id
       LEFT JOIN ressources r ON r.id = c.ressource_id
       LEFT JOIN creneau_personnes cp ON cp.creneau_id = c.id
       LEFT JOIN personnes pe ON pe.id = cp.personne_id
       WHERE c.franchise_id = ? AND p.code IN (${examCodes}) ${dateFilter}
       ORDER BY c.date ${periode === 'futur' ? 'ASC' : 'DESC'}, c.heure_debut
       LIMIT 100`,
      [fid, ...EXAM_CODES]
    ),
    queryOne(
      `SELECT
         COUNT(DISTINCT CASE WHEN code_obtenu=1 THEN id END) as codes_obtenus,
         COUNT(DISTINCT CASE WHEN code_obtenu=0 AND nb_heures>0 THEN id END) as en_formation,
         COUNT(DISTINCT id) as total_eleves
       FROM personnes WHERE franchise_id=?`,
      [fid]
    ),
    query(
      `SELECT pe.prenom, pe.nom, pe.filiere, pe.date_code,
              c.date as date_exam, p.nom as type_exam
       FROM personnes pe
       LEFT JOIN creneau_personnes cp ON cp.personne_id=pe.id
       LEFT JOIN creneaux c ON c.id=cp.creneau_id
       LEFT JOIN produits p ON p.id=c.produit_id AND p.code IN (${examCodes})
       WHERE pe.franchise_id=? AND pe.code_obtenu=1 AND pe.date_code IS NOT NULL
       ORDER BY pe.date_code DESC LIMIT 20`,
      [fid, ...EXAM_CODES]
    ),
  ])

  return NextResponse.json({ creneaux, stats, recents })
}
