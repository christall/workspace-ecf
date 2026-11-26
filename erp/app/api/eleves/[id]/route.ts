import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const eleve = await queryOne(
    'SELECT * FROM personnes WHERE id = ? AND franchise_id = ?',
    [id, session.franchise_id]
  )
  if (!eleve) return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 })

  const lecons = await query(
    `SELECT c.id, c.date, c.heure_debut, c.heure_fin, c.verrou_planning,
            p.nom as produit_nom, p.couleur_hex as produit_couleur, p.code as produit_code,
            r.nom as ressource_nom, cp.abspres
     FROM creneau_personnes cp
     JOIN creneaux c ON c.id = cp.creneau_id
     JOIN produits p ON p.id = c.produit_id
     JOIN ressources r ON r.id = c.ressource_id
     WHERE cp.personne_id = ?
     ORDER BY c.date DESC, c.heure_debut DESC LIMIT 30`,
    [id]
  )

  return NextResponse.json({ ...eleve, derniers_creneaux: lecons })
}
