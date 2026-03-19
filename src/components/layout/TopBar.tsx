import { useNavigate } from 'react-router-dom'
import { LogOut, QrCode, Menu, WifiOff, RefreshCw, Wifi } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { formatDateFR, todayISO } from '@/utils/dates'

export default function TopBar() {
  const navigate = useNavigate()
  const { utilisateur, chantier, logout } = useAuthStore()
  const { toggleSidebar, isOnline, pendingSyncCount, isSyncing, triggerSync } = useUiStore()
  const today = formatDateFR(todayISO())

  return (
    <header className="bg-nc-blue text-white px-4 py-3 flex items-center justify-between safe-top shadow-md flex-shrink-0">
      {/* Menu mobile */}
      <button
        onClick={toggleSidebar}
        className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/10 transition-colors"
      >
        <Menu size={22} />
      </button>

      {/* Infos chantier */}
      <div className="flex-1 min-w-0 mx-2 md:mx-0">
        <h1 className="font-bold text-sm truncate">{chantier?.name ?? 'Neoclima'}</h1>
        <p className="text-white/60 text-xs">{today} · {utilisateur?.prenom} {utilisateur?.nom}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Indicateur sync/offline — toujours visible */}
        <button
          onClick={!isOnline || pendingSyncCount === 0 ? undefined : triggerSync}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors
            ${!isOnline
              ? 'bg-red-500/30 text-white'
              : pendingSyncCount > 0
                ? 'bg-amber-400/30 text-amber-200 hover:bg-amber-400/40'
                : 'bg-white/10 text-white/50'
            }`}
          title={
            !isOnline ? 'Hors ligne'
              : pendingSyncCount > 0 ? `${pendingSyncCount} en attente — cliquer pour sync`
              : 'Connecté'
          }
        >
          {!isOnline ? (
            <WifiOff size={13} />
          ) : isSyncing ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Wifi size={13} />
          )}
          {!isOnline && <span>Offline</span>}
          {isOnline && pendingSyncCount > 0 && <span>{pendingSyncCount}</span>}
        </button>

        <button
          onClick={() => navigate('/production/scan')}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          title="Scanner QR"
        >
          <QrCode size={20} />
        </button>
        <button
          onClick={logout}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          title="Déconnexion"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  )
}
