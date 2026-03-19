import { useState } from 'react'
import { X, Send, AlertTriangle } from 'lucide-react'
import type { Task, ContrainteType } from '@/types/models'

interface Props {
  task: Task
  onClose: () => void
  onSubmit: (type: ContrainteType, comment: string) => Promise<void>
}

const BLOCAGE_TYPES: { id: ContrainteType; label: string; emoji: string }[] = [
  { id: 'materiau', label: 'Matériau manquant', emoji: '📦' },
  { id: 'acces', label: 'Accès impossible', emoji: '🚧' },
  { id: 'autre_corps', label: 'Autre corps métier', emoji: '🔧' },
  { id: 'gros_oeuvre', label: 'Gros œuvre', emoji: '🏗️' },
  { id: 'equipement', label: 'Équipement manquant', emoji: '⚙️' },
  { id: 'autre', label: 'Autre', emoji: '❓' },
]

export default function BlocageForm({ task, onClose, onSubmit }: Props) {
  const [selectedType, setSelectedType] = useState<ContrainteType | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedType) return
    setIsSubmitting(true)
    try {
      await onSubmit(selectedType, comment)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end animate-fade-in">
      <div className="w-full bg-white rounded-t-3xl animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            <h3 className="font-bold text-nc-blue">Signaler un blocage</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tâche concernée */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Tâche concernée</p>
            <p className="font-semibold text-nc-blue text-sm mt-0.5 truncate">{task.label}</p>
          </div>

          {/* Type de blocage */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Type de blocage *</p>
            <div className="grid grid-cols-2 gap-2">
              {BLOCAGE_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all active:scale-95 touch-manipulation
                    ${selectedType === type.id
                      ? 'border-nc-red bg-red-50'
                      : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <span className="text-xl">{type.emoji}</span>
                  <p className="text-xs font-medium text-gray-700 mt-1 leading-tight">{type.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Commentaire court */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Description rapide</p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Décrire le blocage en quelques mots…"
              rows={2}
              className="input-field resize-none"
            />
          </div>

          {/* Bouton envoi */}
          <button
            onClick={handleSubmit}
            disabled={!selectedType || isSubmitting}
            className="w-full btn-danger flex items-center justify-center gap-2 h-12"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send size={18} />
                Envoyer le blocage
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
