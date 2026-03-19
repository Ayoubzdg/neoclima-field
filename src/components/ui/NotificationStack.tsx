import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'

const ICONS = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <AlertCircle size={18} className="text-red-500" />,
  warning: <AlertTriangle size={18} className="text-amber-500" />,
  info: <Info size={18} className="text-blue-500" />
}

const BG = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  info: 'bg-blue-50 border-blue-200'
}

export default function NotificationStack() {
  const { notifications, removeNotification } = useUiStore()

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map(notif => (
        <div
          key={notif.id}
          className={`flex items-start gap-3 p-3 rounded-xl border shadow-md
                      pointer-events-auto animate-fade-in ${BG[notif.type]}`}
        >
          {ICONS[notif.type]}
          <p className="text-sm text-gray-800 flex-1">{notif.message}</p>
          <button
            onClick={() => removeNotification(notif.id)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
