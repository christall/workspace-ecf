'use client'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useScrollRestore } from '@/lib/useScrollRestore'
import { formatDate } from '@/lib/utils'
import { Search, BookOpen, TrendingUp, Award, UserCheck } from 'lucide-react'
import EleveDrawer from '@/components/planning/EleveDrawer'

const STADE_TABS = [
  { value: '', label: 'Tous' },
  { value: 'debutant', label: '< 10h' },
  { value: 'intermediaire', label: '10–30h' },
  { value: 'pret_examen', label: 'Prêt examen' },
]

function PedagogieContent() {
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('q') || ''
  const filiere = params.get('filiere') || ''
  const stade = params.get('stade') || ''
  const page = parseInt(params.get('page') || '1')

  const scrollRef = useScrollRestore(`pedagogie:${params.toString()}`)

  const { data, isLoading } = useQuery({
    queryKey: ['pedagogie', q, filiere, stade, page],
    queryFn: () => fetch(`/api/pedagogie?${params.toString()}`).then(r => r.json()),
  })

  const push = (updates: Record<string, string>) => {
    const p = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    p.delete('page')
    router.push(`/pedagogie?${p.toString()}`, { scroll: false })
  }

  const stats = data?.statsGlobales ?? {}
  const eleves = data?.eleves ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 30)
  const filieres = data?.filieres ?? []

  const stadeLabel = (h: number, code: number) => {
    if (code) return { label: 'Code ✓', cls: 'bg-green-100 text-green-700' }
    if (h < 5) return { label: 'Débutant', cls: 'bg-slate-100 text-slate-600' }
    if (h < 15) return { label: 'Intermédiaire', cls: 'bg-blue-100 text-blue-700' }
    if (h < 25) return { label: 'Avancé', cls: 'bg-violet-100 text-violet-700' }
    return { label: 'Prêt examen', cls: 'bg-amber-100 text-amber-700' }
  }

  return (
    <div ref={scrollRef} className="p-8 overflow-auto flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pédagogie</h1>
          <p className="text-slate-500 text-sm mt-0.5">Suivi de progression des élèves</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Moy. heures', val: Number(stats.moy_heures ?? 0).toFixed(1) + 'h', icon: TrendingUp, cls: 'bg-blue-100', icls: 'text-blue-600' },
          { label: 'Codes obtenus', val: stats.avec_code ?? 0, icon: Award, cls: 'bg-green-100', icls: 'text-green-600' },
          { label: 'Prêts examen', val: stats.prets_examen ?? 0, icon: UserCheck, cls: 'bg-amber-100', icls: 'text-amber-600' },
          { label: 'Nouveaux (60j)', val: stats.nouveaux ?? 0, icon: BookOpen, cls: 'bg-violet-100', icls: 'text-violet-600' },
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

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" defaultValue={q} placeholder="Nom ou prénom…"
            onKeyDown={e => e.key === 'Enter' && push({ q: (e.target as HTMLInputElement).value })}
            onBlur={e => e.target.value !== q && push({ q: e.target.value })}
            className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filiere} onChange={e => push({ filiere: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Toutes filières</option>
          {filieres.map((f: {filiere:string}) => <option key={f.filiere} value={f.filiere}>{f.filiere}</option>)}
        </select>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          {STADE_TABS.map(t => (
            <button key={t.value} onClick={() => push({ stade: t.value })}
              className={`px-3 py-2 text-xs transition-colors ${stade === t.value ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Élève</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Filière</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Stade</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Heures</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Séances</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Dernière leçon</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && [...Array(8)].map((_, i) => (
              <tr key={i}>{[...Array(6)].map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
              ))}</tr>
            ))}
            {!isLoading && eleves.map((e: Record<string, unknown>) => {
              const { label, cls } = stadeLabel(Number(e.nb_heures), Number(e.code_obtenu))
              return (
                <tr key={e.id as string} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{e.prenom as string} {e.nom as string}</td>
                  <td className="px-4 py-3 text-slate-500 text-sm">{e.filiere as string || '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${cls}`}>{label}</span></td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{Number(e.nb_heures).toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-slate-500">{e.nb_seances as number}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">
                    {e.derniere_lecon ? formatDate(e.derniere_lecon as string) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => push({ eleve: e.id as string })}
                      className="text-xs text-primary-600 hover:underline font-medium">Voir →</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {page} / {totalPages} — {total} élèves</span>
            <div className="flex gap-2">
              {page > 1 && <button onClick={() => push({ page: String(page-1) })} className="btn-ghost py-1 px-3">← Préc.</button>}
              {page < totalPages && <button onClick={() => push({ page: String(page+1) })} className="btn-ghost py-1 px-3">Suiv. →</button>}
            </div>
          </div>
        )}
      </div>
      <Suspense><EleveDrawer /></Suspense>
    </div>
  )
}

export default function PedagogiePage() {
  return <Suspense fallback={<div className="p-8 flex-1"><div className="h-8 w-32 bg-slate-200 rounded animate-pulse" /></div>}><PedagogieContent /></Suspense>
}
