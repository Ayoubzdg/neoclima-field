import { useEffect, useState } from 'react'
import { getSecureUrl, openSecure } from '@/lib/secureUrl'

interface Props {
  /** URL stockée en base (ancienne URL publique) */
  src: string | null | undefined
  alt?: string
  className?: string
  /** Ouvrir en grand au clic (URL signée fraîche) */
  clickable?: boolean
}

/**
 * <img> compatible buckets privés : résout une URL signée 1 h
 * (avec cache) à partir de l'URL stockée. Pendant la transition
 * (buckets encore publics), affiche l'URL d'origine.
 */
export default function SecureImage({ src, alt = '', className, clickable = true }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getSecureUrl(src).then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [src])

  if (!src) return null
  if (!url) return <div className={`bg-gray-100 animate-pulse ${className ?? ''}`} />

  const img = <img src={url} alt={alt} className={className} loading="lazy" />
  if (!clickable) return img
  return (
    <button type="button" onClick={() => openSecure(src)} className="block w-full text-left">
      {img}
    </button>
  )
}
