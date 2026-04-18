import { createClient } from '@supabase/supabase-js'
import type {
  Chantier, Secteur, ZoneTakt, CycleTakt, Task, TaskPhase,
  Contrainte, NonConformite, Mesure, Photo, TaskHistory,
  Effectif, Equipe, Utilisateur, WeeklyPlan, TaskType,
  PlanVersion, Materiau, SyncQueueItem, VueAvancementZone,
  Entreprise, Personne, AccesChantier, LoginPersonneResult
} from '@/types/models'

// ── Client Supabase ─────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Variables Supabase manquantes. Copier .env.example vers .env et remplir les valeurs.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    },
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  }
)

// ── Helpers ─────────────────────────────────────────────────

function handleError(error: unknown, context: string): never {
  const msg = error instanceof Error ? error.message : String(error)
  throw new Error(`[Supabase ${context}] ${msg}`)
}

// ── AUTH / SESSION ──────────────────────────────────────────

export async function loginWithPin(codePin: string, chantierId: string): Promise<Utilisateur | null> {
  // Vérifie le PIN via SECURITY DEFINER — RLS désactivé, anon key suffit
  const { data: rows, error: rpcError } = await supabase
    .rpc('login_with_pin', { p_code_pin: codePin, p_chantier_id: chantierId })

  if (rpcError || !rows || rows.length === 0) return null
  const row = rows[0] as {
    user_id: string; nom: string; prenom: string
    role: string; equipe_id: string | null; chantier_id: string
  }

  // Charger l'objet utilisateur complet avec son équipe
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*, equipe:equipes(*)')
    .eq('id', row.user_id)
    .single()
  if (error) return null
  return data as Utilisateur
}

export async function logoutUser(): Promise<void> {
  // Pas de session Supabase Auth à fermer (auth par PIN uniquement)
}

export async function getUtilisateurById(id: string): Promise<Utilisateur | null> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*, equipe:equipes(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Utilisateur
}

// ── CHANTIERS ───────────────────────────────────────────────

export async function getChantiers(): Promise<Chantier[]> {
  // Utilise une fonction SECURITY DEFINER — accessible avant login (écran de sélection chantier)
  const { data, error } = await supabase.rpc('get_chantiers_actifs')
  if (error) handleError(error, 'getChantiers')
  return (data ?? []) as Chantier[]
}

