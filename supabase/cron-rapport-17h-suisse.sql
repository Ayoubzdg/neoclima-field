-- ═══════════════════════════════════════════════════════════
-- RAPPORT AUTO : 17h heure suisse, été comme hiver
-- À exécuter UNE fois dans Supabase → SQL Editor,
-- APRÈS avoir redéployé la fonction rapport-auto.
--
-- pg_cron tourne en UTC et ignore l'heure d'été. Le job appelle
-- donc la fonction à 15h et 16h UTC ; la fonction ne génère que
-- lors de l'appel qui tombe à 17h heure suisse.
-- (Aucun secret à ressaisir : seul l'horaire du job change.)
-- ═══════════════════════════════════════════════════════════

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'rapport-auto-17h'),
  schedule := '0 15,16 * * 1-5'
);

-- Vérification : schedule doit afficher 0 15,16 * * 1-5
SELECT jobname, schedule, active FROM cron.job
WHERE jobname = 'rapport-auto-17h';
