import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HardHat, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getChantiers } from '@/lib/supabase'
import type { Chantier } from '@/types/models'

type Step = 'chantier' | 'pin'

export default function LoginScreen() {
  const navigate = useNavigate()
  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore()

  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [selectedChantier, setSelectedChantier] = useState<Chantier | null>(null)
  const [pin, setPin] = useState('')
  const [step, setStep] = useState<Step>('chantier')
  const [loadingChantiers, setLoadingChantiers] = useState(true)

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    getChantiers()
      .then(setChantiers)
      .catch(() => setChantiers([]))
      .finally(() => setLoadingChantiers(false))
  }, [])

  useEffect(() => {
    clearError()
  }, [step, clearError])

  const handlePinDigit = async (digit: string) => {
    const newPin = pin + digit
    setPin(newPin)
    if (newPin.length === 4) {
      const success = await login(newPin, selectedChantier!.id)
      if (success) {
        navigate('/')
      } else {
        setTimeout(() => setPin(''), 500)
      }
    }
  }

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1))
    clearError()
  }

  const handleChantierSelect = (chantier: Chantier) => {
    setSelectedChantier(chantier)
    setStep('pin')
  }

  return (
    <div className="min-h-screen bg-nc-blue flex flex-col items-center justify-center p-6 safe-top">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-nc-red rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <HardHat size={32} className="text-white" />
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight">Neoclima</h1>
        <p className="text-white/60 text-sm mt-1">Neoclima Field</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Étape 1 — Sélection chantier */}
        {step === 'chantier' && (
          <div className="p-6 animate-fade-in">
            <h2 className="text-nc-blue font-bold text-lg mb-4">Choisir le chantier</h2>
            {loadingChantiers ? (
              <div className="flex justify-center py-8">
                <Loader2 size={28} className="animate-spin text-nc-red" />
              </div>
            ) : chantiers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">Aucun chantier actif trouvé</p>
                <p className="text-xs mt-1">Vérifier la configuration Supabase</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chantiers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleChantierSelect(c)}
                    className="w-full text-left p-4 rounded-xl border-2 border-gray-100
                               hover:border-nc-blue hover:bg-blue-50 transition-all active:scale-98
                               flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-semibold text-nc-blue">{c.name}</p>
                      {c.client && <p className="text-xs text-gray-500">{c.client}</p>}
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-nc-blue" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Étape 2 — Code PIN */}
        {step === 'pin' && (
          <div className="p-6 animate-fade-in">
            <button
              onClick={() => { setStep('chantier'); setPin('') }}
              className="text-nc-red text-sm font-medium mb-4 flex items-center gap-1"
            >
              ← {selectedChantier?.name}
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
                <div /> {/* empty */}
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
      </div>

      <p className="text-white/30 text-xs mt-8">neoclima-field · V2.0</p>
    </div>
  )
}
