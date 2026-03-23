-- ═══════════════════════════════════════════════════════════
-- SEED COMPLET — Neoclima SA — Entreprise de ventilation suisse
-- Chantier : Installation CVC — Complexe résidentiel La Passerelle, Genève
-- 15 équipes (internes + ST montage + ST isolation)
-- 60+ tâches · 12 contraintes · 8 NC · 4 bâtiments
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ── Chantier ──────────────────────────────────────────────
  v_ch UUID := 'a1000000-0000-0000-0000-000000000001';

  -- ── Secteurs (bâtiments) ──────────────────────────────────
  v_s_a UUID := 'b1000000-0000-0000-0000-000000000001'; -- Bâtiment A
  v_s_b UUID := 'b1000000-0000-0000-0000-000000000002'; -- Bâtiment B
  v_s_c UUID := 'b1000000-0000-0000-0000-000000000003'; -- Bâtiment C
  v_s_d UUID := 'b1000000-0000-0000-0000-000000000004'; -- Bâtiment D
  v_s_m UUID := 'b1000000-0000-0000-0000-000000000005'; -- Machinerie centrale

  -- ── Zones Takt ────────────────────────────────────────────
  -- Bât A (R+1 à R+4)
  v_a_r4 UUID := 'c1000000-0000-0000-0000-000000000001';
  v_a_r3 UUID := 'c1000000-0000-0000-0000-000000000002';
  v_a_r2 UUID := 'c1000000-0000-0000-0000-000000000003';
  v_a_r1 UUID := 'c1000000-0000-0000-0000-000000000004';
  -- Bât B (R+1 à R+3)
  v_b_r3 UUID := 'c1000000-0000-0000-0000-000000000005';
  v_b_r2 UUID := 'c1000000-0000-0000-0000-000000000006';
  v_b_r1 UUID := 'c1000000-0000-0000-0000-000000000007';
  -- Bât C (R+1 à R+3)
  v_c_r3 UUID := 'c1000000-0000-0000-0000-000000000008';
  v_c_r2 UUID := 'c1000000-0000-0000-0000-000000000009';
  v_c_r1 UUID := 'c1000000-0000-0000-0000-000000000010';
  -- Bât D (R+1 à R+2)
  v_d_r2 UUID := 'c1000000-0000-0000-0000-000000000011';
  v_d_r1 UUID := 'c1000000-0000-0000-0000-000000000012';
  -- Machinerie
  v_m_ct UUID := 'c1000000-0000-0000-0000-000000000013';

  -- ── Équipes Neoclima (internes) ───────────────────────────
  v_eq_a UUID := 'd1000000-0000-0000-0000-000000000001'; -- Gaines rectangulaires
  v_eq_b UUID := 'd1000000-0000-0000-0000-000000000002'; -- Gaines circulaires & spiralées
  v_eq_c UUID := 'd1000000-0000-0000-0000-000000000003'; -- Régulation & GTB
  v_eq_d UUID := 'd1000000-0000-0000-0000-000000000004'; -- Raccordements hydrauliques
  v_eq_e UUID := 'd1000000-0000-0000-0000-000000000005'; -- Terminaux & VC

  -- ── Sous-traitants Montage (6 équipes) ────────────────────
  v_st_m1 UUID := 'd1000000-0000-0000-0000-000000000006'; -- Ventilairsec SA
  v_st_m2 UUID := 'd1000000-0000-0000-0000-000000000007'; -- Techno Air Sàrl
  v_st_m3 UUID := 'd1000000-0000-0000-0000-000000000008'; -- AirTech GmbH
  v_st_m4 UUID := 'd1000000-0000-0000-0000-000000000009'; -- ProVent SA
  v_st_m5 UUID := 'd1000000-0000-0000-0000-000000000010'; -- SwissVent AG
  v_st_m6 UUID := 'd1000000-0000-0000-0000-000000000011'; -- AlphaAir SA

  -- ── Sous-traitants Isolation (4 équipes) ──────────────────
  v_st_i1 UUID := 'd1000000-0000-0000-0000-000000000012'; -- Isotherm SA
  v_st_i2 UUID := 'd1000000-0000-0000-0000-000000000013'; -- ThermoFlex Sàrl
  v_st_i3 UUID := 'd1000000-0000-0000-0000-000000000014'; -- AlpIso GmbH
  v_st_i4 UUID := 'd1000000-0000-0000-0000-000000000015'; -- SwissIso SA

  -- ── Types de tâches ───────────────────────────────────────
  v_tt_gr  UUID := 'f1000000-0000-0000-0000-000000000001'; -- Gaine rectangulaire
  v_tt_gc  UUID := 'f1000000-0000-0000-0000-000000000002'; -- Gaine circulaire
  v_tt_gs  UUID := 'f1000000-0000-0000-0000-000000000003'; -- Gaine spiralée
  v_tt_igr UUID := 'f1000000-0000-0000-0000-000000000004'; -- Isolation gaine rect.
  v_tt_igc UUID := 'f1000000-0000-0000-0000-000000000005'; -- Isolation gaine circ.
  v_tt_itp UUID := 'f1000000-0000-0000-0000-000000000006'; -- Isolation tuyauterie
  v_tt_vc  UUID := 'f1000000-0000-0000-0000-000000000007'; -- Ventilo-convecteur
  v_tt_ext UUID := 'f1000000-0000-0000-0000-000000000008'; -- Extracteur
  v_tt_ra  UUID := 'f1000000-0000-0000-0000-000000000009'; -- Raccordement hydraulique
  v_tt_reg UUID := 'f1000000-0000-0000-0000-000000000010'; -- Régulation / GTB
  v_tt_cta UUID := 'f1000000-0000-0000-0000-000000000011'; -- CTA installation
  v_tt_vrv UUID := 'f1000000-0000-0000-0000-000000000012'; -- VRV / Split

  -- ── Cycles ────────────────────────────────────────────────
  v_cy_a4  UUID := 'e1000000-0000-0000-0000-000000000001';
  v_cy_a3  UUID := 'e1000000-0000-0000-0000-000000000002';
  v_cy_a2  UUID := 'e1000000-0000-0000-0000-000000000003';
  v_cy_a1  UUID := 'e1000000-0000-0000-0000-000000000004';
  v_cy_b3  UUID := 'e1000000-0000-0000-0000-000000000005';
  v_cy_b2  UUID := 'e1000000-0000-0000-0000-000000000006';
  v_cy_b1  UUID := 'e1000000-0000-0000-0000-000000000007';
  v_cy_c3  UUID := 'e1000000-0000-0000-0000-000000000008';
  v_cy_c2  UUID := 'e1000000-0000-0000-0000-000000000009';
  v_cy_c1  UUID := 'e1000000-0000-0000-0000-000000000010';
  v_cy_d2  UUID := 'e1000000-0000-0000-0000-000000000011';
  v_cy_d1  UUID := 'e1000000-0000-0000-0000-000000000012';
  v_cy_m   UUID := 'e1000000-0000-0000-0000-000000000013';

  -- ── Utilisateurs ──────────────────────────────────────────
  -- Monteurs Neoclima
  v_u_karim  UUID := '11111111-0000-0000-0000-000000000001';
  v_u_leo    UUID := '11111111-0000-0000-0000-000000000002';
  v_u_marco  UUID := '11111111-0000-0000-0000-000000000003';
  v_u_sami   UUID := '11111111-0000-0000-0000-000000000004';
  v_u_remy   UUID := '11111111-0000-0000-0000-000000000005';
  -- Chefs de chantier
  v_u_claire UUID := '11111111-0000-0000-0000-000000000006';
  v_u_luc    UUID := '11111111-0000-0000-0000-000000000007';
  -- CA / Direction travaux
  v_u_ayoub  UUID := '11111111-0000-0000-0000-000000000008';
  v_u_marc   UUID := '11111111-0000-0000-0000-000000000009';
  -- Admin
  v_u_nadia  UUID := '11111111-0000-0000-0000-000000000010';
  v_u_pierre UUID := '11111111-0000-0000-0000-000000000011';

  -- Semaines
  v_sem      DATE := date_trunc('week', CURRENT_DATE)::DATE;
  v_sem_prev DATE := (date_trunc('week', CURRENT_DATE) - interval '7 days')::DATE;
  v_sem_n1   DATE := (date_trunc('week', CURRENT_DATE) + interval '7 days')::DATE;
  v_sem_n2   DATE := (date_trunc('week', CURRENT_DATE) + interval '14 days')::DATE;

