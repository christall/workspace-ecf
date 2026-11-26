'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Settings, Users, Package, Car, Building2, User } from 'lucide-react'

const TABS = [
  { value: 'franchise', label: 'Franchise', icon: Building2 },
  { value: 'utilisateurs', label: 'Utilisateurs', icon: Users },
  { value: 'produits', label: 'Produits', icon: Package },
  { value: 'ressources', label: 'Ressources', icon: Car },
]

const ROLE_LABELS: Record<string, string> = { admin: 'Administrateur', secretaire: 'Secrétaire', moniteur: 'Moniteur', direction: 'Direction' }

export default function BackOfficePage() {
  const [tab, setTab] = useState('franchise')

  const { data, isLoading } = useQuery({
    queryKey: ['backoffice'],
    queryFn: () => fetch('/api/backoffice').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  })

  const franchise = data?.franchise ?? {}
  const utilisateurs: Record<string,unknown>[] = data?.utilisateurs ?? []
  const produits: Record<string,unknown>[] = data?.produits ?? []
  const ressources: Record<string,unknown>[] = data?.ressources ?? []

  return (
    <div className="p-8 overflow-auto flex-1 min-h-0">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Back-office</h1>
          <p className="text-slate-500 text-sm">Configuration & administration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border border-slate-200 rounded-xl overflow-hidden mb-6 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${tab === t.value ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon size={15} />{t.label}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div>
      ) : (
        <>
          {/* Franchise */}
          {tab === 'franchise' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="card p-6">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Building2 size={16} /> Informations</h2>
                <dl className="space-y-3">
                  {[
                    ['Code', franchise.code],
                    ['Nom', franchise.nom],
                    ['Ville', franchise.ville],
                    ['Créée le', franchise.created_at ? new Date(franchise.created_at).toLocaleDateString('fr-FR') : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-4">
                      <dt className="text-xs text-slate-500 w-24 flex-shrink-0">{k}</dt>
                      <dd className="text-sm font-medium text-slate-800">{v as string || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="card p-6">
                <h2 className="font-semibold text-slate-800 mb-4">Résumé</h2>
                <dl className="space-y-3">
                  {[
                    ['Utilisateurs', utilisateurs.length],
                    ['Produits', produits.length],
                    ['Ressources', ressources.length],
                    ['Moniteurs', ressources.filter(r => r.type === 'moniteur').length],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-4">
                      <dt className="text-xs text-slate-500 w-24 flex-shrink-0">{k as string}</dt>
                      <dd className="text-xl font-bold text-slate-900">{v as number}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {/* Utilisateurs */}
          {tab === 'utilisateurs' && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Utilisateur</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Rôle</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {utilisateurs.map(u => (
                    <tr key={u.id as string} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <User size={14} className="text-primary-600" />
                          </div>
                          <span className="font-medium text-slate-800">{u.prenom as string} {u.nom as string}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.email as string}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-slate-100 text-slate-700">{ROLE_LABELS[u.role as string] ?? u.role as string}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {u.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Produits */}
          {tab === 'produits' && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Désignation</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Durée</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Couleur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produits.map(p => (
                    <tr key={p.id as string} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.code as string}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{p.nom as string}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {p.duree_minutes ? `${p.duree_minutes} min` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.couleur_hex as string }} />
                          <span className="text-xs text-slate-400 font-mono">{p.couleur_hex as string}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ressources */}
          {tab === 'ressources' && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Couleur</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ressources.map(r => (
                    <tr key={r.id as string} className={`hover:bg-slate-50 ${!r.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.code as string}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.nom as string}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-slate-100 text-slate-600 capitalize">{r.type as string}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: r.couleur_hex as string }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
