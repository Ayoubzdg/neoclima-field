-- ═══════════════════════════════════════════════════════════
-- SÉCURITÉ — BUCKETS STORAGE PRIVÉS
-- À exécuter dans Supabase → SQL Editor
-- ⚠ APRÈS avoir déployé l'app à jour (git push) : l'app doit
--   savoir générer des URLs signées avant que les URLs
--   publiques ne meurent. L'app gère la transition (fallback).
--
-- Avant : photos et plans du chantier accessibles par QUICONQUE
-- possède l'URL (audit §22). Après : accès uniquement avec un
-- JWT valide, via des URLs signées à durée limitée (1 h).
-- ═══════════════════════════════════════════════════════════

-- ── 1. Passer les buckets en privé ──────────────────────────
UPDATE storage.buckets SET public = false WHERE id IN ('photos', 'plans');

-- ── 2. Politiques d'accès (storage.objects) ─────────────────
-- Lecture + écriture pour tout JWT valide ; suppression interne.

DROP POLICY IF EXISTS "nc_lecture_authentifiee" ON storage.objects;
CREATE POLICY "nc_lecture_authentifiee" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('photos', 'plans'));

DROP POLICY IF EXISTS "nc_upload_authentifie" ON storage.objects;
CREATE POLICY "nc_upload_authentifie" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('photos', 'plans'));

DROP POLICY IF EXISTS "nc_suppression_interne" ON storage.objects;
CREATE POLICY "nc_suppression_interne" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('photos', 'plans') AND est_interne());

-- ── 3. Vérification ─────────────────────────────────────────
SELECT id, CASE WHEN public THEN '✗ PUBLIC' ELSE '✓ privé' END AS etat
FROM storage.buckets
WHERE id IN ('photos', 'plans');
