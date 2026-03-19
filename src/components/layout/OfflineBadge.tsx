import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'

export default function OfflineBadge() {
  const { isOnline, pendingSyncCount, isSyncing, triggerSync } = useUiStore()

  if (isOnline && pendingSyncCount === 0) return null

  return (
    <div
      className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium
                  ${isOnline ? 'bg-amber-50 text-amber-700 border-b border-amber-100' : 'bg-orange-500 text-white'}`}
    >
      {isOnline ? (
        <>
          {isSyncing ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          <span>
            {isSyncing
              ? 'Synchronisation en cours…'
              : `${pendingSyncCount} action${pendingSyncCount > 1 ? 's' : ''} en attente de sync`
            }
          </span>
          {!isSyncing && (
            <button
              onClick={triggerSync}
              className="ml-auto underline text-amber-600 hover:text-amber-800"
            >
              Sync maintenant
            </button>
          )}
        </>
      ) : (
        <>
          <WifiOff size={12} />
          <span>Mode hors ligne</span>
          {pendingSyncCount > 0 && (
            <span className="ml-auto bg-white/20 rounded-full px-2 py-0.5">
              {pendingSyncCount}
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ── Notification stack ──────────────────────────────────────
// (fichier séparé mais déclaré ici pour cohérence du layout)
export function SyncSuccessToast({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium">
      <CheckCircle size={16} />
      {count} action{count > 1 ? 's' : ''} synchronisée{count > 1 ? 's' : ''}
    </div>
  )
}
