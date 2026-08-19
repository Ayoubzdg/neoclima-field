import Dexie, { type Table } from 'dexie'
import type { Task, ZoneTakt, TaskPhase, Photo, Contrainte, Equipe, Utilisateur, TaskType } from '@/types/models'

// ── Sync queue locale (offline mutations) ───────────────────

export interface LocalSyncItem {
  localId?: number
  id: string
  table_name: string
  /** 'increment' = delta de quantité rejoué via RPC atomique */
  operation: 'insert' | 'update' | 'delete' | 'increment'
  record_id: string | null
  payload: Record<string, unknown>
  synced: boolean
  created_at: string
  retry_count: number
}

/** Photo prise hors ligne, en attente d'upload */
export interface LocalPhoto {
  localId?: number
  task_id: string | null
  zone_takt_id: string
  nc_id: string | null
  path: string
  contentType: string
  type: string
  auteur_role: string | null
  blob: Blob
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
  photos_offline!: Table<LocalPhoto>

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

    // v2 : file des photos prises hors ligne (blob compressé en attente)
    this.version(2).stores({
      photos_offline: '++localId, task_id, created_at'
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
  const queue = await db.sync_queue.where('synced').equals(0).count()
  const photos = await db.photos_offline.count()
  return queue + photos
}

// ── Photos hors ligne ───────────────────────────────────────

export async function addPhotoOffline(photo: Omit<LocalPhoto, 'localId' | 'retry_count'>): Promise<void> {
  await db.photos_offline.add({ ...photo, retry_count: 0 })
}

export async function getPendingPhotos(): Promise<LocalPhoto[]> {
  return db.photos_offline.orderBy('created_at').toArray()
}

export async function deletePhotoOffline(localId: number): Promise<void> {
  await db.photos_offline.delete(localId)
}
