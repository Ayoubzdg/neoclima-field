-- ═══════════════════════════════════════════════════════════
-- LOT : LOGIN DURCI + BLOCAGES ENRICHIS + TRAÇABILITÉ
-- À exécuter dans Supabase → SQL Editor
-- ⚠ Exécuter APRÈS cloisonnement-entreprises.sql
--    (ce script redéfinit login_personne avec l'entreprise
--     ET la limite d'essais — il remplace la version précédente)
-- ═══════════════════════════════════════════════════════════


-- ═══ 1. LOGIN DURCI ═════════════════════════════════════════
-- · Journal de toutes les tentatives de connexion (audit)
-- · Limite : 10 échecs / 15 min par code entreprise
--   → rend le brute-force d'un PIN 4 chiffres impraticable

CREATE TABLE IF NOT EXISTS login_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_entreprise TEXT NOT NULL,
  success         BOOLEAN NOT NULL,
  personne_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_code_date
  ON login_attempts(code_entreprise, created_at);

DROP FUNCTION IF EXISTS login_personne(TEXT, TEXT);

CREATE FUNCTION login_personne(
  p_code_entreprise TEXT,
  p_code_pin        TEXT
)
RETURNS TABLE(
  personne_id            UUID,
  nom                    TEXT,
  prenom                 TEXT,
  role                   TEXT,
  equipe_id              UUID,
  entreprise_id          UUID,
  entreprise_name        TEXT,
  chantier_id            UUID,
  chantier_name          TEXT,
  chantier_client        TEXT,
  chantier_takt_duree    INTEGER,
  chantier_budget_heures NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code    TEXT := UPPER(TRIM(p_code_entreprise));
  v_fails   INTEGER;
  v_pid     UUID;
BEGIN
  -- Rate-limit : 10 échecs / 15 min sur ce code entreprise
  SELECT COUNT(*) INTO v_fails
  FROM login_attempts la
  WHERE la.code_entreprise = v_code
    AND la.success = false
    AND la.created_at > NOW() - INTERVAL '15 minutes';

  IF v_fails >= 10 THEN
    INSERT INTO login_attempts (code_entreprise, success) VALUES (v_code, false);
    RETURN; -- silencieux : même réponse qu'un mauvais PIN
  END IF;

  -- Identifier la personne (pour le journal)
  SELECT p.id INTO v_pid
  FROM personnes p
  JOIN entreprises e ON e.id = p.entreprise_id
  WHERE e.code_acces = v_code
    AND p.code_pin   = p_code_pin
    AND p.actif      = true
  LIMIT 1;

  -- Journaliser la tentative
  INSERT INTO login_attempts (code_entreprise, success, personne_id)
  VALUES (v_code, v_pid IS NOT NULL, v_pid);

  IF v_pid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id            AS personne_id,
    p.nom,
    p.prenom,
    p.role,
    ac.equipe_id,
    e.id            AS entreprise_id,
    e.name          AS entreprise_name,
    c.id            AS chantier_id,
    c.name          AS chantier_name,
    c.client        AS chantier_client,
    c.takt_duree    AS chantier_takt_duree,
    c.budget_heures AS chantier_budget_heures
  FROM personnes p
  JOIN entreprises e     ON e.id = p.entreprise_id
  JOIN acces_chantier ac ON ac.personne_id = p.id
  JOIN chantiers c       ON c.id = ac.chantier_id
  WHERE p.id = v_pid
    AND c.statut = 'actif';
END;
$$;


-- ═══ 2. BLOCAGES : 12 CAUSES ════════════════════════════════

ALTER TABLE contraintes DROP CONSTRAINT IF EXISTS contraintes_type_check;
ALTER TABLE contraintes ADD CONSTRAINT contraintes_type_check
  CHECK (type IN (
    'materiau', 'acces', 'gros_oeuvre', 'autre_corps', 'equipement',
    'plan_manquant', 'erreur_plan', 'validation', 'reservation',
    'securite', 'technique', 'autre'
  ));


-- ═══ 3. TRAÇABILITÉ : HISTORIQUE ENRICHI ════════════════════
-- Avant : seul le rôle était enregistré ("monteur → done").
-- Maintenant : QUI (nom), de QUELLE entreprise, a fait QUOI.

ALTER TABLE task_history
  ADD COLUMN IF NOT EXISTS personne_nom  TEXT,
  ADD COLUMN IF NOT EXISTS entreprise_id UUID;

CREATE INDEX IF NOT EXISTS idx_task_history_task
  ON task_history(task_id, created_at DESC);


-- ═══ 4. Vérification ════════════════════════════════════════
SELECT 'login_attempts' AS objet, COUNT(*) AS n FROM login_attempts
UNION ALL
SELECT 'task_history', COUNT(*) FROM task_history;
