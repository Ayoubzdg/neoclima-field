-- ═══════════════════════════════════════════════════════════
-- VÉRIFICATION D'INSTALLATION — à exécuter dans Supabase
--
-- Résultat : une ligne par prérequis, avec OK ✓ ou MANQUANT ✗
-- et le fichier SQL à exécuter pour corriger.
-- À relancer après chaque migration, et avant tout déploiement.
-- ═══════════════════════════════════════════════════════════

WITH checks AS (

  -- 1. migration-statuts-validation.sql
  SELECT 1 AS ordre, 'Statut a_controler accepté (workflow validation)' AS controle,
    'migration-statuts-validation.sql' AS fichier,
    EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_name = 'tasks_status_check'
        AND check_clause LIKE '%a_controler%'
    ) AS ok

  UNION ALL
  -- 2. concurrence-offline.sql
  SELECT 2, 'RPC increment_qte_realisee (quantités atomiques)',
    'concurrence-offline.sql',
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_qte_realisee')

  UNION ALL
  -- 3. cloisonnement-entreprises.sql
  SELECT 3, 'entreprise_id sur tasks (cloisonnement ST)',
    'cloisonnement-entreprises.sql',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'entreprise_id')
  UNION ALL
  SELECT 4, 'entreprise_id sur equipes',
    'cloisonnement-entreprises.sql',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'equipes' AND column_name = 'entreprise_id')
  UNION ALL
  SELECT 5, 'Trigger tâche → entreprise de son équipe',
    'cloisonnement-entreprises.sql',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_task_entreprise')
  UNION ALL
  SELECT 6, 'Rôle chef_equipe accepté (personnes)',
    'cloisonnement-entreprises.sql',
    EXISTS (SELECT 1 FROM information_schema.check_constraints
            WHERE constraint_name = 'personnes_role_check'
              AND check_clause LIKE '%chef_equipe%')

  UNION ALL
  -- 4. batch-securite-blocages-historique.sql
  SELECT 7, 'Table login_attempts (limite d''essais + journal)',
    'batch-securite-blocages-historique.sql',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'login_attempts')
  UNION ALL
  SELECT 8, 'login_personne retourne l''entreprise (12 colonnes)',
    'batch-securite-blocages-historique.sql (ou cloisonnement)',
    EXISTS (SELECT 1 FROM pg_proc
            WHERE proname = 'login_personne' AND pronargs = 2
              AND pg_get_function_result(oid) LIKE '%entreprise_id%')
  UNION ALL
  SELECT 9, 'Causes de blocage enrichies (securite, erreur_plan…)',
    'batch-securite-blocages-historique.sql',
    EXISTS (SELECT 1 FROM information_schema.check_constraints
            WHERE constraint_name = 'contraintes_type_check'
              AND check_clause LIKE '%securite%')
  UNION ALL
  SELECT 10, 'task_history.personne_nom (traçabilité QUI)',
    'batch-securite-blocages-historique.sql',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'task_history' AND column_name = 'personne_nom')

  UNION ALL
  -- 5. montage-isolation.sql
  SELECT 11, 'Chaîne montage → isolation (tache_precedente_id)',
    'montage-isolation.sql',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'tache_precedente_id')
  UNION ALL
  SELECT 12, 'Trigger de libération automatique isolation',
    'montage-isolation.sql',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_liberer_successeurs')

  UNION ALL
  -- 6. travaux-supplementaires.sql
  SELECT 13, 'Table travaux_supp',
    'travaux-supplementaires.sql',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'travaux_supp')

  UNION ALL
  -- 7. dashboard-ca-heures.sql
  SELECT 14, 'effectifs.heures_jour (heures réalisées)',
    'dashboard-ca-heures.sql',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'effectifs' AND column_name = 'heures_jour')
  UNION ALL
  SELECT 15, 'tasks.systeme + secteurs.batiment (dashboard CA)',
    'dashboard-ca-heures.sql',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'systeme')
    AND EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'secteurs' AND column_name = 'batiment')

  UNION ALL
  -- Divers plus anciens
  SELECT 16, 'zones_takt.jours_equipe_prevus (budget CA)',
    'add-jours-equipe.sql',
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'zones_takt' AND column_name = 'jours_equipe_prevus')
  UNION ALL
  SELECT 17, 'Trigger sync utilisateurs → personnes',
    'trigger-sync-utilisateurs.sql',
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_utilisateur')
  UNION ALL
  SELECT 18, 'Realtime activé sur tasks (publication)',
    'enable-realtime.sql',
    EXISTS (SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = 'tasks')
)
SELECT
  CASE WHEN ok THEN '✓ OK' ELSE '✗ MANQUANT' END AS etat,
  controle,
  CASE WHEN ok THEN '' ELSE '→ exécuter ' || fichier END AS action
FROM checks
ORDER BY ok, ordre;
