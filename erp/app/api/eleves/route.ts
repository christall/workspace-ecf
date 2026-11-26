import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

const SORT_COLS: Record<string, string> = {
  nom: 'nom, prenom', prenom: 'prenom, nom',
  heures: 'nb_heures', solde: 'solde_credit', inscription: 'date_inscription',
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const filiere = searchParams.get('filiere') || ''
  const code = searchParams.get('code') || ''
  const annee = searchParams.get('annee') || ''
  const sort = searchParams.get('sort') || 'inscription'
  const order = searchParams.get('order') || 'desc'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 25
  const offset = (page - 1) * limit
  const fid = session.franchise_id

  const sortCol = SORT_COLS[sort] || 'date_inscription'
  const sortDir = order === 'asc' ? 'ASC' : 'DESC'

  const filters: string[] = []
  const args: (string | number)[] = [fid]
  if (q) { filters.push('(nom LIKE ? OR prenom LIKE ? OR tel_mobile LIKE ? OR email LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) }
  if (filiere) { filters.push('filiere = ?'); args.push(filiere) }
  if (code === 'oui') filters.push('code_obtenu = 1')
  if (code === 'non') filters.push('code_obtenu = 0')
  if (annee) { filters.push('SUBSTR(date_inscription, 1, 4) = ?'); args.push(annee) }
  const where = filters.length ? 'AND ' + filters.join(' AND ') : ''

  const [countRow, eleves, filieres] = await Promise.all([
    queryOne<{ n: number }>(`SELECT COUNT(*) as n FROM personnes WHERE franchise_id=? ${where}`, args),
    query(`SELECT id, nom, prenom, email, tel_mobile, filiere, nb_heures, solde_credit, code_obtenu, date_inscription, ville
           FROM personnes WHERE franchise_id=? ${where}
           ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`, [...args, limit, offset]),
    query<{ filiere: string }>(`SELECT DISTINCT filiere FROM personnes WHERE franchise_id=? AND filiere IS NOT NULL ORDER BY filiere`, [fid]),
  ])

  return NextResponse.json({ eleves, total: Number(countRow?.n ?? 0), filieres, page, limit })
}
