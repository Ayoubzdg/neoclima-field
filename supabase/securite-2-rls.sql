-- ═══════════════════════════════════════════════════════════
-- SÉCURITÉ ÉTAPE 3/3 — RÉACTIVATION RLS
--
-- ⚠⚠⚠ NE PAS EXÉCUTER avant que :
--   1. securite-1-hash-pins.sql soit passé
--   2. l'Edge Function « login » soit déployée et TESTÉE
--   3. l'app à jour soit déployée (le client injecte le JWT)
--   4. tous les utilisateurs se soient reconnectés (JWT en poche)
-- Sinon : PLUS PERSONNE n'accède aux données depuis l'app.
--
-- Rollback d'urgence : réexécuter disable-rls.sql
--
-- Principe :
-- · Sans JWT valide → AUCUN accès (l'anon key seule ne lit
--   plus rien : fin de la fuite majeure relevée par l'audit)
-- · monteur / chef_equipe → tâches de LEUR entreprise uniquement
-- · chef / ca / admin → tout le chantier
-- · personnes / entreprises / accès / journal → admin seulement
--   (le login passe par des RPC SECURITY DEFINER, non bloqués)
-- ═══════════════════════════════════════════════════════════


-- ── 0. Helpers : lecture des claims du JWT ──────────────────
CREATE OR REPLACE FUNCTION jwt_app_role() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::json->>'app_role', '')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION jwt_entreprise_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::json->>'entreprise_id', '')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION est_interne() RETURNS BOOLEAN AS $$
  SELECT jwt_app_role() IN ('chef', 'ca', 'admin')
$$ LANGUAGE sql STABLE;


-- ── 1. Activer RLS partout ──────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chantiers','secteurs','zones_takt','cycles_takt','tasks','task_phases',
    'task_types','contraintes','materiaux','non_conformites','mesures',
    'photos','task_history','effectifs','weekly_plans','causes_non_completion',
    'plans_versions','travaux_supp','equipes','utilisateurs',
    'entreprises','personnes','acces_chantier','login_attempts'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;


-- ── 2. Données de production : lecture pour tout JWT valide ─
-- (le cloisonnement fin est sur tasks ; zones/plans/NC sont
--  des données de coordination partagées sur le chantier)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chantiers','secteurs','zones_takt','cycles_takt','task_phases',
    'task_types','contraintes','materiaux','non_conformites','mesures',
    'photos','task_history','effectifs','weekly_plans','causes_non_completion',
    'plans_versions','travaux_supp','equipes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS lecture_authentifiee ON %I', t);
    EXECUTE format(
      'CREATE POLICY lecture_authentifiee ON %I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
END $$;


-- ── 3. TASKS : cloisonnement entreprise ─────────────────────
DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks FOR SELECT TO authenticated
  USING (est_interne() OR entreprise_id::text = jwt_entreprise_id());

DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks FOR UPDATE TO authenticated
  USING (est_interne() OR entreprise_id::text = jwt_entreprise_id())
  WITH CHECK (est_interne() OR entreprise_id::text = jwt_entreprise_id());

DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks FOR INSERT TO authenticated
  WITH CHECK (est_interne());

DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_delete ON tasks FOR DELETE TO authenticated
  USING (est_interne());


-- ── 4. Écritures terrain (tous rôles authentifiés) ──────────
-- contraintes (blocages), photos, historique, effectifs,
-- travaux supp : créés par les monteurs aussi
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contraintes','photos','task_history','effectifs','travaux_supp'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS ecriture_authentifiee ON %I', t);
    EXECUTE format(
      'CREATE POLICY ecriture_authentifiee ON %I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS maj_authentifiee ON %I', t);
    EXECUTE format(
      'CREATE POLICY maj_authentifiee ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Suppression de photos : interne uniquement
DROP POLICY IF EXISTS photos_delete ON photos;
CREATE POLICY photos_delete ON photos FOR DELETE TO authenticated
  USING (est_interne());


-- ── 5. Écritures de pilotage : interne uniquement ───────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chantiers','secteurs','zones_takt','cycles_takt','task_phases','task_types',
    'non_conformites','mesures','weekly_plans','causes_non_completion',
    'plans_versions','materiaux','equipes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS ecriture_interne ON %I', t);
    EXECUTE format(
      'CREATE POLICY ecriture_interne ON %I FOR ALL TO authenticated USING (est_interne()) WITH CHECK (est_interne())', t);
  END LOOP;
END $$;


-- ── 6. Tables sensibles : admin (et CA en lecture) ──────────
-- Le LOGIN passe par des RPC SECURITY DEFINER → non bloqué.

DROP POLICY IF EXISTS personnes_admin ON personnes;
CREATE POLICY personnes_admin ON personnes FOR ALL TO authenticated
  USING (jwt_app_role() = 'admin') WITH CHECK (jwt_app_role() = 'admin');

DROP POLICY IF EXISTS acces_admin ON acces_chantier;
CREATE POLICY acces_admin ON acces_chantier FOR ALL TO authenticated
  USING (jwt_app_role() = 'admin') WITH CHECK (jwt_app_role() = 'admin');

DROP POLICY IF EXISTS entreprises_lecture ON entreprises;
CREATE POLICY entreprises_lecture ON entreprises FOR SELECT TO authenticated
  USING (jwt_app_role() IN ('ca', 'admin'));
DROP POLICY IF EXISTS entreprises_admin ON entreprises;
CREATE POLICY entreprises_admin ON entreprises FOR ALL TO authenticated
  USING (jwt_app_role() = 'admin') WITH CHECK (jwt_app_role() = 'admin');

DROP POLICY IF EXISTS utilisateurs_lecture ON utilisateurs;
CREATE POLICY utilisateurs_lecture ON utilisateurs FOR SELECT TO authenticated
  USING (est_interne());
DROP POLICY IF EXISTS utilisateurs_gestion ON utilisateurs;
CREATE POLICY utilisateurs_gestion ON utilisateurs FOR ALL TO authenticated
  USING (jwt_app_role() IN ('ca', 'admin')) WITH CHECK (jwt_app_role() IN ('ca', 'admin'));

DROP POLICY IF EXISTS login_attempts_admin ON login_attempts;
CREATE POLICY login_attempts_admin ON login_attempts FOR SELECT TO authenticated
  USING (jwt_app_role() = 'admin');


-- ── 7. Vérification ─────────────────────────────────────────
SELECT tablename,
       CASE WHEN rowsecurity THEN '✓ RLS actif' ELSE '✗ RLS INACTIF' END AS etat
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;
