// ═══════════════════════════════════════════════════════════
// NEOCLIMA FIELD TRACKER V2 — Types métier TypeScript
// ═══════════════════════════════════════════════════════════

// ── Enums ───────────────────────────────────────────────────

export type ChantierStatut = 'actif' | 'termine' | 'archive'
/**
 * Workflow de validation :
 *   todo → en_cours → a_controler → done (= VALIDÉ par le chef)
 *              ↕ blocked
 * Le monteur pose a_controler ("Terminé"), seul chef/ca/admin
 * valide (done). Seul done compte dans l'avancement et le PPC.
 */
export type TaskStatus = 'todo' | 'en_cours' | 'a_controler' | 'done' | 'blocked'
export type PhaseStatus = 'todo' | 'en_cours' | 'done'
export type CycleStatut = 'planifie' | 'en_cours' | 'complete' | 'partiel'
export type ContrainteType =
  | 'materiau' | 'acces' | 'gros_oeuvre' | 'autre_corps' | 'equipement'
  | 'plan_manquant' | 'erreur_plan' | 'validation' | 'reservation'
  | 'securite' | 'technique' | 'autre'
export type ContrainteStatut = 'ouverte' | 'en_cours' | 'levee'
export type MateriauxStatut = 'manquant' | 'commande' | 'livre'
export type NcGravite = 'mineure' | 'majeure' | 'bloquante'
export type NcStatut = 'ouverte' | 'en_cours' | 'levee' | 'validee'
export type MesureType = 'debit' | 'pression' | 'etancheite' | 'bruit' | 'temperature' | 'autre'
export type PhotoType = 'general' | 'blocage' | 'nc' | 'reception' | 'avant' | 'apres'
/**
 * chef_equipe = responsable sous-traitant : voit toutes les équipes
 * de SON entreprise, déclare les effectifs, mais ne valide jamais
 * définitivement ses propres prestations.
 */
export type UserRole = 'monteur' | 'chef_equipe' | 'chef' | 'ca' | 'admin'
export type WeeklyPlanStatut = 'brouillon' | 'engage' | 'cloture'
export type CauseNonCompletion = 'contrainte_non_levee' | 'ressource_insuffisante' | 'plan_non_disponible' | 'autre'
export type SyncOperation = 'insert' | 'update' | 'delete'

// ── Chantier ────────────────────────────────────────────────

export interface Chantier {
  id: string
  name: string
  adresse: string | null
  client: string | null
  date_debut: string | null
  date_fin_prev: string | null
  budget_heures: number
  takt_duree: number
  statut: ChantierStatut
  created_at: string
}

// ── Équipe ──────────────────────────────────────────────────

export interface Equipe {
  id: string
  chantier_id: string | null
  /** Entreprise propriétaire (cloisonnement sous-traitants) */
  entreprise_id: string | null
  name: string
  couleur: string
  code_pin: string | null
  actif: boolean
  created_at: string
}

// ── Utilisateur ─────────────────────────────────────────────

export interface Utilisateur {
  id: string
  chantier_id: string | null
  equipe_id: string | null
  nom: string
  prenom: string | null
  role: UserRole
  code_pin: string | null
  actif: boolean
  created_at: string
  // Relations
  equipe?: Equipe
}

// ── Secteur ─────────────────────────────────────────────────

export interface Secteur {
  id: string
  chantier_id: string
  name: string
  description: string | null
  /** Bâtiment de rattachement (agrégation dashboard CA) */
  batiment: string | null
  ordre: number
  created_at: string
}

// ── Zone Takt ───────────────────────────────────────────────

export interface ZoneTakt {
  id: string
  secteur_id: string
  name: string
  description: string | null
  superficie: number | null
  volume: number | null
  qr_code: string | null
  plan_url: string | null
  plan_type: string | null
  plan_pages: number
  plan_version: number
  /** Budget en jours-équipe fixé par le CA (1 équipe = 2 monteurs) */
  jours_equipe_prevus: number | null
  ordre: number
  created_at: string
  // Relations
  secteur?: Secteur
  avancement_pct?: number
}

// ── Plan version ────────────────────────────────────────────

export interface PlanVersion {
  id: string
  zone_takt_id: string
  version: number
  url: string
  note: string | null
  cree_par: string | null
  created_at: string
}

// ── Task Type ───────────────────────────────────────────────

