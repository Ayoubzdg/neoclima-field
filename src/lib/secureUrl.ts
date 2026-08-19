import { supabase } from '@/lib/supabase'

/**
 * URLs SIGNÉES pour les buckets privés (photos, plans).
 *
 * Les URLs stockées en base sont d'anciennes URLs "publiques"
 * (…/object/public/<bucket>/<chemin>). Une fois les buckets
 * passés en privé, elles ne servent plus qu'à retrouver le
 * chemin : on génère à la volée une URL signée 1 h, mise en
 * cache. Tant que les buckets sont encore publics (transition),
 * l'URL d'origine est renvoyée telle quelle en cas d'échec.
 */

const SIGNED_TTL_S = 3600
// cache : url stockée → { url signée, expiration }
const cache = new Map<string, { signed: string; exp: number }>()

function extractBucketPath(storedUrl: string): { bucket: string; path: string } | null {
  const m = storedUrl.match(/\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/)
  if (!m) return null
  return { bucket: m[1], path: decodeURIComponent(m[2]) }
}

export async function getSecureUrl(storedUrl: string | null | undefined): Promise<string | null> {
  if (!storedUrl) return null

  const hit = cache.get(storedUrl)
  if (hit && hit.exp > Date.now()) return hit.signed

  const bp = extractBucketPath(storedUrl)
  if (!bp) return storedUrl // URL externe ou format inconnu

  try {
    const { data, error } = await supabase.storage
      .from(bp.bucket)
      .createSignedUrl(bp.path, SIGNED_TTL_S)
    if (error || !data?.signedUrl) return storedUrl // transition : bucket encore public
    cache.set(storedUrl, { signed: data.signedUrl, exp: Date.now() + (SIGNED_TTL_S - 60) * 1000 })
    return data.signedUrl
  } catch {
    return storedUrl
  }
}

/** Ouvre une pièce jointe dans un nouvel onglet avec une URL signée */
export async function openSecure(storedUrl: string | null | undefined): Promise<void> {
  const url = await getSecureUrl(storedUrl)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
