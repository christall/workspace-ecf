'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatHeure, timeToMinutes, cn } from '@/lib/utils'

type Eleve = { id: string; prenom: string; nom: string; abspres: number | null }
type Creneau = {
  id: string; date: string; heure_debut: string; heure_fin: string
  produit_code: string; produit_nom: string; produit_couleur: string
  ressource_id: string; ressource_nom: string; ressource_couleur: string
  verrou_planning: number; commentaire: string | null; eleves: Eleve[]
}
type Ressource = { id: string; code: string; nom: string; couleur_hex: string }
type JourData = { date: string; label: string; creneaux: Creneau[] }

const DAY_START = 7 * 60
const DAY_END = 19 * 60
const DAY_DURATION = DAY_END - DAY_START
const PX_PER_MIN = 1.2      // journée entière ~865px
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7)

function timeToY(time: string) { return (timeToMinutes(time) - DAY_START) * PX_PER_MIN }
function durationPx(s: string, e: string) { return Math.max(20, (timeToMinutes(e) - timeToMinutes(s)) * PX_PER_MIN) }

function EventCard({ c, color, onClick }: { c: Creneau; color: string; onClick: () => void }) {
  const top = timeToY(c.heure_debut)
  const height = durationPx(c.heure_debut, c.heure_fin)
  const isShort = height < 36
  return (
    <div className="absolute left-0.5 right-0.5 rounded cursor-pointer hover:brightness-95 hover:z-10 transition-all hover:shadow-md"
      style={{ top, height, backgroundColor: color + '22', borderLeft: `3px solid ${color}` }}
      onClick={onClick}>
      <div className="px-1.5 py-0.5 overflow-hidden h-full flex flex-col">
        <span className="text-[10px] font-semibold truncate" style={{ color }}>
          {c.produit_nom}
        </span>
        {!isShort && c.eleves.length > 0 && (
          <span className="text-[10px] text-slate-600 truncate">
            {c.eleves[0].prenom} {c.eleves[0].nom}
            {c.eleves.length > 1 ? ` +${c.eleves.length - 1}` : ''}
          </span>
        )}
        {!isShort && (
          <span className="text-[9px] text-slate-400 mt-auto">
            {formatHeure(c.heure_debut)}–{formatHeure(c.heure_fin)}
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
    if (a === 0) return { text: 'Présent', cls: 'bg-green-100 text-green-700' }
    if (a === 1) return { text: 'Abs. excusé', cls: 'bg-yellow-100 text-yellow-700' }
    if (a === 2) return { text: 'Absent', cls: 'bg-red-100 text-red-700' }
    return { text: 'À venir', cls: 'bg-slate-100 text-slate-500' }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: creneau.produit_couleur + '22' }}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: creneau.produit_couleur }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{creneau.produit_nom}</h3>
            <p className="text-sm text-slate-500">
              {formatHeure(creneau.heure_debut)}–{formatHeure(creneau.heure_fin)} · {creneau.ressource_nom}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        {creneau.verrou_planning ? <span className="badge bg-slate-100 text-slate-600 mb-3">🔒 Verrouillé</span> : null}
        {creneau.eleves.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Élèves</p>
            <div className="space-y-1.5">
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
      </div>
    </div>
  )
}

export default function PlanningGridSemaine({
  jours, ressources, selectedRessources
}: {
  jours: JourData[]
  ressources: Ressource[]
  selectedRessources: string[]
}) {
  const [selected, setSelected] = useState<Creneau | null>(null)
  const gridHeight = DAY_DURATION * PX_PER_MIN

  // Couleur d'un créneau = couleur du moniteur s'il est dans la sélection, sinon couleur produit
  const getColor = (c: Creneau) => {
    const r = ressources.find(r => r.id === c.ressource_id)
    return selectedRessources.includes(c.ressource_id) && r ? r.couleur_hex : c.produit_couleur
  }

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header jours — fixe */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-white overflow-x-auto">
          <div className="flex min-w-max">
            <div className="w-14 flex-shrink-0" />
            {jours.map(j => (
              <div key={j.date} className="min-w-[160px] flex-1 px-3 py-2 border-l border-slate-100 text-center">
                <div className="text-sm font-medium text-slate-700 capitalize">{j.label}</div>
                <div className="text-xs text-slate-400">{j.creneaux.length} créneau{j.creneaux.length > 1 ? 'x' : ''}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Corps — scroll X + Y, scrollbar toujours accessible */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="flex min-w-max">
            {/* Axe horaire */}
            <div className="w-14 flex-shrink-0 relative" style={{ height: gridHeight }}>
              {HOURS.map(h => (
                <div key={h} className="absolute w-full flex items-start justify-end pr-2"
                  style={{ top: (h - 7) * 60 * PX_PER_MIN - 8 }}>
                  <span className="text-[10px] text-slate-400 leading-none">{h}h</span>
                </div>
              ))}
            </div>
            {/* Colonnes par jour */}
            {jours.map(j => (
              <div key={j.date} className="min-w-[160px] flex-1 border-l border-slate-100 relative" style={{ height: gridHeight }}>
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-slate-100"
                    style={{ top: (h - 7) * 60 * PX_PER_MIN }} />
                ))}
                {HOURS.map(h => (
                  <div key={`${h}-30`} className="absolute w-full border-t border-slate-50"
                    style={{ top: (h - 7) * 60 * PX_PER_MIN + 30 * PX_PER_MIN }} />
                ))}
                {j.creneaux.map(c => (
                  <EventCard key={c.id} c={c} color={getColor(c)} onClick={() => setSelected(c)} />
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
