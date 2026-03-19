import { NavLink } from 'react-router-dom'
import {
  ClipboardList, Map, BarChart2, Shield, Settings,
  Users, BarChart3, HardHat, LogOut, QrCode, Calendar, Building2,
  ShieldCheck
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface NavGroup {
  label: string
  items: { to: string; icon: React.ReactNode; label: string; roles: string[] }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Production',
    items: [
      { to: '/production',            icon: <ClipboardList size={18} />, label: 'Mes tâches',      roles: ['monteur', 'chef', 'ca', 'admin'] },
      { to: '/production/chef',       icon: <HardHat size={18} />,       label: 'Dashboard chef',  roles: ['chef', 'ca', 'admin'] },
      { to: '/production/takt',       icon: <BarChart2 size={18} />,     label: 'Tableau de flux', roles: ['ca', 'admin'] },
      { to: '/production/blocages',   icon: <Shield size={18} />,        label: 'Blocages urgents',roles: ['chef', 'ca', 'admin'] },
      { to: '/production/scan',       icon: <QrCode size={18} />,        label: 'Scanner QR',      roles: ['monteur', 'chef', 'ca', 'admin'] },
    ]
  },
  {
    label: 'Planning',
    items: [
      { to: '/planning',                icon: <BarChart3 size={18} />,    label: 'Gantt chantier',  roles: ['chef', 'ca', 'admin'] },
      { to: '/planning/contraintes',    icon: <Calendar size={18} />,     label: 'Agenda contraintes', roles: ['chef', 'ca', 'admin'] },
      { to: '/planning/lookahead',      icon: <Calendar size={18} />,     label: 'Lookahead 3S',    roles: ['chef', 'ca', 'admin'] },
      { to: '/planning/weekly',         icon: <ClipboardList size={18} />,label: 'Weekly Plan',     roles: ['chef', 'ca', 'admin'] },
      { to: '/planning/ppc',            icon: <BarChart2 size={18} />,    label: 'PPC & Analyse',   roles: ['chef', 'ca', 'admin'] },
    ]
  },
  {
    label: 'Plans',
    items: [
      { to: '/plans',    icon: <Map size={18} />,   label: 'Zones & Plans', roles: ['monteur', 'chef', 'ca', 'admin'] },
      { to: '/plans/qr', icon: <QrCode size={18} />,label: 'Imprimer QR',  roles: ['ca', 'admin'] },
    ]
  },
  {
    label: 'Qualité',
    items: [
      { to: '/qualite',         icon: <Shield size={18} />,  label: 'Non-conformités',  roles: ['chef', 'ca', 'admin'] },
      { to: '/qualite/mesures', icon: <BarChart3 size={18} />,label: 'Mesures & Essais', roles: ['chef', 'ca', 'admin'] },
    ]
  },
  {
    label: 'Équipes',
    items: [
      { to: '/equipes',           icon: <Users size={18} />,        label: 'Équipes',   roles: ['chef', 'ca', 'admin'] },
      { to: '/equipes/effectifs', icon: <ClipboardList size={18} />,label: 'Effectifs', roles: ['chef', 'ca', 'admin'] },
    ]
  },
  {
    label: 'Reporting',
    items: [
      { to: '/reporting',               icon: <BarChart3 size={18} />,    label: 'Rapport hebdo',    roles: ['ca', 'admin'] },
      { to: '/reporting/bon-travail',   icon: <ClipboardList size={18} />,label: 'Bon de travail',   roles: ['chef', 'ca', 'admin'] },
      { to: '/reporting/financier',     icon: <BarChart2 size={18} />,    label: 'Tableau financier',roles: ['ca', 'admin'] },
    ]
  },
  {
    label: 'Paramètres',
    items: [
      { to: '/parametres',             icon: <Settings size={18} />,     label: 'Chantier',        roles: ['ca', 'admin'] },
      { to: '/parametres/zones',       icon: <Building2 size={18} />,    label: 'Zones & Secteurs',roles: ['ca', 'admin'] },
      { to: '/parametres/equipes',     icon: <Users size={18} />,        label: 'Équipes & PIN',   roles: ['ca', 'admin'] },
      { to: '/parametres/task-types',  icon: <ClipboardList size={18} />,label: 'Types de tâches', roles: ['ca', 'admin'] },
    ]
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin', icon: <ShieldCheck size={18} />, label: 'Gestion des accès', roles: ['admin'] },
    ]
  }
]

interface Props {
  /** Callback appelé après un clic sur un lien (ferme le drawer mobile) */
  onNavClick?: () => void
}

export default function Sidebar({ onNavClick }: Props) {
  const { role, utilisateur, chantier, logout } = useAuthStore()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100 ${
      isActive
        ? 'bg-nc-red text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-nc-blue'
    }`

  return (
    <aside className="w-60 bg-white border-r border-gray-100 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 bg-nc-blue flex-shrink-0">
        <h1 className="text-white font-bold text-base">Neoclima Field</h1>
        <p className="text-white/60 text-xs mt-0.5 truncate">{chantier?.name}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(item =>
            role ? item.roles.includes(role) : false
          )
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={linkClass}
                    end
                    onClick={onNavClick}
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-7 h-7 rounded-lg bg-nc-red flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {utilisateur?.prenom?.[0]}{utilisateur?.nom?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">
              {utilisateur?.prenom} {utilisateur?.nom}
            </p>
            <p className="text-[10px] text-gray-400 capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                     text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
