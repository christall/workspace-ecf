import { getSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Calendar, Euro } from 'lucide-react'
import { formatDate, initiales } from '@/lib/utils'
import ReglementForm from './ReglementForm'

type PageProps = { params: Promise<{ id: string }> }

const STATUTS: Record<string, { label: string; cls: string }> = {
  emise:    { label: 'Émise',      cls: 'bg-blue-100 text-blue-700' },
  partielle:{ label: 'Partielle',  cls: 'bg-amber-100 text-amber-700' },
  en_retard:{ label: 'En retard',  cls: 'bg-red-100 text-red-700' },
  reglee:   { label: 'Réglée',    cls: 'bg-green-100 text-green-700' },
}

const MODES: Record<string, string> = {
  cheque: 'Chèque', especes: 'Espèces', cb: 'Carte bancaire',
  virement: 'Virement', prelevement: 'Prélèvement',
}

export default async function FicheFacturePage({ params }: PageProps) {
  const session = await getSession()
  const { id } = await params

  const facture = await queryOne<Record<string, unknown>>(
    `SELECT f.*, pe.prenom, pe.nom, pe.email, pe.tel_mobile, pe.id as personne_id
     FROM factures f JOIN personnes pe ON pe.id=f.personne_id
     WHERE f.id=? AND f.franchise_id=?`,
    [id, session!.franchise_id]
  )
  if (!facture) notFound()

  const lignes = await query<Record<string, unknown>>(
    'SELECT * FROM lignes_factures WHERE facture_id=? ORDER BY ordre', [id]
  )
  const reglements = await query<Record<string, unknown>>(
    'SELECT * FROM reglements WHERE facture_id=? ORDER BY date DESC', [id]
  )

  const statut = STATUTS[facture.statut as string] ?? { label: facture.statut as string, cls: 'bg-slate-100 text-slate-600' }
  const reste = Math.max(0, Number(facture.montant_ttc) - Number(facture.montant_regle))
  const isReglee = facture.statut === 'reglee'

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/facturation" className="btn-ghost mb-6 -ml-2 text-slate-500">
        <ArrowLeft size={16} /> Retour à la facturation
      </Link>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">
                Facture #{String(facture.numero).padStart(4, '0')}
              </h1>
              <span className={`badge ${statut.cls}`}>{statut.label}</span>
            </div>
            <p className="text-slate-500 text-sm">{facture.libelle as string}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">
              {Number(facture.montant_ttc).toLocaleString('fr-FR')} €
            </div>
            {!isReglee && reste > 0 && (
              <div className="text-sm text-amber-600 font-medium">
                Reste dû : {reste.toLocaleString('fr-FR')} €
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm">
            <User size={14} className="text-slate-400" />
            <Link href={`/eleves/${facture.personne_id}`} className="text-primary-600 hover:underline font-medium">
              {facture.prenom as string} {facture.nom as string}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={14} className="text-slate-400" />
            Émise le {formatDate(facture.date as string)}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={14} className="text-slate-400" />
            Échéance : {formatDate(facture.date_echeance as string)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lignes */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-700 text-sm">Détail des prestations</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">Désignation</th>
                  <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Qté</th>
                  <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">P.U.</th>
                  <th className="text-right px-5 py-2.5 font-medium text-slate-500 text-xs">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lignes.map(l => (
                  <tr key={l.id as string}>
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-slate-800">{l.libelle as string}</div>
                      <div className="text-xs text-slate-400">{l.code_produit as string}</div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-600">{Number(l.quantite)}</td>
                    <td className="px-5 py-2.5 text-right text-slate-600">{Number(l.prix_unitaire).toLocaleString('fr-FR')} €</td>
                    <td className="px-5 py-2.5 text-right font-medium text-slate-900">{Number(l.montant_ht).toLocaleString('fr-FR')} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-5 py-3 text-right font-semibold text-slate-700">Total HT (exonéré TVA)</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900">
                    {Number(facture.montant_ttc).toLocaleString('fr-FR')} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Règlements */}
        <div className="space-y-4">
          {/* Récap paiement */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">Récapitulatif</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total facture</span>
                <span className="font-medium">{Number(facture.montant_ttc).toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Encaissé</span>
                <span className="font-medium text-green-700">
                  {Number(facture.montant_regle).toLocaleString('fr-FR')} €
                </span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between">
                <span className="font-semibold text-slate-700">Reste dû</span>
                <span className={`font-bold ${reste > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {reste > 0 ? `${reste.toLocaleString('fr-FR')} €` : 'Soldé ✓'}
                </span>
              </div>
            </div>

            {/* Barre progression */}
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (Number(facture.montant_regle) / Number(facture.montant_ttc)) * 100)}%` }} />
            </div>
          </div>

          {/* Historique règlements */}
          {reglements.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
                <Euro size={14} />
                Règlements ({reglements.length})
              </h3>
              <div className="space-y-2">
                {reglements.map(r => (
                  <div key={r.id as string} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                    <div>
                      <div className="font-medium text-slate-700">{Number(r.montant).toLocaleString('fr-FR')} €</div>
                      <div className="text-xs text-slate-400">{MODES[r.mode as string] ?? r.mode as string} · {formatDate(r.date as string)}</div>
                    </div>
                    <span className="badge bg-green-100 text-green-700">✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulaire nouveau règlement */}
          {!isReglee && (
            <ReglementForm factureId={id} reste={reste} />
          )}
        </div>
      </div>
    </div>
  )
}