export async function getChantierById(id: string): Promise<Chantier | null> {
  const { data, error } = await supabase
    .from('chantiers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Chantier
}

export async function upsertChantier(chantier: Partial<Chantier>): Promise<Chantier> {
  const { data, error } = await supabase
    .from('chantiers')
    .upsert(chantier)
    .select()
    .single()
  if (error) handleError(error, 'upsertChantier')
  return data as Chantier
}

// ── SECTEURS ────────────────────────────────────────────────

export async function getSecteurs(chantierId: string): Promise<Secteur[]> {
  const { data, error } = await supabase
    .from('secteurs')
    .select('*')
    .eq('chantier_id', chantierId)
    .order('ordre')
  if (error) handleError(error, 'getSecteurs')
  return (data ?? []) as Secteur[]
}

export async function upsertSecteur(secteur: Partial<Secteur>): Promise<Secteur> {
  const { data, error } = await supabase
    .from('secteurs')
    .upsert(secteur)
    .select()
    .single()
  if (error) handleError(error, 'upsertSecteur')
  return data as Secteur
}

export async function deleteSecteur(id: string): Promise<void> {
  const { error } = await supabase.from('secteurs').delete().eq('id', id)
  if (error) handleError(error, 'deleteSecteur')
}

// ── ZONES TAKT ──────────────────────────────────────────────

export async function getZonesTakt(secteurId: string): Promise<ZoneTakt[]> {
  const { data, error } = await supabase
    .from('zones_takt')
    .select('*')
    .eq('secteur_id', secteurId)
    .order('ordre')
  if (error) handleError(error, 'getZonesTakt')
  return (data ?? []) as ZoneTakt[]
}

export async function getZonesByChantier(chantierId: string): Promise<ZoneTakt[]> {
  // Étape 1 : secteurs du chantier
  const { data: secteurs } = await supabase
    .from('secteurs')
    .select('id')
    .eq('chantier_id', chantierId)
  const secteurIds = (secteurs ?? []).map((s: { id: string }) => s.id)
  if (secteurIds.length === 0) return []

  // Étape 2 : zones avec leur secteur (pour l'affichage)
  const { data, error } = await supabase
    .from('zones_takt')
    .select('*, secteur:secteurs(*)')
    .in('secteur_id', secteurIds)
    .order('ordre')
  if (error) handleError(error, 'getZonesByChantier')
  return (data ?? []) as ZoneTakt[]
}

export async function getZoneByQrCode(qrCode: string): Promise<ZoneTakt | null> {
  const { data, error } = await supabase
    .from('zones_takt')
    .select('*, secteur:secteurs(*)')
    .eq('qr_code', qrCode)
    .single()
  if (error) return null
  return data as ZoneTakt
}

export async function upsertZoneTakt(zone: Partial<ZoneTakt>): Promise<ZoneTakt> {
  const { data, error } = await supabase
    .from('zones_takt')
    .upsert(zone)
    .select()
    .single()
  if (error) handleError(error, 'upsertZoneTakt')
  return data as ZoneTakt
}

export async function deleteZoneTakt(id: string): Promise<void> {
  const { error } = await supabase.from('zones_takt').delete().eq('id', id)
  if (error) handleError(error, 'deleteZoneTakt')
}

// ── CYCLES TAKT ─────────────────────────────────────────────

export async function getCyclesByZone(zoneTaktId: string): Promise<CycleTakt[]> {
  const { data, error } = await supabase
    .from('cycles_takt')
    .select('*')
    .eq('zone_takt_id', zoneTaktId)
    .order('semaine', { ascending: false })
  if (error) handleError(error, 'getCyclesByZone')
  return (data ?? []) as CycleTakt[]
}

export async function getCyclesBySemaine(chantierId: string, semaine: string): Promise<CycleTakt[]> {
  // Étape 1 : secteurs du chantier
  const { data: secteurs } = await supabase
    .from('secteurs')
    .select('id')
    .eq('chantier_id', chantierId)
  const secteurIds = (secteurs ?? []).map((s: { id: string }) => s.id)
  if (secteurIds.length === 0) return []

  // Étape 2 : zones des secteurs
  const { data: zones } = await supabase
    .from('zones_takt')
    .select('id')
    .in('secteur_id', secteurIds)
  const zoneIds = (zones ?? []).map((z: { id: string }) => z.id)
  if (zoneIds.length === 0) return []

  // Étape 3 : cycles de ces zones pour la semaine donnée
  const { data, error } = await supabase
    .from('cycles_takt')
    .select('*, zone_takt:zones_takt(*)')
    .in('zone_takt_id', zoneIds)
    .eq('semaine', semaine)
  if (error) handleError(error, 'getCyclesBySemaine')
  return (data ?? []) as CycleTakt[]
}

export async function getAllCyclesByChantier(chantierId: string): Promise<CycleTakt[]> {
  // Étape 1 : secteurs du chantier
  const { data: secteurs } = await supabase
    .from('secteurs')
    .select('id')
    .eq('chantier_id', chantierId)
  const secteurIds = (secteurs ?? []).map((s: { id: string }) => s.id)
  if (secteurIds.length === 0) return []

  // Étape 2 : zones des secteurs
  const { data: zones } = await supabase
    .from('zones_takt')
    .select('id')
    .in('secteur_id', secteurIds)
  const zoneIds = (zones ?? []).map((z: { id: string }) => z.id)
  if (zoneIds.length === 0) return []

  // Étape 3 : tous les cycles de ces zones (toutes semaines)
  const { data, error } = await supabase
    .from('cycles_takt')
    .select('*, zone_takt:zones_takt(*)')
    .in('zone_takt_id', zoneIds)
    .order('semaine', { ascending: true })
  if (error) handleError(error, 'getAllCyclesByChantier')
  return (data ?? []) as CycleTakt[]
}

export async function upsertCycle(cycle: Partial<CycleTakt>): Promise<CycleTakt> {
  const { data, error } = await supabase
    .from('cycles_takt')
    .upsert(cycle)
    .select()
    .single()
  if (error) handleError(error, 'upsertCycle')
  return data as CycleTakt
}

// ── TASKS ───────────────────────────────────────────────────

export async function getTasksDuJour(equipeId: string, date: string): Promise<Task[]> {
  // date = lundi de la semaine courante (ISO) — on charge toute la semaine (lundi → dimanche)
  const monday = new Date(date)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const sundayISO = sunday.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('tasks')
    .select('*, equipe:equipes(*), zone_takt:zones_takt(*), phases:task_phases(*), contraintes(*)')
    .eq('equipe_id', equipeId)
    .gte('date_planifiee', date)
    .lte('date_planifiee', sundayISO)
    .order('date_planifiee')
    .order('created_at')
  if (error) handleError(error, 'getTasksDuJour')
  return (data ?? []) as Task[]
}

export async function getTasksByZone(
  zoneTaktId: string,
  filters?: { equipeId?: string; semaine?: string }
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*, equipe:equipes(*), phases:task_phases(*), contraintes(*), photos(*)')
    .eq('zone_takt_id', zoneTaktId)

  // Filtre équipe si fourni
  if (filters?.equipeId) query = query.eq('equipe_id', filters.equipeId)

  // Filtre semaine courante si fourni (lundi → dimanche)
  if (filters?.semaine) {
    const monday = new Date(filters.semaine)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    query = query
      .gte('date_planifiee', filters.semaine)
      .lte('date_planifiee', sunday.toISOString().split('T')[0])
  }

  const { data, error } = await query.order('date_planifiee', { ascending: true })
  if (error) handleError(error, 'getTasksByZone')
  return (data ?? []) as Task[]
}

export async function getTasksByCycle(cycleId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, equipe:equipes(*), phases:task_phases(*), contraintes(*)')
    .eq('cycle_id', cycleId)
    .order('date_planifiee', { ascending: true })
  if (error) handleError(error, 'getTasksByCycle')
  return (data ?? []) as Task[]
}

export async function getTasksByChantier(chantierId: string, filters?: {
  semaine?: string
  equipeId?: string
  status?: string
}): Promise<Task[]> {
  // Étape 1 : secteurs du chantier
  const { data: secteurs } = await supabase
    .from('secteurs')
    .select('id')
    .eq('chantier_id', chantierId)
  const secteurIds = (secteurs ?? []).map((s: { id: string }) => s.id)
  if (secteurIds.length === 0) return []

  // Étape 2 : zones des secteurs
  const { data: zones } = await supabase
    .from('zones_takt')
    .select('id')
    .in('secteur_id', secteurIds)
  const zoneIds = (zones ?? []).map((z: { id: string }) => z.id)
  if (zoneIds.length === 0) return []

  let query = supabase
    .from('tasks')
    .select('*, equipe:equipes(*), zone_takt:zones_takt(*, secteur:secteurs(*))')
    .in('zone_takt_id', zoneIds)

  if (filters?.semaine) query = query.eq('date_planifiee', filters.semaine)
  if (filters?.equipeId) query = query.eq('equipe_id', filters.equipeId)
  if (filters?.status)   query = query.eq('status', filters.status)

  const { data, error } = await query.order('date_planifiee', { ascending: true })
  if (error) handleError(error, 'getTasksByChantier')
  return (data ?? []) as Task[]
}

export async function getTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, equipe:equipes(*), zone_takt:zones_takt(*), task_type:task_types(*), phases:task_phases(*), contraintes(*, materiaux(*)), photos(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Task
}

export async function updateTaskStatus(id: string, status: Task['status'], updates?: Partial<Task>): Promise<Task> {
  const payload: Partial<Task> = { status, ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) handleError(error, 'updateTaskStatus')
  return data as Task
}

export async function upsertTask(task: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .upsert({ ...task, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) handleError(error, 'upsertTask')
  return data as Task
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) handleError(error, 'updateTask')
  return data as Task
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) handleError(error, 'deleteTask')
}

