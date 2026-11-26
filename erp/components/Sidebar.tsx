'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { JWTPayload } from '@/lib/auth'
import {
  LayoutDashboard, CalendarDays, Users, Receipt, ClipboardList,
  Settings, BarChart3, LogOut, ChevronRight, BookOpen, Car, FileSignature
} from 'lucide-react'

type NavItem = {
  label: string
  href?: string
  icon: React.ElementType
  soon?: boolean
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Planning',        href: '/planning',   icon: CalendarDays },
  { label: 'Élèves',          href: '/eleves',     icon: Users },
  { label: 'Facturation',     href: '/facturation', icon: Receipt },
  { label: 'Conventions',     href: '/conventions',  icon: FileSignature },
  { label: 'Examens',         href: '/examens',      icon: ClipboardList },
  { label: 'Pédagogie',       href: '/pedagogie',    icon: BookOpen },
  { label: 'Ressources',      href: '/ressources',   icon: Car },
  { label: 'Statistiques',    href: '/statistiques', icon: BarChart3 },
  { label: 'Back-office',     href: '/backoffice',   icon: Settings },
]

export default function Sidebar({ session }: { session: JWTPayload }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-sm">EC</span>
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm leading-tight">ERP CERCA</div>
            <div className="text-slate-400 text-xs truncate">{session.franchise_nom.replace('ECF CERCA — ', '')}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const active = item.href ? pathname.startsWith(item.href) : false

          if (item.soon) return (
            <div key={item.label}
              className="flex items-center gap-3 px-4 py-2.5 text-slate-500 cursor-not-allowed">
              <Icon size={18} />
              <span className="text-sm flex-1">{item.label}</span>
              <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">bientôt</span>
            </div>
          )

          return (
            <Link key={item.label} href={item.href!}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors',
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}>
              <Icon size={18} />
              <span className="text-sm flex-1">{item.label}</span>
              {active && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {session.prenom[0]}{session.nom[0]}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{session.prenom} {session.nom}</div>
            <div className="text-slate-400 text-xs capitalize">{session.role}</div>
          </div>
        </div>
        <button onClick={logout}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-xs w-full transition-colors">
          <LogOut size={14} />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
