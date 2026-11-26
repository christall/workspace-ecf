import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const statut = searchParams.get('statut') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 25
  const offset = (page - 1) * limit
  const fid = session.franchise_id

  const filters: string[] = []
  const args: (string | number)[] = [fid]

  if (q) { filters.push('(pe.nom LIKE ? OR pe.prenom LIKE ? OR f.numero LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (statut) { filters.push('f.statut = ?'); args.push(statut) }
  const where = filters.length ? 'AND ' + filters.join(' AND ') : ''

  const countRow = await queryOne<{n:number}>(
    `SELECT COUNT(*) as n FROM factures f JOIN personnes pe ON pe.id=f.personne_id
     WHERE f.franchise_id=? ${where}`, args
  )

  const factures = await query(
    `SELECT f.id, f.numero, f.date, f.date_echeance, f.libelle, f.statut,
            f.montant_ttc, f.montant_regle,
            pe.prenom, pe.nom, pe.id as personne_id
     FROM factures f JOIN personnes pe ON pe.id=f.personne_id
     WHERE f.franchise_id=? ${where}
     ORDER BY f.date DESC, f.numero DESC
     LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  )

  // Stats globales
  const stats = await queryOne(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN statut='emise' THEN montant_ttc ELSE 0 END) as a_encaisser,
       SUM(CASE WHEN statut='en_retard' THEN montant_ttc ELSE 0 END) as en_retard,
       SUM(montant_regle) as encaisse_mois
     FROM factures WHERE franchise_id=? AND date >= date('now','start of month')`,
    [fid]
  )

  return NextResponse.json({ factures, total: Number(countRow?.n ?? 0), page, limit, stats })
}