export interface TaskType {
  id: string
  chantier_id: string
  name: string
  unite: string
  phases: string[]
  rendement: number | null
  cout_unitaire: number
  /** Lot métier — montage (défaut) ou isolation */
  lot?: 'montage' | 'isolation'
  /** Système CVC par défaut des tâches créées depuis ce type */
  systeme?: string | null
}

// ── Cycle Takt ──────────────────────────────────────────────

export interface CycleTakt {
  id: string
  zone_takt_id: string
  semaine: string
  statut: CycleStatut
  ppc: number | null
  note_chef: string | null
  created_at: string
  // Relations
  zone_takt?: ZoneTakt
  tasks?: Task[]
}

// ── Rect (position sur plan) ────────────────────────────────

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// ── Tâche ───────────────────────────────────────────────────

export interface Task {
  id: string
  cycle_id: string | null
  zone_takt_id: string | null
  task_type_id: string | null
  equipe_id: string | null
  /** Héritée de l'équipe via trigger DB (cloisonnement sous-traitants) */
  entreprise_id: string | null
  /** Lot métier — montage (défaut) ou isolation */
  lot: 'montage' | 'isolation'
  /** Système CVC (soufflage, extraction, désenfumage…) — agrégation CA */
  systeme: string | null
  /** Tâche montage dont dépend cette tâche (chaîne montage → isolation) */
  tache_precedente_id: string | null
  /** true tant que le prédécesseur n'est pas validé (maintenu par trigger DB) */
  bloquee_par_predecesseur: boolean
  label: string
  description: string | null
  qte_prevue: number
  qte_realisee: number
  unite: string
  date_planifiee: string | null
  date_debut_reel: string | null
  date_fin_reel: string | null
  heures_prevues: number
  heures_realisees: number
  status: TaskStatus
  type_blocage: string | null
  comment: string | null
  rect: Rect | null
  engage: boolean
  cout_unitaire: number
  created_at: string
  updated_at: string
  // Relations
  equipe?: Equipe
  zone_takt?: ZoneTakt
  task_type?: TaskType
  phases?: TaskPhase[]
  contraintes?: Contrainte[]
  photos?: Photo[]
}

// ── Phase de tâche ──────────────────────────────────────────

export interface TaskPhase {
  id: string
  task_id: string
  name: string
  ordre: number
  status: PhaseStatus
  date_debut: string | null
  date_fin: string | null
  created_at: string
}

// ── Contrainte ──────────────────────────────────────────────

export interface Contrainte {
  id: string
  task_id: string
  cycle_id: string | null
  type: ContrainteType
  description: string
  responsable: string | null
  date_besoin: string | null
  date_levee_prev: string | null
  date_levee_reel: string | null
  statut: ContrainteStatut
  bloquant: boolean
  created_at: string
  // Relations
  materiaux?: Materiau[]
}

// ── Matériau ────────────────────────────────────────────────

export interface Materiau {
  id: string
  contrainte_id: string | null
  task_id: string | null
  designation: string
  reference: string | null
  quantite: number
  unite: string
  fournisseur: string | null
  statut: MateriauxStatut
  date_besoin: string | null
  date_commande: string | null
  date_livraison: string | null
  created_at: string
}

// ── Non-conformité ──────────────────────────────────────────

export interface NonConformite {
  id: string
  task_id: string | null
  zone_takt_id: string
  numero: number
  titre: string
  description: string | null
  gravite: NcGravite
  statut: NcStatut
  assignee_equipe_id: string | null
  date_echeance: string | null
  date_levee: string | null
  valide_par: string | null
  created_at: string
  updated_at: string
  // Relations
  photos?: Photo[]
  equipe?: Equipe
}

// ── Mesure ──────────────────────────────────────────────────

export interface Mesure {
  id: string
  task_id: string | null
  zone_takt_id: string
  chantier_id: string | null
  type: MesureType
  designation: string | null
  valeur_prevue: number | null
  valeur_mesuree: number | null
  unite: string | null
  conforme: boolean | null
  ecart_pct: number | null
  mesure_par: string | null
  date_mesure: string | null
  note: string | null
  created_at: string
}

// ── Photo ───────────────────────────────────────────────────

export interface Photo {
  id: string
  task_id: string | null
  zone_takt_id: string
  nc_id: string | null
  url: string
  x: number | null
  y: number | null
  legende: string | null
  type: PhotoType
  auteur_role: string | null
  created_at: string
}

// ── Historique tâche ────────────────────────────────────────

export interface TaskHistory {
  id: string
  task_id: string
  role: string | null
  action: string | null
  detail: string | null
  /** QUI a fait l'action (traçabilité 18 MCHF) */
  personne_nom: string | null
  entreprise_id: string | null
  created_at: string
}

