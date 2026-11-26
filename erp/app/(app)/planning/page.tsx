import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'
import PlanningGrid from '@/components/planning/PlanningGrid'
import PlanningGridSemaine from '@/components/planning/PlanningGridSemaine'
import PlanningNav from '@/components/planning/PlanningNav'
import EleveDrawer from '@/components/planning/EleveDrawer'
import { Suspense } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Creneau } from '@/lib/db'

type PageProps = { searchParams: Promise<{ date?: string; mode?: string; ressources?: string }> }

async function getJourData(fid: string, date: string) {
  const creneaux = await query<Creneau>(
    `SELECT c.id, c.date, c.heure_debut, c.heure_fin, c.commentaire, c.verrou_planning,
            p.id as produit_id, p.code as produit_code, p.nom as produit_nom, p.couleur_hex as produit_couleur,
            r.id as ressource_id, r.code as ressource_code, r.nom as ressource_nom, r.couleur_hex as ressource_couleur
     FROM creneaux c JOIN produits p ON p.id=c.produit_id JOIN ressources r ON r.id=c.ressource_id
     WHERE c.franchise_id=? AND c.date=? ORDER BY r.code, c.heure_debut`,
    [fid, date]
  )
  return withEleves(creneaux)
}

async function getSemaineData(fid: string, dateRef: string, ressourceIds: string[]) {
  const ref = new Date(dateRef + 'T12:00:00')
  const monday = startOfWeek(ref, { weekStartsOn: 1 })
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i))
  const dates = days.map(d => format(d, 'yyyy-MM-dd'))

  const idsFilter = ressourceIds.length > 0
    ? `AND r.id IN (${ressourceIds.map(() => '?').join(',')})`
    : ''
  const args: string[] = [fid, ...dates, ...(ressourceIds.length > 0 ? ressourceIds : [])]

  const creneaux = await query<Creneau>(
    `SELECT c.id, c.date, c.heure_debut, c.heure_fin, c.commentaire, c.verrou_planning,
            p.id as produit_id, p.code as produit_code, p.nom as produit_nom, p.couleur_hex as produit_couleur,
            r.id as ressource_id, r.code as ressource_code, r.nom as ressource_nom, r.couleur_hex as ressource_couleur
     FROM creneaux c JOIN produits p ON p.id=c.produit_id JOIN ressources r ON r.id=c.ressource_id
     WHERE c.franchise_id=? AND c.date IN (${dates.map(() => '?').join(',')}) ${idsFilter}
     ORDER BY c.date, c.heure_debut`,
    args
  )

  const withEl = await withEleves(creneaux)
  const byDate: Record<string, Creneau[]> = {}
  for (const d of dates) byDate[d] = []
  for (const c of withEl) {
    if (byDate[c.date]) byDate[c.date].push(c)
  }

  return days.map(d => ({
    date: format(d, 'yyyy-MM-dd'),
    label: format(d, 'EEE d MMM', { locale: fr }),
    creneaux: byDate[format(d, 'yyyy-MM-dd')] || [],
  }))
}

async function withEleves(creneaux: Creneau[]): Promise<Creneau[]> {
  if (creneaux.length === 0) return []
  const ids = creneaux.map(c => `'${c.id}'`).join(',')
  const eleves = await query<{ creneau_id: string; id: string; prenom: string; nom: string; abspres: number | null }>(
    `SELECT cp.creneau_id, cp.abspres, pe.id, pe.prenom, pe.nom
     FROM creneau_personnes cp JOIN personnes pe ON pe.id=cp.personne_id
     WHERE cp.creneau_id IN (${ids})`
  )
  const map: Record<string, typeof eleves> = {}
  for (const e of eleves) {
    if (!map[e.creneau_id]) map[e.creneau_id] = []
    map[e.creneau_id].push(e)
  }
  return creneaux.map(c => ({ ...c, eleves: map[c.id] || [] }))
}

