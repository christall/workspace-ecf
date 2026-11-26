import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const fid = session.franchise_id
  const today = new Date().toISOString().slice(0, 10)
  const monday = new Date(); monday.setDate(monday.getDate() - monday.getDay() + 1)
  const mondayStr = monday.toISOString().slice(0, 10)

  const ressources = await query(
    `SELECT r.id, r.code, r.nom, r.type, r.couleur_hex, r.is_active,
            COUNT(DISTINCT CASE WHEN c.date BETWEEN '${mondayStr}' AND '${today}' THEN c.id END) as seances_semaine,
            COUNT(DISTINCT CASE WHEN c.date >= date('${today}', '-30 days') THEN c.id END) as seances_mois,
            COUNT(DISTINCT c.id) as seances_total,
            MAX(c.date) as derniere_seance,
            COUNT(DISTINCT CASE WHEN c.date >= '${today}' THEN c.id END) as seances_futures
     FROM ressources r
     LEFT JOIN creneaux c ON c.ressource_id=r.id AND c.franchise_id=?
     WHERE r.franchise_id=?
     GROUP BY r.id
     ORDER BY r.type, r.code`,
    [fid, fid]
  )

  return NextResponse.json({ ressources })
}
