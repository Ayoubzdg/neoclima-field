import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Edit2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getEquipes, getUtilisateurs } from '@/lib/supabase'
import type { Equipe, Utilisateur } from '@/types/models'

export default function EquipesList() {
  const navigate = useNavigate()
  const { chantier } = useAuthStore()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([
      getEquipes(chantier.id),
      getUtilisateurs(chantier.id)
    ]).then(([eq, us]) => {
      setEquipes(eq)
      setUtilisateurs(us)
    }).finally(() => setIsLoading(false))
  }, [chantier?.id])

  const getMembres = (equipeId: string) => utilisateurs.filter(u => u.equipe_id === equipeId)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-nc-blue">Équipes</h2>
          <p className="text-gray-500 text-sm">{equipes.length} équipes · {utilisateurs.length} personnes</p>
        </div>
        <button
          onClick={() => navigate('/parametres/equipes')}
          className="btn-primary text-sm flex items-center gap-1.5 py-2 px-3"
        >
          <Plus size={16} />
          Nouvelle équipe
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {equipes.map(equipe => {
            const membres = getMembres(equipe.id)
            return (
              <div key={equipe.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: equipe.couleur }} />
                    <p className="font-bold text-nc-blue">{equipe.name}</p>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {membres.length} membre{membres.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate('/parametres/equipes')}
                    className="p-2 rounded-xl hover:bg-gray-100"
                  >
                    <Edit2 size={14} className="text-gray-400" />
                  </button>
                </div>
                {membres.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {membres.map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <div className="w-5 h-5 rounded-full bg-nc-blue flex items-center justify-center text-white text-[9px] font-bold">
                          {m.prenom?.[0]}{m.nom[0]}
                        </div>
                        <span className="text-xs font-medium text-gray-700">{m.prenom} {m.nom}</span>
                        <span className="text-[10px] text-gray-400 capitalize">({m.role})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Aucun membre assigné</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
