import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import LoginScreen from '@/components/auth/LoginScreen'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import RequireRole from '@/components/auth/RequireRole'
import type { UserRole } from '@/types/models'

/** Garde de route par rôle — bloque l'accès par URL, pas seulement le menu */
const guard = (roles: UserRole[], element: React.ReactNode) => (
  <RequireRole roles={roles}>{element}</RequireRole>
)

// Module Production
import MesTaches from '@/modules/production/MesTaches'
import TacheDetail from '@/modules/production/TacheDetail'
import QRScanner from '@/modules/production/QRScanner'
import DashboardChef from '@/modules/production/DashboardChef'
import ControleTaches from '@/modules/production/ControleTaches'
import TravauxSuppList from '@/modules/production/TravauxSuppList'
import TableauFluxTakt from '@/modules/production/TableauFluxTakt'
import BlocagesUrgents from '@/modules/production/BlocagesUrgents'
import ZoneTasksView from '@/modules/production/ZoneTasksView'

// Module Planning
import GanttChantier from '@/modules/planning/GanttChantier'
import Lookahead from '@/modules/planning/Lookahead'
import WeeklyPlan from '@/modules/planning/WeeklyPlan'
import PpcDashboard from '@/modules/planning/PpcDashboard'
import ContraintesAgenda from '@/modules/planning/ContraintesAgenda'

// Module Plans
import ZonesList from '@/modules/plans/ZonesList'
import PlanViewer from '@/modules/plans/PlanViewer'
import QrCodePrint from '@/modules/plans/QrCodePrint'

// Module Qualité
import NonConformites from '@/modules/qualite/NonConformites'
import NcDetail from '@/modules/qualite/NcDetail'
import Mesures from '@/modules/qualite/Mesures'

// Module Équipes
import EquipesList from '@/modules/equipes/EquipesList'
import Effectifs from '@/modules/equipes/Effectifs'

// Module Reporting
import RapportHebdo from '@/modules/reporting/RapportHebdo'
import RapportJour from '@/modules/reporting/RapportJour'
import DashboardCA from '@/modules/reporting/DashboardCA'
import { RegieList, RegieEdit } from '@/modules/reporting/RapportsRegie'
import BonTravail from '@/modules/reporting/BonTravail'

// Module Paramètres
import ParamChantier from '@/modules/parametres/ParamChantier'
import ParamEquipes from '@/modules/parametres/ParamEquipes'
import ParamTaskTypes from '@/modules/parametres/ParamTaskTypes'
import ParamZones from '@/modules/parametres/ParamZones'

// Module Admin
import AdminPanel from '@/modules/admin/AdminPanel'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginScreen />
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/production" replace /> },

      // ── Production ──────────────────────────────────────
      { path: 'production', element: <MesTaches /> },
      { path: 'production/tache/:id', element: <TacheDetail /> },
      { path: 'production/scan', element: <QRScanner /> },
      { path: 'production/chef', element: guard(['chef_equipe', 'chef', 'ca', 'admin'], <DashboardChef />) },
      { path: 'production/controle', element: guard(['chef', 'ca', 'admin'], <ControleTaches />) },
      { path: 'production/travaux-supp', element: guard(['monteur', 'chef_equipe', 'chef', 'ca', 'admin'], <TravauxSuppList />) },
      { path: 'production/takt', element: guard(['chef', 'ca', 'admin'], <TableauFluxTakt />) },
      { path: 'production/blocages', element: guard(['chef_equipe', 'chef', 'ca', 'admin'], <BlocagesUrgents />) },

      // ── Planning ────────────────────────────────────────
      { path: 'planning', element: guard(['chef', 'ca', 'admin'], <GanttChantier />) },
      { path: 'planning/lookahead', element: guard(['chef', 'ca', 'admin'], <Lookahead />) },
      { path: 'planning/weekly', element: guard(['chef', 'ca', 'admin'], <WeeklyPlan />) },
      { path: 'planning/ppc', element: guard(['chef', 'ca', 'admin'], <PpcDashboard />) },
      { path: 'planning/contraintes', element: guard(['chef', 'ca', 'admin'], <ContraintesAgenda />) },

      // ── Plans ───────────────────────────────────────────
      { path: 'plans', element: <ZonesList /> },
      { path: 'plans/zone/:id', element: <PlanViewer /> },
      { path: 'plans/zone/:id/viewer', element: <PlanViewer /> },
      { path: 'plans/qr', element: guard(['ca', 'admin'], <QrCodePrint />) },

      // ── Qualité ─────────────────────────────────────────
      { path: 'qualite', element: guard(['chef', 'ca', 'admin'], <NonConformites />) },
      { path: 'qualite/nc/:id', element: guard(['chef', 'ca', 'admin'], <NcDetail />) },
      { path: 'qualite/mesures', element: guard(['chef', 'ca', 'admin'], <Mesures />) },

      // ── Équipes ─────────────────────────────────────────
      { path: 'equipes', element: guard(['chef', 'ca', 'admin'], <EquipesList />) },
      { path: 'equipes/effectifs', element: guard(['chef_equipe', 'chef', 'ca', 'admin'], <Effectifs />) },

      // ── Reporting ───────────────────────────────────────
      { path: 'reporting', element: guard(['ca', 'admin'], <RapportHebdo />) },
      { path: 'reporting/jour', element: guard(['chef', 'ca', 'admin'], <RapportJour />) },
      { path: 'reporting/dashboard-ca', element: guard(['ca', 'admin'], <DashboardCA />) },
      { path: 'reporting/regie', element: guard(['chef', 'ca', 'admin'], <RegieList />) },
      { path: 'reporting/regie/:id', element: guard(['chef', 'ca', 'admin'], <RegieEdit />) },
      { path: 'reporting/bon-travail', element: guard(['chef', 'ca', 'admin'], <BonTravail />) },

      // ── Paramètres ──────────────────────────────────────
      { path: 'parametres', element: guard(['ca', 'admin'], <ParamChantier />) },
      { path: 'parametres/equipes', element: guard(['ca', 'admin'], <ParamEquipes />) },
      { path: 'parametres/task-types', element: guard(['ca', 'admin'], <ParamTaskTypes />) },
      { path: 'parametres/zones', element: guard(['chef', 'ca', 'admin'], <ParamZones />) },

      // ── Admin ────────────────────────────────────────────
      { path: 'admin', element: guard(['admin'], <AdminPanel />) },

      // ── Route QR direct (depuis scan physique) ──────────
      { path: 'zone/:qrCode', element: <PlanViewer /> },
      { path: 'zone-tasks/:qrCode', element: <ZoneTasksView /> },
    ]
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
])
