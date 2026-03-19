-- ═══════════════════════════════════════════════════════════
-- SEED — Données de démonstration Neoclima V2
-- ═══════════════════════════════════════════════════════════
-- À exécuter APRÈS schema.sql dans l'éditeur SQL Supabase
-- ═══════════════════════════════════════════════════════════

-- IDs fixes pour la démo
DO $$
DECLARE
  v_chantier_id UUID := 'a1000000-0000-0000-0000-000000000001';
  v_secteur_a   UUID := 'b1000000-0000-0000-0000-000000000001';
  v_secteur_b   UUID := 'b1000000-0000-0000-0000-000000000002';
  v_zone_n2n    UUID := 'c1000000-0000-0000-0000-000000000001';
  v_zone_n2s    UUID := 'c1000000-0000-0000-0000-000000000002';
  v_zone_n1     UUID := 'c1000000-0000-0000-0000-000000000003';
  v_zone_rdc    UUID := 'c1000000-0000-0000-0000-000000000004';
  v_equipe_a    UUID := 'd1000000-0000-0000-0000-000000000001';
  v_equipe_b    UUID := 'd1000000-0000-0000-0000-000000000002';
  v_equipe_c    UUID := 'd1000000-0000-0000-0000-000000000003';
  v_cycle_1     UUID := 'e1000000-0000-0000-0000-000000000001';
  v_cycle_2     UUID := 'e1000000-0000-0000-0000-000000000002';
  v_tt_gaine_r  UUID := 'f1000000-0000-0000-0000-000000000001';
  v_tt_gaine_c  UUID := 'f1000000-0000-0000-0000-000000000002';
  v_tt_terminal UUID := 'f1000000-0000-0000-0000-000000000003';
  -- UUIDs utilisateurs (doivent correspondre aux auth.users)
  v_u_jean      UUID := '11111111-0000-0000-0000-000000000001';
  v_u_marc      UUID := '11111111-0000-0000-0000-000000000002';
  v_u_pedro     UUID := '11111111-0000-0000-0000-000000000003';
  v_u_sophie    UUID := '11111111-0000-0000-0000-000000000004';
  v_u_thomas    UUID := '11111111-0000-0000-0000-000000000005';
BEGIN

-- ── Chantier ────────────────────────────────────────────────
INSERT INTO chantiers (id, name, adresse, client, date_debut, date_fin_prev, budget_heures, takt_duree, statut)
VALUES (v_chantier_id, 'Chantier Rolex Learning Center', 'Route de la Maladière 71, Lausanne', 'EPFL',
        '2025-01-06', '2025-09-30', 2400, 5, 'actif')
ON CONFLICT (id) DO NOTHING;

-- ── Équipes ─────────────────────────────────────────────────
INSERT INTO equipes (id, chantier_id, name, couleur, code_pin)
VALUES
  (v_equipe_a, v_chantier_id, 'Équipe A', '#3B82F6', '1234'),
  (v_equipe_b, v_chantier_id, 'Équipe B', '#8B5CF6', '5678'),
  (v_equipe_c, v_chantier_id, 'Équipe C', '#10B981', '9012')
ON CONFLICT (id) DO NOTHING;

