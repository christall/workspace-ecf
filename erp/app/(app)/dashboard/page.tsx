import { getSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { formatHeure } from '@/lib/utils'
import { CalendarDays, Users, Euro, GraduationCap, Clock } from 'lucide-react'

async function getStats(fid: string) {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 8) + '01'

  const [lecons_today, eleves_actifs, examens_semaine, heures_mois, prochaines_lecons] = await Promise.all([
    queryOne<{n:number}>('SELECT COUNT(*) as n FROM creneaux WHERE franchise_id=? AND date=?', [fid, today]),
    queryOne<{n:number}>('SELECT COUNT(*) as n FROM personnes WHERE franchise_id=?', [fid]),
    queryOne<{n:number}>(
      `SELECT COUNT(*) as n FROM creneaux c JOIN produits p ON p.id=c.produit_id AND p.code IN ('*EP','*EE')
       WHERE c.franchise_id=? AND c.date BETWEEN ? AND date(?, '+7 days')`,
      [fid, today, today]
    ),
    queryOne<{h:number}>(
      `SELECT COALESCE(SUM(
         (CAST(substr(heure_fin,1,2) AS INTEGER)*60 + CAST(substr(heure_fin,4,2) AS INTEGER)) -
         (CAST(substr(heure_debut,1,2) AS INTEGER)*60 + CAST(substr(heure_debut,4,2) AS INTEGER))
       ) / 60.0, 0) as h
       FROM creneaux WHERE franchise_id=? AND date >= ? AND date <= ?`,
      [fid, monthStart, today]
    ),
    query<{heure_debut:string;heure_fin:string;produit_nom:string;couleur_hex:string;ressource_nom:string;eleves_noms:string}>(
      `SELECT c.date, c.heure_debut, c.heure_fin, p.nom as produit_nom, p.couleur_hex,
              r.nom as ressource_nom,
              GROUP_CONCAT(pe.prenom || ' ' || pe.nom, ', ') as eleves_noms
       FROM creneaux c
       JOIN produits p ON p.id=c.produit_id
       JOIN ressources r ON r.id=c.ressource_id
       LEFT JOIN creneau_personnes cp ON cp.creneau_id=c.id
       LEFT JOIN personnes pe ON pe.id=cp.personne_id
       WHERE c.franchise_id=? AND c.date=?
       GROUP BY c.id ORDER BY c.heure_debut LIMIT 10`,
      [fid, today]
    ),
  ])

  return {
    lecons_today: Number(lecons_today?.n ?? 0),
    eleves_actifs: Number(eleves_actifs?.n ?? 0),
    examens_semaine: Number(examens_semaine?.n ?? 0),
    ca_mois_estime: Math.round(Number(heures_mois?.h ?? 0) * 45),
    prochaines_lecons,
  }
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await getSession()
  const stats = await getStats(session!.franchise_id)
  const today = new Date()
  const dayLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Bonjour, {session!.prenom} 👋</h1>
        <p className="text-slate-500 text-sm mt-0.5 capitalize">{dayLabel} · {session!.franchise_nom}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={CalendarDays} label="Leçons aujourd'hui" value={stats.lecons_today}
          sub="créneaux planifiés" color="bg-blue-500" />
        <StatCard icon={Users} label="Élèves actifs" value={stats.eleves_actifs}
          sub="dans le centre" color="bg-violet-500" />
        <StatCard icon={Euro} label="CA ce mois" value={`${stats.ca_mois_estime.toLocaleString('fr-FR')} €`}
          sub="estimation" color="bg-emerald-500" />
        <StatCard icon={GraduationCap} label="Examens cette semaine" value={stats.examens_semaine}
          sub="ETG + pratique" color="bg-amber-500" />
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            Planning du jour
          </h2>
          <a href="/planning" className="text-xs text-primary-600 hover:underline">Voir le planning complet →</a>
        </div>
        <div className="divide-y divide-slate-50">
          {stats.prochaines_lecons.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Aucun créneau aujourd'hui</div>
          )}
          {stats.prochaines_lecons.map((l, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
              <div className="text-sm font-mono text-slate-500 w-24 flex-shrink-0">
                {formatHeure(l.heure_debut)} – {formatHeure(l.heure_fin)}
              </div>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.couleur_hex }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800">{l.produit_nom}</span>
                {l.eleves_noms && <span className="text-sm text-slate-500"> · {l.eleves_noms}</span>}
              </div>
              <div className="text-xs text-slate-400 flex-shrink-0">{l.ressource_nom}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