// ── TASK PHASES ─────────────────────────────────────────────

export async function getPhasesByTask(taskId: string): Promise<TaskPhase[]> {
  const { data, error } = await supabase
    .from('task_phases')
    .select('*')
    .eq('task_id', taskId)
    .order('ordre')
  if (error) handleError(error, 'getPhasesByTask')
  return (data ?? []) as TaskPhase[]
}

export async function updatePhaseStatus(id: string, status: TaskPhase['status']): Promise<TaskPhase> {
  const { data, error } = await supabase
    .from('task_phases')
    .update({ status, date_fin: status === 'done' ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .single()
  if (error) handleError(error, 'updatePhaseStatus')
  return data as TaskPhase
}

// ── CONTRAINTES ─────────────────────────────────────────────

export async function getContraintesByTask(taskId: string): Promise<Contrainte[]> {
  const { data, error } = await supabase
    .from('contraintes')
    .select('*, materiaux(*)')
    .eq('task_id', taskId)
    .order('date_besoin', { ascending: true })
  if (error) handleError(error, 'getContraintesByTask')
  return (data ?? []) as Contrainte[]
}

export async function getContraintesUrgentes(chantierId: string): Promise<Contrainte[]> {
  const { data, error } = await supabase
    .from('vue_contraintes_urgentes')
    .select('*')
    .eq('chantier_id', chantierId)
    .order('date_besoin', { ascending: true })
  if (error) handleError(error, 'getContraintesUrgentes')
  return (data ?? []) as Contrainte[]
}

export async function upsertContrainte(contrainte: Partial<Contrainte>): Promise<Contrainte> {
  const { data, error } = await supabase
    .from('contraintes')
    .upsert(contrainte)
    .select()
    .single()
  if (error) handleError(error, 'upsertContrainte')
  return data as Contrainte
}

export async function leverContrainte(id: string): Promise<Contrainte> {
  const { data, error } = await supabase
    .from('contraintes')
    .update({ statut: 'levee', date_levee_reel: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) handleError(error, 'leverContrainte')
  return data as Contrainte
}

// ── NON-CONFORMITÉS ─────────────────────────────────────────

export async function getNonConformites(chantierId: string, filters?: { statut?: string; gravite?: string }): Promise<NonConformite[]> {
  // Étape 1 : secteurs du chantier
  const { data: secteurs } = await supabase
    .from('secteurs')
    .select('id')
    .eq('chantier_id', chantierId)
  const secteurIds = (secteurs ?? []).map((s: { id: string }) => s.id)
  if (secteurIds.length === 0) return []

  // Étape 2 : zones des secteurs
  const { data: zones } = await supabase
    .from('zones_takt')
    .select('id')
    .in('secteur_id', secteurIds)
  const zoneIds = (zones ?? []).map((z: { id: string }) => z.id)
  if (zoneIds.length === 0) return []

  let query = supabase
    .from('non_conformites')
    .select('*, photos(*), equipe:equipes(*), zone_takt:zones_takt(*)')
    .in('zone_takt_id', zoneIds)

  if (filters?.statut) query = query.eq('statut', filters.statut)
  if (filters?.gravite) query = query.eq('gravite', filters.gravite)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) handleError(error, 'getNonConformites')
  return (data ?? []) as NonConformite[]
}

export async function upsertNonConformite(nc: Partial<NonConformite>): Promise<NonConformite> {
  const { data, error } = await supabase
    .from('non_conformites')
    .upsert({ ...nc, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) handleError(error, 'upsertNonConformite')
  return data as NonConformite
}

// ── MESURES ─────────────────────────────────────────────────

export async function getMesures(chantierId: string): Promise<Mesure[]> {
  const { data, error } = await supabase
    .from('mesures')
    .select('*')
    .eq('chantier_id', chantierId)
    .order('date_mesure', { ascending: false })
  if (error) handleError(error, 'getMesures')
  return (data ?? []) as Mesure[]
}

export async function upsertMesure(mesure: Partial<Mesure>): Promise<Mesure> {
  const { data, error } = await supabase
    .from('mesures')
    .upsert(mesure)
    .select()
    .single()
  if (error) handleError(error, 'upsertMesure')
  return data as Mesure
}

// ── PHOTOS ──────────────────────────────────────────────────

export async function uploadPhoto(file: File, path: string): Promise<string> {
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) handleError(error, 'uploadPhoto')
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

export async function savePhoto(photo: Partial<Photo>): Promise<Photo> {
  const { data, error } = await supabase
    .from('photos')
    .insert(photo)
    .select()
    .single()
  if (error) handleError(error, 'savePhoto')
  return data as Photo
}

export async function getPhotosByTask(taskId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
  if (error) handleError(error, 'getPhotosByTask')
  return (data ?? []) as Photo[]
}

// ── TASK HISTORY ────────────────────────────────────────────

export async function addTaskHistory(taskId: string, role: string, action: string, detail?: string): Promise<void> {
  const { error } = await supabase
    .from('task_history')
    .insert({ task_id: taskId, role, action, detail })
  if (error) handleError(error, 'addTaskHistory')
}

// ── ÉQUIPES ─────────────────────────────────────────────────

export async function getEquipes(chantierId: string): Promise<Equipe[]> {
  const { data, error } = await supabase
    .from('equipes')
    .select('*')
    .eq('chantier_id', chantierId)
    .eq('actif', true)
    .order('name')
  if (error) handleError(error, 'getEquipes')
  return (data ?? []) as Equipe[]
}

export async function upsertEquipe(equipe: Partial<Equipe>): Promise<Equipe> {
  const { data, error } = await supabase
    .from('equipes')
    .upsert(equipe)
    .select()
    .single()
  if (error) handleError(error, 'upsertEquipe')
  return data as Equipe
}

// ── UTILISATEURS ────────────────────────────────────────────

export async function getUtilisateurs(chantierId: string): Promise<Utilisateur[]> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*, equipe:equipes(*)')
    .eq('chantier_id', chantierId)
    .eq('actif', true)
    .order('nom')
  if (error) handleError(error, 'getUtilisateurs')
  return (data ?? []) as Utilisateur[]
}

// Admin : tous les utilisateurs (actifs + inactifs)
export async function getUtilisateursAll(chantierId: string): Promise<Utilisateur[]> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*, equipe:equipes(*)')
    .eq('chantier_id', chantierId)
    .order('nom')
  if (error) handleError(error, 'getUtilisateursAll')
  return (data ?? []) as Utilisateur[]
}

export async function setUtilisateurActif(id: string, actif: boolean): Promise<void> {
  const { error } = await supabase.from('utilisateurs').update({ actif }).eq('id', id)
  if (error) handleError(error, 'setUtilisateurActif')
}

export async function upsertUtilisateur(user: Partial<Utilisateur>): Promise<Utilisateur> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .upsert(user)
    .select()
    .single()
  if (error) handleError(error, 'upsertUtilisateur')
  return data as Utilisateur
}