-- ── Auth users (Supabase Auth) ───────────────────────────────
-- Ces comptes permettent au RLS de fonctionner via auth.uid()
-- Le mot de passe = le code PIN de chaque utilisateur
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role, aud
)
VALUES
  (v_u_jean,   '00000000-0000-0000-0000-000000000000',
   'jean-pierre.martin@neoclima.internal',
   crypt('0001', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),

  (v_u_marc,   '00000000-0000-0000-0000-000000000000',
   'marc.dubois@neoclima.internal',
   crypt('0002', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),

  (v_u_pedro,  '00000000-0000-0000-0000-000000000000',
   'pedro.garcia@neoclima.internal',
   crypt('0003', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),

  (v_u_sophie, '00000000-0000-0000-0000-000000000000',
   'sophie.berger@neoclima.internal',
   crypt('9999', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),

  (v_u_thomas, '00000000-0000-0000-0000-000000000000',
   'thomas.favre@neoclima.internal',
   crypt('8888', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- ── Utilisateurs de démo ────────────────────────────────────
-- id = auth.uid() pour que le RLS fonctionne
INSERT INTO utilisateurs (id, chantier_id, equipe_id, nom, prenom, role, code_pin, email)
VALUES
  (v_u_jean,   v_chantier_id, v_equipe_a, 'Martin', 'Jean-Pierre', 'monteur', '0001', 'jean-pierre.martin@neoclima.internal'),
  (v_u_marc,   v_chantier_id, v_equipe_a, 'Dubois', 'Marc',        'monteur', '0002', 'marc.dubois@neoclima.internal'),
  (v_u_pedro,  v_chantier_id, v_equipe_b, 'Garcia', 'Pedro',       'monteur', '0003', 'pedro.garcia@neoclima.internal'),
  (v_u_sophie, v_chantier_id, NULL,       'Berger', 'Sophie',      'chef',    '9999', 'sophie.berger@neoclima.internal'),
  (v_u_thomas, v_chantier_id, NULL,       'Favre',  'Thomas',      'ca',      '8888', 'thomas.favre@neoclima.internal')
ON CONFLICT (id) DO NOTHING;

-- ── Secteurs ────────────────────────────────────────────────
INSERT INTO secteurs (id, chantier_id, name, description, ordre)
VALUES
  (v_secteur_a, v_chantier_id, 'Bâtiment Principal', 'Niveaux RDC à N2', 1),
  (v_secteur_b, v_chantier_id, 'Annexe Technique', 'Sous-sol et locaux techniques', 2)
ON CONFLICT (id) DO NOTHING;

-- ── Zones Takt ──────────────────────────────────────────────
INSERT INTO zones_takt (id, secteur_id, name, description, superficie, qr_code, ordre)
VALUES
  (v_zone_n2n, v_secteur_a, 'Niveau 2 Nord', 'Bureaux open-space nord, plateaux A et B', 450, 'NC-Z001', 1),
  (v_zone_n2s, v_secteur_a, 'Niveau 2 Sud', 'Bureaux individuels et salle réunion', 380, 'NC-Z002', 2),
  (v_zone_n1,  v_secteur_a, 'Niveau 1 Est', 'Couloir technique et locaux serveurs', 220, 'NC-Z003', 3),
  (v_zone_rdc, v_secteur_a, 'RDC Technique', 'Local CTA, TGBT, machinerie ascenseurs', 160, 'NC-Z004', 4)
ON CONFLICT (id) DO NOTHING;

-- ── Types de tâches (catalogue) ─────────────────────────────
INSERT INTO task_types (id, chantier_id, name, unite, phases, rendement, cout_unitaire)
VALUES
  (v_tt_gaine_r, v_chantier_id, 'Gaine rectangulaire', 'ml',
   '["Traçage","Pose","Fixation","Raccordement"]'::JSONB, 12, 45),
  (v_tt_gaine_c, v_chantier_id, 'Gaine circulaire', 'ml',
   '["Traçage","Pose","Fixation","Raccordement"]'::JSONB, 15, 35),
  (v_tt_terminal, v_chantier_id, 'Terminal CTA', 'pce',
   '["Positionnement","Fixation","Câblage"]'::JSONB, 4, 180)
ON CONFLICT (id) DO NOTHING;

-- ── Cycles Takt ─────────────────────────────────────────────
INSERT INTO cycles_takt (id, zone_takt_id, semaine, statut, ppc)
VALUES
  (v_cycle_1, v_zone_n2n, '2026-03-16', 'en_cours', NULL),
  (v_cycle_2, v_zone_n2s, '2026-03-16', 'planifie', NULL)
ON CONFLICT (zone_takt_id, semaine) DO NOTHING;

-- ── Tâches de production ────────────────────────────────────
INSERT INTO tasks (cycle_id, zone_takt_id, task_type_id, equipe_id, label, qte_prevue, qte_realisee, unite, date_planifiee, heures_prevues, status, engage)
VALUES
  -- Zone N2 Nord — Cycle S11
  (v_cycle_1, v_zone_n2n, v_tt_gaine_r, v_equipe_a,
   'Gaine rect 400×200 — Nappe haute N2 Nord', 124, 74, 'ml', '2026-03-16', 10, 'en_cours', true),
  (v_cycle_1, v_zone_n2n, v_tt_gaine_r, v_equipe_a,
   'Gaine rect 200×100 — Nappe basse N2 Nord', 86, 0, 'ml', '2026-03-17', 7, 'todo', true),
  (v_cycle_1, v_zone_n2n, v_tt_terminal, v_equipe_a,
   'Terminaux bureau 2.14 à 2.18', 12, 0, 'pce', '2026-03-18', 3, 'todo', false),
  -- Zone N2 Sud — Cycle S11
  (v_cycle_2, v_zone_n2s, v_tt_gaine_r, v_equipe_b,
   'Gaine rect 315×160 — Distribution principale', 96, 0, 'ml', '2026-03-16', 8, 'todo', true),
  (v_cycle_2, v_zone_n2s, v_tt_gaine_c, v_equipe_b,
   'Gaine circulaire Ø200 — Piquages bureaux', 42, 0, 'ml', '2026-03-17', 3, 'todo', false)
ON CONFLICT DO NOTHING;

-- ── Tâche bloquée pour la démo ──────────────────────────────
UPDATE tasks SET
  status = 'blocked',
  type_blocage = 'gros_oeuvre',
  comment = 'Dalle N2 non coffrée — accès impossible côté Nord'
WHERE label = 'Gaine rect 315×160 — Distribution principale';

-- ── Contrainte associée ─────────────────────────────────────
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT
  t.id,
  'gros_oeuvre',
  'Dalle niveau 2 sud non coulée — coffrage en attente',
  'Chef GO — M. Schneider',
  '2026-03-20',
  'ouverte',
  true
FROM tasks t
WHERE t.label = 'Gaine rect 315×160 — Distribution principale'
ON CONFLICT DO NOTHING;

-- ── NC de démo ──────────────────────────────────────────────
INSERT INTO non_conformites (zone_takt_id, titre, description, gravite, statut)
VALUES
  (v_zone_n2n, 'Gaine mal fixée — suspension insuffisante',
   'Espacement entre supports supérieur à 1,5m sur 12ml de gaine rect 400×200',
   'majeure', 'ouverte')
ON CONFLICT DO NOTHING;

-- ── Effectifs de démo ───────────────────────────────────────
INSERT INTO effectifs (chantier_id, equipe_id, date, monteurs_prevus, monteurs_presents)
VALUES
  (v_chantier_id, v_equipe_a, CURRENT_DATE, 4, 4),
  (v_chantier_id, v_equipe_b, CURRENT_DATE, 4, 3),
  (v_chantier_id, v_equipe_c, CURRENT_DATE, 3, 3)
ON CONFLICT (chantier_id, equipe_id, date) DO NOTHING;

-- ── Weekly plan ─────────────────────────────────────────────
INSERT INTO weekly_plans (chantier_id, semaine, statut, cree_par)
VALUES (v_chantier_id, '2026-03-16', 'engage', 'Thomas Favre — CA')
ON CONFLICT (chantier_id, semaine) DO NOTHING;

END $$;
