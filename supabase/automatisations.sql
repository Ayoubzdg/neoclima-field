-- ═══════════════════════════════════════════════════════════
-- AUTOMATISATIONS — escalade blocages > 48 h + rapport 17h
-- À exécuter dans Supabase → SQL Editor
--
-- ⚠️ AVANT d'exécuter : remplace <CRON_SECRET> (2 occurrences)
--    par un secret de ton choix (ex: une longue chaîne aléatoire).
--    Le MÊME secret devra être mis dans les secrets des
--    Edge Functions escalade-blocages et rapport-auto.
-- ═══════════════════════════════════════════════════════════

-- ── 0. Extensions ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. ESCALADE : marquage pour ne notifier qu'une fois ─────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escalade_at TIMESTAMPTZ;

-- ── 2. RAPPORTS DU JOUR AUTOMATIQUES (générés à 17h) ────────
CREATE TABLE IF NOT EXISTS rapports_jour_auto (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id  UUID NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  date_rapport DATE NOT NULL,
  synthese     TEXT,           -- texte rédigé par l'IA
  donnees      JSONB,          -- chiffres bruts du jour (audit)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chantier_id, date_rapport)
);

ALTER TABLE rapports_jour_auto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rja_interne ON rapports_jour_auto;
CREATE POLICY rja_interne ON rapports_jour_auto
  FOR SELECT TO authenticated USING (est_interne());
-- (écriture uniquement par la fonction serveur — service role)

-- ── 3. AGRÉGATEUR : les chiffres du jour d'un chantier ──────
CREATE OR REPLACE FUNCTION donnees_rapport_jour(p_chantier_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER STABLE AS $$
WITH zs AS (
  SELECT z.id, z.name
  FROM zones_takt z JOIN secteurs s ON s.id = z.secteur_id
  WHERE s.chantier_id = p_chantier_id
),
t AS (
  SELECT tk.*, zs.name AS zone_name
  FROM tasks tk JOIN zs ON zs.id = tk.zone_takt_id
)
SELECT jsonb_build_object(
  'personnel', (
    SELECT jsonb_build_object(
      'presents', COALESCE(SUM(monteurs_presents), 0),
      'prevus',   COALESCE(SUM(monteurs_prevus), 0),
      'effectifs_declares', COUNT(*) > 0)
    FROM effectifs WHERE chantier_id = p_chantier_id AND date = p_date
  ),
  'production', jsonb_build_object(
    'validees_aujourdhui',  (SELECT COUNT(*) FROM t WHERE status = 'done' AND updated_at::date = p_date),
    'terminees_declarees',  (SELECT COUNT(*) FROM t WHERE date_fin_reel::date = p_date),
    'stock_a_controler',    (SELECT COUNT(*) FROM t WHERE status = 'a_controler')
  ),
  'blocages', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'tache', label, 'zone', zone_name, 'cause', type_blocage,
      'plus_de_48h', updated_at < NOW() - INTERVAL '48 hours')), '[]'::jsonb)
    FROM t WHERE status = 'blocked'
  ),
  'retards_par_zone', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('zone', zone_name, 'taches_en_retard', n)), '[]'::jsonb)
    FROM (
      SELECT zone_name, COUNT(*) AS n FROM t
      WHERE date_planifiee < date_trunc('week', p_date::timestamp)::date
        AND status NOT IN ('done', 'a_controler')
      GROUP BY zone_name
    ) r
  ),
  'travaux_supp_en_attente', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('description', LEFT(description, 80), 'statut', statut)), '[]'::jsonb)
    FROM travaux_supp
    WHERE chantier_id = p_chantier_id AND statut IN ('signale', 'valide_cc')
  )
)
$$;

-- ── 4. PLANIFICATIONS pg_cron (heures en UTC !) ─────────────
-- Escalade : toutes les heures à h+15
SELECT cron.unschedule('escalade-blocages')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escalade-blocages');
SELECT cron.schedule(
  'escalade-blocages',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://sseqiogfaekvylwkzfvy.supabase.co/functions/v1/escalade-blocages',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Rapport du jour : 15h00 UTC = 17h00 heure suisse (été).
-- En hiver (UTC+1), passe à '0 16 * * 1-5' pour rester à 17h locale.
SELECT cron.unschedule('rapport-auto-17h')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rapport-auto-17h');
SELECT cron.schedule(
  'rapport-auto-17h',
  '0 15 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://sseqiogfaekvylwkzfvy.supabase.co/functions/v1/rapport-auto',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ── 5. Vérification ─────────────────────────────────────────
SELECT jobname, schedule, active FROM cron.job
WHERE jobname IN ('escalade-blocages', 'rapport-auto-17h');