// ── EFFECTIFS ───────────────────────────────────────────────

export async function getEffectifs(chantierId: string, date: string): Promise<Effectif[]> {
  const { data, error } = await supabase
    .from('effectifs')
    .select('*, equipe:equipes(*)')
    .eq('chantier_id', chantierId)
    .eq('date', date)
  if (error) handleError(error, 'getEffectifs')
  return (data ?? []) as Effectif[]
}

export async function upsertEffectif(effectif: Partial<Effectif>): Promise<Effectif> {
  const { data, error } = await supabase
    .from('effectifs')
    .upsert(effectif)
    .select()
    .single()
  if (error) handleError(error, 'upsertEffectif')
  return data as Effectif
}

// ── WEEKLY PLANS ────────────────────────────────────────────

export async function getWeeklyPlan(chantierId: string, semaine: string): Promise<WeeklyPlan | null> {
  const { data, error } = await supabase
    .from('weekly_plans')
    .select('*')
    .eq('chantier_id', chantierId)
    .eq('semaine', semaine)
    .single()
  if (error) return null
  return data as WeeklyPlan
}

export async function upsertWeeklyPlan(plan: Partial<WeeklyPlan>): Promise<WeeklyPlan> {
  const { data, error } = await supabase
    .from('weekly_plans')
    .upsert(plan)
    .select()
    .single()
  if (error) handleError(error, 'upsertWeeklyPlan')
  return data as WeeklyPlan
}