export default async function PlanningPage({ searchParams }: PageProps) {
  const session = await getSession()
  const { date: dateParam, mode = 'jour', ressources: ressourcesParam = '' } = await searchParams
  const date = dateParam || new Date().toISOString().slice(0, 10)
  const fid = session!.franchise_id
  const selectedRessources = ressourcesParam ? ressourcesParam.split(',').filter(Boolean) : []

  // Ressources disponibles
  const ressources = await query<{ id: string; code: string; nom: string; couleur_hex: string }>(
    `SELECT id, code, nom, couleur_hex FROM ressources
     WHERE franchise_id=? AND is_active=1 AND type='moniteur' ORDER BY code`, [fid]
  )

  // Navigation
  const dateObj = new Date(date + 'T12:00:00')
  const prevDate = format(addDays(dateObj, mode === 'semaine' ? -7 : -1), 'yyyy-MM-dd')
  const nextDate = format(addDays(dateObj, mode === 'semaine' ? 7 : 1), 'yyyy-MM-dd')
  const todayDate = new Date().toISOString().slice(0, 10)
  const isToday = date === todayDate
  const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(dateObj, i - dayOfWeek + 1)
    return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE d', { locale: fr }) }
  })

  // Données selon le mode
  const creneauxJour = mode !== 'semaine' ? await getJourData(fid, date) : []
  const jours = mode === 'semaine' ? await getSemaineData(fid, date, selectedRessources) : []

  const totalCreneaux = mode === 'semaine'
    ? jours.reduce((s, j) => s + j.creneaux.length, 0)
    : creneauxJour.length
  const dayLabel = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Sélection auto des 2 premiers moniteurs en mode semaine si rien sélectionné
  const effectiveSelected = mode === 'semaine' && selectedRessources.length === 0 && ressources.length > 0
    ? ressources.slice(0, 2).map(r => r.id)
    : selectedRessources

  const jours2 = mode === 'semaine' && selectedRessources.length === 0 && ressources.length > 0
    ? await getSemaineData(fid, date, effectiveSelected)
    : jours

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 capitalize">
              {mode === 'semaine' ? `Semaine du ${weekDays[0].label} au ${weekDays[4].label}` : dayLabel}
            </h1>
            <p className="text-sm text-slate-500">
              {totalCreneaux} créneau{totalCreneaux > 1 ? 'x' : ''}{mode === 'semaine' && effectiveSelected.length > 0 ? ` · ${effectiveSelected.length} moniteur${effectiveSelected.length > 1 ? 's' : ''}` : ` · ${ressources.length} moniteurs`}
            </p>
          </div>
          <PlanningNav
            date={date} prevDate={prevDate} nextDate={nextDate}
            todayDate={todayDate} weekDays={weekDays} isToday={isToday}
            mode={mode} ressources={ressources} selectedRessources={effectiveSelected}
          />
        </div>
      </div>

      {/* Légende */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex gap-4 flex-shrink-0 overflow-x-auto">
        {mode === 'semaine' && effectiveSelected.length > 0 ? (
          ressources.filter(r => effectiveSelected.includes(r.id)).map(r => (
            <div key={r.id} className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.couleur_hex }} />
              <span className="text-xs text-slate-600 font-medium">{r.nom}</span>
            </div>
          ))
        ) : (
          [{ nom: 'Leçon', color: '#3b82f6' }, { nom: 'Code', color: '#22c55e' },
           { nom: 'Exam. pratique', color: '#ef4444' }, { nom: 'Eval. initiale', color: '#a855f7' },
           { nom: 'Conduite accomp.', color: '#f97316' }].map(p => (
            <div key={p.nom} className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-xs text-slate-500">{p.nom}</span>
            </div>
          ))
        )}
      </div>

      {/* Grid — flex-1 + min-h-0 pour que le scroll reste dans la zone visible */}
      <div className="flex-1 min-h-0 bg-white overflow-hidden">
        {mode === 'semaine' ? (
          <PlanningGridSemaine
            jours={jours2.length > 0 ? jours2 : jours}
            ressources={ressources}
            selectedRessources={effectiveSelected}
          />
        ) : (
          <PlanningGrid
            creneaux={creneauxJour as unknown as Parameters<typeof PlanningGrid>[0]['creneaux']}
            ressources={ressources as unknown as Parameters<typeof PlanningGrid>[0]['ressources']}
          />
        )}
      </div>
      <Suspense><EleveDrawer /></Suspense>
    </div>
  )
}
