-- ═══════════════════════════════════════════════════════════
-- NOTIFICATIONS PUSH — table des abonnements
-- À exécuter dans Supabase → SQL Editor
--
-- Chaque appareil qui active les notifications enregistre ici
-- son abonnement Web Push. L'Edge Function push-blocage lit
-- cette table (service role) pour envoyer les notifications.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personne_id   UUID,
  role          TEXT,
  entreprise_id UUID,
  chantier_id   UUID,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_role ON push_subs(chantier_id, role);

-- RLS : un client authentifié gère SES abonnements ;
-- la lecture globale est réservée au service role (Edge Function)
ALTER TABLE push_subs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subs_insert ON push_subs;
CREATE POLICY push_subs_insert ON push_subs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS push_subs_update ON push_subs;
CREATE POLICY push_subs_update ON push_subs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS push_subs_delete ON push_subs;
CREATE POLICY push_subs_delete ON push_subs
  FOR DELETE TO authenticated USING (true);

-- Vérification
SELECT COUNT(*) AS abonnements FROM push_subs;
