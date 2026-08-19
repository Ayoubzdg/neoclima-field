import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Loader2, AlertCircle, Building2, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getEntrepriseByCode } from '@/lib/supabase'
import type { LoginPersonneResult } from '@/types/models'

// ═══════════════════════════════════════════════════════════
// Nouveau flux login multi-entreprise :
//   1. code   → Saisie libre du code entreprise
//   2. pin    → Code PIN 4 chiffres
//   3. select → Sélection chantier (si accès à plusieurs)
// ═══════════════════════════════════════════════════════════

type Step = 'code' | 'pin' | 'select'

export default function LoginScreen() {
  const navigate = useNavigate()
  const { loginPersonneStep, loginWithChantier, isLoading, error, isAuthenticated, clearError } = useAuthStore()

  const [step, setStep] = useState<Step>('code')
  const [codeEntreprise, setCodeEntreprise] = useState('')
  const [codeError, setCodeError] = useState('')
  const [validatingCode, setValidatingCode] = useState(false)
  const [entrepriseName, setEntrepriseName] = useState('')

  const [pin, setPin] = useState('')
  const [chantierOptions, setChantierOptions] = useState<LoginPersonneResult[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    clearError()
    setCodeError('')
    if (step === 'code') {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [step, clearError])

  // ── Step 1 : validation du code entreprise ────────────────
  const handleCodeSubmit = async () => {
    const code = codeEntreprise.trim().toUpperCase()
    if (!code) { setCodeError('Saisir un code entreprise'); return }

    setValidatingCode(true)
    setCodeError('')
    try {
      const entreprise = await getEntrepriseByCode(code)
      if (!entreprise) {
        setCodeError('Code entreprise inconnu. Vérifier avec votre responsable.')
        setValidatingCode(false)
        return
      }
      setEntrepriseName(entreprise.name)
      setCodeEntreprise(code)  // normalize to uppercase
      setStep('pin')
    } catch {
      setCodeError('Erreur de connexion au serveur')
    } finally {
      setValidatingCode(false)
    }
  }

  // ── Step 2 : saisie PIN ────────────────────────────────────
  const handlePinDigit = async (digit: string) => {
    if (pin.length >= 4) return
    const newPin = pin + digit
    setPin(newPin)

    if (newPin.length === 4) {
      const results = await loginPersonneStep(codeEntreprise, newPin)

      if (results.length === 0) {
        // Erreur — réinitialiser le PIN après 600ms
        setTimeout(() => setPin(''), 600)
        return
      }

      if (results.length === 1) {
        // Login automatique — loginPersonneStep a déjà appelé loginWithChantier
        navigate('/')
        return
      }

      // Plusieurs chantiers → sélecteur
      setChantierOptions(results)
      setStep('select')
    }
  }

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1))
    clearError()
  }

  // ── Step 3 : sélection chantier ───────────────────────────
  const handleSelectChantier = async (result: LoginPersonneResult) => {
    const ok = await loginWithChantier(result)
    if (ok) navigate('/')
  }

  return (
    <div className="min-h-screen bg-nc-blue flex flex-col items-center justify-center p-6 safe-top">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src="/logo.png"
          alt="Neoclima"
          className="h-14 w-auto object-contain mx-auto mb-2 brightness-0 invert"
        />
        <p className="text-white/50 text-xs tracking-widest uppercase">Field</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* ── Étape 1 — Code entreprise ─────────────────────── */}
        {step === 'code' && (
          <div className="p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-5">
              <Building2 size={20} className="text-nc-red" />
              <h2 className="text-nc-blue font-bold text-lg">Code entreprise</h2>
            </div>

            <p className="text-gray-500 text-sm mb-4">
              Saisir le code communiqué par votre responsable.
            </p>

            <input
              ref={inputRef}
              type="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={codeEntreprise}
              onChange={e => {
                setCodeEntreprise(e.target.value.toUpperCase())
                setCodeError('')
              }}
              onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
              placeholder="Ex : NEOCLIMA"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold
                         tracking-widest text-nc-blue text-center uppercase
                         focus:outline-none focus:border-nc-blue transition-colors"
            />

            {codeError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 mt-3 text-sm">
                <AlertCircle size={15} />
                <span>{codeError}</span>
              </div>
            )}

            <button
              onClick={handleCodeSubmit}
              disabled={validatingCode || !codeEntreprise.trim()}
              className="mt-4 w-full h-12 bg-nc-blue text-white font-semibold rounded-xl
                         hover:bg-nc-blue-dark active:scale-98 transition-all
                         disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {validatingCode ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>Continuer <ChevronRight size={18} /></>
              )}
            </button>
          </div>
        )}

        {/* ── Étape 2 — Code PIN ────────────────────────────── */}
        {step === 'pin' && (
          <div className="p-6 animate-fade-in">
            {/* Header avec retour */}
            <button
              onClick={() => { setStep('code'); setPin(''); clearError() }}
              className="text-nc-red text-sm font-medium mb-4 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              {entrepriseName || codeEntreprise}
            </button>

            <h2 className="text-nc-blue font-bold text-lg mb-1">Code PIN</h2>
            <p className="text-gray-500 text-sm mb-6">Saisir votre code à 4 chiffres</p>

            {/* Indicateurs PIN */}
            <div className="flex justify-center gap-4 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    i < pin.length
                      ? 'bg-nc-red border-nc-red scale-110'
                      : 'border-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Erreur */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 mb-4 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Clavier numérique */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={28} className="animate-spin text-nc-red" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {['1','2','3','4','5','6','7','8','9'].map(d => (
                  <button
                    key={d}
                    onClick={() => handlePinDigit(d)}
                    disabled={pin.length >= 4}
                    className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200
                               rounded-xl text-xl font-semibold text-nc-blue
                               active:scale-95 transition-all duration-100 touch-manipulation"
                  >
                    {d}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handlePinDigit('0')}
                  disabled={pin.length >= 4}
                  className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200
                             rounded-xl text-xl font-semibold text-nc-blue
                             active:scale-95 transition-all duration-100 touch-manipulation"
                >
                  0
                </button>
                <button
                  onClick={handlePinDelete}
                  className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200
                             rounded-xl text-nc-red font-semibold
                             active:scale-95 transition-all duration-100 touch-manipulation
                             flex items-center justify-center"
                >
                  ⌫
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Étape 3 — Sélection chantier ─────────────────── */}
        {step === 'select' && (
          <div className="p-6 animate-fade-in">
            <button
              onClick={() => { setStep('pin'); setPin(''); clearError() }}
              className="text-nc-red text-sm font-medium mb-4 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Changer de PIN
            </button>

            <h2 className="text-nc-blue font-bold text-lg mb-1">Choisir le chantier</h2>
            <p className="text-gray-500 text-sm mb-4">
              Vous avez accès à plusieurs projets.
            </p>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={28} className="animate-spin text-nc-red" />
              </div>
            ) : (
              <div className="space-y-2">
                {chantierOptions.map(c => (
                  <button
                    key={c.chantier_id}
                    onClick={() => handleSelectChantier(c)}
                    className="w-full text-left p-4 rounded-xl border-2 border-gray-100
                               hover:border-nc-blue hover:bg-blue-50 transition-all active:scale-98
                               flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-semibold text-nc-blue">{c.chantier_name}</p>
                      {c.chantier_client && (
                        <p className="text-xs text-gray-500">{c.chantier_client}</p>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-nc-blue" />
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 mt-4 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-white/30 text-xs mt-8">neoclima-field · V2.0</p>
    </div>
  )
}
