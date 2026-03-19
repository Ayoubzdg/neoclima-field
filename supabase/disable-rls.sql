-- ═══════════════════════════════════════════════════════════
-- DÉSACTIVER LE RLS — Neoclima Field Tracker V2
-- ═══════════════════════════════════════════════════════════
-- App interne à PIN — la sécurité est gérée au niveau applicatif.
-- Le RLS Supabase n'est pas nécessaire pour ce cas d'usage.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE chantiers          DISABLE ROW LEVEL SECURITY;
ALTER TABLE secteurs           DISABLE ROW LEVEL SECURITY;
ALTER TABLE zones_takt         DISABLE ROW LEVEL SECURITY;
ALTER TABLE cycles_takt        DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_phases        DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_types         DISABLE ROW LEVEL SECURITY;
ALTER TABLE contraintes        DISABLE ROW LEVEL SECURITY;
ALTER TABLE materiaux          DISABLE ROW LEVEL SECURITY;
ALTER TABLE non_conformites    DISABLE ROW LEVEL SECURITY;
ALTER TABLE mesures            DISABLE ROW LEVEL SECURITY;
ALTER TABLE photos             DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_history       DISABLE ROW LEVEL SECURITY;
ALTER TABLE effectifs          DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipes            DISABLE ROW LEVEL SECURITY;
ALTER TABLE utilisateurs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans       DISABLE ROW LEVEL SECURITY;
ALTER TABLE plans_versions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue         DISABLE ROW LEVEL SECURITY;
ALTER TABLE parametres         DISABLE ROW LEVEL SECURITY;
ALTER TABLE causes_non_completion DISABLE ROW LEVEL SECURITY;
