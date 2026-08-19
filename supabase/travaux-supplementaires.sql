-- ═══════════════════════════════════════════════════════════
-- TRAVAUX SUPPLÉMENTAIRES
-- À exécuter dans Supabase → SQL Editor
--
-- Workflow :  Monteur détecte (photo + description)
--          →  signale
--          →  Chef de chantier analyse (estimation heures)
--          →  valide_cc
--          →  Chargé d'affaires autorise
--          →  valide_ca  ← RIEN ne se réalise sans cette étape
--          →  realise
--          (refuse possible à chaque étape, motif obligatoire)
--
-- Base de la facturation des régies/TS : tracé LE JOUR MÊME,
-- avec photo, auteur et entreprise.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS travaux_supp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id     UUID NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  zone_takt_id    UUID REFERENCES zones_takt(id) ON DELETE SET NULL,
  entreprise_id   UUID REFERENCES entreprises(id),
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,

  description     TEXT NOT NULL,
  photo_url       TEXT,

  statut          TEXT NOT NULL DEFAULT 'signale'
                    CHECK (statut IN ('signale','valide_cc','valide_ca','realise','refuse')),

  heures_estimees NUMERIC(6,1),
  qte_estimee     TEXT,               -- texte libre : "12 ml gaine 200"

  cree_par        TEXT,               -- nom de l'auteur
  cree_par_role   TEXT,
  valide_cc_par   TEXT,               -- chef de chantier
  valide_ca_par   TEXT,               -- chargé d'affaires
  motif_refus     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_chantier ON travaux_supp(chantier_id, statut);
CREATE INDEX IF NOT EXISTS idx_ts_entreprise ON travaux_supp(entreprise_id);

-- Vérification
SELECT statut, COUNT(*) FROM travaux_supp GROUP BY statut;
