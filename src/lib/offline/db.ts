import Dexie, { type Table } from 'dexie'
import type { Task, ZoneTakt, TaskPhase, Photo, Contrainte, Equipe, Utilisateur, TaskType } from '@/types/models'

// ── Sync queue locale (offline mutations) ───────────────────

export interface LocalSyncItem {
  localId?: number
  id: string
  table_name: string
  operation: 'insert' | 'update' | 'delete'
  record_id: string | null
  payload: Record<string, unknown>
  synced: boolean
  created_at: string
  retry_count: number
}

// ── Dexie database ──────────────────────────────────────────

class NCTrackerDB extends Dexie {
  tasks!: Table<Task>
  zones_takt!: Table<ZoneTakt>
  task_phases!: Table<TaskPhase>
  photos!: Table<Photo>
  contraintes!: Table<Contrainte>
  equipes!: Table<Equipe>
  utilisateurs!: Table<Utilisateur>
  task_types!: Table<TaskType>
  sync_queue!: Table<LocalSyncItem>

  constructor() {
    super('NCTracker')

    this.version(1).stores({
      tasks: 'id, zone_takt_id, date_planifiee, status, equipe_id, cycle_id, updated_at',
      zones_takt: 'id, qr_code, secteur_id',
      task_phases: 'id, task_id, ordre',
      photos: 'id, task_id, zone_takt_id, [synced+created_at]',
      contraintes: 'id, task_id, statut',
      equipes: 'id, chantier_id',
      utilisateurs: 'id, chantier_id, equipe_id, role',
      task_types: 'id, chantier_id',
      sync_queue: '++localId, id, synced, created_at'
    })
  }
}

export const db = new NCTrackerDB()

// ── Helpers offline ─────────────────────────────────────────

export async function cacheDonneesTerrain(data: {
  tasks: Task[]
  zones: ZoneTakt[]
  phases: TaskPhase[]
  contraintes: Contrainte[]
  equipes: Equipe[]
  taskTypes: TaskType[]
}): Promise<void> {
  await db.transaction('rw', [db.tasks, db.zones_takt, db.task_phases, db.contraintes, db.equipes, db.task_types], async () => {
    await db.tasks.bulkPut(data.tasks)
    await db.zones_takt.bulkPut(data.zones)
    await db.task_phases.bulkPut(data.phases)
    await db.contraintes.bulkPut(data.contraintes)
    await db.equipes.bulkPut(data.equipes)
    await db.task_types.bulkPut(data.taskTypes)
  })
}

export async function getTasksOffline(equipeId: string, date: string): Promise<Task[]> {
  return db.tasks
    .where('equipe_id').equals(equipeId)
    .and(t => t.date_planifiee === date)
    .toArray()
}

export async function updateTaskOffline(id: string, updates: Partial<Task>): Promise<void> {
  await db.tasks.update(id, { ...updates, updated_at: new Date().toISOString() })
}

export async function addToSyncQueue(item: Omit<LocalSyncItem, 'localId' | 'retry_count'>): Promise<void> {
  await db.sync_queue.add({ ...item, retry_count: 0 })
}

export async function getPendingSyncItems(): Promise<LocalSyncItem[]> {
  return db.sync_queue.where('synced').equals(0).toArray()
}

export async function markSyncItemDone(localId: number): Promise<void> {
  await db.sync_queue.update(localId, { synced: true })
}

export async function clearSyncedItems(): Promise<void> {
  await db.sync_queue.where('synced').equals(1).delete()
}

export async function countPendingSync(): Promise<number> {
  return db.sync_queue.where('synced').equals(0).count()
}
