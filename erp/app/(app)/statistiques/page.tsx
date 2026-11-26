'use client'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Euro, Users, CalendarDays } from 'lucide-react'

const MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function BarChart({ data, keyVal, label, color = '#6366f1', unit = '' }: {
  data: Record<string, unknown>[]; keyVal: string; label: string; color?: string; unit?: string
}) {
  const vals = data.map(d => Number(d[keyVal] ?? 0))
  const max = Math.max(...vals, 1)
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-600 mb-3">{label}</h3>
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => {
          const h = Math.round((vals[i] / max) * 100)
          const mois = String(d.mois ?? '').slice(5, 7)
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute bottom-full mb-1 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                {unit === '€' ? Number(vals[i]).toLocaleString('fr-FR') + ' €' : vals[i] + (unit || '')}
              </div>
              <div className="w-full rounded-t transition-all" style={{ height: `${h}%`, backgroundColor: color, minHeight: vals[i] > 0 ? 4 : 0 }} />
              <span className="text-[9px] text-slate-400">{MOIS_COURT[parseInt(mois)-1] ?? mois}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StatistiquesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['statistiques'],
    queryFn: () => fetch('/api/statistiques').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  })

  const s = data?.synthese ?? {}
  const caParMois = data?.caParMois ?? []
  const heuresParMois = data?.heuresParMois ?? []
  const repartition = data?.repartitionFiliere ?? []
  const topProduits = data?.topProduits ?? []

  return (
    <div className="p-8 overflow-auto flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Statistiques</h1>
          <p className="text-slate-500 text-sm mt-0.5">Vue d'ensemble de l'activité</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'CA ce mois', val: `${Number(s.ca_mois ?? 0).toLocaleString('fr-FR')} €`, icon: Euro, cls: 'bg-green-100', icls: 'text-green-600' },
          { label: 'CA cette année', val: `${Number(s.ca_annee ?? 0).toLocaleString('fr-FR')} €`, icon: TrendingUp, cls: 'bg-blue-100', icls: 'text-blue-600' },
          { label: 'Séances cette sem.', val: s.seances_semaine ?? 0, icon: CalendarDays, cls: 'bg-violet-100', icls: 'text-violet-600' },
          { label: 'Inscrits (30j)', val: s.inscrits_mois ?? 0, icon: Users, cls: 'bg-amber-100', icls: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${k.cls} flex items-center justify-center flex-shrink-0`}>
              <k.icon size={20} className={k.icls} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{k.label}</p>
              <p className="text-lg font-bold text-slate-900">{isLoading ? '…' : k.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          {isLoading ? <div className="h-40 bg-slate-100 rounded animate-pulse" /> : (
            <BarChart data={caParMois} keyVal="ca_encaisse" label="CA encaissé par mois (€)" color="#22c55e" unit="€" />
          )}
        </div>
        <div className="card p-5">
          {isLoading ? <div className="h-40 bg-slate-100 rounded animate-pulse" /> : (
            <BarChart data={heuresParMois} keyVal="nb_seances" label="Séances par mois" color="#6366f1" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Répartition filières */}
        <div className="card p-5">
          <h3 className="text-sm font-medium text-slate-600 mb-4">Répartition par filière</h3>
          {isLoading ? <div className="h-32 bg-slate-100 rounded animate-pulse" /> : (
            <div className="space-y-3">
              {repartition.map((f: Record<string, unknown>) => {
                const pct = Math.round(Number(f.nb) / (data?.synthese?.total_eleves ?? 1) * 100)
                return (
                  <div key={f.filiere as string}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium">{f.filiere as string}</span>
                      <span className="text-slate-500">{f.nb as number} élèves · moy. {Number(f.moy_heures).toFixed(1)}h</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top produits */}
        <div className="card p-5">
          <h3 className="text-sm font-medium text-slate-600 mb-4">Top produits (3 derniers mois)</h3>
          {isLoading ? <div className="h-32 bg-slate-100 rounded animate-pulse" /> : (
            <div className="space-y-2">
              {topProduits.map((p: Record<string, unknown>, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-10">{p.code as string}</span>
                    <span className="text-slate-700 truncate max-w-[160px]">{p.nom as string}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-medium text-slate-800">{p.nb_seances as number}</span>
                    <span className="text-slate-400 text-xs ml-1">séances</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