// ── TASK TYPES ──────────────────────────────────────────────

export async function getTaskTypes(chantierId: string): Promise<TaskType[]> {
  const { data, error } = await supabase
    .from('task_types')
    .select('*')
    .eq('chantier_id', chantierId)
    .order('name')
  if (error) handleError(error, 'getTaskTypes')
  return (data ?? []) as TaskType[]
}

export async function upsertTaskType(taskType: Partial<TaskType>): Promise<TaskType> {
  const { data, error } = await supabase
    .from('task_types')
    .upsert(taskType)
    .select()
    .single()
  if (error) handleError(error, 'upsertTaskType')
  return data as TaskType
}

export async function deleteTaskType(id: string): Promise<void> {
  const { error } = await supabase.from('task_types').delete().eq('id', id)
  if (error) handleError(error, 'deleteTaskType')
}

export async function deleteUtilisateur(id: string): Promise<void> {
  const { error } = await supabase.from('utilisateurs').delete().eq('id', id)
  if (error) handleError(error, 'deleteUtilisateur')
}

// ── PLANS VERSIONS ──────────────────────────────────────────

export async function getPlanVersions(zoneTaktId: string): Promise<PlanVersion[]> {
  const { data, error } = await supabase
    .from('plans_versions')
    .select('*')
    .eq('zone_takt_id', zoneTaktId)
    .order('version', { ascending: false })
  if (error) handleError(error, 'getPlanVersions')
  return (data ?? []) as PlanVersion[]
}

export async function uploadPlan(file: File, zoneTaktId: string): Promise<string> {
  const path = `plans/zone-${zoneTaktId}/v${Date.now()}.pdf`
  const { error } = await supabase.storage
    .from('plans')
    .upload(path, file, { cacheControl: '604800', upsert: false })
  if (error) handleError(error, 'uploadPlan')
  const { data } = supabase.storage.from('plans').getPublicUrl(path)
  return data.publicUrl
}

// ── MATÉRIAUX ───────────────────────────────────────────────

export async function getMateriaux(taskId: string): Promise<Materiau[]> {
  const { data, error } = await supabase
    .from('materiaux')
    .select('*')
    .eq('task_id', taskId)
    .order('designation')
  if (error) handleError(error, 'getMateriaux')
  return (data ?? []) as Materiau[]
}

export async function upsertMateriau(materiau: Partial<Materiau>): Promise<Materiau> {
  const { data, error } = await supabase
    .from('materiaux')
    .upsert(materiau)
    .select()
    .single()
  if (error) handleError(error, 'upsertMateriau')
  return data as Materiau
}

// ── VUE AVANCEMENT ──────────────────────────────────────────

export async function getAvancementChantier(chantierId: string): Promise<VueAvancementZone[]> {
  const { data, error } = await supabase
    .from('vue_avancement_zone')
    .select('*')
    .eq('chantier_id', chantierId)
  if (error) handleError(error, 'getAvancementChantier')
  return (data ?? []) as VueAvancementZone[]
}

