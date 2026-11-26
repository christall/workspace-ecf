import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar session={session} />
      <main className="flex-1 overflow-hidden bg-slate-50 flex flex-col">
        {children}
      </main>
    </div>
  )
}
