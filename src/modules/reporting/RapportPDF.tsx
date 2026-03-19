import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { getSemaineLabel } from '@/utils/dates'
import type { Chantier, Task, NonConformite } from '@/types/models'

interface Stats {
  tasks: Task[]
  ncs: NonConformite[]
  ppc: number | null
  avancement: number
  tasksRealisees: number
  tasksEngagees: number
  blocages: Task[]
  totalHeures: number
  totalPresents: number
  totalPrevus: number
}

const S = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, padding: 32, backgroundColor: '#FFFFFF' },
  headerBar:   { backgroundColor: '#2C3E50', padding: '12 16', marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 8, marginTop: 2 },
  headerRight: { color: '#C0392B', fontSize: 18, fontFamily: 'Helvetica-Bold' },
  section:     { marginBottom: 14 },
  sectionTitle:{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2C3E50', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4, marginBottom: 8 },
  kpiRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpiBox:      { flex: 1, backgroundColor: '#F9FAFB', border: '1 solid #E5E7EB', borderRadius: 6, padding: '8 10' },
  kpiLabel:    { color: '#9CA3AF', fontSize: 7, marginBottom: 2 },
  kpiValue:    { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2C3E50' },
  kpiSub:      { color: '#9CA3AF', fontSize: 7, marginTop: 1 },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 5, gap: 6 },
  th:          { fontFamily: 'Helvetica-Bold', color: '#6B7280', fontSize: 7, flex: 1 },
  td:          { color: '#374151', fontSize: 8, flex: 1 },
  badge:       { fontSize: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  footer:      { position: 'absolute', bottom: 16, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { color: '#9CA3AF', fontSize: 7 },
})

function getPpcColor(ppc: number | null): string {
  if (ppc === null) return '#94A3B8'
  if (ppc >= 80) return '#22C55E'
  if (ppc >= 60) return '#F59E0B'
  return '#EF4444'
}

interface Props {
  chantier: Chantier
  semaine: string
  stats: Stats
}

export function RapportPDF({ chantier, semaine, stats }: Props) {
  const semaineLabel = getSemaineLabel(semaine)
  const now = new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
  const tasksDone = stats.tasks.filter(t => t.status === 'done')
  const tasksBlocked = stats.tasks.filter(t => t.status === 'blocked')

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* En-tête */}
        <View style={S.headerBar}>
          <View>
            <Text style={S.headerTitle}>NEOCLIMA — Rapport Hebdomadaire</Text>
            <Text style={S.headerSub}>{chantier.name}{chantier.client ? ` · ${chantier.client}` : ''}</Text>
            <Text style={S.headerSub}>{semaineLabel}</Text>
          </View>
          <View>
            <Text style={S.headerRight}>
              PPC {stats.ppc !== null ? `${stats.ppc}%` : '—'}
            </Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Indicateurs clés</Text>
          <View style={S.kpiRow}>
            <View style={S.kpiBox}>
              <Text style={S.kpiLabel}>PPC semaine</Text>
              <Text style={[S.kpiValue, { color: getPpcColor(stats.ppc) }]}>
                {stats.ppc !== null ? `${stats.ppc}%` : '—'}
              </Text>
              <Text style={S.kpiSub}>{stats.tasksRealisees}/{stats.tasksEngagees} engagées</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={S.kpiLabel}>Avancement global</Text>
              <Text style={S.kpiValue}>{stats.avancement}%</Text>
              <Text style={S.kpiSub}>{tasksDone.length}/{stats.tasks.length} tâches</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={S.kpiLabel}>Effectif</Text>
              <Text style={S.kpiValue}>{stats.totalPresents}/{stats.totalPrevus}</Text>
              <Text style={S.kpiSub}>{stats.totalHeures}h productives</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={S.kpiLabel}>NC ouvertes</Text>
              <Text style={[S.kpiValue, { color: '#EF4444' }]}>
                {stats.ncs.filter(n => n.statut === 'ouverte' || n.statut === 'en_cours').length}
              </Text>
              <Text style={S.kpiSub}>{stats.ncs.filter(n => n.gravite === 'bloquante').length} bloquante(s)</Text>
            </View>
          </View>
        </View>

        {/* Tâches terminées */}
        {tasksDone.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Tâches réalisées ({tasksDone.length})</Text>
            <View style={S.row}>
              <Text style={S.th}>Tâche</Text>
              <Text style={[S.th, { flex: 0.5 }]}>Qté</Text>
              <Text style={[S.th, { flex: 0.7 }]}>Équipe</Text>
            </View>
            {tasksDone.slice(0, 15).map(t => (
              <View key={t.id} style={S.row}>
                <Text style={S.td}>{t.label}</Text>
                <Text style={[S.td, { flex: 0.5 }]}>{t.qte_realisee} {t.unite}</Text>
                <Text style={[S.td, { flex: 0.7, color: '#6B7280' }]}>{t.equipe?.name ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Blocages */}
        {tasksBlocked.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Blocages ({tasksBlocked.length})</Text>
            <View style={S.row}>
              <Text style={S.th}>Tâche</Text>
              <Text style={[S.th, { flex: 0.7 }]}>Type</Text>
              <Text style={S.th}>Description</Text>
            </View>
            {tasksBlocked.map(t => (
              <View key={t.id} style={S.row}>
                <Text style={[S.td, { color: '#DC2626' }]}>{t.label}</Text>
                <Text style={[S.td, { flex: 0.7, color: '#9CA3AF' }]}>{t.type_blocage ?? '—'}</Text>
                <Text style={S.td}>{t.comment ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Non-conformités */}
        {stats.ncs.filter(n => n.statut !== 'validee').length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>
              Non-conformités actives ({stats.ncs.filter(n => n.statut !== 'validee').length})
            </Text>
            <View style={S.row}>
              <Text style={[S.th, { flex: 0.5 }]}>N°</Text>
              <Text style={S.th}>Titre</Text>
              <Text style={[S.th, { flex: 0.6 }]}>Gravité</Text>
              <Text style={[S.th, { flex: 0.6 }]}>Statut</Text>
            </View>
            {stats.ncs.filter(n => n.statut !== 'validee').map(nc => (
              <View key={nc.id} style={S.row}>
                <Text style={[S.td, { flex: 0.5 }]}>NC-{String(nc.numero).padStart(3, '0')}</Text>
                <Text style={S.td}>{nc.titre}</Text>
                <Text style={[S.td, { flex: 0.6, color: nc.gravite === 'bloquante' ? '#7F1D1D' : nc.gravite === 'majeure' ? '#EF4444' : '#F59E0B', fontFamily: 'Helvetica-Bold' }]}>
                  {nc.gravite}
                </Text>
                <Text style={[S.td, { flex: 0.6, color: '#6B7280' }]}>{nc.statut}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Neoclima Field Tracker V2 · Généré le {now}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
