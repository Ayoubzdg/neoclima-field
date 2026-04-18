import { useEffect, useState, useMemo } from 'react'
import {
  Shield, Plus, Edit2, Check, X, Eye, EyeOff,
  UserCheck, UserX, Loader2, AlertCircle, RefreshCw,
  Building2, Calendar, Users, ChevronRight, ChevronDown, CheckCircle2,
  KeyRound, Trash2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getEquipes, getUtilisateursAll, upsertUtilisateur,
  deleteUtilisateur, setUtilisateurActif,
  getChantiers, createChantierComplet,
  getEntreprises, upsertEntreprise, deleteEntreprise,
  getPersonnesByEntreprise, upsertPersonne, deletePersonne, setPersonneActif,
  getAccesByPersonne, addAccesChantier, removeAccesChantier
} from '@/lib/supabase'
import type { Equipe, Utilisateur, UserRole, Chantier, Entreprise, Personne, AccesChantier } from '@/types/models'
import type { NouveauChantierPayload } from '@/lib/supabase'

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
// Composant — formulaire inline utilisateur
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
// Composant — formulaire nouveau chantier
// ─────────────────────────────────────────────────────────────

function NouveauChantierForm({ onCreated, onCancel }: { onCreated: (c: Chantier) => void; onCancel: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const sixMonths = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]

  const [form, setForm] = useState<NouveauChantierPayload>({
    nom: '',
    adresse: '',
    client: '',
    date_debut: today,
    date_fin_prev: sixMonths,
    budget_heures: 2000,
    takt_duree: 5,
    pin_monteur: String(Math.floor(1000 + Math.random() * 9000)),
    pin_chef: String(Math.floor(1000 + Math.random() * 9000)),
    pin_ca: String(Math.floor(1000 + Math.random() * 9000)),
    pin_admin: String(Math.floor(1000 + Math.random() * 9000)),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPins, setShowPins] = useState(true)

  const f = (field: keyof NouveauChantierPayload, val: string | number) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const handleSubmit = async () => {
    if (!form.nom.trim()) { setError('Nom du projet requis'); return }
    if (!form.pin_ca || !form.pin_admin) { setError('PINs CA et Admin obligatoires'); return }
    setSaving(true)
    setError(null)
    try {
      const chantier = await createChantierComplet(form)
      onCreated(chantier)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-nc-blue/20 shadow-sm overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-bold text-nc-blue flex items-center gap-2">
          <Building2 size={16} />
          Nouveau projet
        </p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Infos projet */}
        <div className="space-y-3">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Informations projet</p>

          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Nom du projet *</label>
            <input
              value={form.nom}
              onChange={e => f('nom', e.target.value)}
              placeholder="Ex: Installation CVC — Bâtiment Rolex"
              autoFocus
              className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Adresse</label>
              <input
                value={form.adresse}
                onChange={e => f('adresse', e.target.value)}
                placeholder="Rue, Ville"
                className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Maître d'ouvrage</label>
              <input
                value={form.client}
                onChange={e => f('client', e.target.value)}
                placeholder="Nom du client"
                className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Date début</label>
              <input
                type="date"
                value={form.date_debut}
                onChange={e => f('date_debut', e.target.value)}
                className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Date fin prév.</label>
              <input
                type="date"
                value={form.date_fin_prev}
                onChange={e => f('date_fin_prev', e.target.value)}
                className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Budget heures</label>
              <input
                type="number"
                value={form.budget_heures}
                onChange={e => f('budget_heures', Number(e.target.value))}
                min={1}
                className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Durée takt (jours)</label>
              <input
                type="number"
                value={form.takt_duree}
                onChange={e => f('takt_duree', Number(e.target.value))}
                min={1}
                max={30}
                className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
              />
            </div>
          </div>
        </div>

        {/* PINs accès */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Codes PIN d'accès</p>
            <button
              type="button"
              onClick={() => setShowPins(p => !p)}
              className="text-[10px] text-gray-400 flex items-center gap-1 hover:text-nc-blue"
            >
              {showPins ? <EyeOff size={11} /> : <Eye size={11} />}
              {showPins ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { field: 'pin_monteur', label: 'Monteur', color: 'text-gray-600' },
              { field: 'pin_chef', label: 'Chef chantier', color: 'text-blue-600' },
              { field: 'pin_ca', label: 'Chargé d\'affaires *', color: 'text-purple-600' },
              { field: 'pin_admin', label: 'Admin *', color: 'text-red-600' },
            ] as { field: keyof NouveauChantierPayload; label: string; color: string }[]).map(({ field, label, color }) => (
              <div key={field}>
                <label className={`text-[9px] font-bold uppercase tracking-wide ${color}`}>{label}</label>
                <div className="flex gap-1 mt-0.5">
                  <input
                    type={showPins ? 'text' : 'password'}
                    value={form[field] as string}
                    onChange={e => f(field, e.target.value)}
                    maxLength={6}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
                  />
                  <button
                    type="button"
                    onClick={() => f(field, String(Math.floor(1000 + Math.random() * 9000)))}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-[10px] text-gray-400 hover:bg-gray-50"
                    title="Régénérer"
                  >
                    ↺
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400">
            Ces PINs seront utilisés pour la connexion. Notez-les avant de fermer ce formulaire.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={saving || !form.nom.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-nc-blue text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-nc-blue/90"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Création...' : 'Créer le projet'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Composant — onglet Projets
// ─────────────────────────────────────────────────────────────

function ProjetsTab() {
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [createdChantier, setCreatedChantier] = useState<Chantier | null>(null)

  const load = async () => {
    setIsLoading(true)
    try {
      const list = await getChantiers()
      setChantiers(list)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreated = (ch: Chantier) => {
    setCreatedChantier(ch)
    setIsAdding(false)
    load()
  }

  const statut_colors: Record<string, string> = {
    actif: 'bg-green-100 text-green-700',
    termine: 'bg-gray-100 text-gray-600',
    archive: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="space-y-4">
      {/* Succès création */}
      {createdChantier && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-semibold">Projet créé avec succès !</p>
            <p className="text-xs mt-0.5 text-green-700">
              <strong>{createdChantier.name}</strong> est maintenant disponible dans le sélecteur de login.
              Connectez-vous avec le PIN CA ou Admin pour accéder au nouveau projet.
            </p>
          </div>
          <button onClick={() => setCreatedChantier(null)} className="text-green-400 hover:text-green-600 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Formulaire nouveau chantier */}
      {isAdding && (
        <NouveauChantierForm
          onCreated={handleCreated}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* Liste des projets */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {chantiers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Building2 size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun projet actif</p>
            </div>
          ) : (
            chantiers.map((ch, idx) => {
              const isLast = idx === chantiers.length - 1
              const dateDebut = ch.date_debut ? new Date(ch.date_debut).toLocaleDateString('fr-CH', { month: 'short', year: 'numeric' }) : '—'
              const dateFin = ch.date_fin_prev ? new Date(ch.date_fin_prev).toLocaleDateString('fr-CH', { month: 'short', year: 'numeric' }) : '—'
              return (
                <div key={ch.id} className={`px-4 py-3.5 flex items-center gap-3 ${!isLast ? 'border-b border-gray-50' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-nc-blue/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-nc-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-nc-blue truncate">{ch.name}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md capitalize flex-shrink-0 ${statut_colors[ch.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ch.statut}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                      {ch.client && <span className="truncate">{ch.client}</span>}
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Calendar size={10} />
                        {dateDebut} → {dateFin}
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Users size={10} />
                        {ch.budget_heures}h
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Bouton ajouter */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-nc-blue/30 hover:text-nc-blue hover:bg-blue-50/30 transition-colors"
        >
          <Plus size={16} />
          Nouveau projet
        </button>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-2">
        <AlertCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <p className="font-semibold">Chaque projet est indépendant</p>
          <p className="mt-0.5">Les zones, tâches, équipes et utilisateurs sont isolés par projet. Pour accéder à un projet, sélectionnez-le sur l'écran de connexion.</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Composant — Onglet Entreprises (nouveau modèle multi-cie)
// ─────────────────────────────────────────────────────────────

const ROLES_LIST: { value: UserRole; label: string; color: string }[] = [
  { value: 'monteur', label: 'Monteur',  color: 'text-gray-700' },
  { value: 'chef',    label: 'Chef',     color: 'text-blue-700' },
  { value: 'ca',      label: 'C.A.',     color: 'text-purple-700' },
  { value: 'admin',   label: 'Admin',    color: 'text-red-700' },
]

function PersonneRow({
  personne,
  acces,
  chantiers,
  onEdit,
  onDelete,
  onToggle,
  onAddAcces,
  onRemoveAcces,
}: {
  personne: Personne
  acces: AccesChantier[]
  chantiers: Chantier[]
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onAddAcces: (chantierId: string) => void
  onRemoveAcces: (chantierId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const roleMeta = ROLES_LIST.find(r => r.value === personne.role) ?? ROLES_LIST[0]
  const personneChantiers = acces.map(a => chantiers.find(c => c.id === a.chantier_id)).filter(Boolean) as Chantier[]
  const availableChantiers = chantiers.filter(c => !acces.find(a => a.chantier_id === c.id))

  return (
    <div className={`border-b border-gray-50 last:border-0 ${!personne.actif ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${personne.actif ? 'bg-nc-blue text-white' : 'bg-gray-200 text-gray-400'}`}>
          {(personne.prenom?.[0] ?? '').toUpperCase()}{personne.nom[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-nc-blue">{personne.prenom} {personne.nom}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 ${roleMeta.color}`}>
              {roleMeta.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {personneChantiers.length === 0
              ? 'Aucun chantier assigné'
              : `${personneChantiers.length} chantier${personneChantiers.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Chantiers">
            <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Modifier">
            <Edit2 size={13} />
          </button>
          <button onClick={onToggle} className={`p-1.5 rounded-lg ${personne.actif ? 'hover:bg-red-50 text-gray-300 hover:text-red-400' : 'hover:bg-green-50 text-gray-300 hover:text-green-500'}`} title={personne.actif ? 'Désactiver' : 'Réactiver'}>
            {personne.actif ? <UserX size={13} /> : <UserCheck size={13} />}
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400" title="Supprimer">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-gray-50/60 px-4 pb-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-1">Chantiers assignés</p>
          {personneChantiers.map(c => (
            <div key={c.id} className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-gray-100">
              <span className="font-medium text-nc-blue">{c.name}</span>
              <button onClick={() => onRemoveAcces(c.id)} className="text-red-400 hover:text-red-600 text-[10px]">Retirer</button>
            </div>
          ))}
          {availableChantiers.length > 0 && (
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) { onAddAcces(e.target.value); e.target.value = '' } }}
              className="mt-1 w-full border border-dashed border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-500 bg-white focus:outline-none"
            >
              <option value="">+ Ajouter un chantier…</option>
              {availableChantiers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}

function PersonneForm({
  initial,
  entrepriseId,
  onSave,
  onCancel,
}: {
  initial: Partial<Personne>
  entrepriseId: string
  onSave: (p: Personne) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    prenom: initial.prenom ?? '',
    nom: initial.nom ?? '',
    role: (initial.role ?? 'monteur') as UserRole,
    code_pin: initial.code_pin ?? '',
  })
  const [showPin, setShowPin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.nom.trim()) { setError('Nom requis'); return }
    if (!form.code_pin.trim() && !initial.id) { setError('PIN requis'); return }
    setSaving(true)
    setError('')
    try {
      const saved = await upsertPersonne({
        ...(initial.id ? { id: initial.id } : {}),
        entreprise_id: entrepriseId,
        prenom: form.prenom.trim() || null,
        nom: form.nom.trim(),
        role: form.role,
        code_pin: form.code_pin.trim() || initial.code_pin,
        actif: initial.actif ?? true,
      })
      onSave(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-blue-50/30 rounded-xl border border-nc-blue/20 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Prénom</label>
          <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20" placeholder="Jean" />
        </div>
        <div>
          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Nom *</label>
          <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} autoFocus
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20" placeholder="Dupont" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Rôle</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
            className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/20 bg-white">
            {ROLES_LIST.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">PIN *</label>
          <div className="flex gap-1 mt-0.5">
            <input type={showPin ? 'text' : 'password'} value={form.code_pin}
              onChange={e => setForm(f => ({ ...f, code_pin: e.target.value }))} maxLength={6}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-nc-blue/20" placeholder="••••" />
            <button type="button" onClick={() => setShowPin(p => !p)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-[10px] text-gray-400 hover:bg-gray-50">
              {showPin ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
            <button type="button" onClick={() => setForm(f => ({ ...f, code_pin: String(Math.floor(1000 + Math.random() * 9000)) }))}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-[10px] text-gray-400 hover:bg-gray-50" title="Générer">↺</button>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">{error}</p>}

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 px-4 py-1.5 bg-nc-blue text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-nc-blue/90">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Enregistrer
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">Annuler</button>
      </div>
    </div>
  )
}

function EntrepriseBlock({
  entreprise,
  chantiers,
  onUpdated,
}: {
  entreprise: Entreprise
  chantiers: Chantier[]
  onUpdated: () => void
}) {
  const [personnes, setPersonnes] = useState<Personne[]>([])
  const [acces, setAcces] = useState<Record<string, AccesChantier[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [addingPersonne, setAddingPersonne] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const list = await getPersonnesByEntreprise(entreprise.id)
    setPersonnes(list)
    // Charger les accès de toutes les personnes
    const accesMap: Record<string, AccesChantier[]> = {}
    await Promise.all(list.map(async p => {
      accesMap[p.id] = await getAccesByPersonne(p.id)
    }))
    setAcces(accesMap)
    setLoading(false)
  }

  useEffect(() => { if (expanded) load() }, [expanded, entreprise.id])

  const handleSaved = async (saved: Personne) => {
    setAddingPersonne(false)
    setEditingId(null)
    await load()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* En-tête entreprise */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-nc-blue text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {entreprise.code_acces.slice(0, 2)}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-nc-blue">{entreprise.name}</p>
          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
            Code : <strong className="text-gray-600">{entreprise.code_acces}</strong>
          </p>
        </div>
        <ChevronDown size={15} className={`text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Corps expansible */}
      {expanded && (
        <div className="border-t border-gray-100">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-nc-blue" />
            </div>
          ) : (
            <>
              {/* Formulaire ajout personne */}
              {addingPersonne && (
                <div className="p-3 border-b border-gray-100">
                  <PersonneForm
                    initial={{}}
                    entrepriseId={entreprise.id}
                    onSave={handleSaved}
                    onCancel={() => setAddingPersonne(false)}
                  />
                </div>
              )}

              {/* Liste des personnes */}
              {personnes.map(p => (
                <div key={p.id}>
                  {editingId === p.id ? (
                    <div className="p-3 border-b border-gray-100">
                      <PersonneForm
                        initial={p}
                        entrepriseId={entreprise.id}
                        onSave={handleSaved}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <PersonneRow
                      personne={p}
                      acces={acces[p.id] ?? []}
                      chantiers={chantiers}
                      onEdit={() => { setEditingId(p.id); setAddingPersonne(false) }}
                      onDelete={async () => {
                        if (!confirm(`Supprimer ${p.prenom} ${p.nom} ?`)) return
                        await deletePersonne(p.id)
                        await load()
                      }}
                      onToggle={async () => {
                        await setPersonneActif(p.id, !p.actif)
                        await load()
                      }}
                      onAddAcces={async (chantierId) => {
                        await addAccesChantier(p.id, chantierId)
                        await load()
                      }}
                      onRemoveAcces={async (chantierId) => {
                        await removeAccesChantier(p.id, chantierId)
                        await load()
                      }}
                    />
                  )}
                </div>
              ))}

              {personnes.length === 0 && !addingPersonne && (
                <div className="text-center py-6 text-gray-400 text-sm">
                  Aucune personne enregistrée
                </div>
              )}

              {/* Bouton ajouter personne */}
              {!addingPersonne && (
                <div className="p-3 border-t border-gray-100">
                  <button
                    onClick={() => { setAddingPersonne(true); setEditingId(null) }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl hover:border-nc-blue/30 hover:text-nc-blue hover:bg-blue-50/30 transition-colors"
                  >
                    <Plus size={13} />
                    Ajouter une personne
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EntreprisesTab() {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [e, c] = await Promise.all([getEntreprises(), getChantiers()])
    setEntreprises(e)
    setChantiers(c)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!formName.trim()) { setFormError('Nom requis'); return }
    if (!formCode.trim()) { setFormError('Code requis'); return }
    setSaving(true)
    setFormError('')
    try {
      await upsertEntreprise({ name: formName.trim(), code_acces: formCode.trim().toUpperCase(), actif: true })
      setFormName('')
      setFormCode('')
      setShowForm(false)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-2">
        <KeyRound size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <p className="font-semibold">Nouveau modèle de connexion</p>
          <p className="mt-0.5">
            Chaque entreprise a un code d'accès unique. Les personnes se connectent avec ce code + leur PIN.
            Si elles ont accès à plusieurs chantiers, un sélecteur apparaît.
          </p>
        </div>
      </div>

      {/* Formulaire création entreprise */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-nc-blue/20 p-4 space-y-3">
          <p className="text-sm font-bold text-nc-blue">Nouvelle entreprise</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Nom *</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} autoFocus
                placeholder="Neoclima SA"
                className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Code d'accès *</label>
              <input value={formCode} onChange={e => setFormCode(e.target.value.toUpperCase())}
                placeholder="NEOCLIMA"
                className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-nc-blue/30" />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">{formError}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-1 px-4 py-2 bg-nc-blue text-white text-sm font-semibold rounded-lg disabled:opacity-40">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Créer
            </button>
            <button onClick={() => { setShowForm(false); setFormError('') }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">Annuler</button>
          </div>
        </div>
      )}

      {/* Liste entreprises */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {entreprises.map(e => (
            <EntrepriseBlock
              key={e.id}
              entreprise={e}
              chantiers={chantiers}
              onUpdated={load}
            />
          ))}
          {entreprises.length === 0 && !showForm && (
            <div className="text-center py-10 text-gray-400">
              <Building2 size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune entreprise configurée</p>
            </div>
          )}
        </div>
      )}

      {/* Bouton créer */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-nc-blue/30 hover:text-nc-blue hover:bg-blue-50/30 transition-colors"
        >
          <Plus size={16} />
          Nouvelle entreprise
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AdminPanel — composant principal
// ─────────────────────────────────────────────────────────────

type Tab = 'utilisateurs' | 'projets' | 'entreprises'

export default function AdminPanel() {
  const { role, utilisateur, chantier } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('utilisateurs')

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

  const stats = useMemo(() => ({
    total: users.filter(u => u.actif).length,
    monteur: users.filter(u => u.actif && u.role === 'monteur').length,
    chef: users.filter(u => u.actif && u.role === 'chef').length,
    ca: users.filter(u => u.actif && u.role === 'ca').length,
    admin: users.filter(u => u.actif && u.role === 'admin').length,
    inactif: users.filter(u => !u.actif).length,
  }), [users])

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
    load()
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
            <h2 className="text-lg font-bold text-nc-blue">Administration</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">ADMIN</span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">{chantier?.name}</p>
        </div>
        {activeTab === 'utilisateurs' && (
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
        )}
      </div>

      {/* Onglets */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-medium mb-5">
        {([
          { key: 'utilisateurs', label: 'Utilisateurs', icon: <Users size={14} /> },
          { key: 'projets',      label: 'Projets',      icon: <Building2 size={14} /> },
          { key: 'entreprises',  label: 'Entreprises',  icon: <KeyRound size={14} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 transition-colors ${
              activeTab === tab.key
                ? 'bg-nc-blue text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Onglet Projets */}
      {activeTab === 'projets' && <ProjetsTab />}

      {/* Onglet Entreprises */}
      {activeTab === 'entreprises' && <EntreprisesTab />}

      {/* Onglet Utilisateurs */}
      {activeTab === 'utilisateurs' && (
        <>
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
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher un utilisateur..."
              className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-nc-blue/30"
            />
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

          {/* Bouton ajouter utilisateur */}
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
        </>
      )}
    </div>
  )
}
