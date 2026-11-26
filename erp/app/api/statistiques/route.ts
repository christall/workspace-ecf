import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const fid = session.franchise_id

  const [
    caParMois, heuresParMois, inscriptionsParMois,
    repartitionFiliere, topProduits, synthese
  ] = await Promise.all([
    // CA par mois (12 derniers mois)
    query(
      `SELECT SUBSTR(date, 1, 7) as mois,
              SUM(montant_ttc) as ca_brut,
              SUM(montant_regle) as ca_encaisse,
              COUNT(*) as nb_factures
       FROM factures WHERE franchise_id=? AND date >= date('now', '-12 months')
       GROUP BY mois ORDER BY mois`, [fid]
    ),
    // Créneaux par semaine (12 dernières semaines)
    query(
      `SELECT SUBSTR(date, 1, 7) as mois, COUNT(*) as nb_seances,
              COUNT(DISTINCT ressource_id) as nb_moniteurs_actifs
       FROM creneaux WHERE franchise_id=? AND date >= date('now', '-12 months')
       GROUP BY mois ORDER BY mois`, [fid]
    ),
    // Inscriptions par mois
    query(
      `SELECT SUBSTR(date_inscription, 1, 7) as mois, COUNT(*) as nb,
              filiere
       FROM personnes WHERE franchise_id=? AND date_inscription >= date('now', '-12 months')
       GROUP BY mois, filiere ORDER BY mois`, [fid]
    ),
    // Répartition par filière
    query(
      `SELECT filiere, COUNT(*) as nb, AVG(nb_heures) as moy_heures,
              SUM(CASE WHEN code_obtenu=1 THEN 1 ELSE 0 END) as avec_code
       FROM personnes WHERE franchise_id=? AND filiere IS NOT NULL
       GROUP BY filiere ORDER BY nb DESC`, [fid]
    ),
    // Top produits par nombre de séances
    query(
      `SELECT p.nom, p.code, COUNT(*) as nb_seances,
              COUNT(DISTINCT cp.personne_id) as nb_eleves
       FROM creneaux c JOIN produits p ON p.id=c.produit_id
       LEFT JOIN creneau_personnes cp ON cp.creneau_id=c.id
       WHERE c.franchise_id=? AND c.date >= date('now', '-3 months')
       GROUP BY p.id ORDER BY nb_seances DESC LIMIT 10`, [fid]
    ),
    // Synthèse globale
    queryOne(
      `SELECT
         (SELECT COUNT(*) FROM personnes WHERE franchise_id=?) as total_eleves,
         (SELECT SUM(montant_ttc) FROM factures WHERE franchise_id=? AND SUBSTR(date,1,7)=SUBSTR(date('now'),1,7)) as ca_mois,
         (SELECT SUM(montant_ttc) FROM factures WHERE franchise_id=? AND SUBSTR(date,1,4)=SUBSTR(date('now'),1,4)) as ca_annee,
         (SELECT COUNT(*) FROM creneaux WHERE franchise_id=? AND date >= date('now', '-7 days')) as seances_semaine,
         (SELECT COUNT(*) FROM personnes WHERE franchise_id=? AND date_inscription >= date('now', '-30 days')) as inscrits_mois`,
      [fid, fid, fid, fid, fid]
    ),
  ])

  return NextResponse.json({ caParMois, heuresParMois, inscriptionsParMois, repartitionFiliere, topProduits, synthese })
}
