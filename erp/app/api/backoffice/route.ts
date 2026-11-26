import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const fid = session.franchise_id

  const [franchise, utilisateurs, produits, ressources] = await Promise.all([
    queryOne(`SELECT * FROM franchises WHERE id=?`, [fid]),
    query(`SELECT id, prenom, nom, email, role, is_active FROM utilisateurs WHERE franchise_id=?`, [fid]),
    query(`SELECT id, code, nom, duree_minutes, couleur_hex FROM produits WHERE franchise_id=? ORDER BY code`, [fid]),
    query(`SELECT id, code, nom, type, couleur_hex, is_active FROM ressources WHERE franchise_id=? ORDER BY type, code`, [fid]),
  ])

  return NextResponse.json({ franchise, utilisateurs, produits, ressources })
}
