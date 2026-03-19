import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import LoginScreen from '@/components/auth/LoginScreen'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

// Module Production
import MesTaches from '@/modules/production/MesTaches'
import TacheDetail from '@/modules/production/TacheDetail'
import QRScanner from '@/modules/production/QRScanner'
import DashboardChef from '@/modules/production/DashboardChef'
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
import BonTravail from '@/modules/reporting/BonTravail'
import TableauFinancier from '@/modules/reporting/TableauFinancier'

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
      { path: 'production/chef', element: <DashboardChef /> },
      { path: 'production/takt', element: <TableauFluxTakt /> },
      { path: 'production/blocages', element: <BlocagesUrgents /> },

      // ── Planning ────────────────────────────────────────
      { path: 'planning', element: <GanttChantier /> },
      { path: 'planning/lookahead', element: <Lookahead /> },
      { path: 'planning/weekly', element: <WeeklyPlan /> },
      { path: 'planning/ppc', element: <PpcDashboard /> },
      { path: 'planning/contraintes', element: <ContraintesAgenda /> },

      // ── Plans ───────────────────────────────────────────
      { path: 'plans', element: <ZonesList /> },
      { path: 'plans/zone/:id', element: <PlanViewer /> },
      { path: 'plans/zone/:id/viewer', element: <PlanViewer /> },
      { path: 'plans/qr', element: <QrCodePrint /> },

      // ── Qualité ─────────────────────────────────────────
      { path: 'qualite', element: <NonConformites /> },
      { path: 'qualite/nc/:id', element: <NcDetail /> },
      { path: 'qualite/mesures', element: <Mesures /> },

      // ── Équipes ─────────────────────────────────────────
      { path: 'equipes', element: <EquipesList /> },
      { path: 'equipes/effectifs', element: <Effectifs /> },

      // ── Reporting ───────────────────────────────────────
      { path: 'reporting', element: <RapportHebdo /> },
      { path: 'reporting/bon-travail', element: <BonTravail /> },
      { path: 'reporting/financier', element: <TableauFinancier /> },

      // ── Paramètres ──────────────────────────────────────
      { path: 'parametres', element: <ParamChantier /> },
      { path: 'parametres/equipes', element: <ParamEquipes /> },
      { path: 'parametres/task-types', element: <ParamTaskTypes /> },
      { path: 'parametres/zones', element: <ParamZones /> },

      // ── Admin ────────────────────────────────────────────
      { path: 'admin', element: <AdminPanel /> },

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