BEGIN

-- ─── NETTOYAGE ────────────────────────────────────────────────
DELETE FROM contraintes   WHERE task_id IN (SELECT id FROM tasks WHERE zone_takt_id IN (
  v_a_r4,v_a_r3,v_a_r2,v_a_r1,v_b_r3,v_b_r2,v_b_r1,v_c_r3,v_c_r2,v_c_r1,v_d_r2,v_d_r1,v_m_ct));
DELETE FROM non_conformites WHERE zone_takt_id IN (
  v_a_r4,v_a_r3,v_a_r2,v_a_r1,v_b_r3,v_b_r2,v_b_r1,v_c_r3,v_c_r2,v_c_r1,v_d_r2,v_d_r1,v_m_ct);
DELETE FROM tasks         WHERE zone_takt_id IN (
  v_a_r4,v_a_r3,v_a_r2,v_a_r1,v_b_r3,v_b_r2,v_b_r1,v_c_r3,v_c_r2,v_c_r1,v_d_r2,v_d_r1,v_m_ct);
DELETE FROM cycles_takt   WHERE id IN (
  v_cy_a4,v_cy_a3,v_cy_a2,v_cy_a1,v_cy_b3,v_cy_b2,v_cy_b1,v_cy_c3,v_cy_c2,v_cy_c1,v_cy_d2,v_cy_d1,v_cy_m);
DELETE FROM effectifs     WHERE chantier_id = v_ch;
DELETE FROM weekly_plans  WHERE chantier_id = v_ch;
DELETE FROM zones_takt    WHERE id IN (
  v_a_r4,v_a_r3,v_a_r2,v_a_r1,v_b_r3,v_b_r2,v_b_r1,v_c_r3,v_c_r2,v_c_r1,v_d_r2,v_d_r1,v_m_ct);
DELETE FROM task_types    WHERE chantier_id = v_ch;
DELETE FROM secteurs      WHERE chantier_id = v_ch;
DELETE FROM utilisateurs  WHERE chantier_id = v_ch;
DELETE FROM equipes       WHERE chantier_id = v_ch;
DELETE FROM chantiers     WHERE id = v_ch;

-- ─── CHANTIER ─────────────────────────────────────────────────
INSERT INTO chantiers (id, name, adresse, client, date_debut, date_fin_prev, budget_heures, takt_duree, statut)
VALUES (v_ch,
  'Installation CVC — Complexe résidentiel La Passerelle',
  'Route de Meyrin 76, 1217 Meyrin — Genève',
  'Régie Immobilière Genevoise (RIG) / Direction des travaux',
  '2025-09-01', '2026-07-31', 6400, 5, 'actif');

-- ─── 15 ÉQUIPES ───────────────────────────────────────────────
INSERT INTO equipes (id, chantier_id, name, couleur, code_pin, actif)
VALUES
  -- Neoclima — équipes internes (5)
  (v_eq_a,  v_ch, 'Neoclima — Gaines rectangulaires', '#2563EB', '1100', true),
  (v_eq_b,  v_ch, 'Neoclima — Gaines circ. & spiralées', '#1D4ED8', '1200', true),
  (v_eq_c,  v_ch, 'Neoclima — Régulation & GTB', '#7C3AED', '1300', true),
  (v_eq_d,  v_ch, 'Neoclima — Raccordements hydrauliques', '#0891B2', '1400', true),
  (v_eq_e,  v_ch, 'Neoclima — Terminaux & VC', '#0284C7', '1500', true),
  -- Sous-traitants Montage (6)
  (v_st_m1, v_ch, 'ST Montage — Ventilairsec SA', '#16A34A', '2100', true),
  (v_st_m2, v_ch, 'ST Montage — Techno Air Sàrl', '#15803D', '2200', true),
  (v_st_m3, v_ch, 'ST Montage — AirTech GmbH', '#166534', '2300', true),
  (v_st_m4, v_ch, 'ST Montage — ProVent SA', '#14532D', '2400', true),
  (v_st_m5, v_ch, 'ST Montage — SwissVent AG', '#4ADE80', '2500', true),
  (v_st_m6, v_ch, 'ST Montage — AlphaAir SA', '#86EFAC', '2600', true),
  -- Sous-traitants Isolation (4)
  (v_st_i1, v_ch, 'ST Isolation — Isotherm SA', '#DC2626', '3100', true),
  (v_st_i2, v_ch, 'ST Isolation — ThermoFlex Sàrl', '#B91C1C', '3200', true),
  (v_st_i3, v_ch, 'ST Isolation — AlpIso GmbH', '#991B1B', '3300', true),
  (v_st_i4, v_ch, 'ST Isolation — SwissIso SA', '#F87171', '3400', true);

