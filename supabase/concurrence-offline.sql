-- ═══════════════════════════════════════════════════════════
-- CONCURRENCE — quantités en delta atomique
-- À exécuter dans Supabase → SQL Editor
--
-- Problème résolu : deux personnes saisissent une quantité en
-- même temps → avant, la seconde écriture écrasait la première
-- (last-write-wins). Avec le delta atomique, les deux saisies
-- S'ADDITIONNENT côté serveur.
--
-- Exemple : qte=10. A ajoute +5, B ajoute +3 simultanément.
--   Avant : résultat 13 OU 15 (une saisie perdue)
--   Après : résultat 18 (toujours)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION increment_qte_realisee(p_task_id UUID, p_delta NUMERIC)
RETURNS SETOF tasks AS $$
  UPDATE tasks
  SET qte_realisee = GREATEST(0, qte_realisee + p_delta),
      updated_at   = NOW()
  WHERE id = p_task_id
  RETURNING *;
$$ LANGUAGE sql;