// ── CRÉATION CHANTIER COMPLET ───────────────────────────────

export interface NouveauChantierPayload {
  nom: string
  adresse: string
  client: string
  date_debut: string
  date_fin_prev: string
  budget_heures: number
  takt_duree: number
  pin_monteur: string
  pin_chef: string
  pin_ca: string
  pin_admin: string
}

export async function createChantierComplet(payload: NouveauChantierPayload): Promise<Chantier> {
  // 1. Créer le chantier
  const { data: ch, error: chErr } = await supabase
    .from('chantiers')
    .insert({
      name: payload.nom,
      adresse: payload.adresse,
      client: payload.client,
      date_debut: payload.date_debut,
      date_fin_prev: payload.date_fin_prev,
      budget_heures: payload.budget_heures,
      takt_duree: payload.takt_duree,
      statut: 'actif'
    })
    .select()
    .single()
  if (chErr) handleError(chErr, 'createChantier')
  const chantier = ch as Chantier

  // 2. Créer 2 équipes par défaut
  const { data: equipes, error: eqErr } = await supabase
    .from('equipes')
    .insert([
      { chantier_id: chantier.id, name: 'Neoclima — Équipe A', couleur: '#2563EB', code_pin: '1100', actif: true },
      { chantier_id: chantier.id, name: 'Sous-traitant montage', couleur: '#D97706', code_pin: '1200', actif: true }
    ])
    .select()
  if (eqErr) handleError(eqErr, 'createEquipes')
  const eqA = (equipes as Equipe[])[0]

  // 3. Créer les utilisateurs de base
  const { error: usErr } = await supabase
    .from('utilisateurs')
    .insert([
      { chantier_id: chantier.id, equipe_id: eqA.id, nom: 'Monteur', prenom: 'Principal', role: 'monteur', code_pin: payload.pin_monteur, actif: true },
      { chantier_id: chantier.id, equipe_id: eqA.id, nom: 'Chef', prenom: 'Chantier', role: 'chef', code_pin: payload.pin_chef, actif: true },
      { chantier_id: chantier.id, equipe_id: null, nom: 'Chargé', prenom: "d'Affaires", role: 'ca', code_pin: payload.pin_ca, actif: true },
      { chantier_id: chantier.id, equipe_id: null, nom: 'Admin', prenom: 'Système', role: 'admin', code_pin: payload.pin_admin, actif: true }
    ])
  if (usErr) handleError(usErr, 'createUtilisateurs')

  // 4. Créer les types de tâches CVC — rendement en pce/h/monteur
  // Conversion : pcs_par_jour / (2 monteurs × 8h) = pcs_par_jour / 16
  const taskTypesList = [
    // ── Appareils ──────────────────────────────────────────────────────
    { name: 'Ventilo-convecteur',                                      unite: 'pce', rendement: 0.375  }, //   6 pcs/j ÷ 16
    // ── Conduites ─────────────────────────────────────────────────────
    { name: 'Gaine galvanisée',                                        unite: 'ml',  rendement: 25     }, // 400 ml/j  ÷ 16
    { name: 'Canaux circulaires galva perforé',                        unite: 'pce', rendement: 2.8125 }, //  45 pcs/j ÷ 16
    { name: 'Canaux circulaires SAFE galva',                           unite: 'pce', rendement: 2.8125 },
    { name: 'Accessoires canaux circulaires SAFE galva',               unite: 'pce', rendement: 2.8125 },
    { name: 'Conduites inox V2A',                                      unite: 'ml',  rendement: 15.625 }, // 250 ml/j  ÷ 16
    { name: 'Canaux circulaires SAFE inox V2A',                        unite: 'pce', rendement: 5.625  }, //  90 pcs/j ÷ 16
    { name: 'Accessoires canaux circulaires SAFE inox V2A',            unite: 'pce', rendement: 2.8125 },
    { name: 'Gaine de désenfumage',                                    unite: 'pce', rendement: 2.8125 },
    // ── Accessoires ───────────────────────────────────────────────────
    { name: "Diffusion d'air par gaines textiles",                     unite: 'pce', rendement: 0.375  }, //   6 pcs/j ÷ 16
    { name: 'Amortisseur de bruit quadratique',                        unite: 'pce', rendement: 2.8125 },
    { name: 'Amortisseur de bruit circulaire',                         unite: 'pce', rendement: 2.8125 },
    { name: 'Amortisseur de bruit quad. (pulsion VCF)',                unite: 'pce', rendement: 2.8125 },
    { name: 'Silencieux circulaire galva',                             unite: 'pce', rendement: 2.8125 },
    { name: 'Clapet de réglage manuel rectangulaire',                  unite: 'pce', rendement: 2.8125 },
    { name: 'Clapet de réglage manuel circulaire',                     unite: 'pce', rendement: 2.8125 },
    { name: 'Registre à iris',                                         unite: 'pce', rendement: 2.8125 },
    { name: 'Régulateur de débits constants circulaire',               unite: 'pce', rendement: 2.8125 },
    { name: 'Diffuseur linéaire à fentes — pulsion',                   unite: 'pce', rendement: 1.25   }, //  20 pcs/j ÷ 16
    { name: "Grilles de diffusion d'air",                              unite: 'pce', rendement: 2.8125 },
    { name: "Caisson pour grilles de pulsion d'air",                   unite: 'pce', rendement: 2.8125 },
    { name: 'Diffuseur plafond hélicoïdal zone admin',                 unite: 'pce', rendement: 1.25   },
    { name: 'Module de soufflage laminaire',                           unite: 'pce', rendement: 2.8125 },
    { name: "Grilles de reprise d'air",                                unite: 'pce', rendement: 2.8125 },
    { name: "Caisson grilles de reprise d'air avec piquage",           unite: 'pce', rendement: 2.8125 },
    { name: 'Diffuseur linéaire à fentes — reprise',                   unite: 'pce', rendement: 1.25   },
    { name: 'Raccord flexible',                                        unite: 'pce', rendement: 2.8125 },
    { name: 'Soupape',                                                 unite: 'pce', rendement: 2.8125 },
    { name: 'Fond grillagé',                                           unite: 'pce', rendement: 2.8125 },
    { name: 'Portillon de révision rect. GALVA',                       unite: 'pce', rendement: 2.8125 },
    { name: 'Grille compensation désenfumage plateau production',      unite: 'pce', rendement: 2.8125 },
    { name: 'Portillon de révision rect. GALVA > +70°C',               unite: 'pce', rendement: 2.8125 },
    { name: 'Portillon de révision rect. GALVA étanche',               unite: 'pce', rendement: 2.8125 },
    { name: 'Portillon de révision rect. GALVA isolé',                 unite: 'pce', rendement: 2.8125 },
    { name: 'Portillon de révision GALVA circulaire',                  unite: 'pce', rendement: 2.8125 },
    { name: 'Portillon de révision rect. V4A',                         unite: 'pce', rendement: 2.8125 },
    { name: 'Plaquette indicatrice autocollante',                      unite: 'pce', rendement: 12.5   }, // 200 pcs/j ÷ 16
    { name: 'Bouchon',                                                 unite: 'pce', rendement: 62.5   }, //1000 pcs/j ÷ 16
    // ── Organes de régulation ─────────────────────────────────────────
    { name: 'VAV rectangulaire galva',                                 unite: 'pce', rendement: 2.8125 },
    { name: 'VAV circulaire galva',                                    unite: 'pce', rendement: 2.8125 },
    { name: 'CCF rectangulaire GALVA',                                 unite: 'pce', rendement: 0.5    }, //   8 pcs/j ÷ 16
    { name: 'Kit de montage CCF pour parois légères',                  unite: 'pce', rendement: 0.5    },
    { name: 'CCF circulaire GALVA',                                    unite: 'pce', rendement: 0.5    },
    { name: 'Clapets de désenfumage',                                  unite: 'pce', rendement: 0.5    },
    { name: 'Clapets de fermeture V4A 600°C',                         unite: 'pce', rendement: 0.5    },
    { name: 'Régulateur de débit constant mécanique circulaire',       unite: 'pce', rendement: 2.8125 },
    { name: 'VAV rectangulaire V2A',                                   unite: 'pce', rendement: 2.8125 },
    { name: 'Clapets de fermeture galva',                              unite: 'pce', rendement: 2.8125 },
    { name: 'Pose des périphériques',                                  unite: 'pce', rendement: 2.8125 },
  ]
  const { error: ttErr } = await supabase
    .from('task_types')
    .insert(taskTypesList.map(t => ({ ...t, chantier_id: chantier.id, cout_unitaire: 0 })))
  if (ttErr) handleError(ttErr, 'createTaskTypes')

  return chantier
}

