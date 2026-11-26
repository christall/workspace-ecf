import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const fid = session.franchise_id

  const [convention, stagiaires, financeurs] = await Promise.all([
    queryOne(
      `SELECT * FROM conventions WHERE id=? AND franchise_id=?`, [id, fid]
    ),
    query(
      `SELECT cs.id, cs.statut_presence, cs.id_lop,
              pe.prenom, pe.nom, pe.email, pe.tel_mobile, pe.filiere, pe.nb_heures
       FROM convention_stagiaires cs
       LEFT JOIN personnes pe ON pe.id=cs.personne_id
       WHERE cs.convention_id=?
       ORDER BY pe.nom, pe.prenom`, [id]
    ),
    query(
      `SELECT * FROM convention_financeurs WHERE convention_id=? ORDER BY montant DESC`, [id]
    ),
  ])

  if (!convention) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json({ convention, stagiaires, financeurs })
}
