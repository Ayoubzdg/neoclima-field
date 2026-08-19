-- ═══════════════════════════════════════════════════════════
-- WORKFLOW DE VALIDATION — migration des statuts
-- À exécuter dans Supabase → SQL Editor
--
-- Nouveau workflow :
--   todo → en_cours → a_controler → done (= VALIDÉ par le chef)
--                ↕ blocked
--
-- · Le "Terminé" du monteur pose désormais a_controler.
-- · Seul le chef/CA/admin passe a_controler → done (validation).
-- · Seul done compte dans l'avancement et le PPC.
-- · Les tâches done existantes restent done (validées d'office).
-- · Les 4 statuts CVC morts (nappe_h, nappe_b, terminaux,
--   raccordement) sont supprimés : inatteignables par l'UI,
--   ils redeviennent de simples en_cours.
-- ═══════════════════════════════════════════════════════════

-- 1. Migrer les données existantes
UPDATE tasks
SET status = 'en_cours'
WHERE status IN ('nappe_h', 'nappe_b', 'terminaux', 'raccordement');

-- 2. Remplacer la contrainte CHECK
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'en_cours', 'a_controler', 'done', 'blocked'));

-- 3. Vérification
SELECT status, COUNT(*) FROM tasks GROUP BY status ORDER BY status;
