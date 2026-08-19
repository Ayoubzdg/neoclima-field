-- ═══════════════════════════════════════════════════════════
-- CHAÎNE MONTAGE → ISOLATION
-- À exécuter dans Supabase → SQL Editor
--
-- Workflow : Montage (ST montage) → À contrôler → VALIDÉ
--            → [AUTO] la tâche isolation liée est LIBÉRÉE
--            → Isolation (ST isolation) → À contrôler → Validé
--
-- · Une tâche isolation liée à un montage non validé est
--   verrouillée ("En attente montage") côté terrain.
-- · La libération est un trigger DB : fiable quel que soit
--   le client (app, offline sync, API).
-- ═══════════════════════════════════════════════════════════


-- ── 1. Colonnes ─────────────────────────────────────────────

ALTER TABLE task_types
  ADD COLUMN IF NOT EXISTS lot TEXT NOT NULL DEFAULT 'montage'
    CHECK (lot IN ('montage', 'isolation'));

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS lot TEXT NOT NULL DEFAULT 'montage'
    CHECK (lot IN ('montage', 'isolation')),
  ADD COLUMN IF NOT EXISTS tache_precedente_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bloquee_par_predecesseur BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_precedente ON tasks(tache_precedente_id);


-- ── 2. Verrouillage à la création ───────────────────────────
-- Une tâche créée avec un prédécesseur non validé naît verrouillée.

CREATE OR REPLACE FUNCTION fn_task_lock_from_predecesseur()
RETURNS TRIGGER AS $$
DECLARE
  v_pred_status TEXT;
BEGIN
  IF NEW.tache_precedente_id IS NOT NULL THEN
    SELECT status INTO v_pred_status FROM tasks WHERE id = NEW.tache_precedente_id;
    NEW.bloquee_par_predecesseur := (v_pred_status IS DISTINCT FROM 'done');
  ELSE
    NEW.bloquee_par_predecesseur := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_lock_pred ON tasks;
CREATE TRIGGER trg_task_lock_pred
BEFORE INSERT OR UPDATE OF tache_precedente_id ON tasks
FOR EACH ROW
EXECUTE FUNCTION fn_task_lock_from_predecesseur();


-- ── 3. Libération automatique ───────────────────────────────
-- Montage VALIDÉ (done) → toutes ses tâches suivantes sont
-- libérées. Dévalidation → re-verrouillage des suivantes
-- pas encore démarrées.

CREATE OR REPLACE FUNCTION fn_liberer_successeurs()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    -- Libération
    UPDATE tasks
    SET bloquee_par_predecesseur = false,
        updated_at = NOW()
    WHERE tache_precedente_id = NEW.id
      AND bloquee_par_predecesseur = true;
  ELSIF OLD.status = 'done' AND NEW.status IS DISTINCT FROM 'done' THEN
    -- Dévalidation → re-verrouiller les suivantes non démarrées
    UPDATE tasks
    SET bloquee_par_predecesseur = true,
        updated_at = NOW()
    WHERE tache_precedente_id = NEW.id
      AND status = 'todo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_liberer_successeurs ON tasks;
CREATE TRIGGER trg_liberer_successeurs
AFTER UPDATE OF status ON tasks
FOR EACH ROW
EXECUTE FUNCTION fn_liberer_successeurs();


-- ── 4. Types de tâches ISOLATION au catalogue ───────────────
-- Ajoutés à tous les chantiers actifs qui n'en ont pas encore.
-- Rendements en unité/h/monteur — à ajuster selon vos ratios.

INSERT INTO task_types (chantier_id, name, unite, rendement, cout_unitaire, lot)
SELECT c.id, t.name, t.unite, t.rendement, 0, 'isolation'
FROM chantiers c
CROSS JOIN (VALUES
  ('Isolation gaine rectangulaire', 'ml',  4.0),
  ('Isolation gaine spiro',         'ml',  5.0),
  ('Isolation coquilles conduits',  'ml',  3.0),
  ('Isolation terminaux',           'pce', 2.0)
) AS t(name, unite, rendement)
WHERE c.statut = 'actif'
  AND NOT EXISTS (
    SELECT 1 FROM task_types tt
    WHERE tt.chantier_id = c.id AND tt.name = t.name
  );


-- ── 5. Vérification ─────────────────────────────────────────
SELECT lot, COUNT(*) FROM task_types GROUP BY lot;
