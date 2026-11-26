import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const fid = session.franchise_id
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 8) + '01'

  const [lecons_today, eleves_actifs, examens_semaine, heures_mois, prochaines_lecons] = await Promise.all([
    queryOne<{n:number}>('SELECT COUNT(*) as n FROM creneaux WHERE franchise_id=? AND date=?', [fid, today]),
    queryOne<{n:number}>('SELECT COUNT(*) as n FROM personnes WHERE franchise_id=?', [fid]),
    queryOne<{n:number}>(
      `SELECT COUNT(*) as n FROM creneaux c JOIN produits p ON p.id=c.produit_id AND p.code IN ('*EP','*EE')
       WHERE c.franchise_id=? AND c.date BETWEEN ? AND date(?, '+7 days')`,
      [fid, today, today]
    ),
    queryOne<{h:number}>(
      `SELECT COALESCE(SUM(
         (CAST(substr(heure_fin,1,2) AS INTEGER)*60 + CAST(substr(heure_fin,4,2) AS INTEGER)) -
         (CAST(substr(heure_debut,1,2) AS INTEGER)*60 + CAST(substr(heure_debut,4,2) AS INTEGER))
       ) / 60.0, 0) as h
       FROM creneaux WHERE franchise_id=? AND date >= ? AND date <= ?`,
      [fid, monthStart, today]
    ),
    query(
      `SELECT c.date, c.heure_debut, c.heure_fin, p.nom as produit_nom, p.couleur_hex,
              r.nom as ressource_nom,
              GROUP_CONCAT(pe.prenom || ' ' || pe.nom, ', ') as eleves_noms
       FROM creneaux c
       JOIN produits p ON p.id=c.produit_id
       JOIN ressources r ON r.id=c.ressource_id
       LEFT JOIN creneau_personnes cp ON cp.creneau_id=c.id
       LEFT JOIN personnes pe ON pe.id=cp.personne_id
       WHERE c.franchise_id=? AND c.date=?
       GROUP BY c.id ORDER BY c.heure_debut LIMIT 10`,
      [fid, today]
    ),
  ])

  return NextResponse.json({
    lecons_today: Number(lecons_today?.n ?? 0),
    eleves_actifs: Number(eleves_actifs?.n ?? 0),
    examens_semaine: Number(examens_semaine?.n ?? 0),
    ca_mois_estime: Math.round(Number(heures_mois?.h ?? 0) * 45),
    prochaines_lecons,
  })
}
