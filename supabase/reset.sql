-- ═══════════════════════════════════════════════════════════════════
-- RESET COMPLET — Neoclima Field
-- Supprime TOUTES les données. Conserve la structure (tables, RLS, RPC).
-- ⚠️  IRRÉVERSIBLE — faire un backup Supabase avant d'exécuter
-- ═══════════════════════════════════════════════════════════════════

-- Exécuter dans Supabase → SQL Editor → New query → Run

DO $$
BEGIN

  -- 1. Feuilles (dépendances profondes)
  DELETE FROM photos;
  DELETE FROM task_history;
  DELETE FROM task_phases;
  DELETE FROM materiaux;
  DELETE FROM contraintes;
  DELETE FROM mesures;
  DELETE FROM non_conformites;
  DELETE FROM plan_versions;
  DELETE FROM sync_queue_items;
  DELETE FROM push_subscriptions;

  -- 2. Tâches
  DELETE FROM tasks;

  -- 3. Cycles et données semaine
  DELETE FROM cycles_takt;
  DELETE FROM effectifs;
  DELETE FROM weekly_plans;

  -- 4. Zones et types
  DELETE FROM zones_takt;
  DELETE FROM task_types;

  -- 5. Structure chantier
  DELETE FROM secteurs;
  DELETE FROM utilisateurs;
  DELETE FROM equipes;
  DELETE FROM chantiers;

  RAISE NOTICE '✓ Base de données vidée — prête pour un nouveau projet';

END $$;
