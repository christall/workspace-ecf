'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { ClipboardList, CheckCircle2, Clock, Users, CalendarDays } from 'lucide-react'

const PERIODE_TABS = [
  { value: 'futur', label: 'À venir' },
  { value: 'mois', label: '30 derniers jours' },
  { value: 'passe', label: 'Historique' },
]

const EXAM_LABELS: Record<string, string> = {
  AE: 'Exam. théorique', EI: 'Éval. initiale', RVP: 'RDV pédago pratique',
  RVPT: 'RDV pédago théo', RETG: 'Redev. ETG', RVT2: 'RDV théo 2', RVPr: 'RDV préalable',
}

export default function ExamensPage() {
  const [periode, setPeriode] = useState('futur')

  const { data, isLoading } = useQuery({
    queryKey: ['examens', periode],
    queryFn: () => fetch(`/api/examens?periode=${periode}`).then(r => r.json()),
  })

  const stats = data?.stats ?? {}
  const creneaux = data?.creneaux ?? []
  const recents = data?.recents ?? []

  // Grouper les créneaux par date
  const byDate: Record<string, typeof creneaux> = {}
  for (const c of creneaux) {
    if (!byDate[c.date]) byDate[c.date] = []
    byDate[c.date].push(c)
  }

  return (
    <div className="p-8 overflow-auto flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Examens</h1>
          <p className="text-slate-500 text-sm mt-0.5">Suivi des passages et résultats</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Codes obtenus', val: stats.codes_obtenus ?? 0, icon: CheckCircle2, cls: 'bg-green-100', icls: 'text-green-600' },
          { label: 'En formation', val: stats.en_formation ?? 0, icon: Clock, cls: 'bg-blue-100', icls: 'text-blue-600' },
          { label: 'Total élèves', val: stats.total_eleves ?? 0, icon: Users, cls: 'bg-slate-100', icls: 'text-slate-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.cls} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.icls} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-xl font-bold text-slate-900">{isLoading ? '…' : Number(s.val).toLocaleString('fr-FR')}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Colonne principale : créneaux */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-400" /> Créneaux
            </h2>
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              {PERIODE_TABS.map(t => (
                <button key={t.value} onClick={() => setPeriode(t.value)}
                  className={`px-3 py-1.5 text-xs transition-colors ${periode === t.value ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : Object.keys(byDate).length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
              Aucun créneau d'examen {periode === 'futur' ? 'à venir' : 'sur la période'}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byDate).map(([date, items]) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="space-y-1.5">
                    {items.map((c: Record<string, unknown>) => (
                      <div key={c.id as string} className="card p-3 flex items-center gap-3">
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: c.couleur_hex as string }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{EXAM_LABELS[c.produit_code as string] ?? c.produit_nom as string}</span>
                            <span className="text-xs text-slate-400">{String(c.heure_debut).slice(0,5)}</span>
                          </div>
                          {c.prenom && (
                            <div className="text-xs text-slate-500">{c.prenom as string} {c.nom_eleve as string} · {c.filiere as string}</div>
                          )}
                        </div>
                        {c.ressource_nom && (
                          <span className="text-xs text-slate-400 flex-shrink-0">{c.ressource_nom as string}</span>
                        )}
                        {c.code_obtenu ? (
                          <span className="badge bg-green-100 text-green-700 flex-shrink-0">✓ Code</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colonne : codes récemment obtenus */}
        <div>
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" /> Codes récents
          </h2>
          <div className="space-y-2">
            {recents.length === 0 && !isLoading && (
              <p className="text-sm text-slate-400 italic">Aucun résultat récent</p>
            )}
            {recents.map((e: Record<string, unknown>, i: number) => (
              <div key={i} className="card p-3">
                <div className="font-medium text-slate-800 text-sm">{e.prenom as string} {e.nom as string}</div>
                <div className="text-xs text-slate-500">{e.filiere as string}</div>
                {e.date_code && (
                  <div className="text-xs text-green-600 mt-1">✓ {formatDate(e.date_code as string)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
