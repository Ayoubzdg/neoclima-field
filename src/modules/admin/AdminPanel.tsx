import { useEffect, useState, useMemo } from 'react'
import {
  Shield, Plus, Edit2, Check, X, Eye, EyeOff,
  UserCheck, UserX, Loader2, AlertCircle, RefreshCw, ChevronDown
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getEquipes, getUtilisateursAll, upsertUtilisateur,
  deleteUtilisateur, setUtilisateurActif
} from '@/lib/supabase'
import type { Equipe, Utilisateur, UserRole } from '@/types/models'

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const ROLES: { value: UserRole; label: string; color: string; bg: string }[] = [
  { value: 'monteur',  label: 'Monteur', color: 'text-gray-700',  bg: 'bg-gray-100' },
  { value: 'chef',     label: 'Chef',    color: 'text-blue-700',  bg: 'bg-blue-100' },
  { value: 'ca',       label: 'C.A.',    color: 'text-purple-700', bg: 'bg-purple-100' },
  { value: 'admin',    label: 'Admin',   color: 'text-red-700',   bg: 'bg-red-100' },
]

function getRoleMeta(role: UserRole) {
  return ROLES.find(r => r.value === role) ?? ROLES[0]
}

// ─────────────────────────────────────────────────────────────
// Composant — ligne utilisateur (mode lecture)
// ─────────────────────────────────────────────────────────────

