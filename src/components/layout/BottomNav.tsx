import { NavLink } from 'react-router-dom'
import { ClipboardList, Map, BarChart2, Shield, Settings, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/production',
    icon: <ClipboardList size={22} />,
    label: 'Production',
    roles: ['monteur', 'chef', 'ca', 'admin']
  },
  {
    to: '/production/blocages',
    icon: <AlertTriangle size={22} />,
    label: 'Blocages',
    roles: ['chef', 'ca', 'admin']
  },
  {
    to: '/plans',
    icon: <Map size={22} />,
    label: 'Plans',
    roles: ['monteur', 'chef', 'ca', 'admin']
  },
  {
    to: '/qualite',
    icon: <Shield size={22} />,
    label: 'Qualité',
    roles: ['chef', 'ca', 'admin']
  },
  {
    to: '/parametres',
    icon: <Settings size={22} />,
    label: 'Paramètres',
    roles: ['ca', 'admin']
  },
  {
    to: '/admin',
    icon: <ShieldCheck size={22} />,
    label: 'Admin',
    roles: ['admin']
  }
]

export default function BottomNav() {
  const role = useAuthStore(s => s.role)

  const visibleItems = NAV_ITEMS.filter(item =>
    role ? item.roles.includes(role) : false
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100
                    flex items-center justify-around safe-bottom z-40 shadow-lg">
      {visibleItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 flex-1
             transition-colors duration-150 touch-manipulation
             ${isActive ? 'text-nc-red' : 'text-gray-400'}`
          }
        >
          {item.icon}
          <span className="text-[10px] font-medium leading-tight truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