// ═══════════════════════════════════════════════════════════
// MULTI-ENTREPRISE
// ═══════════════════════════════════════════════════════════

// ── Vérifier qu'un code entreprise existe ──────────────────
export async function getEntrepriseByCode(
  code: string
): Promise<{ id: string; name: string; code_acces: string } | null> {
  const { data, error } = await supabase.rpc('get_entreprise_by_code', { p_code: code })
  if (error || !data || data.length === 0) return null
  return data[0] as { id: string; name: string; code_acces: string }
}

// ── Login multi-entreprise ──────────────────────────────────
// Retourne 0 (mauvais code/PIN), 1 (login direct) ou N (sélecteur)
export async function loginPersonne(
  codeEntreprise: string,
  codePin: string
): Promise<LoginPersonneResult[]> {
  const { data, error } = await supabase.rpc('login_personne', {
    p_code_entreprise: codeEntreprise,
    p_code_pin: codePin
  })
  if (error) return []
  return (data ?? []) as LoginPersonneResult[]
}

// ── CRUD Entreprises ────────────────────────────────────────

export async function getEntreprises(): Promise<Entreprise[]> {
  const { data, error } = await supabase
    .from('entreprises')
    .select('*')
    .order('name')
  if (error) handleError(error, 'getEntreprises')
  return (data ?? []) as Entreprise[]
}

