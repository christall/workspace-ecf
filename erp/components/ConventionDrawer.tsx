'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { X, ExternalLink, Users, Euro, Calendar, MapPin } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Stagiaire = { id: string; prenom: string; nom: string; email: string | null; tel_mobile: string | null; filiere: string | null; nb_heures: number; statut_presence: string }
type Convention = {
  id: string; designation: string; date_debut: string; date_fin: string
  montant_total: number; nb_places: number; statut: string
  activite_nom: string | null; type_action_nom: string | null; site_nom: string | null
  id_source_fplearn: number | null; id_source_plgfpro: number | null
}

const PRESENCE_LABELS: Record<string, { label: string; cls: string }> = {
  inscrit:  { label: 'Inscrit',    cls: 'bg-blue-100 text-blue-700' },
  present:  { label: 'Présent',    cls: 'bg-green-100 text-green-700' },
  absent:   { label: 'Absent',     cls: 'bg-red-100 text-red-700' },
  certifie: { label: 'Certifié',   cls: 'bg-violet-100 text-violet-700' },
}

export default function ConventionDrawer() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const convId = params.get('convention')
  const [data, setData] = useState<{ convention: Convention; stagiaires: Stagiaire[] } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!convId) { setData(null); return }
    setLoading(true)
    fetch(`/api/conventions/${convId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [convId])

  const close = () => {
    const p = new URLSearchParams(params.toString())
    p.delete('convention')
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  if (!convId) return null

  const conv = data?.convention
  const stagiaires = data?.stagiaires ?? []

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={close} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[460px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          {loading || !conv ? (
            <div className="h-5 w-56 bg-slate-200 rounded animate-pulse" />
          ) : (
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">{conv.designation}</h2>
              {conv.activite_nom && (
                <p className="text-xs text-primary-600 font-medium mt-0.5">{conv.activite_nom}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {conv?.id_source_fplearn && (
              <span className="text-xs text-slate-400 font-mono">fplearn #{conv.id_source_fplearn}</span>
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
              {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + i * 6}%` }} />)}
            </div>
          )}

          {conv && !loading && (
            <>
              {/* Infos principales */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Calendar size={12} /> Période</div>
                  <div className="text-sm font-medium text-slate-800">
                    {formatDate(conv.date_debut)}
                    {conv.date_fin && conv.date_fin !== conv.date_debut && ` → ${formatDate(conv.date_fin)}`}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Users size={12} /> Stagiaires</div>
                  <div className="text-xl font-bold text-slate-900">{stagiaires.length}<span className="text-sm font-normal text-slate-400">/{conv.nb_places || '?'}</span></div>
                </div>
                {conv.montant_total > 0 && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><Euro size={12} /> Montant</div>
                    <div className="text-lg font-bold text-green-800">{Number(conv.montant_total).toLocaleString('fr-FR')} €</div>
                  </div>
                )}
                {conv.site_nom && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><MapPin size={12} /> Site</div>
                    <div className="text-sm font-medium text-slate-800 truncate">{conv.site_nom}</div>
                  </div>
                )}
              </div>

              {conv.type_action_nom && (
                <div className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">Type : </span>{conv.type_action_nom}
                </div>
              )}

              {/* Stagiaires */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Stagiaires ({stagiaires.length})
                  </p>
                </div>
                {stagiaires.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aucun stagiaire lié</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    {stagiaires.map(st => {
                      const pr = PRESENCE_LABELS[st.statut_presence] ?? PRESENCE_LABELS.inscrit
                      return (
                        <div key={st.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                          <div className="min-w-0">
                            {st.prenom || st.nom ? (
                              <>
                                <div className="text-sm font-medium text-slate-800">{st.prenom} {st.nom}</div>
                                {(st.email || st.tel_mobile) && (
                                  <div className="text-xs text-slate-400 truncate">{st.email || st.tel_mobile}</div>
                                )}
                              </>
                            ) : (
                              <div className="text-sm text-slate-400 italic">Stagiaire non lié</div>
                            )}
                          </div>
                          <span className={`badge flex-shrink-0 ml-2 ${pr.cls}`}>{pr.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
