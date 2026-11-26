import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const activite = searchParams.get('activite') || ''
  const statut = searchParams.get('statut') || ''
  const du = searchParams.get('du') || ''
  const au = searchParams.get('au') || ''
  const sort = searchParams.get('sort') || 'date_debut'
  const order = searchParams.get('order') || 'desc'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 25
  const offset = (page - 1) * limit
  const fid = session.franchise_id

  const SORT_COLS: Record<string, string> = {
    date_debut: 'c.date_debut', date_fin: 'c.date_fin',
    designation: 'c.designation', montant: 'c.montant_total',
    stagiaires: 'nb_stagiaires', activite: 'c.activite_nom',
  }
  const sortCol = SORT_COLS[sort] || 'c.date_debut'
  const sortDir = order === 'asc' ? 'ASC' : 'DESC'

  const filters: string[] = []
  const args: (string | number)[] = [fid]
  if (q) { filters.push('(c.designation LIKE ? OR c.activite_nom LIKE ? OR c.type_action_nom LIKE ? OR c.site_nom LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) }
  if (activite) { filters.push('c.activite_nom = ?'); args.push(activite) }
  if (statut) { filters.push('c.statut = ?'); args.push(statut) }
  if (du) { filters.push('c.date_debut >= ?'); args.push(du) }
  if (au) { filters.push('c.date_debut <= ?'); args.push(au) }
  const where = filters.length ? 'AND ' + filters.join(' AND ') : ''

  const [countRow, conventions, activites, stats] = await Promise.all([
    queryOne<{ n: number }>(
      `SELECT COUNT(*) as n FROM conventions c WHERE c.franchise_id=? ${where}`, args
    ),
    query(
      `SELECT c.id, c.designation, c.date_debut, c.date_fin, c.montant_total,
              c.nb_places, c.statut, c.activite_nom, c.type_action_nom, c.site_nom,
              c.id_source_fplearn, c.id_source_plgfpro,
              COUNT(cs.id) as nb_stagiaires
       FROM conventions c
       LEFT JOIN convention_stagiaires cs ON cs.convention_id=c.id
       WHERE c.franchise_id=? ${where}
       GROUP BY c.id
       ORDER BY ${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    ),
    query<{ activite_nom: string }>(
      `SELECT DISTINCT activite_nom FROM conventions WHERE franchise_id=? AND activite_nom IS NOT NULL ORDER BY activite_nom`, [fid]
    ),
    queryOne(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN statut='en_cours' THEN 1 END) as en_cours,
         COUNT(CASE WHEN statut='terminee' THEN 1 END) as terminees,
         SUM(montant_total) as ca_total,
         (SELECT COUNT(*) FROM convention_stagiaires WHERE franchise_id=?) as total_stagiaires
       FROM conventions WHERE franchise_id=?`, [fid, fid]
    ),
  ])

  return NextResponse.json({
    conventions, total: Number(countRow?.n ?? 0), activites, stats, page, limit,
  })
}