// ── Travaux supplémentaires ─────────────────────────────────

export type TravauxSuppStatut = 'signale' | 'valide_cc' | 'valide_ca' | 'realise' | 'refuse'

export interface TravauxSupp {
  id: string
  chantier_id: string
  zone_takt_id: string | null
  entreprise_id: string | null
  task_id: string | null
  description: string
  photo_url: string | null
  statut: TravauxSuppStatut
  heures_estimees: number | null
  qte_estimee: string | null
  cree_par: string | null
  cree_par_role: string | null
  valide_cc_par: string | null
  valide_ca_par: string | null
  motif_refus: string | null
  created_at: string
  updated_at: string
  // Relations
  zone_takt?: ZoneTakt
}

// ── Effectif ────────────────────────────────────────────────

export interface Effectif {
  id: string
  chantier_id: string
  equipe_id: string
  date: string
  monteurs_prevus: number
  monteurs_presents: number
  /** Heures travaillées ce jour (défaut 8) — heures réalisées = présents × heures_jour */
  heures_jour: number
  note: string | null
  // Relations
  equipe?: Equipe
}

// ── Weekly Plan ─────────────────────────────────────────────

export interface WeeklyPlan {
  id: string
  chantier_id: string
  semaine: string
  statut: WeeklyPlanStatut
  ppc_global: number | null
  note: string | null
  cree_par: string | null
  created_at: string
}

// ── Sync Queue (offline) ────────────────────────────────────

export interface SyncQueueItem {
  id: string
  device_id: string
  table_name: string
  operation: SyncOperation
  record_id: string | null
  payload: Record<string, unknown>
  synced: boolean
  created_at: string
}

// ── Push Subscription ───────────────────────────────────────

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string | null
  auth_key: string | null
  created_at: string
}

// ── Vue : avancement zone ───────────────────────────────────

export interface VueAvancementZone {
  zone_takt_id: string
  zone_name: string
  chantier_id: string
  total_tasks: number
  tasks_done: number
  tasks_blocked: number
  avancement_pct: number
}

// ── Données dashboard chef ──────────────────────────────────

export interface EquipeDashboard {
  equipe: Equipe
  effectif_prevu: number
  effectif_present: number
  tasks: Task[]
  avancement_pct: number
  tasks_done: number
  tasks_blocked: number
  alertes: string[]
}

// ── PPC Data ────────────────────────────────────────────────

export interface PpcData {
  semaine: string
  ppc: number
  engagees: number
  completees: number
  causes: Record<CauseNonCompletion, number>
}

// ── Lookahead contrainte ─────────────────────────────────────

export interface LookaheadContrainte extends Contrainte {
  task_label: string
  zone_takt_id: string
  zone_name: string
  chantier_id: string
  jours_restants: number
  urgence: 'ok' | 'attention' | 'urgent' | 'retard'
}

// ── Session utilisateur (app state) ─────────────────────────

export interface SessionUtilisateur {
  utilisateur: Utilisateur
  chantier: Chantier
  equipe: Equipe | null
  role: UserRole
  chantierId: string
}

// ═══════════════════════════════════════════════════════════
// ARCHITECTURE MULTI-ENTREPRISE
// ═══════════════════════════════════════════════════════════

// ── Entreprise ──────────────────────────────────────────────

export interface Entreprise {
  id: string
  name: string
  code_acces: string   // Toujours en MAJUSCULES dans la DB
  actif: boolean
  created_at: string
}

// ── Personne ────────────────────────────────────────────────
// Identité unique par personne, indépendante des chantiers.
// Le rôle est le même sur tous les projets.

export interface Personne {
  id: string
  entreprise_id: string
  nom: string
  prenom: string | null
  role: UserRole
  code_pin: string | null
  actif: boolean
  created_at: string
}

// ── AccesChantier ────────────────────────────────────────────

export interface AccesChantier {
  id: string
  personne_id: string
  chantier_id: string
  equipe_id: string | null
  created_at: string
}

// ── Résultat du RPC login_personne ───────────────────────────

export interface LoginPersonneResult {
  personne_id: string
  nom: string
  prenom: string | null
  role: UserRole
  equipe_id: string | null
  /** Renseignés par la version enrichie du RPC (cloisonnement) */
  entreprise_id?: string | null
  entreprise_name?: string | null
  chantier_id: string
  chantier_name: string
  chantier_client: string | null
  chantier_takt_duree: number
  chantier_budget_heures: number
}
