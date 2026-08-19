import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

/**
 * ABONNEMENT AUX NOTIFICATIONS PUSH (Web Push / VAPID)
 *
 * Discipline anti-spam (audit §17) : seuls les événements
 * critiques déclenchent un push — aujourd'hui : BLOCAGE signalé
 * → notification aux chefs / CA, même app fermée.
 */

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '') as string

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushDisponible(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

export function pushActif(): boolean {
  return pushDisponible() && Notification.permission === 'granted'
}

/**
 * Demande la permission et enregistre l'abonnement en base.
 * À appeler depuis un GESTE utilisateur (clic) — obligatoire sur iOS.
 * Retourne true si l'abonnement est actif.
 */
export async function activerNotifications(): Promise<boolean> {
  if (!pushDisponible()) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const a = useAuthStore.getState()

  const { error } = await supabase.from('push_subs').upsert({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    personne_id: a.utilisateur?.id ?? null,
    role: a.role ?? null,
    entreprise_id: a.entrepriseId ?? null,
    chantier_id: a.chantier?.id ?? null,
  }, { onConflict: 'endpoint' })

  return !error
}

/** Désabonne cet appareil */
export async function desactiverNotifications(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subs').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch { /* non bloquant */ }
}
