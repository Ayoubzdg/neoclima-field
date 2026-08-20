import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw, Copy, Check } from 'lucide-react'
import { genererSyntheseIA } from '@/lib/supabase'

/**
 * SYNTHÈSE IA — bloc réutilisable (rapport du jour / hebdo).
 * L'app envoie les données déjà agrégées à l'Edge Function
 * rapport-ia (Claude) qui rédige une synthèse professionnelle.
 * Le texte est ÉDITABLE avant impression : l'IA propose,
 * l'humain valide.
 */
export default function SyntheseIA({ type, chantier, periode, donnees, value, onChange }: {
  type: 'jour' | 'hebdo'
  chantier: string
  periode: string
  donnees: unknown
  /** Mode contrôlé : le parent garde le texte (pour l'inclure dans ses exports PDF/PPTX) */
  value?: string
  onChange?: (texte: string) => void
}) {
  const [interne, setInterne] = useState('')
  const texte = value !== undefined ? value : interne
  const setTexte = (t: string) => {
    if (onChange) onChange(t)
    else setInterne(t)
  }
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generer = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setTexte(await genererSyntheseIA({ type, chantier, periode, donnees }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indisponible */ }
  }

  // Rendu markdown minimal pour l'impression : **gras** uniquement
  const htmlImpression = texte
    .split('\n')
    .map(l => l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'))
    .join('<br/>')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 print:border print:rounded-none print:shadow-none print:break-inside-avoid">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles size={13} className="text-nc-red" />Synthèse IA
        </p>
        <div className="flex gap-1.5 print:hidden">
          {texte && (
            <button onClick={copier}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50"
              title="Copier le texte">
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            </button>
          )}
          <button onClick={generer} disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nc-blue text-white text-xs font-semibold hover:bg-nc-blue/90 disabled:opacity-50">
            {isLoading
              ? <><Loader2 size={13} className="animate-spin" />Rédaction…</>
              : texte
                ? <><RefreshCw size={13} />Régénérer</>
                : <><Sparkles size={13} />Générer la synthèse</>}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2 print:hidden">
          {error}
        </p>
      )}

      {texte ? (
        <>
          {/* Édition à l'écran */}
          <textarea
            value={texte}
            onChange={e => setTexte(e.target.value)}
            rows={Math.min(18, Math.max(8, texte.split('\n').length + 2))}
            className="w-full text-sm text-gray-800 leading-relaxed border border-gray-200 rounded-lg p-3
                       resize-y outline-none focus:border-nc-blue print:hidden"
          />
          <p className="text-[10px] text-gray-400 mt-1 print:hidden">
            Texte modifiable — relis et corrige avant d'imprimer ou d'envoyer.
          </p>
          {/* Version impression (gras rendu) */}
          <div className="hidden print:block text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: htmlImpression }} />
        </>
      ) : !isLoading && !error && (
        <p className="text-xs text-gray-400 print:hidden">
          L'IA rédige une synthèse professionnelle à partir des chiffres du rapport — à relire et ajuster avant envoi.
        </p>
      )}
    </div>
  )
}
