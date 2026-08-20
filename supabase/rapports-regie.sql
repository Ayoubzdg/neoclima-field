-- ═══════════════════════════════════════════════════════════
-- RAPPORTS DE RÉGIE (rapport journalier)
-- À exécuter dans Supabase → SQL Editor
--
-- Équivalent numérique du carnet papier "Tages/Regie-Rapport" :
-- numéro unique automatique, lignes ouvriers/heures, matériel,
-- imprimable avec double signature (client / entrepreneur).
-- Peut être lié à un travail supplémentaire signalé dans Field.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rapports_regie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          SERIAL,                    -- numéro unique auto (N° 1, 2, 3…)
  chantier_id     UUID NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  travaux_supp_id UUID REFERENCES travaux_supp(id) ON DELETE SET NULL,

  date_rapport    DATE NOT NULL DEFAULT CURRENT_DATE,
  client          TEXT,                      -- prérempli depuis le chantier
  description     TEXT,                      -- "Travaux exécutés"

  -- Lignes ouvriers : [{ref, nombre, fonction, heures, heures_supp}]
  lignes          JSONB NOT NULL DEFAULT '[]',
  -- Matériel, outils et transports (texte libre, une entrée par ligne)
  materiel        TEXT,

  cree_par        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regie_chantier ON rapports_regie(chantier_id, numero DESC);

-- RLS : réservé à l'interne (chef / ca / admin)
ALTER TABLE rapports_regie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regie_interne ON rapports_regie;
CREATE POLICY regie_interne ON rapports_regie
  FOR ALL TO authenticated
  USING (est_interne()) WITH CHECK (est_interne());

-- Vérification
SELECT COUNT(*) AS rapports FROM rapports_regie;
