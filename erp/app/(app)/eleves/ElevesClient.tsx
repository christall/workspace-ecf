'use client'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useScrollRestore } from '@/lib/useScrollRestore'
import { formatDate, initiales } from '@/lib/utils'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { Suspense } from 'react'
import EleveDrawer from '@/components/planning/EleveDrawer'

function SortHeader({ label, col, sort, order, onSort }: {
  label: string; col: string; sort: string; order: string
  onSort: (col: string) => void
}) {
  const active = sort === col
  const Icon = active ? (order === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th className="text-left px-4 py-3 font-medium text-slate-600">
      <button onClick={() => onSort(col)}
        className="flex items-center gap-1 hover:text-slate-900 transition-colors whitespace-nowrap">
        {label}<Icon size={13} className={active ? 'text-primary-600' : 'text-slate-400'} />
      </button>
    </th>
  )
}

const filiereColor = (f: unknown) => {
  if (f === 'AAC') return 'bg-violet-100 text-violet-700'
  if (String(f).startsWith('Tradition')) return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

export default function ElevesPage() {
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('q') || ''
  const filiere = params.get('filiere') || ''
  const code = params.get('code') || ''
  const annee = params.get('annee') || ''
  const sort = params.get('sort') || 'inscription'
  const order = params.get('order') || 'desc'
  const page = parseInt(params.get('page') || '1')

  const scrollRef = useScrollRestore(`eleves:${params.toString()}`)

  const { data, isLoading } = useQuery({
    queryKey: ['eleves', q, filiere, code, annee, sort, order, page],
    queryFn: () => fetch(`/api/eleves?${params.toString()}`).then(r => r.json()),
  })

  const push = (updates: Record<string, string>) => {
    const p = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    p.delete('page')
    router.push(`/eleves?${p.toString()}`, { scroll: false })
  }

  const onSort = (col: string) => {
    const newOrder = sort === col && order === 'asc' ? 'desc' : 'asc'
    push({ sort: col, order: newOrder })
  }

  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 25)
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 4 }, (_, i) => String(thisYear - i))

  return (
    <div ref={scrollRef} className="p-8 overflow-auto flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Élèves</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isLoading ? '…' : `${total} élève${total > 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn-primary">+ Nouvel élève</button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" defaultValue={q} placeholder="Nom, prénom, email, tél…"
            onKeyDown={e => e.key === 'Enter' && push({ q: (e.target as HTMLInputElement).value })}
            onBlur={e => e.target.value !== q && push({ q: e.target.value })}
            className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-64
                       focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filiere} onChange={e => push({ filiere: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Toutes filières</option>
          {(data?.filieres ?? []).map((f: { filiere: string }) => (
            <option key={f.filiere} value={f.filiere}>{f.filiere}</option>
          ))}
        </select>
        <select value={annee} onChange={e => push({ annee: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Toutes années</option>
          {years.map(y => <option key={y} value={y}>Inscrits {y}</option>)}
        </select>
        <select value={code} onChange={e => push({ code: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Code : tous</option>
          <option value="oui">Code obtenu ✓</option>
          <option value="non">Code en cours</option>
        </select>
        {(q || filiere || code || annee) && (
          <button onClick={() => router.push('/eleves', { scroll: false })}
            className="btn-ghost py-2 px-3 text-slate-500">✕ Réinitialiser</button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <SortHeader label="Élève" col="nom" sort={sort} order={order} onSort={onSort} />
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Filière</th>
              <SortHeader label="Heures" col="heures" sort={sort} order={order} onSort={onSort} />
              <SortHeader label="Solde" col="solde" sort={sort} order={order} onSort={onSort} />
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Code</th>
              <SortHeader label="Inscription" col="inscription" sort={sort} order={order} onSort={onSort} />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && [...Array(8)].map((_, i) => (
              <tr key={i}>
                {[...Array(7)].map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + j * 5}%` }} />
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && (data?.eleves ?? []).map((e: Record<string, unknown>) => (
              <tr key={e.id as string} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 text-xs font-bold">
                        {initiales(e.prenom as string, e.nom as string)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{e.prenom as string} {e.nom as string}</div>
                      <div className="text-xs text-slate-400">{e.ville as string}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                  <div className="text-xs">{e.tel_mobile as string}</div>
                  <div className="text-xs text-slate-400 truncate max-w-[160px]">{e.email as string}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${filiereColor(e.filiere)}`}>{(e.filiere as string) || '—'}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">{Number(e.nb_heures).toFixed(1)}h</td>
                <td className="px-4 py-3 text-right">
                  <span className={Number(e.solde_credit) < 100 ? 'text-red-600 font-medium' : 'text-slate-700'}>
                    {Number(e.solde_credit).toLocaleString('fr-FR')} €
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {e.code_obtenu
                    ? <span className="badge bg-green-100 text-green-700">✓</span>
                    : <span className="badge bg-slate-100 text-slate-500">–</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(e.date_inscription as string)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => push({ eleve: e.id as string })}
                    className="text-xs text-primary-600 hover:underline font-medium">
                    Voir →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {page} / {totalPages} — {total} élèves</span>
            <div className="flex gap-2">
              {page > 1 && <button onClick={() => push({ page: String(page - 1) })} className="btn-ghost py-1 px-3">← Préc.</button>}
              {page < totalPages && <button onClick={() => push({ page: String(page + 1) })} className="btn-ghost py-1 px-3">Suiv. →</button>}
            </div>
          </div>
        )}
      </div>
      <Suspense><EleveDrawer /></Suspense>
    </div>
  )
}
