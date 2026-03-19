import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import type { Contrainte } from '@/types/models'

// ── Utilitaires semaine ───────────────────────────────────────

function getWeekDays(startMonday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startMonday)
    d.setDate(d.getDate() + i)
    return d
  })
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const TYPE_EMOJI: Record<string, string> = {
  materiau: '📦',
  acces: '🚧',
  autre_corps: '🔧',
  gros_oeuvre: '🏗️',
  equipement: '⚙️',
  autre: '❓',
}

const STATUT_COLOR: Record<string, string> = {
  ouverte: 'bg-red-100 border-red-200 text-red-700',
  en_cours: 'bg-amber-100 border-amber-200 text-amber-700',
  levee: 'bg-green-100 border-green-200 text-green-700',
}

export default function ContraintesAgenda() {
  const navigate = useNavigate()
  const { chantier } = useAuthStore()
  const [monday, setMonday] = useState(() => getMondayOfWeek(new Date()))
  const [contraintes, setContraintes] = useState<Contrainte[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chantier?.id) return
    setIsLoading(true)
    // Charger les contraintes des tâches du chantier
    const fetchContraintes = async () => {
      const weekEnd = new Date(monday)
      weekEnd.setDate(weekEnd.getDate() + 6)

      // Étape 1 : secteurs du chantier
      const { data: secteurs } = await supabase
        .from('secteurs')
        .select('id')
        .eq('chantier_id', chantier.id)

      if (!secteurs || secteurs.length === 0) {
        setContraintes([])
        setIsLoading(false)
        return
      }

      // Étape 2 : zones des secteurs
      const secteurIds = secteurs.map((s: { id: string }) => s.id)
      const { data: zones } = await supabase
        .from('zones_takt')
        .select('id')
        .in('secteur_id', secteurIds)

      if (!zones || zones.length === 0) {
        setContraintes([])
        setIsLoading(false)
        return
      }

      const zoneIds = zones.map((z: { id: string }) => z.id)

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id')
        .in('zone_takt_id', zoneIds)

      if (!tasks || tasks.length === 0) {
        setContraintes([])
        setIsLoading(false)
        return
      }

      const taskIds = tasks.map((t: { id: string }) => t.id)

      const { data, error } = await supabase
        .from('contraintes')
        .select('*')
        .in('task_id', taskIds)
        .neq('statut', 'levee')
        .order('date_besoin', { ascending: true })

      if (!error && data) {
        setContraintes(data as Contrainte[])
      }
    }

    fetchContraintes().finally(() => setIsLoading(false))
  }, [chantier?.id, monday])

  const days = getWeekDays(monday)
  const weekEnd = new Date(monday)
  weekEnd.setDate(weekEnd.getDate() + 6)

  // Grouper les contraintes par jour de date_besoin
  const contraintesByDay = days.map(day => {
    const isoDay = toISO(day)
    return contraintes.filter(c => c.date_besoin === isoDay)
  })

  // Contraintes sans date (date_besoin null) ou hors semaine
  const sansDates = contraintes.filter(c =>
    !c.date_besoin ||
    c.date_besoin < toISO(monday) ||
    c.date_besoin > toISO(weekEnd)
  )

  const prevWeek = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() - 7)
    setMonday(d)
  }
  const nextWeek = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    setMonday(d)
  }

  const today = toISO(new Date())

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-nc-blue">Agenda Contraintes</h2>
          <p className="text-xs text-gray-500">
            {monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} —
            {weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={prevWeek}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
          >
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <button
            onClick={nextWeek}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Colonnes jours */}
          <div className="space-y-2">
            {days.map((day, i) => {
              const isoDay = toISO(day)
              const isToday = isoDay === today
              const items = contraintesByDay[i]
              const isWeekend = i >= 5

              return (
                <div
                  key={isoDay}
                  className={`rounded-xl overflow-hidden border
                    ${isToday ? 'border-nc-blue' : 'border-gray-100'}
                    ${isWeekend && items.length === 0 ? 'opacity-40' : ''}`}
                >
                  {/* En-tête jour */}
                  <div className={`flex items-center gap-2 px-3 py-2
                    ${isToday ? 'bg-nc-blue text-white' : 'bg-gray-50 text-gray-600'}`}
                  >
                    <span className="font-semibold text-sm">{DAY_LABELS[i]}</span>
                    <span className="text-xs opacity-70">
                      {day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    {items.length > 0 && (
                      <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full
                        ${isToday ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                        {items.length}
                      </span>
                    )}
                  </div>

                  {/* Contraintes du jour */}
                  {items.length > 0 ? (
                    <div className="divide-y divide-gray-50 bg-white">
                      {items.map(c => (
                        <div key={c.id} className={`flex items-start gap-2 px-3 py-2 border-l-4 ${STATUT_COLOR[c.statut] ?? ''}`}>
                          <span className="text-base flex-shrink-0">{TYPE_EMOJI[c.type] ?? '❓'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{c.description}</p>
                            {c.responsable && (
                              <p className="text-xs opacity-60">{c.responsable}</p>
                            )}
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 border
                            ${STATUT_COLOR[c.statut] ?? ''}`}>
                            {c.statut === 'ouverte' ? 'Ouverte' : c.statut === 'en_cours' ? 'En cours' : 'Levée'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-white">
                      <p className="text-xs text-gray-300 italic">Aucune contrainte</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Sans date ou hors semaine */}
          {sansDates.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <Clock size={12} />
                Sans date / hors semaine ({sansDates.length})
              </p>
              <div className="space-y-1.5">
                {sansDates.map(c => (
                  <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${STATUT_COLOR[c.statut] ?? 'border-gray-100'}`}>
                    <span>{TYPE_EMOJI[c.type] ?? '❓'}</span>
                    <p className="text-xs font-medium flex-1 truncate">{c.description}</p>
                    {c.bloquant && (
                      <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {contraintes.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle size={36} className="mx-auto mb-2 text-green-400" />
              <p className="font-medium text-green-600">Aucune contrainte ouverte</p>
              <p className="text-sm mt-1">Toutes les contraintes sont levées</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
