import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { queryOne, db } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params
  const { montant, mode, date, reference } = await req.json()

  if (!montant || !mode || !date)
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })

  const facture = await queryOne<{ montant_ttc: number; montant_regle: number }>(
    'SELECT montant_ttc, montant_regle FROM factures WHERE id=? AND franchise_id=?',
    [id, session.franchise_id]
  )
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const montantNum = Number(montant)
  const newRegle = Number(facture.montant_regle) + montantNum
  const newStatut = newRegle >= Number(facture.montant_ttc)
    ? 'reglee'
    : newRegle > 0 ? 'partielle' : 'emise'

  await db.executeMultiple(`
    INSERT INTO reglements (id, franchise_id, facture_id, date, montant, mode, reference)
    VALUES ('${randomUUID()}', '${session.franchise_id}', '${id}', '${date}', ${montantNum}, '${mode}', '${reference ?? ''}');
    UPDATE factures SET montant_regle=${newRegle}, statut='${newStatut}' WHERE id='${id}';
  `)

  return NextResponse.json({ ok: true, nouveau_statut: newStatut, montant_regle: newRegle })
}
