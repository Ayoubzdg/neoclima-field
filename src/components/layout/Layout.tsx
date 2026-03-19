import { Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { useRealtime } from '@/hooks/useRealtime'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import TopBar from './TopBar'
import OfflineBadge from './OfflineBadge'

export default function Layout() {
  const role = useAuthStore(s => s.role)
  const chantierId = useAuthStore(s => s.chantier?.id ?? null)
  const { sidebarOpen, toggleSidebar } = useUiStore()
  const isMonteur = role === 'monteur'

  // Souscription Supabase Realtime pour les mises à jour temps réel
  useRealtime(chantierId)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Sidebar desktop ──────────────────────────── */}
      <div className="hidden md:block flex-shrink-0">
        <Sidebar />
      </div>

      {/* ── Drawer mobile (overlay + panel) ─────────── */}
      {sidebarOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={toggleSidebar}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar onNavClick={toggleSidebar} />
          </div>
        </>
      )}

      {/* ── Contenu principal ────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <OfflineBadge />
        <main className={`flex-1 overflow-y-auto ${isMonteur ? 'pb-20' : 'pb-4'}`}>
          <Outlet />
        </main>
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
