'use client'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useScrollRestore } from '@/lib/useScrollRestore'
import { formatDate, initiales } from '@/lib/utils'
import { Suspense } from 'react'
import FactureDrawer from '@/components/FactureDrawer'
import { Search, Euro, AlertTriangle, Clock, CheckCircle2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

const STATUTS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  emise:    { label: 'Émise',     cls: 'bg-blue-100 text-blue-700',   icon: Clock },
  partielle:{ label: 'Partielle', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  en_retard:{ label: 'En retard', cls: 'bg-red-100 text-red-700',     icon: AlertTriangle },
  reglee:   { label: 'Réglée',   cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
}

function SortTh({ label, col, sort, order, onSort }: {
  label: string; col: string; sort: string; order: string; onSort: (c: string) => void
}) {
  const active = sort === col
  const Icon = active ? (order === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th className="text-left px-4 py-3 font-medium text-slate-600">
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-slate-900 transition-colors whitespace-nowrap">
        {label}<Icon size={13} className={active ? 'text-primary-600' : 'text-slate-400'} />
      </button>
    </th>
  )
}

export default function FacturationPage() {
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('q') || ''
  const statut = params.get('statut') || ''
  const sort = params.get('sort') || 'date'
  const order = params.get('order') || 'desc'
  const du = params.get('du') || ''
  const au = params.get('au') || ''
  const page = parseInt(params.get('page') || '1')

  const scrollRef = useScrollRestore(`facturation:${params.toString()}`)

  const { data, isLoading } = useQuery({
    queryKey: ['facturation', q, statut, sort, order, du, au, page],
    queryFn: () => fetch(`/api/facturation?${params.toString()}`).then(r => r.json()),
  })

  const push = (updates: Record<string, string>) => {
    const p = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    if (!('page' in updates)) p.delete('page')
    router.push(`/facturation?${p.toString()}`, { scroll: false })
  }

  const onSort = (col: string) => {
    push({ sort: col, order: sort === col && order === 'asc' ? 'desc' : 'asc' })
  }

  const stats = data?.stats ?? {}
  const factures = data?.factures ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 25)

  const STATUT_TABS = [
    { value: '', label: 'Toutes' },
    { value: 'emise', label: 'Émises' },
    { value: 'partielle', label: 'Partielles' },
    { value: 'en_retard', label: 'En retard' },
    { value: 'reglee', label: 'Réglées' },
  ]

  return (
    <div ref={scrollRef} className="p-8 overflow-auto flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturation</h1>
          <p className="text-slate-500 text-sm mt-0.5">{isLoading ? '…' : `${total} facture${total > 1 ? 's' : ''}`}</p>
        </div>
        <button className="btn-primary">+ Nouvelle facture</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'À encaisser', val: stats.a_encaisser ?? 0, icon: Euro, cls: 'bg-blue-100', icls: 'text-blue-600' },
          { label: 'En retard', val: stats.en_retard ?? 0, icon: AlertTriangle, cls: 'bg-red-100', icls: 'text-red-600', bold: true },
          { label: 'Encaissé ce mois', val: stats.encaisse_mois ?? 0, icon: CheckCircle2, cls: 'bg-green-100', icls: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.cls} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.icls} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-lg font-bold ${s.bold ? 'text-red-700' : 'text-slate-900'}`}>
                {isLoading ? '…' : `${Number(s.val).toLocaleString('fr-FR')} €`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" defaultValue={q} placeholder="Élève ou n° facture…"
              onKeyDown={e => e.key === 'Enter' && push({ q: (e.target as HTMLInputElement).value })}
              onBlur={e => e.target.value !== q && push({ q: e.target.value })}
              className="pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">Du</label>
            <input type="date" defaultValue={du}
              onBlur={e => push({ du: e.target.value })}
              className="px-2 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <label className="text-xs text-slate-500">au</label>
            <input type="date" defaultValue={au}
              onBlur={e => push({ au: e.target.value })}
              className="px-2 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {(q || du || au) && (
            <button onClick={() => push({ q: '', du: '', au: '' })} className="btn-ghost py-2 px-3 text-slate-500">✕</button>
          )}
        </div>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
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
              <SortTh label="N°" col="numero" sort={sort} order={order} onSort={onSort} />
              <SortTh label="Élève" col="eleve" sort={sort} order={order} onSort={onSort} />
              <SortTh label="Date" col="date" sort={sort} order={order} onSort={onSort} />
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Échéance</th>
              <SortTh label="Montant" col="montant" sort={sort} order={order} onSort={onSort} />
              <SortTh label="Reste dû" col="reste" sort={sort} order={order} onSort={onSort} />
              <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && [...Array(8)].map((_, i) => (
              <tr key={i}>{[...Array(7)].map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
              ))}</tr>
            ))}
            {!isLoading && factures.map((f: Record<string, unknown>) => {
              const reste = Math.max(0, Number(f.montant_ttc) - Number(f.montant_regle))
              const s = STATUTS[f.statut as string] ?? { label: f.statut, cls: 'bg-slate-100 text-slate-600', icon: Clock }
              const SIcon = s.icon
              return (
                <tr key={f.id as string} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">#{String(f.numero).padStart(4, '0')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-700 text-xs font-bold">{initiales(f.prenom as string, f.nom as string)}</span>
                      </div>
                      <span className="font-medium text-slate-800">{f.prenom as string} {f.nom as string}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(f.date as string)}</td>
                  <td className={`px-4 py-3 hidden lg:table-cell whitespace-nowrap ${f.statut === 'en_retard' ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                    {formatDate(f.date_echeance as string)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{Number(f.montant_ttc).toLocaleString('fr-FR')} €</td>
                  <td className="px-4 py-3 text-right">
                    <span className={reste > 0 ? 'text-amber-700 font-medium' : 'text-slate-400'}>
                      {reste > 0 ? `${reste.toLocaleString('fr-FR')} €` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className={`badge gap-1 ${s.cls}`}><SIcon size={11} />{s.label}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => push({ facture: f.id as string })}
                      className="text-xs text-primary-600 hover:underline font-medium">Voir →</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {page} / {totalPages} — {total} factures</span>
            <div className="flex gap-2">
              {page > 1 && <button onClick={() => push({ page: String(page - 1) })} className="btn-ghost py-1 px-3">← Préc.</button>}
              {page < totalPages && <button onClick={() => push({ page: String(page + 1) })} className="btn-ghost py-1 px-3">Suiv. →</button>}
            </div>
          </div>
        )}
      </div>
      <Suspense><FactureDrawer /></Suspense>
    </div>
  )
}
