-- ═══════════════════════════════════════════════════════════
-- RAPPORT DE RÉGIE v2 — À exécuter dans Supabase → SQL Editor
-- (remplace entreprise-titulaire.sql — tout est idempotent,
--  ré-exécutable sans risque)
--
-- 1. Entreprise titulaire du chantier (en-tête du rapport)
-- 2. Emplacement exact du travail supp (saisi par le monteur)
-- 3. Photos en annexe + flux de validation sur le rapport
-- ═══════════════════════════════════════════════════════════

-- ── 1. ENTREPRISE TITULAIRE ─────────────────────────────────
-- Celle qui a la relation contractuelle avec le client
-- (ex : ROOS sur Satellite 10). Les rapports de régie
-- émanent d'elle, quel que soit l'utilisateur connecté.

ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS entreprise_titulaire_id UUID REFERENCES entreprises(id);

-- RPC SECURITY DEFINER : lisible par tous les rôles internes,
-- même si la RLS de "entreprises" est réservée ca/admin.
CREATE OR REPLACE FUNCTION get_entreprise_titulaire(p_chantier_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT e.name
  FROM chantiers c
  JOIN entreprises e ON e.id = c.entreprise_titulaire_id
  WHERE c.id = p_chantier_id;
$$;

-- Repère la bonne entreprise dans cette liste :
SELECT id, name, code_acces FROM entreprises ORDER BY name;

-- Puis définis le titulaire (ADAPTE le nom si besoin) :
UPDATE chantiers
SET entreprise_titulaire_id = (
  SELECT id FROM entreprises WHERE name ILIKE '%ROOS%' LIMIT 1
)
WHERE name = 'Satellite 10';

-- ── 2. EMPLACEMENT EXACT (travaux supp) ─────────────────────
ALTER TABLE travaux_supp
  ADD COLUMN IF NOT EXISTS emplacement TEXT;

-- ── 3. RAPPORT : emplacement, photos annexe, flux interne ───
ALTER TABLE rapports_regie
  ADD COLUMN IF NOT EXISTS emplacement TEXT,
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS flux JSONB;

-- ── VÉRIFICATION ────────────────────────────────────────────
-- La colonne entreprise_titulaire doit afficher ROOS pour
-- Satellite 10. Si NULL → l'UPDATE ci-dessus n'a rien trouvé,
-- relance-le avec l'id exact de la liste des entreprises.
SELECT c.name AS chantier, e.name AS entreprise_titulaire
FROM chantiers c
LEFT JOIN entreprises e ON e.id = c.entreprise_titulaire_id;