-- ─── AUTH USERS ───────────────────────────────────────────────
INSERT INTO auth.users (id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud)
VALUES
  (v_u_karim,  '00000000-0000-0000-0000-000000000000', 'karim.benzara@neoclima.ch',    crypt('1001', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_leo,    '00000000-0000-0000-0000-000000000000', 'leo.magnin@neoclima.ch',        crypt('1002', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_marco,  '00000000-0000-0000-0000-000000000000', 'marco.ferretti@neoclima.ch',    crypt('1003', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_sami,   '00000000-0000-0000-0000-000000000000', 'sami.ouali@neoclima.ch',        crypt('1004', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_remy,   '00000000-0000-0000-0000-000000000000', 'remy.charpentier@neoclima.ch',  crypt('1005', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_claire, '00000000-0000-0000-0000-000000000000', 'claire.dubois@neoclima.ch',     crypt('2001', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_luc,    '00000000-0000-0000-0000-000000000000', 'luc.fontannaz@neoclima.ch',     crypt('2002', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_ayoub,  '00000000-0000-0000-0000-000000000000', 'ayoub.azedag@neoclima.ch',      crypt('9001', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_marc,   '00000000-0000-0000-0000-000000000000', 'marc.schneider@neoclima.ch',    crypt('9002', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_nadia,  '00000000-0000-0000-0000-000000000000', 'nadia.rochat@neoclima.ch',      crypt('8001', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated'),
  (v_u_pierre, '00000000-0000-0000-0000-000000000000', 'pierre.maillard@neoclima.ch',   crypt('8002', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- ─── UTILISATEURS ─────────────────────────────────────────────
INSERT INTO utilisateurs (id, chantier_id, equipe_id, nom, prenom, role, code_pin, email)
VALUES
  (v_u_karim,  v_ch, v_eq_a,  'Benzara',     'Karim',   'monteur', '1001', 'karim.benzara@neoclima.ch'),
  (v_u_leo,    v_ch, v_eq_b,  'Magnin',      'Léo',     'monteur', '1002', 'leo.magnin@neoclima.ch'),
  (v_u_marco,  v_ch, v_eq_d,  'Ferretti',    'Marco',   'monteur', '1003', 'marco.ferretti@neoclima.ch'),
  (v_u_sami,   v_ch, v_eq_e,  'Ouali',       'Sami',    'monteur', '1004', 'sami.ouali@neoclima.ch'),
  (v_u_remy,   v_ch, v_eq_c,  'Charpentier', 'Rémy',    'monteur', '1005', 'remy.charpentier@neoclima.ch'),
  (v_u_claire, v_ch, NULL,    'Dubois',      'Claire',  'chef',    '2001', 'claire.dubois@neoclima.ch'),
  (v_u_luc,    v_ch, NULL,    'Fontannaz',   'Luc',     'chef',    '2002', 'luc.fontannaz@neoclima.ch'),
  (v_u_ayoub,  v_ch, NULL,    'Azedag',      'Ayoub',   'ca',      '9001', 'ayoub.azedag@neoclima.ch'),
  (v_u_marc,   v_ch, NULL,    'Schneider',   'Marc',    'ca',      '9002', 'marc.schneider@neoclima.ch'),
  (v_u_nadia,  v_ch, NULL,    'Rochat',      'Nadia',   'admin',   '8001', 'nadia.rochat@neoclima.ch'),
  (v_u_pierre, v_ch, NULL,    'Maillard',    'Pierre',  'admin',   '8002', 'pierre.maillard@neoclima.ch');

-- ─── SECTEURS ─────────────────────────────────────────────────
INSERT INTO secteurs (id, chantier_id, name, description, ordre)
VALUES
  (v_s_a, v_ch, 'Bâtiment A', '18 logements — R+1 à R+4 — façade ouest', 1),
  (v_s_b, v_ch, 'Bâtiment B', '16 logements — R+1 à R+3 — façade est',   2),
  (v_s_c, v_ch, 'Bâtiment C', '16 logements — R+1 à R+3 — façade nord',  3),
  (v_s_d, v_ch, 'Bâtiment D', '12 logements — R+1 à R+2 — façade sud',   4),
  (v_s_m, v_ch, 'Machinerie', 'Local CTA + nourrice + armoire GTB',       5);

-- ─── ZONES TAKT ───────────────────────────────────────────────
INSERT INTO zones_takt (id, secteur_id, name, description, superficie, qr_code, ordre)
VALUES
  (v_a_r4, v_s_a, 'Bât A — R+4', '5 apparts 4.5p, terrasses',    540, 'NC-A-R4', 1),
  (v_a_r3, v_s_a, 'Bât A — R+3', '5 apparts 3.5p / 4.5p',        540, 'NC-A-R3', 2),
  (v_a_r2, v_s_a, 'Bât A — R+2', '5 apparts 3.5p / 4.5p',        540, 'NC-A-R2', 3),
  (v_a_r1, v_s_a, 'Bât A — R+1', '3 apparts + locaux communs',    480, 'NC-A-R1', 4),
  (v_b_r3, v_s_b, 'Bât B — R+3', '6 apparts 3.5p',                460, 'NC-B-R3', 5),
  (v_b_r2, v_s_b, 'Bât B — R+2', '6 apparts 3.5p',                460, 'NC-B-R2', 6),
  (v_b_r1, v_s_b, 'Bât B — R+1', '4 apparts + corridor',          420, 'NC-B-R1', 7),
  (v_c_r3, v_s_c, 'Bât C — R+3', '6 apparts 2.5p / 3.5p',         440, 'NC-C-R3', 8),
  (v_c_r2, v_s_c, 'Bât C — R+2', '6 apparts 2.5p / 3.5p',         440, 'NC-C-R2', 9),
  (v_c_r1, v_s_c, 'Bât C — R+1', '4 apparts + locaux poussettes', 400, 'NC-C-R1', 10),
  (v_d_r2, v_s_d, 'Bât D — R+2', '6 apparts 4.5p',                380, 'NC-D-R2', 11),
  (v_d_r1, v_s_d, 'Bât D — R+1', '6 apparts + cave',              380, 'NC-D-R1', 12),
  (v_m_ct, v_s_m, 'Machinerie CTA', 'Local technique 55m²',         55, 'NC-M-CT', 13);

-- ─── TYPES DE TÂCHES ──────────────────────────────────────────
INSERT INTO task_types (id, chantier_id, name, unite, phases, rendement, cout_unitaire)
VALUES
  (v_tt_gr,  v_ch, 'Gaine rectangulaire',       'ml',  '["Traçage","Pose","Fixation","Raccordement"]'::JSONB,            12, 48),
  (v_tt_gc,  v_ch, 'Gaine circulaire',           'ml',  '["Traçage","Pose","Fixation","Raccordement"]'::JSONB,            15, 34),
  (v_tt_gs,  v_ch, 'Gaine spiralée',             'ml',  '["Traçage","Pose","Fixation","Raccordement"]'::JSONB,            18, 28),
  (v_tt_igr, v_ch, 'Isolation gaine rect.',      'ml',  '["Préparation surface","Pose isolation","Finition"]'::JSONB,    20, 32),
  (v_tt_igc, v_ch, 'Isolation gaine circ.',      'ml',  '["Préparation surface","Pose isolation","Finition"]'::JSONB,    22, 26),
  (v_tt_itp, v_ch, 'Isolation tuyauterie',       'ml',  '["Dégraissage","Pose coquille","Finition"]'::JSONB,             25, 22),
  (v_tt_vc,  v_ch, 'Ventilo-convecteur',         'pce', '["Positionnement","Fixation","Câblage","Test"]'::JSONB,          3, 245),
  (v_tt_ext, v_ch, 'Extracteur',                 'pce', '["Positionnement","Fixation","Raccordement","Test"]'::JSONB,     5, 185),
  (v_tt_ra,  v_ch, 'Raccordement hydraulique',   'pce', '["Préparation","Raccordement","Test étanchéité"]'::JSONB,        6,  98),
  (v_tt_reg, v_ch, 'Régulation / GTB',           'pce', '["Câblage","Paramétrage","Mise en service","PV"]'::JSONB,        4, 195),
  (v_tt_cta, v_ch, 'CTA — Installation',         'u',   '["Levage","Fixation","Raccordement hydraulique","Mise en service"]'::JSONB, 1, 4200),
  (v_tt_vrv, v_ch, 'VRV / Split',                'pce', '["Pose unité int.","Pose unité ext.","Liaisons frigorifiques","Test"]'::JSONB, 2, 680);

-- ─── CYCLES TAKT ──────────────────────────────────────────────
INSERT INTO cycles_takt (id, zone_takt_id, semaine, statut, ppc)
VALUES
  -- Bât A : R+1/R+2 terminés, R+3 en cours (87%), R+4 démarré
  (v_cy_a4, v_a_r4, v_sem,      'en_cours', NULL),
  (v_cy_a3, v_a_r3, v_sem,      'en_cours',   87),
  (v_cy_a2, v_a_r2, v_sem_prev, 'complete',   95),
  (v_cy_a1, v_a_r1, v_sem_prev, 'complete',  100),
  -- Bât B : R+1 terminé, R+2 en cours, R+3 planifié
  (v_cy_b3, v_b_r3, v_sem_n1,   'planifie', NULL),
  (v_cy_b2, v_b_r2, v_sem,      'en_cours', NULL),
  (v_cy_b1, v_b_r1, v_sem_prev, 'complete',   91),
  -- Bât C : R+1 en cours, R+2/R+3 planifiés
  (v_cy_c3, v_c_r3, v_sem_n2,   'planifie', NULL),
  (v_cy_c2, v_c_r2, v_sem_n1,   'planifie', NULL),
  (v_cy_c1, v_c_r1, v_sem,      'en_cours', NULL),
  -- Bât D : tout planifié
  (v_cy_d2, v_d_r2, v_sem_n2,   'planifie', NULL),
  (v_cy_d1, v_d_r1, v_sem_n1,   'planifie', NULL),
  -- Machinerie : en cours
  (v_cy_m,  v_m_ct, v_sem,      'en_cours', NULL)
ON CONFLICT (zone_takt_id, semaine)
  DO UPDATE SET statut = EXCLUDED.statut, ppc = EXCLUDED.ppc;

-- ═══════════════════════════════════════════════════════════
-- TÂCHES — 65 tâches réparties sur 13 zones
-- Montage (Neoclima + ST montage) + Isolation (ST isolation)
-- ═══════════════════════════════════════════════════════════

INSERT INTO tasks (cycle_id, zone_takt_id, task_type_id, equipe_id, label,
  qte_prevue, qte_realisee, unite, date_planifiee,
  heures_prevues, heures_realisees, status, engage, comment, type_blocage)
VALUES

-- ══════════════════════════════════════════════════════════
-- BÂT A R+4 — En cours, accès partiel (façadier)
-- ══════════════════════════════════════════════════════════
(v_cy_a4, v_a_r4, v_tt_gr, v_eq_a,
 'Gaines rect 500×250 — nappe haute R+4', 92, 48, 'ml', CURRENT_DATE, 9, 4, 'en_cours', true, NULL, NULL),

(v_cy_a4, v_a_r4, v_tt_gr, v_st_m1,
 'Gaines rect 315×160 — distribution R+4', 64, 0, 'ml', CURRENT_DATE+1, 6, 0, 'blocked', true,
 'Échafaudages façade ouest occupés par le façadier — coordination planifiée le 27/03', 'acces'),

(v_cy_a4, v_a_r4, v_tt_gc, v_eq_b,
 'Gaines circ Ø250 — piquages apparts A401-A405', 58, 18, 'ml', CURRENT_DATE, 4, 1, 'en_cours', true, NULL, NULL),

(v_cy_a4, v_a_r4, v_tt_vc, v_eq_e,
 'Ventilo-convecteurs apparts A401-A405 (5×3 VC)', 15, 0, 'pce', CURRENT_DATE+3, 15, 0, 'todo', true, NULL, NULL),

(v_cy_a4, v_a_r4, v_tt_ra, v_eq_d,
 'Raccordement réseau primaire R+4 — 8 piquages', 8, 0, 'pce', CURRENT_DATE+4, 8, 0, 'todo', false, NULL, NULL),

(v_cy_a4, v_a_r4, v_tt_igr, v_st_i1,
 'Isolation gaines rect R+4 — nappe haute', 92, 0, 'ml', CURRENT_DATE+5, 5, 0, 'todo', false, NULL, NULL),

(v_cy_a4, v_a_r4, v_tt_igc, v_st_i1,
 'Isolation gaines circ R+4 — piquages', 58, 0, 'ml', CURRENT_DATE+6, 3, 0, 'todo', false, NULL, NULL),

(v_cy_a4, v_a_r4, v_tt_reg, v_eq_c,
 'Régulation VC R+4 — câblage + paramétrage', 15, 0, 'pce', CURRENT_DATE+7, 12, 0, 'todo', false, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT A R+3 — Avancé 87%, finitions isolation
-- ══════════════════════════════════════════════════════════
(v_cy_a3, v_a_r3, v_tt_gr, v_eq_a,
 'Gaines rect 400×200 — R+3 complètes', 88, 88, 'ml', CURRENT_DATE-5, 8, 8, 'done', true, NULL, NULL),

(v_cy_a3, v_a_r3, v_tt_gc, v_eq_b,
 'Gaines circ Ø200 — distribution R+3', 46, 46, 'ml', CURRENT_DATE-4, 3, 3, 'done', true, NULL, NULL),

(v_cy_a3, v_a_r3, v_tt_vc, v_eq_e,
 'Ventilo-convecteurs A301-A305 posés', 15, 15, 'pce', CURRENT_DATE-3, 15, 15, 'done', true, NULL, NULL),

(v_cy_a3, v_a_r3, v_tt_ra, v_eq_d,
 'Raccordements hydrauliques R+3 validés', 8, 8, 'pce', CURRENT_DATE-2, 8, 8, 'done', true, NULL, NULL),

(v_cy_a3, v_a_r3, v_tt_igr, v_st_i2,
 'Isolation gaines rect R+3 — en cours', 88, 52, 'ml', CURRENT_DATE, 5, 3, 'en_cours', true, NULL, NULL),

(v_cy_a3, v_a_r3, v_tt_igc, v_st_i2,
 'Isolation gaines circ R+3', 46, 0, 'ml', CURRENT_DATE+1, 3, 0, 'todo', true, NULL, NULL),

(v_cy_a3, v_a_r3, v_tt_itp, v_st_i2,
 'Isolation tuyauterie réseau primaire R+3', 32, 0, 'ml', CURRENT_DATE+2, 2, 0, 'blocked', true,
 'Tuyauterie primaire non purgée — test pression en attente validation chef', 'autre_corps'),

(v_cy_a3, v_a_r3, v_tt_reg, v_eq_c,
 'Régulation R+3 — mise en service', 15, 0, 'pce', CURRENT_DATE+3, 12, 0, 'todo', true, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT A R+2 — Terminé semaine précédente
-- ══════════════════════════════════════════════════════════
(v_cy_a2, v_a_r2, v_tt_gr, v_eq_a,
 'Gaines rect R+2 — pose terminée', 84, 84, 'ml', CURRENT_DATE-10, 8, 8, 'done', true, NULL, NULL),

(v_cy_a2, v_a_r2, v_tt_gc, v_st_m2,
 'Gaines circ R+2 — pose terminée', 44, 44, 'ml', CURRENT_DATE-9, 3, 3, 'done', true, NULL, NULL),

(v_cy_a2, v_a_r2, v_tt_vc, v_eq_e,
 'Ventilo-convecteurs R+2 posés et testés', 15, 15, 'pce', CURRENT_DATE-8, 15, 15, 'done', true, NULL, NULL),

(v_cy_a2, v_a_r2, v_tt_igr, v_st_i3,
 'Isolation complète R+2 — validée', 84, 84, 'ml', CURRENT_DATE-6, 5, 5, 'done', true, NULL, NULL),

(v_cy_a2, v_a_r2, v_tt_itp, v_st_i3,
 'Isolation tuyauterie R+2 — validée', 28, 28, 'ml', CURRENT_DATE-5, 2, 2, 'done', true, NULL, NULL),

(v_cy_a2, v_a_r2, v_tt_reg, v_eq_c,
 'Régulation R+2 — PV de mise en service signé', 15, 15, 'pce', CURRENT_DATE-4, 12, 12, 'done', true, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT A R+1 — Terminé et réceptionné
-- ══════════════════════════════════════════════════════════
(v_cy_a1, v_a_r1, v_tt_gr, v_eq_a,
 'Gaines rect R+1 — réceptionné', 72, 72, 'ml', CURRENT_DATE-16, 7, 7, 'done', true, NULL, NULL),

(v_cy_a1, v_a_r1, v_tt_vc, v_eq_e,
 'Ventilo-convecteurs R+1 — réceptionnés', 9, 9, 'pce', CURRENT_DATE-12, 9, 9, 'done', true, NULL, NULL),

(v_cy_a1, v_a_r1, v_tt_igr, v_st_i4,
 'Isolation R+1 — PV signé', 72, 72, 'ml', CURRENT_DATE-10, 4, 4, 'done', true, NULL, NULL),

(v_cy_a1, v_a_r1, v_tt_reg, v_eq_c,
 'Régulation R+1 — mis en service et validé', 9, 9, 'pce', CURRENT_DATE-9, 7, 7, 'done', true, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT B R+2 — En cours, manchettes manquantes
-- ══════════════════════════════════════════════════════════
(v_cy_b2, v_b_r2, v_tt_gr, v_st_m3,
 'Gaines rect 400×200 — B R+2 distribution', 68, 32, 'ml', CURRENT_DATE, 6, 3, 'en_cours', true, NULL, NULL),

(v_cy_b2, v_b_r2, v_tt_gc, v_st_m3,
 'Gaines circ Ø160 — piquages B R+2', 36, 0, 'ml', CURRENT_DATE+1, 3, 0, 'blocked', true,
 'Manchettes flexibles Ø160 — 48 pièces manquantes sur BL 2024-445. Livraison confirmée vendredi.', 'materiau'),

(v_cy_b2, v_b_r2, v_tt_vc, v_st_m4,
 'Ventilo-convecteurs B R+2 — apparts B201-B206', 18, 0, 'pce', CURRENT_DATE+3, 18, 0, 'todo', true, NULL, NULL),

(v_cy_b2, v_b_r2, v_tt_igr, v_st_i1,
 'Isolation gaines B R+2', 68, 0, 'ml', CURRENT_DATE+5, 4, 0, 'todo', false, NULL, NULL),

(v_cy_b2, v_b_r2, v_tt_itp, v_st_i1,
 'Isolation tuyauterie B R+2', 24, 0, 'ml', CURRENT_DATE+6, 2, 0, 'todo', false, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT B R+1 — Terminé semaine précédente
-- ══════════════════════════════════════════════════════════
(v_cy_b1, v_b_r1, v_tt_gr, v_st_m3,
 'Gaines rect B R+1 — terminées', 58, 58, 'ml', CURRENT_DATE-8, 5, 5, 'done', true, NULL, NULL),

(v_cy_b1, v_b_r1, v_tt_vc, v_st_m4,
 'VC B R+1 posés', 12, 12, 'pce', CURRENT_DATE-6, 12, 12, 'done', true, NULL, NULL),

(v_cy_b1, v_b_r1, v_tt_igr, v_st_i2,
 'Isolation B R+1 — validée', 58, 58, 'ml', CURRENT_DATE-4, 3, 3, 'done', true, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT B R+3 — Planifié S+1
-- ══════════════════════════════════════════════════════════
(v_cy_b3, v_b_r3, v_tt_gr, v_st_m5,
 'Gaines rect B R+3 — planifié', 64, 0, 'ml', CURRENT_DATE+7, 6, 0, 'todo', false, NULL, NULL),

(v_cy_b3, v_b_r3, v_tt_igr, v_st_i3,
 'Isolation B R+3 — planifié', 64, 0, 'ml', CURRENT_DATE+12, 4, 0, 'todo', false, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT C R+1 — En cours, plan manquant
-- ══════════════════════════════════════════════════════════
(v_cy_c1, v_c_r1, v_tt_gr, v_st_m2,
 'Gaines rect C R+1 — démarrage', 52, 12, 'ml', CURRENT_DATE, 5, 1, 'en_cours', true, NULL, NULL),

(v_cy_c1, v_c_r1, v_tt_gc, v_st_m2,
 'Gaines circ C R+1', 28, 0, 'ml', CURRENT_DATE+2, 2, 0, 'blocked', true,
 'Plan de réservation C R+1 non transmis par architecte — version corrigée attendue sous 24h', 'autre_corps'),

(v_cy_c1, v_c_r1, v_tt_vc, v_st_m5,
 'Ventilo-convecteurs C R+1', 12, 0, 'pce', CURRENT_DATE+4, 12, 0, 'todo', true, NULL, NULL),

(v_cy_c1, v_c_r1, v_tt_igr, v_st_i4,
 'Isolation C R+1', 52, 0, 'ml', CURRENT_DATE+6, 3, 0, 'todo', false, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT C R+2 / R+3 — Planifiés
-- ══════════════════════════════════════════════════════════
(v_cy_c2, v_c_r2, v_tt_gr, v_st_m5,
 'Gaines rect C R+2 — planifié', 58, 0, 'ml', CURRENT_DATE+8, 5, 0, 'todo', false, NULL, NULL),

(v_cy_c3, v_c_r3, v_tt_gr, v_st_m6,
 'Gaines rect C R+3 — planifié', 58, 0, 'ml', CURRENT_DATE+15, 5, 0, 'todo', false, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- BÂT D — Planifié S+1 / S+2
-- ══════════════════════════════════════════════════════════
(v_cy_d1, v_d_r1, v_tt_gr, v_st_m6,
 'Gaines rect D R+1 — planifié S+1', 48, 0, 'ml', CURRENT_DATE+8, 4, 0, 'todo', false, NULL, NULL),

(v_cy_d1, v_d_r1, v_tt_vc, v_eq_e,
 'Ventilo-convecteurs D R+1', 18, 0, 'pce', CURRENT_DATE+11, 18, 0, 'todo', false, NULL, NULL),

(v_cy_d2, v_d_r2, v_tt_gr, v_st_m6,
 'Gaines rect D R+2 — planifié S+2', 48, 0, 'ml', CURRENT_DATE+15, 4, 0, 'todo', false, NULL, NULL),

(v_cy_d2, v_d_r2, v_tt_igr, v_st_i4,
 'Isolation D R+2', 48, 0, 'ml', CURRENT_DATE+19, 3, 0, 'todo', false, NULL, NULL),

-- ══════════════════════════════════════════════════════════
-- MACHINERIE — CTA, nourrice, GTB
-- ══════════════════════════════════════════════════════════
(v_cy_m, v_m_ct, v_tt_cta, v_eq_d,
 'CTA Carrier 30RB-060 — levage et installation', 1, 0, 'u', CURRENT_DATE+1, 16, 0, 'blocked', true,
 'CTA non livrée — transporteur confirme livraison mercredi 26/03. Grue réservée.', 'equipement'),

(v_cy_m, v_m_ct, v_tt_ra, v_eq_d,
 'Raccordements hydrauliques nourrice centrale', 12, 6, 'pce', CURRENT_DATE, 12, 6, 'en_cours', true, NULL, NULL),

(v_cy_m, v_m_ct, v_tt_ra, v_eq_d,
 'Raccordements aérauliques — gaines primaires', 6, 0, 'pce', CURRENT_DATE+3, 8, 0, 'todo', true, NULL, NULL),

(v_cy_m, v_m_ct, v_tt_itp, v_st_i1,
 'Isolation tuyauterie machinerie — réseau primaire', 68, 0, 'ml', CURRENT_DATE+4, 4, 0, 'todo', true, NULL, NULL),

(v_cy_m, v_m_ct, v_tt_vrv, v_st_m1,
 'VRV local machinerie — 2 splits gestion thermique', 2, 0, 'pce', CURRENT_DATE+2, 6, 0, 'todo', true, NULL, NULL),

(v_cy_m, v_m_ct, v_tt_reg, v_eq_c,
 'Armoire GTB — câblage complet', 1, 0, 'u', CURRENT_DATE+5, 16, 0, 'blocked', true,
 'Schémas électriques GTB version 3 non validés par ingénieur électricien — attente visa', 'autre_corps'),

(v_cy_m, v_m_ct, v_tt_reg, v_eq_c,
 'Mise en service CTA + tests débit + PV réception', 1, 0, 'u', CURRENT_DATE+8, 12, 0, 'todo', false, NULL, NULL);

-- ═══════════════════════════════════════════════════════════
-- CONTRAINTES — 12 contraintes variées
-- ═══════════════════════════════════════════════════════════

-- 1. Bloquante — façadier Bât A R+4
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'acces',
  'Échafaudages façade ouest occupés par Façadier & Cie SA (marché lot 08). Coordination réunion planifiée le 27/03. Libération prévue lundi 31/03.',
  'Façadier & Cie SA — M. Bernardo / CT Luc Fontannaz',
  CURRENT_DATE + 4, 'en_cours', true
FROM tasks t WHERE t.label LIKE 'Gaines rect 315×160%R+4%' LIMIT 1;

-- 2. Bloquante — manchettes Ø160 Bât B
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'materiau',
  'Manchettes flexibles Ø160mm ref. MF-160-FLEX — 48 pièces. BL 2024-445 en attente. Fournisseur Duraflex confirme livraison vendredi 28/03 avant 12h.',
  'Duraflex SA — M. Vaucher / Appro Nadia Rochat',
  CURRENT_DATE + 2, 'ouverte', true
FROM tasks t WHERE t.label LIKE 'Gaines circ Ø160%B R+2%' LIMIT 1;

-- 3. Bloquante — CTA non livrée
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'equipement',
  'CTA Carrier 30RB-060 — livraison initialement S-3, repoussée 2x. Transporteur Transports Réunies SA. Grue ATG réservée mercredi 26/03 08h00.',
  'Carrier Distribution Suisse / Ayoub Azedag (CA)',
  CURRENT_DATE + 2, 'en_cours', true
FROM tasks t WHERE t.label LIKE 'CTA Carrier%' LIMIT 1;

-- 4. Bloquante — schémas GTB non validés
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'autre_corps',
  'Schémas électriques armoire GTB v3 — visa ingénieur électricien bureau ISE SA requis avant câblage. Envoyés le 18/03. Réponse attendue avant le 28/03.',
  'Bureau ISE SA — Ing. M. Pfister / CT Claire Dubois',
  CURRENT_DATE + 2, 'ouverte', true
FROM tasks t WHERE t.label LIKE 'Armoire GTB%câblage%' LIMIT 1;

-- 5. Bloquante — plan réservation Bât C
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'autre_corps',
  'Plan de réservation Bât C R+1 version corrigée non transmis. Architecte Zaha & Partners — version 2 en cours de validation interne. Transmission sous 24h confirmée.',
  'Zaha & Partners Architectes / Ayoub Azedag',
  CURRENT_DATE + 1, 'en_cours', false
FROM tasks t WHERE t.label LIKE 'Gaines circ C R+1%' LIMIT 1;

-- 6. Bloquante — tuyauterie non purgée
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'gros_oeuvre',
  'Réseau primaire Bât A R+3 non purgé — test pression 6 bars requis avant isolation tuyauterie. Plombier-chauffagiste Lot 05 (Sanitaire Gilliard SA) doit intervenir en premier.',
  'Sanitaire Gilliard SA — Chef de chantier M. Roux',
  CURRENT_DATE + 1, 'ouverte', true
FROM tasks t WHERE t.label LIKE 'Isolation tuyauterie réseau primaire R+3%' LIMIT 1;

-- 7. En cours — accès locaux techniques D R+1
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'acces',
  'Clés locaux techniques Bât D R+1 non remises. Demande transmise au gérant de l''immeuble le 20/03. Remise prévue mercredi.',
  'Régie Immobilière Genevoise — M. Dupont',
  CURRENT_DATE + 1, 'en_cours', false
FROM tasks t WHERE t.label LIKE 'Ventilo-convecteurs D R+1%' LIMIT 1;

-- 8. Levée — plancher technique R+2 Bât A
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, date_levee_reel, statut, bloquant)
SELECT t.id, 'gros_oeuvre',
  'Plancher technique Bât A R+2 non coffrée côté nord — attendu le 10/03. Réalisé le 11/03. Levée confirmée par CT.',
  'GO — Marti SA', CURRENT_DATE - 13, CURRENT_DATE - 11, 'levee', false
FROM tasks t WHERE t.label LIKE 'Gaines rect R+2%pose terminée%' LIMIT 1;

-- 9. Levée — livraison VC B R+1
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, date_levee_reel, statut, bloquant)
SELECT t.id, 'materiau',
  'Ventilo-convecteurs Bât B R+1 — livrés et réceptionnés le ' || to_char(CURRENT_DATE - 7, 'DD/MM/YYYY') || '. Conformes à la commande.',
  'Systemair SA', CURRENT_DATE - 9, CURRENT_DATE - 7, 'levee', false
FROM tasks t WHERE t.label LIKE 'VC B R+1 posés%' LIMIT 1;

-- 10. Ouverte — coordination extracteurs Bât C R+2
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'autre_corps',
  'Coordination ventilation WC Bât C R+2 avec lot plomberie (Sanitaire Gilliard SA) — positionnement extracteurs à confirmer sur plan commun.',
  'Sanitaire Gilliard SA / CT Claire Dubois',
  CURRENT_DATE + 6, 'ouverte', false
FROM tasks t WHERE t.label LIKE 'Gaines rect C R+2%' LIMIT 1;

-- 11. Ouverte — validation isolation Bât A R+3
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'autre_corps',
  'Contrôleur SNBS doit viser les travaux d''isolation avant fermeture des plafonds Bât A R+3. Visite planifiée le 01/04.',
  'Bureau de contrôle SNBS — Ing. Favre',
  CURRENT_DATE + 3, 'ouverte', false
FROM tasks t WHERE t.label LIKE 'Isolation gaines circ R+3%' LIMIT 1;

-- 12. En cours — commande gaines B R+3
INSERT INTO contraintes (task_id, type, description, responsable, date_besoin, statut, bloquant)
SELECT t.id, 'materiau',
  'Gaines rectangulaires Bât B R+3 à commander — devis en attente confirmation direction pour CHF 4''200.—. Délai livraison fournisseur : 5 jours ouvrables.',
  'Nadia Rochat (Admin) / Marc Schneider (CA)',
  CURRENT_DATE + 5, 'en_cours', false
FROM tasks t WHERE t.label LIKE 'Gaines rect B R+3%' LIMIT 1;

-- ═══════════════════════════════════════════════════════════
-- NON-CONFORMITÉS — 8 NC
-- ═══════════════════════════════════════════════════════════

INSERT INTO non_conformites (zone_takt_id, titre, description, gravite, statut, date_echeance)
VALUES
  -- NC bloquante
  (v_a_r4,
   'Gaine 500×250 — pente inverse sur 9ml',
   'Tronçon nappe haute Bât A R+4 nord posé avec pente +2% au lieu de -1% (SIA 382). Risque condensats. Reprise obligatoire avant isolation.',
   'bloquante', 'ouverte', CURRENT_DATE + 2),

  -- NC majeures
  (v_a_r3,
   'Espacement supports insuffisant — R+3',
   'Suspensions espacement > 1,8m sur 16ml de gaine rect 400×200. SIA 382.1 exige max 1,5m. 5 supports manquants à ajouter.',
   'majeure', 'en_cours', CURRENT_DATE + 4),

  (v_b_r2,
   'Soudure manchon Ø125 non conforme',
   'Soudure zone T4 Bât B R+2 — aspect insuffisant. Ressuage visuel négatif. Contrôle étanchéité 6 bars requis avant isolation.',
   'majeure', 'ouverte', CURRENT_DATE + 3),

  (v_m_ct,
   'Départ/retour CTA inversés sur collecteur',
   'Raccordement nourrice machinerie : départ et retour inversés sur collecteur nord. Corrigé sur plan v4 mais physiquement non repris.',
   'majeure', 'en_cours', CURRENT_DATE + 1),

  (v_c_r1,
   'Hauteur gaine insuffisante — couloir C R+1',
   'Gaine rect 315×160 couloir Bât C R+1 posée à 2,25m (faux-plafond prévu à 2,20m). Conflit avec dalle. Reprise nécessaire ou adaptation plan faux-plafond.',
   'majeure', 'ouverte', CURRENT_DATE + 5),

  -- NC mineures
  (v_a_r2,
   'Étiquetage incomplet Bât A R+2',
   '8 gaines sur 22 non étiquetées selon nomenclature projet NE-GEN-01. Complément à effectuer avant PV de réception.',
   'mineure', 'levee', CURRENT_DATE - 3),

  (v_a_r1,
   'Vis de fixation manquantes — 3 VC R+1',
   'VC apparts A104, A107, A109 : 1 vis de fixation inférieure manquante. Corrigé le ' || to_char(CURRENT_DATE - 6, 'DD/MM/YYYY') || '.',
   'mineure', 'validee', CURRENT_DATE - 8),

  (v_b_r1,
   'Protection provisoire gaines endommagée',
   'Bâches de protection gaines Bât B R+1 déchirées par autre corps d''état. Remplacement effectué. Aucune dégradation gaine constatée.',
   'mineure', 'validee', CURRENT_DATE - 4);

-- ═══════════════════════════════════════════════════════════
-- EFFECTIFS — 15 équipes sur 5 jours (pic de chantier)
-- ═══════════════════════════════════════════════════════════

INSERT INTO effectifs (chantier_id, equipe_id, date, monteurs_prevus, monteurs_presents, note)
VALUES
  -- Neoclima Gaines rect (Éq. A — 6 monteurs)
  (v_ch, v_eq_a, CURRENT_DATE-4, 6,6, NULL),
  (v_ch, v_eq_a, CURRENT_DATE-3, 6,5, 'Karim absent — formation sécurité hauteur'),
  (v_ch, v_eq_a, CURRENT_DATE-2, 6,6, NULL),
  (v_ch, v_eq_a, CURRENT_DATE-1, 6,6, NULL),
  (v_ch, v_eq_a, CURRENT_DATE,   6,4, 'Équipe partagée machinerie/R+4'),
  -- Neoclima Gaines circ (Éq. B — 4 monteurs)
  (v_ch, v_eq_b, CURRENT_DATE-4, 4,4, NULL),
  (v_ch, v_eq_b, CURRENT_DATE-3, 4,4, NULL),
  (v_ch, v_eq_b, CURRENT_DATE-2, 4,3, 'Léo en appui Éq. A'),
  (v_ch, v_eq_b, CURRENT_DATE-1, 4,4, NULL),
  (v_ch, v_eq_b, CURRENT_DATE,   4,4, NULL),
  -- Neoclima Régulation (Éq. C — 3 personnes)
  (v_ch, v_eq_c, CURRENT_DATE-4, 3,3, NULL),
  (v_ch, v_eq_c, CURRENT_DATE-3, 3,2, 'Rémy en formation GTB fabricant'),
  (v_ch, v_eq_c, CURRENT_DATE-2, 3,3, NULL),
  (v_ch, v_eq_c, CURRENT_DATE-1, 3,3, NULL),
  (v_ch, v_eq_c, CURRENT_DATE,   3,3, NULL),
  -- Neoclima Raccordements (Éq. D — 4 personnes)
  (v_ch, v_eq_d, CURRENT_DATE-4, 4,4, NULL),
  (v_ch, v_eq_d, CURRENT_DATE-3, 4,4, NULL),
  (v_ch, v_eq_d, CURRENT_DATE-2, 4,4, NULL),
  (v_ch, v_eq_d, CURRENT_DATE-1, 4,3, 'Marco absent — arrêt maladie'),
  (v_ch, v_eq_d, CURRENT_DATE,   4,4, NULL),
  -- Neoclima Terminaux (Éq. E — 4 personnes)
  (v_ch, v_eq_e, CURRENT_DATE-4, 4,4, NULL),
  (v_ch, v_eq_e, CURRENT_DATE-3, 4,4, NULL),
  (v_ch, v_eq_e, CURRENT_DATE-2, 4,4, NULL),
  (v_ch, v_eq_e, CURRENT_DATE-1, 4,4, NULL),
  (v_ch, v_eq_e, CURRENT_DATE,   4,4, NULL),
  -- ST Montage 1 — Ventilairsec SA (5 monteurs)
  (v_ch, v_st_m1, CURRENT_DATE-4, 5,5, NULL),
  (v_ch, v_st_m1, CURRENT_DATE-3, 5,4, '1 monteur ST réaffecté autre chantier Ventilairsec'),
  (v_ch, v_st_m1, CURRENT_DATE-2, 5,5, NULL),
  (v_ch, v_st_m1, CURRENT_DATE-1, 5,5, NULL),
  (v_ch, v_st_m1, CURRENT_DATE,   5,5, NULL),
  -- ST Montage 2 — Techno Air (4 monteurs)
  (v_ch, v_st_m2, CURRENT_DATE-4, 4,4, NULL),
  (v_ch, v_st_m2, CURRENT_DATE-3, 4,4, NULL),
  (v_ch, v_st_m2, CURRENT_DATE-2, 4,4, NULL),
  (v_ch, v_st_m2, CURRENT_DATE-1, 4,4, NULL),
  (v_ch, v_st_m2, CURRENT_DATE,   4,3, '1 monteur absent non remplacé'),
  -- ST Montage 3 — AirTech GmbH (5 monteurs)
  (v_ch, v_st_m3, CURRENT_DATE-4, 5,5, NULL),
  (v_ch, v_st_m3, CURRENT_DATE-3, 5,5, NULL),
  (v_ch, v_st_m3, CURRENT_DATE-2, 5,5, NULL),
  (v_ch, v_st_m3, CURRENT_DATE-1, 5,4, 'Chef d''équipe en réunion de chantier AM'),
  (v_ch, v_st_m3, CURRENT_DATE,   5,5, NULL),
  -- ST Montage 4 — ProVent SA (3 monteurs)
  (v_ch, v_st_m4, CURRENT_DATE-4, 3,3, NULL),
  (v_ch, v_st_m4, CURRENT_DATE-3, 3,3, NULL),
  (v_ch, v_st_m4, CURRENT_DATE-2, 3,2, '1 absent'),
  (v_ch, v_st_m4, CURRENT_DATE-1, 3,3, NULL),
  (v_ch, v_st_m4, CURRENT_DATE,   3,3, NULL),
  -- ST Montage 5 — SwissVent AG (4 monteurs)
  (v_ch, v_st_m5, CURRENT_DATE-2, 4,4, 'Arrivée en cours de semaine (Bât C démarré)'),
  (v_ch, v_st_m5, CURRENT_DATE-1, 4,4, NULL),
  (v_ch, v_st_m5, CURRENT_DATE,   4,4, NULL),
  -- ST Montage 6 — AlphaAir SA (3 monteurs — Bât D planifié S+1)
  (v_ch, v_st_m6, CURRENT_DATE,   3,0, 'Mobilisation prévue S+1 — préparation matériel en cours'),
  -- ST Isolation 1 — Isotherm SA (4 poseurs)
  (v_ch, v_st_i1, CURRENT_DATE-4, 4,4, NULL),
  (v_ch, v_st_i1, CURRENT_DATE-3, 4,4, NULL),
  (v_ch, v_st_i1, CURRENT_DATE-2, 4,4, NULL),
  (v_ch, v_st_i1, CURRENT_DATE-1, 4,3, '1 poseur retard livraison matériaux isolation'),
  (v_ch, v_st_i1, CURRENT_DATE,   4,4, NULL),
  -- ST Isolation 2 — ThermoFlex (3 poseurs)
  (v_ch, v_st_i2, CURRENT_DATE-4, 3,3, NULL),
  (v_ch, v_st_i2, CURRENT_DATE-3, 3,3, NULL),
  (v_ch, v_st_i2, CURRENT_DATE-2, 3,3, NULL),
  (v_ch, v_st_i2, CURRENT_DATE-1, 3,3, NULL),
  (v_ch, v_st_i2, CURRENT_DATE,   3,2, '1 poseur en attente matériau R+3'),
  -- ST Isolation 3 — AlpIso GmbH (3 poseurs)
  (v_ch, v_st_i3, CURRENT_DATE-4, 3,3, NULL),
  (v_ch, v_st_i3, CURRENT_DATE-3, 3,2, NULL),
  (v_ch, v_st_i3, CURRENT_DATE-2, 3,3, NULL),
  (v_ch, v_st_i3, CURRENT_DATE-1, 3,3, NULL),
  (v_ch, v_st_i3, CURRENT_DATE,   3,3, NULL),
  -- ST Isolation 4 — SwissIso SA (2 poseurs — Bât D planifié)
  (v_ch, v_st_i4, CURRENT_DATE,   2,2, 'Mobilisation sur Bât A R+1 finitions')
ON CONFLICT (chantier_id, equipe_id, date)
  DO UPDATE SET monteurs_prevus   = EXCLUDED.monteurs_prevus,
                monteurs_presents = EXCLUDED.monteurs_presents,
                note              = EXCLUDED.note;

-- ═══════════════════════════════════════════════════════════
-- WEEKLY PLANS
-- ═══════════════════════════════════════════════════════════
INSERT INTO weekly_plans (chantier_id, semaine, statut, ppc_global, note, cree_par)
VALUES
  (v_ch, v_sem_prev, 'cloture', 91,
   'S-1 : PPC 91% — Bât A R+1/R+2 réceptionnés · Bât B R+1 terminé · 2 NC levées',
   'Ayoub Azedag — CA'),
  (v_ch, v_sem, 'engage', NULL,
   'Semaine en cours : 15 équipes actives · Focus R+3 finitions + R+4 démarrage + machinerie CTA',
   'Ayoub Azedag — CA')
ON CONFLICT (chantier_id, semaine)
  DO UPDATE SET statut = EXCLUDED.statut, ppc_global = EXCLUDED.ppc_global, note = EXCLUDED.note;

END $$;
