-- ═══════════════════════════════════════════════════════════
-- VENTILATION DES HEURES PAR ZONE
-- À exécuter UNE fois dans Supabase → SQL Editor
-- (prérequis : cloisonnement-entreprises.sql et securite-2-rls.sql)
--
-- Chaque soir, l'équipe répartit ses heures du jour
-- (présents × heures/jour) sur les zones où elle a travaillé,
-- en 4 catégories :
--   productif · attente (blocage) · regie · reprise
--
-- Débloque : heures consommées vs budget PAR ZONE et PAR
-- ENTREPRISE, heures perdues en attente (base de réclamation),
-- rendements réels pour le chiffrage.
-- ═══════════════════════════════════════════════════════════

-- ── 1. Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS heures_zone (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id   UUID NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  equipe_id     UUID NOT NULL REFERENCES equipes(id)   ON DELETE CASCADE,
  -- Héritée de l'équipe par trigger (cloisonnement sous-traitants)
  entreprise_id UUID REFERENCES entreprises(id),
  -- NULL autorisé pour les heures non productives sans zone précise
  zone_takt_id  UUID REFERENCES zones_takt(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  categorie     TEXT NOT NULL DEFAULT 'productif'
                CHECK (categorie IN ('productif', 'attente', 'regie', 'reprise')),
  heures        NUMERIC(5,1) NOT NULL CHECK (heures > 0 AND heures <= 500),
  saisi_par     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heures_zone_chantier_date ON heures_zone(chantier_id, date);
CREATE INDEX IF NOT EXISTS idx_heures_zone_equipe_date   ON heures_zone(equipe_id, date);
CREATE INDEX IF NOT EXISTS idx_heures_zone_zone          ON heures_zone(zone_takt_id);

-- ── 2. Trigger : l'entreprise vient TOUJOURS de l'équipe ────
CREATE OR REPLACE FUNCTION fn_heures_zone_entreprise()
RETURNS TRIGGER AS $$
BEGIN
  SELECT entreprise_id INTO NEW.entreprise_id
  FROM equipes WHERE id = NEW.equipe_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_heures_zone_entreprise ON heures_zone;
CREATE TRIGGER trg_heures_zone_entreprise
BEFORE INSERT OR UPDATE OF equipe_id ON heures_zone
FOR EACH ROW
EXECUTE FUNCTION fn_heures_zone_entreprise();

-- ── 3. RLS : un sous-traitant ne voit et ne saisit que SES heures
ALTER TABLE heures_zone ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS heures_zone_select ON heures_zone;
CREATE POLICY heures_zone_select ON heures_zone FOR SELECT TO authenticated
  USING (est_interne() OR entreprise_id::text = jwt_entreprise_id());

DROP POLICY IF EXISTS heures_zone_insert ON heures_zone;
CREATE POLICY heures_zone_insert ON heures_zone FOR INSERT TO authenticated
  WITH CHECK (est_interne() OR entreprise_id::text = jwt_entreprise_id());

DROP POLICY IF EXISTS heures_zone_delete ON heures_zone;
CREATE POLICY heures_zone_delete ON heures_zone FOR DELETE TO authenticated
  USING (est_interne() OR entreprise_id::text = jwt_entreprise_id());

-- ── 4. Enregistrement atomique (remplace la journée de l'équipe)
-- Rejouable sans doublon : utilisé aussi par la file hors ligne.
-- SECURITY INVOKER (défaut) → les politiques RLS s'appliquent.
CREATE OR REPLACE FUNCTION enregistrer_heures_zone(
  p_chantier_id UUID,
  p_equipe_id   UUID,
  p_date        DATE,
  p_lignes      JSONB,
  p_saisi_par   TEXT DEFAULT NULL
)
RETURNS SETOF heures_zone
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM heures_zone
  WHERE equipe_id = p_equipe_id AND date = p_date;

  RETURN QUERY
  INSERT INTO heures_zone (chantier_id, equipe_id, zone_takt_id, date, categorie, heures, saisi_par)
  SELECT
    p_chantier_id,
    p_equipe_id,
    NULLIF(l->>'zone_takt_id', '')::uuid,
    p_date,
    COALESCE(l->>'categorie', 'productif'),
    (l->>'heures')::numeric,
    p_saisi_par
  FROM jsonb_array_elements(COALESCE(p_lignes, '[]'::jsonb)) AS l
  WHERE (l->>'heures')::numeric > 0
  RETURNING *;
END;
$$;

-- ── 5. Vérification ─────────────────────────────────────────
SELECT
  (SELECT CASE WHEN rowsecurity THEN '✓ RLS actif' ELSE '✗ RLS INACTIF' END
     FROM pg_tables WHERE schemaname = 'public' AND tablename = 'heures_zone') AS rls,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'heures_zone')           AS politiques_attendu_3,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'enregistrer_heures_zone')     AS rpc_attendu_1;
