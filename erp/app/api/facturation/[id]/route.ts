import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const facture = await queryOne(
    `SELECT f.*, pe.prenom, pe.nom, pe.email, pe.tel_mobile, pe.id as personne_id
     FROM factures f JOIN personnes pe ON pe.id=f.personne_id
     WHERE f.id=? AND f.franchise_id=?`,
    [id, session.franchise_id]
  )
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const lignes = await query(
    `SELECT * FROM lignes_factures WHERE facture_id=? ORDER BY ordre`,
    [id]
  )

  const reglements = await query(
    `SELECT * FROM reglements WHERE facture_id=? ORDER BY date DESC`,
    [id]
  )

  return NextResponse.json({ facture, lignes, reglements })
}