export async function upsertEntreprise(e: Partial<Entreprise>): Promise<Entreprise> {
  // Forcer UPPERCASE sur le code
  const payload = e.code_acces
    ? { ...e, code_acces: e.code_acces.toUpperCase().trim() }
    : e
  const { data, error } = await supabase
    .from('entreprises')
    .upsert(payload)
    .select()
    .single()
  if (error) handleError(error, 'upsertEntreprise')
  return data as Entreprise
}

export async function deleteEntreprise(id: string): Promise<void> {
  const { error } = await supabase.from('entreprises').delete().eq('id', id)
  if (error) handleError(error, 'deleteEntreprise')
}

// ── CRUD Personnes ──────────────────────────────────────────

export async function getPersonnesByEntreprise(entrepriseId: string): Promise<Personne[]> {
  const { data, error } = await supabase
    .from('personnes')
    .select('*')
    .eq('entreprise_id', entrepriseId)
    .order('nom')
  if (error) handleError(error, 'getPersonnesByEntreprise')
  return (data ?? []) as Personne[]
}

export async function upsertPersonne(p: Partial<Personne>): Promise<Personne> {
  const { data, error } = await supabase
    .from('personnes')
    .upsert(p)
    .select()
    .single()
  if (error) handleError(error, 'upsertPersonne')
  return data as Personne
}

export async function deletePersonne(id: string): Promise<void> {
  const { error } = await supabase.from('personnes').delete().eq('id', id)
  if (error) handleError(error, 'deletePersonne')
}

export async function setPersonneActif(id: string, actif: boolean): Promise<void> {
  const { error } = await supabase.from('personnes').update({ actif }).eq('id', id)
  if (error) handleError(error, 'setPersonneActif')
}

// ── Accès chantier ──────────────────────────────────────────

export async function getAccesByChantier(chantierId: string): Promise<AccesChantier[]> {
  const { data, error } = await supabase
    .from('acces_chantier')
    .select('*')
    .eq('chantier_id', chantierId)
  if (error) handleError(error, 'getAccesByChantier')
  return (data ?? []) as AccesChantier[]
}

export async function getAccesByPersonne(personneId: string): Promise<AccesChantier[]> {
  const { data, error } = await supabase
    .from('acces_chantier')
    .select('*')
    .eq('personne_id', personneId)
  if (error) handleError(error, 'getAccesByPersonne')
  return (data ?? []) as AccesChantier[]
}

export async function addAccesChantier(
  personneId: string,
  chantierId: string,
  equipeId?: string
): Promise<void> {
  const { error } = await supabase
    .from('acces_chantier')
    .upsert({ personne_id: personneId, chantier_id: chantierId, equipe_id: equipeId ?? null })
  if (error) handleError(error, 'addAccesChantier')
}

export async function removeAccesChantier(personneId: string, chantierId: string): Promise<void> {
  const { error } = await supabase
    .from('acces_chantier')
    .delete()
    .eq('personne_id', personneId)
    .eq('chantier_id', chantierId)
  if (error) handleError(error, 'removeAccesChantier')
}

// ── SYNC QUEUE ──────────────────────────────────────────────

export async function flushSyncQueue(items: SyncQueueItem[]): Promise<void> {
  for (const item of items) {
    try {
      if (item.operation === 'insert') {
        await supabase.from(item.table_name).insert(item.payload)
      } else if (item.operation === 'update') {
        await supabase.from(item.table_name).update(item.payload).eq('id', item.record_id)
      } else if (item.operation === 'delete') {
        await supabase.from(item.table_name).delete().eq('id', item.record_id)
      }
    } catch {
      // Log silently — item stays in queue for retry
    }
  }
}

// ── REALTIME ────────────────────────────────────────────────

export function subscribeToChantier(
  chantierId: string,
  onTaskChange: (payload: unknown) => void
) {
  return supabase
    .channel(`chantier-${chantierId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      onTaskChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contraintes' },
      onTaskChange
    )
    .subscribe()
}
