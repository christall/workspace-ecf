'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, ExternalLink, CheckCircle2, Clock, AlertTriangle, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Ligne = { designation: string; quantite: number; prix_unitaire: number; montant: number }
type Reglement = { date: string; montant: number; mode: string; reference: string | null }
type Facture = {
  id: string; numero: number; date: string; date_echeance: string; statut: string
  montant_ht: number; montant_tva: number; montant_ttc: number; montant_regle: number
  prenom: string; nom: string; personne_id: string
  lignes: Ligne[]; reglements: Reglement[]
}

const STATUTS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  emise:    { label: 'Émise',     cls: 'bg-blue-100 text-blue-700',   icon: Clock },
  partielle:{ label: 'Partielle', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  en_retard:{ label: 'En retard', cls: 'bg-red-100 text-red-700',     icon: AlertTriangle },
  reglee:   { label: 'Réglée',   cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
}

const MODES: Record<string, string> = {
  cheque: 'Chèque', especes: 'Espèces', cb: 'CB',
  virement: 'Virement', prelevement: 'Prélèvement',
}

export default function FactureDrawer() {
  const params = useSearchParams()
  const router = useRouter()
  const factureId = params.get('facture')
  const [facture, setFacture] = useState<Facture | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!factureId) { setFacture(null); return }
    setLoading(true)
    fetch(`/api/facturation/${factureId}`)
      .then(r => r.json())
      .then(d => setFacture(d.facture ? { ...d.facture, lignes: d.lignes, reglements: d.reglements } : null))
      .finally(() => setLoading(false))
  }, [factureId])

  const close = () => {
    const p = new URLSearchParams(params.toString())
    p.delete('facture')
    router.replace(`/facturation?${p.toString()}`, { scroll: false })
  }

  if (!factureId) return null

  const reste = facture ? Math.max(0, facture.montant_ttc - facture.montant_regle) : 0
  const s = facture ? (STATUTS[facture.statut] ?? STATUTS.emise) : null
  const SIcon = s?.icon ?? Clock

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={close} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          {loading || !facture ? (
            <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
          ) : (
            <div>
              <h2 className="font-semibold text-slate-900">
                Facture #{String(facture.numero).padStart(4, '0')}
              </h2>
              <p className="text-xs text-slate-500">{facture.prenom} {facture.nom} · {formatDate(facture.date)}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            {facture && (
              <a href={`/facturation/${facture.id}`} target="_blank"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Ouvrir la fiche complète">
                <ExternalLink size={15} />
              </a>
            )}
            <button onClick={close}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${65 + i * 5}%` }} />
              ))}
            </div>
          )}

          {facture && !loading && (
            <>
              {/* Statut + montants */}
              <div className="flex items-start justify-between">
                <span className={`badge gap-1.5 text-sm py-1.5 px-3 ${s?.cls}`}>
                  <SIcon size={13} />{s?.label}
                </span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">
                    {Number(facture.montant_ttc).toLocaleString('fr-FR')} €
                  </div>
                  {reste > 0 && (
                    <div className="text-sm text-amber-700 font-medium">
                      Reste dû : {reste.toLocaleString('fr-FR')} €
                    </div>
                  )}
                </div>
              </div>

              {/* Échéance */}
              {facture.date_echeance && (
                <div className={`text-sm ${facture.statut === 'en_retard' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                  Échéance : {formatDate(facture.date_echeance)}
                </div>
              )}

              {/* Lignes */}
              {facture.lignes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Détail</p>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                    {facture.lignes.map((l, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <div className="text-slate-800">{l.designation}</div>
                          {l.quantite !== 1 && <div className="text-xs text-slate-400">{l.quantite} × {Number(l.prix_unitaire).toLocaleString('fr-FR')} €</div>}
                        </div>
                        <div className="font-medium text-slate-900">{Number(l.montant).toLocaleString('fr-FR')} €</div>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 text-sm bg-slate-50">
                      <span className="text-slate-500">Total TTC</span>
                      <span className="font-bold text-slate-900">{Number(facture.montant_ttc).toLocaleString('fr-FR')} €</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Règlements */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Règlements {facture.reglements.length > 0 ? `(${facture.reglements.length})` : ''}
                </p>
                {facture.reglements.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aucun règlement enregistré</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                    {facture.reglements.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <div className="text-slate-700">{MODES[r.mode] ?? r.mode}</div>
                          <div className="text-xs text-slate-400">{formatDate(r.date)}{r.reference ? ` · ${r.reference}` : ''}</div>
                        </div>
                        <div className="font-medium text-green-700">+{Number(r.montant).toLocaleString('fr-FR')} €</div>
                      </div>
                    ))}
                  </div>
                )}
                {reste > 0 && (
                  <button className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-sm text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors">
                    <Plus size={14} /> Enregistrer un règlement
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
