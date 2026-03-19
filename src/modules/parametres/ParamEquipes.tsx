import { useEffect, useState } from 'react'
import { Users, Plus, Edit2, Trash2, Save, X, Eye, EyeOff, Check } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getEquipes, getUtilisateurs, upsertEquipe, upsertUtilisateur, deleteUtilisateur } from '@/lib/supabase'
import type { Equipe, Utilisateur, UserRole } from '@/types/models'

const COLORS = ['#E74C3C', '#2C3E50', '#3498DB', '#27AE60', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22']
const ROLES: UserRole[] = ['monteur', 'chef', 'ca', 'admin']

// ── Inline edit form for equipe header ──────────────────────
function EquipeEditRow({ equipe, onSave, onCancel }: {
  equipe: Partial<Equipe>
  onSave: (eq: Partial<Equipe>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ name: equipe.name ?? '', couleur: equipe.couleur ?? COLORS[0], code_pin: equipe.code_pin ?? '' })
  return (
    <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-gray-100">
      <input
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Nom de l'équipe"
        autoFocus
      />
      <div className="flex gap-1">
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setForm(f => ({ ...f, couleur: c }))}
            className="w-5 h-5 rounded-full border-2 transition-all"
            style={{ backgroundColor: c, borderColor: form.couleur === c ? '#2C3E50' : 'transparent' }}
          />
        ))}
      </div>
      <input
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24 font-mono focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
        value={form.code_pin}
        onChange={e => setForm(f => ({ ...f, code_pin: e.target.value }))}
        placeholder="PIN équipe"
        maxLength={6}
      />
      <button
        onClick={() => onSave(form)}
        disabled={!form.name.trim()}
        className="p-1.5 rounded-lg bg-nc-blue text-white hover:bg-nc-blue-dark disabled:opacity-40"
      >
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100">
        <X size={14} className="text-gray-400" />
      </button>
    </div>
  )
}

