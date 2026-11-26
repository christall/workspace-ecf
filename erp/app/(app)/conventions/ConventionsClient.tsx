'use client'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useScrollRestore } from '@/lib/useScrollRestore'
import { formatDate } from '@/lib/utils'
import { Search, FileText, Users, Euro, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import ConventionDrawer from '@/components/ConventionDrawer'

const STATUT_TABS = [
  { value: '', label: 'Toutes' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminées' },
  { value: 'annulee', label: 'Annulées' },
]

function SortTh({ label, col, sort, order, onSort }: { label: string; col: string; sort: string; order: string; onSort: (c: string) => void }) {
  const active = sort === col
  const Icon = active ? (order === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th className="text-left px-4 py-3 font-medium text-slate-600">
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-slate-900 whitespace-nowrap">
        {label}<Icon size={13} className={active ? 'text-primary-600' : 'text-slate-400'} />
      </button>
    </th>
  )
}

export default function ConventionsClient() {
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('q') || ''
  const activite = params.get('activite') || ''
  const statut = params.get('statut') || ''
  const du = params.get('du') || ''
  const au = params.get('au') || ''
  const sort = params.get('sort') || 'date_debut'
  const order = params.get('order') || 'desc'
  const page = parseInt(params.get('page') || '1')

  const scrollRef = useScrollRestore(`conventions:${params.toString()}`)

  const { data, isLoading } = useQuery({
    queryKey: ['conventions', q, activite, statut, du, au, sort, order, page],
    queryFn: () => fetch(`/api/conventions?${params.toString()}`).then(r => r.json()),
  })

  const push = (updates: Record<string, string>) => {
    const p = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    if (!('page' in updates)) p.delete('page')
    router.push(`/conventions?${p.toString()}`, { scroll: false })
  }

  const onSort = (col: string) => push({ sort: col, order: sort === col && order === 'asc' ? 'desc' : 'asc' })

  const stats = data?.stats ?? {}
  const conventions: Record<string, unknown>[] = data?.conventions ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 25)
  const activites: { activite_nom: string }[] = data?.activites ?? []

  const dureeLabel = (debut: string, fin: string) => {
    if (!debut || !fin) return null
    const d1 = new Date(debut + 'T12:00:00')
    const d2 = new Date(fin + 'T12:00:00')
    const days = Math.round((d2.getTime() - d1.getTime()) / 86400000)
    if (days <= 0) return '1 jour'
    if (days < 7) return `${days} j`
    if (days < 30) return `${Math.round(days / 7)} sem.`
    return `${Math.round(days / 30)} mois`
  }

  return (
    <div ref={scrollRef} className="p-8 overflow-auto flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conventions</h1>
          <p className="text-slate-500 text-sm mt-0.5">{isLoading ? '…' : `${total} convention${total > 1 ? 's' : ''} de formation`}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total conventions', val: stats.total ?? 0, icon: FileText, cls: 'bg-blue-100', icls: 'text-blue-600' },
          { label: 'En cours', val: stats.en_cours ?? 0, icon: FileText, cls: 'bg-amber-100', icls: 'text-amber-600' },
          { label: 'Total stagiaires', val: stats.total_stagiaires ?? 0, icon: Users, cls: 'bg-violet-100', icls: 'text-violet-600' },
          { label: 'CA conventions', val: `${Number(stats.ca_total ?? 0).toLocaleString('fr-FR')} €`, icon: Euro, cls: 'bg-green-100', icls: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.cls} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.icls} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-lg font-bold text-slate-900">{isLoading ? '…' : s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" defaultValue={q} placeholder="Désignation, activité, site…"
            onKeyDown={e => e.key === 'Enter' && push({ q: (e.target as HTMLInputElement).value })}
            onBlur={e => e.target.value !== q && push({ q: e.target.value })}
            className="pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={activite} onChange={e => push({ activite: e.target.value })}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[200px]">
          <option value="">Toutes activités</option>
          {activites.map(a => <option key={a.activite_nom} value={a.activite_nom}>{a.activite_nom}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <input type="date" defaultValue={du} onBlur={e => push({ du: e.target.value })}
            className="px-2 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <span className="text-xs text-slate-400">→</span>
          <input type="date" defaultValue={au} onBlur={e => push({ au: e.target.value })}
            className="px-2 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        {(q || activite || du || au) && (
          <button onClick={() => router.push('/conventions', { scroll: false })}
            className="btn-ghost py-2 px-3 text-slate-500">✕</button>
        )}
        {/* Statuts */}
        <div className="flex border border-slate-200 rounded-lg overflow-hidden ml-auto">
          {STATUT_TABS.map(t => (
            <button key={t.value} onClick={() => push({ statut: t.value })}
              className={`px-3 py-2 text-xs transition-colors ${statut === t.value ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
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
              <SortTh label="Convention" col="designation" sort={sort} order={order} onSort={onSort} />
              <SortTh label="Activité" col="activite" sort={sort} order={order} onSort={onSort} />
              <SortTh label="Début" col="date_debut" sort={sort} order={order} onSort={onSort} />
              <th className="text-left px-4 py-3 font-medium text-slate-600">Durée</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Site</th>
              <SortTh label="Stagiaires" col="stagiaires" sort={sort} order={order} onSort={onSort} />
              <SortTh label="Montant" col="montant" sort={sort} order={order} onSort={onSort} />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && [...Array(8)].map((_, i) => (
              <tr key={i}>{[...Array(7)].map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
              ))}</tr>
            ))}
            {!isLoading && conventions.map(c => (
              <tr key={c.id as string} className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => push({ convention: c.id as string })}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 truncate max-w-[260px]" title={c.designation as string}>
                    {c.designation as string}
                  </div>
                  {c.type_action_nom && (
                    <div className="text-xs text-slate-400 truncate max-w-[260px]">{c.type_action_nom as string}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.activite_nom
                    ? <span className="badge bg-violet-100 text-violet-700 max-w-[140px] truncate block">{c.activite_nom as string}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(c.date_debut as string)}</td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                  {dureeLabel(c.date_debut as string, c.date_fin as string) || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell truncate max-w-[120px]">
                  {c.site_nom as string || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Users size={13} className="text-slate-400" />
                    <span className="font-medium text-slate-700">{c.nb_stagiaires as number}</span>
                    {c.nb_places && Number(c.nb_places) > 0 && (
                      <span className="text-slate-400 text-xs">/{c.nb_places as number}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {Number(c.montant_total) > 0
                    ? <span className="font-medium text-slate-800">{Number(c.montant_total).toLocaleString('fr-FR')} €</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-primary-600 font-medium">Voir →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {page} / {totalPages} — {total} conventions</span>
            <div className="flex gap-2">
              {page > 1 && <button onClick={() => push({ page: String(page - 1) })} className="btn-ghost py-1 px-3">← Préc.</button>}
              {page < totalPages && <button onClick={() => push({ page: String(page + 1) })} className="btn-ghost py-1 px-3">Suiv. →</button>}
            </div>
          </div>
        )}
      </div>

      <Suspense><ConventionDrawer /></Suspense>
    </div>
  )
}
