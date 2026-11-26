'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { X, Phone, Mail, Clock, CreditCard, Calendar, ExternalLink } from 'lucide-react'

type EleveDetail = {
  id: string; prenom: string; nom: string; email: string | null
  tel_mobile: string | null; ville: string | null; date_inscription: string | null
  filiere: string | null; nb_heures: number; solde_credit: number
  code_obtenu: number; date_code: string | null
  derniers_creneaux: { date: string; heure_debut: string; heure_fin: string; produit_nom: string; ressource_nom: string }[]
}

export default function EleveDrawer() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const eleveId = params.get('eleve')
  const [eleve, setEleve] = useState<EleveDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!eleveId) { setEleve(null); return }
    setLoading(true)
    fetch(`/api/eleves/${eleveId}`)
      .then(r => r.json())
      .then(d => setEleve(d))
      .finally(() => setLoading(false))
  }, [eleveId])

  const close = () => {
    const p = new URLSearchParams(params.toString())
    p.delete('eleve')
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  if (!eleveId) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={close} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-white shadow-2xl flex flex-col
                      animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          {loading || !eleve ? (
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          ) : (
            <div>
              <h2 className="font-semibold text-slate-900">{eleve.prenom} {eleve.nom}</h2>
              <p className="text-xs text-slate-500">{eleve.filiere || '—'} · {eleve.ville || '—'}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            {eleve && (
              <a href={`/eleves/${eleve.id}`} target="_blank"
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

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${70 + i * 5}%` }} />
              ))}
            </div>
          )}

          {eleve && !loading && (
            <>
              {/* Infos contact */}
              <div className="space-y-2">
                {eleve.tel_mobile && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone size={14} className="text-slate-400 flex-shrink-0" />
                    <a href={`tel:${eleve.tel_mobile}`} className="text-primary-600 hover:underline">{eleve.tel_mobile}</a>
                  </div>
                )}
                {eleve.email && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail size={14} className="text-slate-400 flex-shrink-0" />
                    <a href={`mailto:${eleve.email}`} className="text-primary-600 hover:underline truncate">{eleve.email}</a>
                  </div>
                )}
                {eleve.date_inscription && (
                  <div className="flex items-center gap-2.5 text-sm text-slate-600">
                    <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                    Inscrit le {new Date(eleve.date_inscription + 'T12:00:00').toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Clock size={12} /> Heures de conduite
                  </div>
                  <div className="text-xl font-bold text-slate-900">{Number(eleve.nb_heures).toFixed(1)}h</div>
                </div>
                <div className={`rounded-lg p-3 ${Number(eleve.solde_credit) < 100 ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <CreditCard size={12} /> Solde crédit
                  </div>
                  <div className={`text-xl font-bold ${Number(eleve.solde_credit) < 100 ? 'text-red-700' : 'text-slate-900'}`}>
                    {Number(eleve.solde_credit).toLocaleString('fr-FR')} €
                  </div>
                </div>
              </div>

              {/* Code */}
              <div className="flex items-center gap-2">
                <span className={`badge text-sm py-1 px-3 ${eleve.code_obtenu ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                  {eleve.code_obtenu ? `✓ Code obtenu${eleve.date_code ? ` le ${new Date(eleve.date_code + 'T12:00:00').toLocaleDateString('fr-FR')}` : ''}` : 'Code en cours'}
                </span>
              </div>

              {/* Derniers créneaux */}
              {eleve.derniers_creneaux.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Dernières leçons</p>
                  <div className="space-y-1.5">
                    {eleve.derniers_creneaux.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50">
                        <div>
                          <span className="font-medium text-slate-800">{c.produit_nom}</span>
                          <span className="text-slate-400 text-xs ml-1">· {c.ressource_nom}</span>
                        </div>
                        <div className="text-xs text-slate-500 text-right">
                          <div>{new Date(c.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                          <div>{c.heure_debut.slice(0,5)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
