-- ═══════════════════════════════════════════════════════════
-- JOURS/ÉQUIPE PAR ZONE
-- À exécuter dans Supabase → SQL Editor
--
-- Le CA renseigne un budget en jours-équipe par zone
-- (1 équipe = 2 monteurs). Sert de référence de traçabilité
-- pour l'avancement : jours prévus vs avancement constaté.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE zones_takt
  ADD COLUMN IF NOT EXISTS jours_equipe_prevus NUMERIC(5,1) DEFAULT NULL;

COMMENT ON COLUMN zones_takt.jours_equipe_prevus IS
  'Budget en jours-équipe (équipe = 2 monteurs) fixé par le chargé d''affaires';
