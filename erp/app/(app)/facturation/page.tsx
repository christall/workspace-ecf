import { Suspense } from 'react'
import FacturationClient from './FacturationClient'

export default function FacturationPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex-1">
        <div className="h-8 w-40 bg-slate-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded animate-pulse" />)}
        </div>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
        </div>
      </div>
    }>
      <FacturationClient />
    </Suspense>
  )
}
