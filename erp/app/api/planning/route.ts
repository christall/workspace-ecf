import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const date = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const creneaux = await query<{
    id: string; date: string; heure_debut: string; heure_fin: string
    commentaire: string | null; verrou_planning: number
    produit_id: string; produit_code: string; produit_nom: string; produit_couleur: string
    ressource_id: string; ressource_code: string; ressource_nom: string; ressource_couleur: string
  }>(
    `SELECT c.id, c.date, c.heure_debut, c.heure_fin, c.commentaire, c.verrou_planning,
            p.id as produit_id, p.code as produit_code, p.nom as produit_nom, p.couleur_hex as produit_couleur,
            r.id as ressource_id, r.code as ressource_code, r.nom as ressource_nom, r.couleur_hex as ressource_couleur
     FROM creneaux c
     JOIN produits p ON p.id = c.produit_id
     JOIN ressources r ON r.id = c.ressource_id
     WHERE c.franchise_id = ? AND c.date = ?
     ORDER BY r.code, c.heure_debut`,
    [session.franchise_id, date]
  )

  // Charger les élèves
  let elevesMap: Record<string, { id: string; prenom: string; nom: string; abspres: number | null }[]> = {}
  if (creneaux.length > 0) {
    const ids = creneaux.map(c => `'${c.id}'`).join(',')
    const eleves = await query<{ creneau_id: string; id: string; prenom: string; nom: string; abspres: number | null }>(
      `SELECT cp.creneau_id, cp.abspres, pe.id, pe.prenom, pe.nom
       FROM creneau_personnes cp JOIN personnes pe ON pe.id = cp.personne_id
       WHERE cp.creneau_id IN (${ids})`
    )
    for (const e of eleves) {
      if (!elevesMap[e.creneau_id]) elevesMap[e.creneau_id] = []
      elevesMap[e.creneau_id].push(e)
    }
  }

  const ressources = await query(
    `SELECT id, code, nom, couleur_hex FROM ressources
     WHERE franchise_id = ? AND is_active = 1 AND type = 'moniteur' ORDER BY code`,
    [session.franchise_id]
  )

  return NextResponse.json({
    creneaux: creneaux.map(c => ({ ...c, eleves: elevesMap[c.id] || [] })),
    ressources,
  })
}
