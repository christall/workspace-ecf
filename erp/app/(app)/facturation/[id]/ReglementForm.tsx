'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle } from 'lucide-react'

const MODES = [
  { value: 'cheque',      label: 'Chèque' },
  { value: 'especes',     label: 'Espèces' },
  { value: 'cb',          label: 'Carte bancaire' },
  { value: 'virement',    label: 'Virement' },
  { value: 'prelevement', label: 'Prélèvement' },
]

export default function ReglementForm({ factureId, reste }: { factureId: string; reste: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    montant: reste.toFixed(2),
    mode: 'cheque',
    date: new Date().toISOString().slice(0, 10),
    reference: '',
  })
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch(`/api/facturation/${factureId}/reglements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, montant: parseFloat(form.montant) }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="btn-primary w-full justify-center py-2.5">
        <PlusCircle size={16} />
        Enregistrer un règlement
      </button>
    )
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-slate-700 text-sm mb-3">Nouveau règlement</h3>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Montant (€)</label>
          <input type="number" step="0.01" min="0.01" max={reste}
            value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mode de règlement</label>
          <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Référence (optionnel)</label>
          <input type="text" value={form.reference} placeholder="N° chèque, ref virement…"
            onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center py-2">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2">
            {loading ? 'Enregistrement…' : 'Valider'}
          </button>
        </div>
      </form>
    </div>
  )
}
