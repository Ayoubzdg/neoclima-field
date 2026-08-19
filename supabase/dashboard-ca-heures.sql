-- ═══════════════════════════════════════════════════════════
-- DASHBOARD CA + HEURES RÉALISÉES
-- À exécuter dans Supabase → SQL Editor
--
-- 1. batiment sur secteurs  → agrégation par bâtiment
-- 2. systeme sur tasks/types → agrégation par système
--    (soufflage, extraction, désenfumage…)
-- 3. heures_jour sur effectifs → heures réalisées =
--    présents × heures_jour, saisi chaque soir par le chef
--    d'équipe en 10 secondes. Débloque productivité et
--    prévision de fin SANS pointage par tâche (qui tuerait
--    l'adoption terrain).
-- ═══════════════════════════════════════════════════════════

-- ── 1. Bâtiment (secteurs) ──────────────────────────────────
ALTER TABLE secteurs
  ADD COLUMN IF NOT EXISTS batiment TEXT;

-- ── 2. Système (tâches + catalogue) ─────────────────────────
ALTER TABLE task_types
  ADD COLUMN IF NOT EXISTS systeme TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS systeme TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_systeme ON tasks(systeme);

-- ── 3. Heures par jour (effectifs) ──────────────────────────
ALTER TABLE effectifs
  ADD COLUMN IF NOT EXISTS heures_jour NUMERIC(4,1) NOT NULL DEFAULT 8;

-- ── Vérification ────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM secteurs  WHERE batiment IS NOT NULL) AS secteurs_avec_batiment,
  (SELECT COUNT(*) FROM tasks     WHERE systeme  IS NOT NULL) AS taches_avec_systeme,
  (SELECT COUNT(*) FROM effectifs)                            AS lignes_effectifs;
