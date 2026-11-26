import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const fid = session.franchise_id
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const filiere = searchParams.get('filiere') || ''
  const stade = searchParams.get('stade') || '' // debutant | intermediaire | pret_examen
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 30

  const filters: string[] = []
  const args: (string|number)[] = [fid]
  if (q) { filters.push('(pe.nom LIKE ? OR pe.prenom LIKE ?)'); args.push(`%${q}%`, `%${q}%`) }
  if (filiere) { filters.push('pe.filiere = ?'); args.push(filiere) }
  if (stade === 'debutant') { filters.push('pe.nb_heures < 10') }
  if (stade === 'intermediaire') { filters.push('pe.nb_heures BETWEEN 10 AND 30') }
  if (stade === 'pret_examen') { filters.push('pe.nb_heures >= 20 AND pe.code_obtenu = 0') }
  const where = filters.length ? 'AND ' + filters.join(' AND ') : ''

  const [eleves, total, filieres, statsGlobales] = await Promise.all([
    query(
      `SELECT pe.id, pe.prenom, pe.nom, pe.filiere, pe.nb_heures, pe.solde_credit,
              pe.code_obtenu, pe.date_inscription,
              MAX(c.date) as derniere_lecon,
              COUNT(cp.creneau_id) as nb_seances
       FROM personnes pe
       LEFT JOIN creneau_personnes cp ON cp.personne_id=pe.id
       LEFT JOIN creneaux c ON c.id=cp.creneau_id
       WHERE pe.franchise_id=? ${where}
       GROUP BY pe.id
       ORDER BY derniere_lecon DESC NULLS LAST, pe.nb_heures DESC
       LIMIT ? OFFSET ?`,
      [...args, limit, (page-1)*limit]
    ),
    queryOne<{n:number}>(
      `SELECT COUNT(*) as n FROM personnes pe WHERE franchise_id=? ${where}`, args
    ),
    query<{filiere:string}>(
      `SELECT DISTINCT filiere FROM personnes WHERE franchise_id=? AND filiere IS NOT NULL ORDER BY filiere`, [fid]
    ),
    queryOne(
      `SELECT
         AVG(nb_heures) as moy_heures,
         COUNT(CASE WHEN code_obtenu=1 THEN 1 END) as avec_code,
         COUNT(CASE WHEN nb_heures>=20 AND code_obtenu=0 THEN 1 END) as prets_examen,
         COUNT(CASE WHEN nb_heures<5 AND date_inscription >= date('now','-60 days') THEN 1 END) as nouveaux
       FROM personnes WHERE franchise_id=?`, [fid]
    ),
  ])

  return NextResponse.json({ eleves, total: Number(total?.n ?? 0), filieres, statsGlobales, page, limit })
}
