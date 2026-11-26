'use client'
import { useEffect, useRef } from 'react'

export function useScrollRestore(key: string) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const saved = sessionStorage.getItem(`scroll:${key}`)
    if (saved) el.scrollTop = parseInt(saved)

    return () => {
      if (ref.current) sessionStorage.setItem(`scroll:${key}`, String(ref.current.scrollTop))
    }
  }, [key])

  return ref
}
