-- ═══════════════════════════════════════════════════════════
-- ACTIVER REALTIME SUR LES TABLES CRITIQUES
-- À exécuter dans Supabase → SQL Editor
--
-- Sans ça, les modifications du monteur n'arrivent JAMAIS
-- au chef de chantier ou au CA en temps réel.
-- ═══════════════════════════════════════════════════════════

-- Nécessaire pour que les UPDATE transmettent la ligne complète
ALTER TABLE tasks        REPLICA IDENTITY FULL;
ALTER TABLE contraintes  REPLICA IDENTITY FULL;
ALTER TABLE cycles_takt  REPLICA IDENTITY FULL;

-- Ajouter les tables à la publication Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE contraintes;
ALTER PUBLICATION supabase_realtime ADD TABLE cycles_takt;

-- Vérification : doit lister les tables activées
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
