import { Suspense } from 'react'
import ElevesClient from './ElevesClient'

export default function ElevesPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex-1">
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
        </div>
      </div>
    }>
      <ElevesClient />
    </Suspense>
  )
}
