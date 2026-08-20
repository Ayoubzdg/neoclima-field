-- ═══════════════════════════════════════════════════════════
-- ENTREPRISE TITULAIRE DU CHANTIER
-- À exécuter dans Supabase → SQL Editor
--
-- L'entreprise titulaire est celle qui a la relation
-- contractuelle avec le client (ex : ROOS sur Satellite 10).
-- Tous les rapports de régie émanent d'elle, quel que soit
-- l'utilisateur connecté (interne ou sous-traitant).
-- ═══════════════════════════════════════════════════════════

ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS entreprise_titulaire_id UUID REFERENCES entreprises(id);

-- ── 1. Liste tes entreprises pour repérer la bonne ──────────
SELECT id, name, code_acces FROM entreprises ORDER BY name;

-- ── 2. Définis le titulaire du chantier (adapte les noms) ───
-- Exemple : ROOS titulaire de Satellite 10
UPDATE chantiers
SET entreprise_titulaire_id = (
  SELECT id FROM entreprises WHERE name ILIKE '%ROOS%' LIMIT 1
)
WHERE name = 'Satellite 10';

-- ── 3. Vérification ─────────────────────────────────────────
SELECT c.name AS chantier, e.name AS entreprise_titulaire
FROM chantiers c
LEFT JOIN entreprises e ON e.id = c.entreprise_titulaire_id;
