'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,   // données fraîches 5 min — pas de re-fetch sur navigation
        gcTime: 10 * 60 * 1000,     // gardées en mémoire 10 min
        refetchOnWindowFocus: false, // pas de re-fetch au focus (comportement desktop)
        retry: 1,
      },
    },
  }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
