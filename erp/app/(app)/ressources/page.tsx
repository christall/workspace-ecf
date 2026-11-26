'use client'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Car, User, Activity, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

function RessourcesContent() {
  const router = useRouter()
  const params = useSearchParams()
  const type = params.get('type') || ''

  const { data, isLoading } = useQuery({
    queryKey: ['ressources'],
    queryFn: () => fetch('/api/ressources').then(r => r.json()),
  })

  const push = (updates: Record<string, string>) => {
    const p = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    router.push(`/ressources?${p.toString()}`, { scroll: false })
  }

  const all: Record<string, unknown>[] = data?.ressources ?? []
  const filtered = type ? all.filter(r => r.type === type) : all
  const moniteurs = all.filter(r => r.type === 'moniteur')
  const vehicules = all.filter(r => r.type === 'vehicule')

  const TYPE_TABS = [
    { value: '', label: `Tous (${all.length})` },
    { value: 'moniteur', label: `Moniteurs (${moniteurs.length})` },
    { value: 'vehicule', label: `Véhicules (${vehicules.length})` },
  ]

  return (
    <div className="p-8 overflow-auto flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ressources</h1>
          <p className="text-slate-500 text-sm mt-0.5">{all.length} ressource{all.length > 1 ? 's' : ''} actives</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Moniteurs', val: moniteurs.length, icon: User, cls: 'bg-blue-100', icls: 'text-blue-600' },
          { label: 'Véhicules', val: vehicules.length, icon: Car, cls: 'bg-slate-100', icls: 'text-slate-600' },
          { label: 'Séances cette semaine', val: all.reduce((s, r) => s + Number(r.seances_semaine ?? 0), 0), icon: Activity, cls: 'bg-green-100', icls: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.cls} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.icls} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-xl font-bold text-slate-900">{isLoading ? '…' : s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border border-slate-200 rounded-lg overflow-hidden mb-4 w-fit">
        {TYPE_TABS.map(t => (
          <button key={t.value} onClick={() => push({ type: t.value })}
            className={`px-4 py-2 text-sm transition-colors ${type === t.value ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Grille */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r: Record<string, unknown>) => (
            <div key={r.id as string} className={`card p-4 ${!r.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: (r.couleur_hex as string) + '22' }}>
                  {r.type === 'moniteur'
                    ? <User size={18} style={{ color: r.couleur_hex as string }} />
                    : <Car size={18} style={{ color: r.couleur_hex as string }} />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 text-sm truncate">{r.nom as string}</div>
                  <div className="text-xs text-slate-400">{r.code as string}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-slate-50 rounded p-2">
                  <div className="font-bold text-slate-800">{r.seances_semaine as number}</div>
                  <div className="text-slate-400">cette sem.</div>
                </div>
                <div className="bg-slate-50 rounded p-2">
                  <div className="font-bold text-slate-800">{r.seances_mois as number}</div>
                  <div className="text-slate-400">ce mois</div>
                </div>
              </div>
              {r.derniere_seance && (
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <Calendar size={11} />
                  {formatDate(r.derniere_seance as string)}
                </div>
              )}
              {r.seances_futures ? (
                <div className="mt-1 text-xs text-primary-600 font-medium">{r.seances_futures as number} séance{Number(r.seances_futures)>1?'s':''} à venir</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RessourcesPage() {
  return <Suspense fallback={<div className="p-8 flex-1"><div className="h-8 w-32 bg-slate-200 rounded animate-pulse" /></div>}><RessourcesContent /></Suspense>
}
