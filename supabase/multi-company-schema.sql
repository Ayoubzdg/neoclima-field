-- ═══════════════════════════════════════════════════════════
-- ARCHITECTURE MULTI-ENTREPRISE — Neoclima Field Tracker V2
-- ═══════════════════════════════════════════════════════════
-- Objectif :
--   - Plusieurs entreprises utilisent l'app
--   - Chaque personne a un rôle unique (même sur tous les projets)
--   - Login : code entreprise (saisie libre) → PIN → sélection chantier
-- ═══════════════════════════════════════════════════════════

-- ── 1. Table entreprises ────────────────────────────────────
CREATE TABLE IF NOT EXISTS entreprises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code_acces  TEXT UNIQUE NOT NULL,  -- Toujours stocké en MAJUSCULES
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entreprises_code ON entreprises(code_acces);

-- ── 2. Table personnes ──────────────────────────────────────
-- Une identité par personne réelle, indépendante des chantiers
CREATE TABLE IF NOT EXISTS personnes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  prenom        TEXT,
  role          TEXT NOT NULL DEFAULT 'monteur'
                  CHECK (role IN ('monteur','chef','ca','admin')),
  code_pin      TEXT NOT NULL,
  actif         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personnes_entreprise ON personnes(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_personnes_pin        ON personnes(code_pin);

-- ── 3. Ajout entreprise_id sur chantiers ───────────────────
ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chantiers_entreprise ON chantiers(entreprise_id);

-- ── 4. Table acces_chantier ─────────────────────────────────
-- Lie une personne à un ou plusieurs chantiers
-- equipe_id optionnel : utile pour les monteurs
CREATE TABLE IF NOT EXISTS acces_chantier (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id UUID REFERENCES personnes(id) ON DELETE CASCADE,
  chantier_id UUID REFERENCES chantiers(id) ON DELETE CASCADE,
  equipe_id   UUID REFERENCES equipes(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(personne_id, chantier_id)
);
CREATE INDEX IF NOT EXISTS idx_acces_personne ON acces_chantier(personne_id);
CREATE INDEX IF NOT EXISTS idx_acces_chantier ON acces_chantier(chantier_id);

-- ── 5. Désactiver RLS sur les nouvelles tables ─────────────
-- (cohérent avec le reste de l'app : sécurité applicative via PIN)
ALTER TABLE entreprises    DISABLE ROW LEVEL SECURITY;
ALTER TABLE personnes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE acces_chantier DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- FONCTIONS RPC
-- ══════════════════════════════════════════════════════════════

-- ── Vérifier qu'un code entreprise existe ──────────────────
CREATE OR REPLACE FUNCTION get_entreprise_by_code(p_code TEXT)
RETURNS TABLE(id UUID, name TEXT, code_acces TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, name, code_acces
  FROM entreprises
  WHERE code_acces = UPPER(TRIM(p_code))
    AND actif = true
  LIMIT 1;
$$;

-- ── Login multi-entreprise ──────────────────────────────────
-- Retourne TOUTES les lignes chantier accessibles par la personne.
-- 1 ligne  → login direct
-- N lignes → afficher le sélecteur de chantier
-- 0 ligne  → code entreprise ou PIN incorrect
CREATE OR REPLACE FUNCTION login_personne(
  p_code_entreprise TEXT,
  p_code_pin        TEXT
)
RETURNS TABLE(
  personne_id           UUID,
  nom                   TEXT,
  prenom                TEXT,
  role                  TEXT,
  equipe_id             UUID,
  chantier_id           UUID,
  chantier_name         TEXT,
  chantier_client       TEXT,
  chantier_takt_duree   INTEGER,
  chantier_budget_heures NUMERIC
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.id            AS personne_id,
    p.nom,
    p.prenom,
    p.role,
    ac.equipe_id,
    c.id            AS chantier_id,
    c.name          AS chantier_name,
    c.client        AS chantier_client,
    c.takt_duree    AS chantier_takt_duree,
    c.budget_heures AS chantier_budget_heures
  FROM personnes p
  JOIN entreprises e  ON e.id  = p.entreprise_id
  JOIN acces_chantier ac ON ac.personne_id = p.id
  JOIN chantiers c    ON c.id  = ac.chantier_id
  WHERE e.code_acces = UPPER(TRIM(p_code_entreprise))
    AND p.code_pin   = p_code_pin
    AND p.actif      = true
    AND c.statut     = 'actif'
  ORDER BY c.name;
$$;

-- ══════════════════════════════════════════════════════════════
-- MIGRATION OPTIONNELLE — Relier les chantiers existants
-- ══════════════════════════════════════════════════════════════
-- Si vous avez déjà des chantiers, créez d'abord une entreprise :
--
--   INSERT INTO entreprises (name, code_acces)
--   VALUES ('Neoclima SA', 'NEOCLIMA')
--   RETURNING id;
--
-- Puis reliez vos chantiers existants :
--
--   UPDATE chantiers
--   SET entreprise_id = '<UUID_ENTREPRISE>'
--   WHERE statut = 'actif';
--
-- Et créez les personnes correspondant à vos utilisateurs existants :
--
--   INSERT INTO personnes (entreprise_id, nom, prenom, role, code_pin)
--   SELECT '<UUID_ENTREPRISE>', nom, prenom, role, code_pin
--   FROM utilisateurs
--   WHERE chantier_id = '<UUID_CHANTIER>';
--
-- Puis créez les accès :
--
--   INSERT INTO acces_chantier (personne_id, chantier_id)
--   SELECT p.id, '<UUID_CHANTIER>'
--   FROM personnes p
--   WHERE p.entreprise_id = '<UUID_ENTREPRISE>';
-- ══════════════════════════════════════════════════════════════
