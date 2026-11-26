import { getSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatHeure, initiales } from '@/lib/utils'
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

type PageProps = { params: Promise<{ id: string }> }

function abspresInfo(a: number | null) {
  if (a === 0)  return { icon: CheckCircle2, cls: 'text-green-500',  label: 'Présent' }
  if (a === 1)  return { icon: AlertCircle,  cls: 'text-yellow-500', label: 'Abs. excusé' }
  if (a === 2)  return { icon: XCircle,      cls: 'text-red-500',    label: 'Absent' }
  return { icon: Clock, cls: 'text-slate-300', label: 'À venir' }
}

export default async function FicheElevePage({ params }: PageProps) {
  const session = await getSession()
  const { id } = await params

  const eleve = await queryOne<{
    id:string;prenom:string;nom:string;email:string|null;tel_mobile:string|null
    date_naissance:string|null;ville:string|null;date_inscription:string|null
    filiere:string|null;permis_code:string;nb_heures:number;solde_credit:number
    code_obtenu:number;date_code:string|null
  }>(
    'SELECT * FROM personnes WHERE id = ? AND franchise_id = ?',
    [id, session!.franchise_id]
  )
  if (!eleve) notFound()

  const lecons = await query<{
    id:string;date:string;heure_debut:string;heure_fin:string;verrou_planning:number
    produit_nom:string;produit_couleur:string;produit_code:string
    ressource_nom:string;abspres:number|null
  }>(
    `SELECT c.id, c.date, c.heure_debut, c.heure_fin, c.verrou_planning,
            p.nom as produit_nom, p.couleur_hex as produit_couleur, p.code as produit_code,
            r.nom as ressource_nom, cp.abspres
     FROM creneau_personnes cp
     JOIN creneaux c ON c.id = cp.creneau_id
     JOIN produits p ON p.id = c.produit_id
     JOIN ressources r ON r.id = c.ressource_id
     WHERE cp.personne_id = ?
     ORDER BY c.date DESC, c.heure_debut DESC LIMIT 30`,
    [id]
  )

  const heuresFaites = lecons.filter(l => l.abspres === 0).length
  const progressPct = Number(eleve.nb_heures) > 0
    ? Math.min(100, Math.round((Number(eleve.nb_heures) / 20) * 100))
    : 0

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/eleves" className="btn-ghost mb-6 -ml-2 text-slate-500">
        <ArrowLeft size={16} /> Retour aux élèves
      </Link>

      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 text-xl font-bold">{initiales(eleve.prenom, eleve.nom)}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{eleve.prenom} {eleve.nom}</h1>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span className="badge bg-blue-100 text-blue-700">Permis {eleve.permis_code}</span>
                  {eleve.filiere && <span className="badge bg-violet-100 text-violet-700">{eleve.filiere}</span>}
                  {eleve.code_obtenu
                    ? <span className="badge bg-green-100 text-green-700">✓ Code obtenu</span>
                    : <span className="badge bg-slate-100 text-slate-600">Code en cours</span>
                  }
                </div>
              </div>
              <button className="btn-ghost text-sm hidden md:flex">Modifier</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {eleve.tel_mobile && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={14} className="text-slate-400" />{eleve.tel_mobile}
                </div>
              )}
              {eleve.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                  <Mail size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{eleve.email}</span>
                </div>
              )}
              {eleve.ville && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin size={14} className="text-slate-400" />{eleve.ville}
                </div>
              )}
              {eleve.date_inscription && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar size={14} className="text-slate-400" />
                  Inscrit le {formatDate(eleve.date_inscription)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm text-slate-500 mb-1">Heures effectuées</p>
          <p className="text-2xl font-bold text-slate-900">{Number(eleve.nb_heures).toFixed(1)}h</p>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-600 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{progressPct}% de 20h estimées</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500 mb-1">Solde crédit</p>
          <p className={`text-2xl font-bold ${Number(eleve.solde_credit) < 100 ? 'text-red-600' : 'text-slate-900'}`}>
            {Number(eleve.solde_credit).toLocaleString('fr-FR')} €
          </p>
          {Number(eleve.solde_credit) < 100 && <p className="text-xs text-red-500 mt-1">Solde insuffisant</p>}
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500 mb-1">Présence</p>
          <p className="text-2xl font-bold text-slate-900">{heuresFaites}/{lecons.length}</p>
          <p className="text-xs text-slate-400 mt-1">leçons effectuées</p>
          {eleve.date_code && <p className="text-xs text-green-600 mt-1">Code le {formatDate(eleve.date_code)}</p>}
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Historique des leçons</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {lecons.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Aucune leçon planifiée</div>
          )}
          {lecons.map(l => {
            const { icon: Icon, cls, label } = abspresInfo(l.abspres)
            return (
              <div key={l.id} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50">
                <div className="text-sm text-slate-500 w-28 flex-shrink-0 font-mono">{formatDate(l.date)}</div>
                <div className="text-sm text-slate-500 w-24 flex-shrink-0">
                  {formatHeure(l.heure_debut)}–{formatHeure(l.heure_fin)}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.produit_couleur }} />
                  <span className="text-sm font-medium text-slate-800">{l.produit_nom}</span>
                </div>
                <div className="text-xs text-slate-400 flex-shrink-0 hidden md:block">{l.ressource_nom}</div>
                <div className={`flex items-center gap-1 text-xs flex-shrink-0 ${cls}`}>
                  <Icon size={14} /><span>{label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