function UserRow({
  user,
  equipes,
  showPin,
  onEdit,
  onToggleActif,
}: {
  user: Utilisateur
  equipes: Equipe[]
  showPin: boolean
  onEdit: () => void
  onToggleActif: () => void
}) {
  const [toggling, setToggling] = useState(false)
  const role = getRoleMeta(user.role)
  const equipe = equipes.find(e => e.id === user.equipe_id)

  const handleToggle = async () => {
    setToggling(true)
    await onToggleActif()
    setToggling(false)
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${!user.actif ? 'opacity-50 bg-gray-50/50' : 'hover:bg-gray-50/50'}`}>
      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          user.actif ? 'bg-nc-blue text-white' : 'bg-gray-200 text-gray-400'
        }`}
      >
        {(user.prenom?.[0] ?? '').toUpperCase()}{user.nom[0].toUpperCase()}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-nc-blue truncate">
            {user.prenom} {user.nom}
          </p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${role.bg} ${role.color}`}>
            {role.label}
          </span>
          {!user.actif && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
              Inactif
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {equipe ? (
            <span className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: equipe.couleur }}
              />
              {equipe.name}
            </span>
          ) : (
            <span className="italic">Sans équipe</span>
          )}
        </p>
      </div>

      {/* PIN masqué */}
      <div className="flex-shrink-0 text-right">
        {showPin ? (
          <span className="font-mono text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg border border-yellow-200">
            {user.code_pin ?? '—'}
          </span>
        ) : (
          <span className="font-mono text-xs text-gray-300">••••</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Toggle actif */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`p-1.5 rounded-lg transition-colors ${
            user.actif
              ? 'hover:bg-red-50 text-gray-300 hover:text-red-400'
              : 'hover:bg-green-50 text-gray-300 hover:text-green-500'
          }`}
          title={user.actif ? 'Désactiver' : 'Réactiver'}
        >
          {toggling
            ? <Loader2 size={14} className="animate-spin" />
            : user.actif
              ? <UserX size={14} />
              : <UserCheck size={14} />
          }
        </button>
        {/* Éditer */}
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-nc-blue transition-colors"
          title="Modifier"
        >
          <Edit2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Composant — formulaire inline
// ─────────────────────────────────────────────────────────────

function UserEditForm({
  user,
  equipes,
  chantierId,
  onSave,
  onCancel,
  onDelete,
}: {
  user: Partial<Utilisateur>
  equipes: Equipe[]
  chantierId: string
  onSave: (u: Utilisateur) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState({
    prenom: user.prenom ?? '',
    nom: user.nom ?? '',
    role: (user.role ?? 'monteur') as UserRole,
    equipe_id: user.equipe_id ?? '',
    code_pin: user.code_pin ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPin, setShowPin] = useState(false)

  const handleSave = async () => {
    if (!form.nom.trim()) { setError('Nom requis'); return }
    setSaving(true)
    setError(null)
    try {
      const saved = await upsertUtilisateur({
        ...(user.id ? { id: user.id } : {}),
        prenom: form.prenom.trim() || null,
        nom: form.nom.trim(),
        role: form.role,
        equipe_id: form.equipe_id || null,
        code_pin: form.code_pin.trim() || null,
        chantier_id: chantierId,
        actif: user.actif ?? true,
      })
      onSave(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-4 bg-blue-50/40 border-b border-nc-blue/10 space-y-3">
      {/* Nom / Prénom */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Prénom</label>
          <input
            value={form.prenom}
            onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
            placeholder="Prénom"
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Nom *</label>
          <input
            value={form.nom}
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
            placeholder="Nom de famille"
            autoFocus={!user.id}
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
          />
        </div>
      </div>

      {/* Rôle */}
      <div>
        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Rôle / Accès</label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => setForm(f => ({ ...f, role: r.value }))}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                form.role === r.value
                  ? `${r.bg} ${r.color} ring-2 ring-offset-1 ring-current`
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {form.role === 'monteur' && 'Voit ses tâches uniquement. Pas d\'accès planning ni paramètres.'}
          {form.role === 'chef' && 'Voit tout le chantier, planning, équipes. Ne peut pas modifier les paramètres.'}
          {form.role === 'ca' && 'Chargé d\'affaires : accès complet sauf gestion des comptes.'}
          {form.role === 'admin' && 'Accès total y compris gestion des utilisateurs et paramètres avancés.'}
        </p>
      </div>

      {/* Équipe */}
      <div>
        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Équipe</label>
        <select
          value={form.equipe_id}
          onChange={e => setForm(f => ({ ...f, equipe_id: e.target.value }))}
          className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-white focus:ring-2 focus:ring-nc-blue/30"
        >
          <option value="">— Sans équipe —</option>
          {equipes.map(eq => (
            <option key={eq.id} value={eq.id}>{eq.name}</option>
          ))}
        </select>
      </div>

      {/* PIN */}
      <div>
        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Code PIN (connexion)</label>
        <div className="flex gap-2 mt-0.5">
          <div className="relative flex-1">
            <input
              type={showPin ? 'text' : 'password'}
              value={form.code_pin}
              onChange={e => setForm(f => ({ ...f, code_pin: e.target.value }))}
              placeholder="Ex : 1234"
              maxLength={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
            />
            <button
              type="button"
              onClick={() => setShowPin(p => !p)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const pin = String(Math.floor(1000 + Math.random() * 9000))
              setForm(f => ({ ...f, code_pin: pin }))
              setShowPin(true)
            }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 whitespace-nowrap"
          >
            Générer
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Boutons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !form.nom.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-nc-blue text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-nc-blue/90"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Enregistrer
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
        >
          Annuler
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="ml-auto px-3 py-2 border border-red-100 text-red-400 rounded-xl text-xs hover:bg-red-50"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AdminPanel — composant principal
// ─────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const { role, utilisateur, chantier } = useAuthStore()

  const [users, setUsers] = useState<Utilisateur[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPins, setShowPins] = useState(false)
  const [filterRole, setFilterRole] = useState<UserRole | 'tous'>('tous')
  const [filterActif, setFilterActif] = useState<'tous' | 'actifs' | 'inactifs'>('actifs')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Accès restreint ─────────────────────────────────────────
  if (role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Shield size={32} className="text-nc-red" />
        </div>
        <div>
          <p className="font-bold text-nc-blue text-lg">Accès restreint</p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs">
            Seuls les administrateurs peuvent accéder à la gestion des utilisateurs.
          </p>
        </div>
        <p className="text-xs text-gray-300">Votre rôle actuel : <strong className="text-gray-500 capitalize">{role}</strong></p>
      </div>
    )
  }

  const load = async () => {
    if (!chantier?.id) return
    setIsLoading(true)
    try {
      const [u, eq] = await Promise.all([
        getUtilisateursAll(chantier.id),
        getEquipes(chantier.id),
      ])
      setUsers(u)
      setEquipes(eq)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [chantier?.id])

  // ── Stats par rôle ──────────────────────────────────────────
  const stats = useMemo(() => ({
    total: users.filter(u => u.actif).length,
    monteur: users.filter(u => u.actif && u.role === 'monteur').length,
    chef: users.filter(u => u.actif && u.role === 'chef').length,
    ca: users.filter(u => u.actif && u.role === 'ca').length,
    admin: users.filter(u => u.actif && u.role === 'admin').length,
    inactif: users.filter(u => !u.actif).length,
  }), [users])

  // ── Filtrage ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filterRole !== 'tous' && u.role !== filterRole) return false
      if (filterActif === 'actifs' && !u.actif) return false
      if (filterActif === 'inactifs' && u.actif) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const fullname = `${u.prenom ?? ''} ${u.nom}`.toLowerCase()
        if (!fullname.includes(q)) return false
      }
      return true
    })
  }, [users, filterRole, filterActif, searchQuery])

  // ── Actions ─────────────────────────────────────────────────
  const handleToggleActif = async (user: Utilisateur) => {
    if (user.id === utilisateur?.id) {
      alert('Vous ne pouvez pas désactiver votre propre compte.')
      return
    }
    await setUtilisateurActif(user.id, !user.actif)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, actif: !u.actif } : u))
  }

  const handleSaved = (saved: Utilisateur) => {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === saved.id)
      if (idx >= 0) return prev.map(u => u.id === saved.id ? saved : u)
      return [...prev, saved]
    })
    setEditingId(null)
    setIsAdding(false)
    load() // re-fetch pour avoir les relations équipe
  }

  const handleDelete = async (user: Utilisateur) => {
    if (user.id === utilisateur?.id) {
      alert('Vous ne pouvez pas supprimer votre propre compte.')
      return
    }
    if (!confirm(`Supprimer définitivement ${user.prenom} ${user.nom} ? Cette action est irréversible.\n\nConsidérez plutôt de désactiver l'utilisateur.`)) return
    await deleteUtilisateur(user.id)
    setUsers(prev => prev.filter(u => u.id !== user.id))
    setEditingId(null)
  }

  return (
    <div className="p-4 max-w-2xl">
      {/* En-tête */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-nc-red" />
            <h2 className="text-lg font-bold text-nc-blue">Gestion des accès</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">ADMIN</span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">{chantier?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"
            title="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowPins(p => !p)}
            className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
          >
            {showPins ? <EyeOff size={13} /> : <Eye size={13} />}
            PINs
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: 'Monteurs', value: stats.monteur, bg: 'bg-gray-50', color: 'text-gray-700' },
          { label: 'Chefs',    value: stats.chef,    bg: 'bg-blue-50',   color: 'text-blue-700' },
          { label: 'CA',       value: stats.ca,      bg: 'bg-purple-50', color: 'text-purple-700' },
          { label: 'Admins',   value: stats.admin,   bg: 'bg-red-50',    color: 'text-red-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Recherche */}
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
        />
        {/* Filtre actif */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-medium">
          {(['actifs', 'tous', 'inactifs'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActif(f)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                filterActif === f ? 'bg-nc-blue text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {f === 'actifs' ? `Actifs (${stats.total})` : f === 'inactifs' ? `Inactifs (${stats.inactif})` : 'Tous'}
            </button>
          ))}
        </div>
        {/* Filtre rôle */}
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value as UserRole | 'tous')}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-600 focus:outline-none bg-white"
        >
          <option value="tous">Tous les rôles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Formulaire ajout */}
      {isAdding && chantier && (
        <div className="bg-white rounded-2xl border border-nc-blue/20 shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-nc-blue">Nouvel utilisateur</p>
          </div>
          <UserEditForm
            user={{}}
            equipes={equipes}
            chantierId={chantier.id}
            onSave={handleSaved}
            onCancel={() => setIsAdding(false)}
          />
        </div>
      )}

      {/* Liste des utilisateurs */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">Aucun utilisateur trouvé</p>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-nc-blue mt-2 hover:underline">
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          {filtered.map(user => (
            <div key={user.id}>
              {editingId === user.id && chantier ? (
                <UserEditForm
                  user={user}
                  equipes={equipes}
                  chantierId={chantier.id}
                  onSave={handleSaved}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => handleDelete(user)}
                />
              ) : (
                <UserRow
                  user={user}
                  equipes={equipes}
                  showPin={showPins}
                  onEdit={() => { setEditingId(user.id); setIsAdding(false) }}
                  onToggleActif={() => handleToggleActif(user)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bouton ajouter */}
      {!isAdding && (
        <button
          onClick={() => { setIsAdding(true); setEditingId(null) }}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-nc-blue/30 hover:text-nc-blue hover:bg-blue-50/30 transition-colors"
        >
          <Plus size={16} />
          Ajouter un utilisateur
        </button>
      )}

      {/* Note bas de page */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2">
        <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700">
          <p className="font-semibold">Conseil sécurité</p>
          <p className="mt-0.5">Désactivez les utilisateurs qui ne travaillent plus sur ce chantier plutôt que de les supprimer. Leur historique de production est conservé.</p>
        </div>
      </div>
    </div>
  )
}
