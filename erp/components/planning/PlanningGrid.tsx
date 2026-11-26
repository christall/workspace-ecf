'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatHeure, timeToMinutes, cn } from '@/lib/utils'

type Eleve = { id: string; prenom: string; nom: string; abspres: number | null }
type Creneau = {
  id: string; date: string; heure_debut: string; heure_fin: string
  produit_code: string; produit_nom: string; produit_couleur: string
  ressource_id: string; ressource_nom: string; ressource_couleur: string
  verrou_planning: boolean; commentaire: string | null; eleves: Eleve[]
}
type Ressource = { id: string; code: string; nom: string; couleur_hex: string }

const DAY_START = 7 * 60    // 7h00
const DAY_END   = 19 * 60   // 19h00
const DAY_DURATION = DAY_END - DAY_START
const PX_PER_MIN = 1.2      // 1 heure = 72px — journée entière ~865px

function timeToY(time: string): number {
  return (timeToMinutes(time) - DAY_START) * PX_PER_MIN
}

function durationToPx(start: string, end: string): number {
  return (timeToMinutes(end) - timeToMinutes(start)) * PX_PER_MIN
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7 → 19

function EventCard({ creneau, onClick }: { creneau: Creneau; onClick: () => void }) {
  const top = timeToY(creneau.heure_debut)
  const height = Math.max(durationToPx(creneau.heure_debut, creneau.heure_fin), 24)
  const isShort = height < 50

  return (
    <div
      className="absolute left-0.5 right-0.5 rounded overflow-hidden cursor-pointer
                 hover:brightness-95 transition-all hover:shadow-md hover:z-10"
      style={{ top, height, backgroundColor: creneau.produit_couleur + '22',
               borderLeft: `3px solid ${creneau.produit_couleur}` }}
      onClick={onClick}
    >
      <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
        <div className="flex items-center gap-1">
          {creneau.verrou_planning && (
            <span className="text-[9px] opacity-60">🔒</span>
          )}
          <span className="text-[10px] font-semibold leading-tight truncate"
            style={{ color: creneau.produit_couleur }}>
            {creneau.produit_nom}
          </span>
        </div>
        {!isShort && creneau.eleves.length > 0 && (
          <span className="text-[10px] text-slate-600 leading-tight truncate">
            {creneau.eleves[0].prenom} {creneau.eleves[0].nom}
            {creneau.eleves.length > 1 && ` +${creneau.eleves.length - 1}`}
          </span>
        )}
        {!isShort && (
          <span className="text-[9px] text-slate-400 mt-auto">
            {formatHeure(creneau.heure_debut)}–{formatHeure(creneau.heure_fin)}
          </span>
        )}
      </div>
    </div>
  )
}

function EventDetail({ creneau, onClose }: { creneau: Creneau; onClose: () => void }) {
  const router = useRouter()
  const params = useSearchParams()
  const openEleve = (id: string) => {
    const p = new URLSearchParams(params.toString())
    p.set('eleve', id)
    router.push(`/planning?${p.toString()}`, { scroll: false })
    onClose()
  }
  const abspresLabel = (a: number | null) => {
    if (a === null) return { text: 'Non saisi', cls: 'bg-slate-100 text-slate-600' }
    if (a === 0) return { text: 'Présent', cls: 'bg-green-100 text-green-700' }
    if (a === 1) return { text: 'Absent excusé', cls: 'bg-yellow-100 text-yellow-700' }
    return { text: 'Absent', cls: 'bg-red-100 text-red-700' }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-5"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: creneau.produit_couleur + '22' }}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: creneau.produit_couleur }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{creneau.produit_nom}</h3>
            <p className="text-sm text-slate-500">
              {formatHeure(creneau.heure_debut)} – {formatHeure(creneau.heure_fin)} · {creneau.ressource_nom}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Flags */}
        <div className="flex gap-2 mb-4">
          {creneau.verrou_planning && (
            <span className="badge bg-slate-100 text-slate-600">🔒 Verrouillé</span>
          )}
          <span className="badge bg-blue-50 text-blue-700">{creneau.produit_code}</span>
        </div>

        {/* Élèves */}
        {creneau.eleves.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Élève{creneau.eleves.length > 1 ? 's' : ''} ({creneau.eleves.length})
            </p>
            <div className="space-y-2">
              {creneau.eleves.map(e => {
                const { text, cls } = abspresLabel(e.abspres)
                return (
                  <div key={e.id} className="flex items-center justify-between">
                    <button onClick={() => openEleve(e.id)}
                      className="text-sm text-primary-600 hover:underline font-medium text-left">
                      {e.prenom} {e.nom}
                    </button>
                    <span className={`badge ${cls}`}>{text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {creneau.commentaire && (
          <div className="mt-3 p-2 bg-slate-50 rounded text-sm text-slate-600 italic">
            {creneau.commentaire}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlanningGrid({
  creneaux, ressources
}: {
  creneaux: Creneau[]
  ressources: Ressource[]
}) {
  const [selected, setSelected] = useState<Creneau | null>(null)

  const gridHeight = DAY_DURATION * PX_PER_MIN

  const byRessource: Record<string, Creneau[]> = {}
  for (const r of ressources) byRessource[r.id] = []
  for (const c of creneaux) {
    if (byRessource[c.ressource_id]) byRessource[c.ressource_id].push(c)
  }

  return (
    <>
      {/* Layout : header fixe + corps scrollable X et Y dans la zone visible */}
      <div className="h-full flex flex-col overflow-hidden">

        {/* Header moniteurs — fixe, scroll X synchronisé avec le corps */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-white overflow-x-auto">
          <div className="flex min-w-max">
            <div className="w-16 flex-shrink-0" />
            {ressources.map(r => (
              <div key={r.id} className="w-44 flex-shrink-0 px-3 py-2 border-l border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.couleur_hex }} />
                  <span className="text-sm font-medium text-slate-700 truncate">{r.nom}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Corps — scroll X + Y, scrollbar H toujours en bas de la zone visible */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex min-w-max">
            {/* Axe horaire */}
            <div className="w-16 flex-shrink-0 relative" style={{ height: gridHeight }}>
              {HOURS.map(h => (
                <div key={h} className="absolute w-full flex items-start"
                  style={{ top: (h - 7) * 60 * PX_PER_MIN - 8 }}>
                  <span className="text-[10px] text-slate-400 pr-2 text-right w-full leading-none">{h}h</span>
                </div>
              ))}
            </div>
            {/* Colonnes moniteurs */}
            {ressources.map(r => (
              <div key={r.id} className="w-44 flex-shrink-0 border-l border-slate-100 relative"
                style={{ height: gridHeight }}>
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-slate-100"
                    style={{ top: (h - 7) * 60 * PX_PER_MIN }} />
                ))}
                {HOURS.map(h => (
                  <div key={`${h}-30`} className="absolute w-full border-t border-slate-50"
                    style={{ top: (h - 7) * 60 * PX_PER_MIN + 30 * PX_PER_MIN }} />
                ))}
                {(byRessource[r.id] || []).map(c => (
                  <EventCard key={c.id} creneau={c} onClick={() => setSelected(c)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && <EventDetail creneau={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
