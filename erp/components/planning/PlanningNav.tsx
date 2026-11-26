'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'

type WeekDay = { date: string; label: string }
type Ressource = { id: string; nom: string; couleur_hex: string }

export default function PlanningNav({ date, prevDate, nextDate, todayDate, weekDays, isToday, mode, ressources, selectedRessources }: {
  date: string; prevDate: string; nextDate: string; todayDate: string
  weekDays: WeekDay[]; isToday: boolean
  mode: string
  ressources: Ressource[]
  selectedRessources: string[]
}) {
  const router = useRouter()
  const params = useSearchParams()

  const go = (updates: Record<string, string>) => {
    const p = new URLSearchParams(params.toString())
    Object.entries(updates).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    router.push(`/planning?${p.toString()}`)
  }

  const toggleRessource = (id: string) => {
    let sel = [...selectedRessources]
    if (sel.includes(id)) sel = sel.filter(x => x !== id)
    else if (sel.length < 4) sel.push(id)
    go({ ressources: sel.join(',') })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mode jour / semaine */}
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => go({ mode: 'jour' })}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors',
              mode !== 'semaine' ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-50')}>
            <LayoutGrid size={13} /> Jour
          </button>
          <button onClick={() => go({ mode: 'semaine' })}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l border-slate-200',
              mode === 'semaine' ? 'bg-primary-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-50')}>
            <CalendarRange size={13} /> Semaine
          </button>
        </div>

        {/* Calendrier direct */}
        <div className="relative flex items-center">
          <CalendarDays size={15} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <input type="date" value={date}
            onChange={e => e.target.value && go({ date: e.target.value })}
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700
                       focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer bg-white" />
        </div>

        {/* Onglets semaine */}
        <div className="hidden md:flex border border-slate-200 rounded-lg overflow-hidden">
          {weekDays.map(d => (
            <button key={d.date} onClick={() => go({ date: d.date })}
              className={cn('px-3 py-1.5 text-xs capitalize transition-colors',
                d.date === date ? 'bg-primary-600 text-white font-medium'
                  : d.date === todayDate ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                  : 'text-slate-600 hover:bg-slate-50')}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Flèches */}
        <div className="flex items-center gap-1">
          <button onClick={() => go({ date: prevDate })}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => go({ date: nextDate })}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            <ChevronRight size={16} />
          </button>
        </div>

        {!isToday && (
          <button onClick={() => go({ date: todayDate })}
            className="px-3 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
            Aujourd'hui
          </button>
        )}
      </div>

      {/* Sélecteur moniteurs (mode semaine) */}
      {mode === 'semaine' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Moniteurs (max 4) :</span>
          {ressources.map(r => {
            const active = selectedRessources.includes(r.id)
            return (
              <button key={r.id} onClick={() => toggleRessource(r.id)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  active ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}
                style={active ? { backgroundColor: r.couleur_hex, borderColor: r.couleur_hex } : {}}>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? 'white' : r.couleur_hex }} />
                {r.nom.split(' ')[0]}
              </button>
            )
          })}
          {selectedRessources.length > 0 && (
            <button onClick={() => go({ ressources: '' })}
              className="text-xs text-slate-400 hover:text-slate-600">✕ tout déselectionner</button>
          )}
        </div>
      )}
    </div>
  )
}