// ── Inline edit form for membre ──────────────────────────────
function MembreEditRow({ user, equipes, onSave, onCancel, onDelete }: {
  user: Partial<Utilisateur>
  equipes: Equipe[]
  onSave: (u: Partial<Utilisateur>) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState({
    prenom: user.prenom ?? '',
    nom: user.nom ?? '',
    role: (user.role ?? 'monteur') as UserRole,
    code_pin: user.code_pin ?? '',
    equipe_id: user.equipe_id ?? '',
  })
  return (
    <div className="px-4 py-3 bg-blue-50/40 flex flex-wrap gap-2 items-center border-b border-gray-100">
      <input
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
        value={form.prenom}
        onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
        placeholder="Prénom"
      />
      <input
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
        value={form.nom}
        onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
        placeholder="Nom"
        autoFocus={!user.id}
      />
      <select
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
        value={form.role}
        onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
      >
        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <select
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
        value={form.equipe_id}
        onChange={e => setForm(f => ({ ...f, equipe_id: e.target.value }))}
      >
        <option value="">Sans équipe</option>
        {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
      </select>
      <input
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-20 font-mono focus:outline-none focus:ring-2 focus:ring-nc-blue/20"
        value={form.code_pin}
        onChange={e => setForm(f => ({ ...f, code_pin: e.target.value }))}
        placeholder="PIN"
        maxLength={6}
      />
      <button
        onClick={() => onSave(form)}
        disabled={!form.nom.trim()}
        className="p-1.5 rounded-lg bg-nc-blue text-white hover:bg-nc-blue-dark disabled:opacity-40"
      >
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100">
        <X size={14} className="text-gray-400" />
      </button>
      {onDelete && (
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 ml-auto">
          <Trash2 size={14} className="text-red-400" />
        </button>
      )}
    </div>
  )
}

export default function ParamEquipes() {
  const { chantier } = useAuthStore()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [showPins, setShowPins] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Edit states
  const [editingEquipeId, setEditingEquipeId] = useState<string | null>(null)
  const [addingEquipe, setAddingEquipe] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [addingMemberToEquipe, setAddingMemberToEquipe] = useState<string | null>(null)

  const reload = () => {
    if (!chantier?.id) return
    Promise.all([getEquipes(chantier.id), getUtilisateurs(chantier.id)])
      .then(([eq, us]) => { setEquipes(eq); setUtilisateurs(us) })
  }

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    Promise.all([getEquipes(chantier.id), getUtilisateurs(chantier.id)])
      .then(([eq, us]) => { setEquipes(eq); setUtilisateurs(us) })
      .finally(() => setIsLoading(false))
  }, [chantier?.id])

  const saveEquipe = async (partial: Partial<Equipe>) => {
    if (!chantier?.id) return
    const existing = editingEquipeId ? equipes.find(e => e.id === editingEquipeId) : null
    await upsertEquipe({ ...existing, ...partial, chantier_id: chantier.id, actif: true })
    setEditingEquipeId(null)
    setAddingEquipe(false)
    reload()
  }

  const saveUtilisateur = async (partial: Partial<Utilisateur>, equipe_id?: string) => {
    if (!chantier?.id) return
    const existing = editingUserId ? utilisateurs.find(u => u.id === editingUserId) : null
    await upsertUtilisateur({
      ...existing,
      ...partial,
      equipe_id: partial.equipe_id || equipe_id || existing?.equipe_id || null,
      chantier_id: chantier.id,
      actif: true,
    })
    setEditingUserId(null)
    setAddingMemberToEquipe(null)
    reload()
  }

  const handleDeleteUser = async (userId: string) => {
    await deleteUtilisateur(userId)
    setEditingUserId(null)
    reload()
  }

  return (
    <div className="p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-nc-red" />
          <h2 className="text-lg font-bold text-nc-blue">Équipes & Utilisateurs</h2>
        </div>
        <button
          onClick={() => setShowPins(p => !p)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-nc-blue bg-gray-100 px-3 py-1.5 rounded-lg"
        >
          {showPins ? <EyeOff size={14} /> : <Eye size={14} />}
          {showPins ? 'Masquer' : 'Afficher'} PINs
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {equipes.map(equipe => {
            const membres = utilisateurs.filter(u => u.equipe_id === equipe.id)
            const isEditingThis = editingEquipeId === equipe.id
            return (
              <div key={equipe.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header équipe */}
                {isEditingThis ? (
                  <EquipeEditRow
                    equipe={equipe}
                    onSave={saveEquipe}
                    onCancel={() => setEditingEquipeId(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: equipe.couleur }} />
                      <p className="font-bold text-nc-blue">{equipe.name}</p>
                      <span className="text-xs text-gray-400">{membres.length} membre{membres.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {showPins && equipe.code_pin && (
                        <span className="font-mono text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">
                          PIN: {equipe.code_pin}
                        </span>
                      )}
                      <button
                        onClick={() => { setEditingEquipeId(equipe.id); setAddingEquipe(false) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                      >
                        <Edit2 size={14} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Membres */}
                <div className="divide-y divide-gray-50">
                  {membres.map(user => {
                    const isEditingUser = editingUserId === user.id
                    if (isEditingUser) {
                      return (
                        <MembreEditRow
                          key={user.id}
                          user={user}
                          equipes={equipes}
                          onSave={p => saveUtilisateur(p)}
                          onCancel={() => setEditingUserId(null)}
                          onDelete={() => handleDeleteUser(user.id)}
                        />
                      )
                    }
                    return (
                      <div key={user.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-nc-blue text-white flex items-center justify-center text-xs font-bold">
                            {user.prenom?.[0]}{user.nom[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{user.prenom} {user.nom}</p>
                            <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {showPins && (
                            <span className="font-mono text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded border border-gray-100">
                              {user.code_pin ?? '—'}
                            </span>
                          )}
                          <button
                            onClick={() => { setEditingUserId(user.id); setAddingMemberToEquipe(null) }}
                            className="p-1.5 rounded-lg hover:bg-gray-100"
                          >
                            <Edit2 size={12} className="text-gray-300" />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Ajouter membre */}
                  {addingMemberToEquipe === equipe.id ? (
                    <MembreEditRow
                      user={{ equipe_id: equipe.id }}
                      equipes={equipes}
                      onSave={p => saveUtilisateur(p, equipe.id)}
                      onCancel={() => setAddingMemberToEquipe(null)}
                    />
                  ) : (
                    <div className="px-4 py-2">
                      <button
                        onClick={() => { setAddingMemberToEquipe(equipe.id); setEditingUserId(null) }}
                        className="text-xs text-nc-blue hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} />
                        Ajouter un membre
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Nouvelle équipe */}
          {addingEquipe ? (
            <div className="bg-white rounded-2xl border border-nc-blue/30 shadow-sm overflow-hidden">
              <EquipeEditRow
                equipe={{ couleur: COLORS[equipes.length % COLORS.length] }}
                onSave={saveEquipe}
                onCancel={() => setAddingEquipe(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => { setAddingEquipe(true); setEditingEquipeId(null) }}
              className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={16} />
              Nouvelle équipe
            </button>
          )}
        </div>
      )}
    </div>
  )
}
