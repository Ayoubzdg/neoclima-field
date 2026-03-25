-- ═══════════════════════════════════════════════════════════════════
-- NOUVEAU PROJET — Neoclima Field
-- Crée la structure minimale pour un chantier opérationnel.
-- Adapte les valeurs entre /* */ avant d'exécuter.
--
-- Ce script peut être exécuté PLUSIEURS FOIS pour créer plusieurs
-- projets indépendants — chacun apparaît dans le sélecteur de login.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ── À PERSONNALISER ───────────────────────────────────────────────
  v_nom_chantier    TEXT := 'Nom du chantier';                 -- Ex: 'Installation CVC — Bâtiment Rolex'
  v_adresse         TEXT := 'Adresse, Ville';                  -- Ex: 'Rue des Acacias 12, 1227 Carouge'
  v_client          TEXT := 'Maître d''ouvrage';               -- Ex: 'Fondation Rolex / Direction des travaux'
  v_date_debut      DATE := CURRENT_DATE;                      -- Date de démarrage
  v_date_fin        DATE := CURRENT_DATE + interval '6 months';-- Date de fin prévisionnelle
  v_budget_heures   INT  := 2000;                              -- Budget heures total
  v_takt_duree      INT  := 5;                                 -- Durée d'un takt (jours ouvrés)

  -- PINs — 4 chiffres
  v_pin_monteur1    TEXT := '1001';   -- Monteur principal
  v_pin_chef        TEXT := '2001';   -- Chef de chantier
  v_pin_ca          TEXT := '9001';   -- Chargé d'affaires (CA) — accès complet
  v_pin_admin       TEXT := '8001';   -- Admin

  -- ── IDs générés automatiquement ───────────────────────────────────
  v_ch    UUID := gen_random_uuid();
  v_eq_a  UUID := gen_random_uuid();   -- Équipe principale Neoclima
  v_eq_b  UUID := gen_random_uuid();   -- Équipe sous-traitant (optionnelle)

BEGIN

  -- ─── CHANTIER ───────────────────────────────────────────────────
  INSERT INTO chantiers (id, name, adresse, client, date_debut, date_fin_prev,
                         budget_heures, takt_duree, statut)
  VALUES (v_ch, v_nom_chantier, v_adresse, v_client,
          v_date_debut, v_date_fin, v_budget_heures, v_takt_duree, 'actif');

  -- ─── ÉQUIPES ────────────────────────────────────────────────────
  INSERT INTO equipes (id, chantier_id, name, couleur, code_pin, actif)
  VALUES
    (v_eq_a, v_ch, 'Neoclima — Équipe A', '#2563EB', '1100', true),
    (v_eq_b, v_ch, 'Sous-traitant montage', '#D97706', '1200', true);

  -- ─── UTILISATEURS ───────────────────────────────────────────────
  -- Monteur (accès tâches uniquement)
  INSERT INTO utilisateurs (id, chantier_id, equipe_id, nom, prenom, role, code_pin, actif)
  VALUES
    (gen_random_uuid(), v_ch, v_eq_a, 'Monteur', 'Prénom', 'monteur', v_pin_monteur1, true),
    (gen_random_uuid(), v_ch, v_eq_a, 'Chef Chantier', 'Prénom', 'chef', v_pin_chef, true),
    (gen_random_uuid(), v_ch, NULL,   'Chargé Affaires', 'Prénom', 'ca', v_pin_ca, true),
    (gen_random_uuid(), v_ch, NULL,   'Admin', 'Prénom', 'admin', v_pin_admin, true);

  -- ─── TYPES DE TÂCHES (préréglés pour ventilation / CVC) ─────────
  INSERT INTO task_types (id, chantier_id, name, unite, rendement, cout_unitaire)
  VALUES
    (gen_random_uuid(), v_ch, 'Gaine rectangulaire',        'ml',  12.0, 45.0),
    (gen_random_uuid(), v_ch, 'Gaine circulaire',           'ml',  18.0, 35.0),
    (gen_random_uuid(), v_ch, 'Gaine spiralée',             'ml',  20.0, 30.0),
    (gen_random_uuid(), v_ch, 'Isolation gaine rect.',      'ml',  10.0, 25.0),
    (gen_random_uuid(), v_ch, 'Isolation gaine circ.',      'ml',  14.0, 20.0),
    (gen_random_uuid(), v_ch, 'Isolation tuyauterie',       'ml',  15.0, 22.0),
    (gen_random_uuid(), v_ch, 'Ventilo-convecteur',         'pce',  4.0, 120.0),
    (gen_random_uuid(), v_ch, 'Extracteur',                 'pce',  6.0, 95.0),
    (gen_random_uuid(), v_ch, 'Raccordement hydraulique',   'pce',  3.0, 80.0),
    (gen_random_uuid(), v_ch, 'Régulation / GTB',           'pce',  2.5, 150.0),
    (gen_random_uuid(), v_ch, 'CTA installation',           'pce',  0.5, 800.0),
    (gen_random_uuid(), v_ch, 'VRV / Split',                'pce',  2.0, 200.0);

  RAISE NOTICE '✓ Projet créé : %', v_nom_chantier;
  RAISE NOTICE '  Chantier ID : %', v_ch;
  RAISE NOTICE '  PINs — Monteur: % | Chef: % | CA: % | Admin: %',
    v_pin_monteur1, v_pin_chef, v_pin_ca, v_pin_admin;
  RAISE NOTICE '  Prochaine étape : créer les secteurs et zones dans Paramètres > Zones';

END $$;
