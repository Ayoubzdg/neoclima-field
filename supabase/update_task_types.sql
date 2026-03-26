-- ============================================================
-- Mise à jour des types de tâches CVC
-- À exécuter dans Supabase SQL Editor
-- Remplace TOUTES les task_types du chantier par la liste officielle
-- ============================================================

DO $$
DECLARE
  v_chantier_id UUID;
BEGIN

  -- ⚠️  Remplace par l'ID de ton chantier si plusieurs projets existent
  --     SELECT id, name FROM chantiers;  ← pour retrouver l'ID
  SELECT id INTO v_chantier_id FROM chantiers WHERE statut = 'actif' LIMIT 1;

  IF v_chantier_id IS NULL THEN
    RAISE EXCEPTION 'Aucun chantier actif trouvé. Vérifie la table chantiers.';
  END IF;

  -- Supprimer les anciens types (sans tâches associées)
  DELETE FROM task_types
  WHERE chantier_id = v_chantier_id
    AND id NOT IN (SELECT DISTINCT task_type_id FROM tasks WHERE task_type_id IS NOT NULL);

  RAISE NOTICE 'Anciens task_types supprimés pour chantier %', v_chantier_id;

  -- Insérer les 49 types de tâches officiels
  INSERT INTO task_types (chantier_id, name, unite, rendement, cout_unitaire) VALUES

  -- ── Appareils ────────────────────────────────────────────────────
  (v_chantier_id, 'Ventilo-convecteur',                                      'pce',  6,    0),

  -- ── Conduites ────────────────────────────────────────────────────
  (v_chantier_id, 'Gaine galvanisée',                                        'ml',   400,  0),
  (v_chantier_id, 'Canaux circulaires galva perforé',                        'pce',  45,   0),
  (v_chantier_id, 'Canaux circulaires SAFE galva',                           'pce',  45,   0),
  (v_chantier_id, 'Accessoires canaux circulaires SAFE galva',               'pce',  45,   0),
  (v_chantier_id, 'Conduites inox V2A',                                      'ml',   250,  0),
  (v_chantier_id, 'Canaux circulaires SAFE inox V2A',                        'pce',  90,   0),
  (v_chantier_id, 'Accessoires canaux circulaires SAFE inox V2A',            'pce',  45,   0),
  (v_chantier_id, 'Gaine de désenfumage',                                    'pce',  45,   0),

  -- ── Accessoires ──────────────────────────────────────────────────
  (v_chantier_id, 'Diffusion d''air par gaines textiles',                    'pce',  6,    0),
  (v_chantier_id, 'Amortisseur de bruit quadratique',                        'pce',  45,   0),
  (v_chantier_id, 'Amortisseur de bruit circulaire',                         'pce',  45,   0),
  (v_chantier_id, 'Amortisseur de bruit quad. (pulsion VCF)',                'pce',  45,   0),
  (v_chantier_id, 'Silencieux circulaire galva',                             'pce',  45,   0),
  (v_chantier_id, 'Clapet de réglage manuel rectangulaire',                  'pce',  45,   0),
  (v_chantier_id, 'Clapet de réglage manuel circulaire',                     'pce',  45,   0),
  (v_chantier_id, 'Registre à iris',                                         'pce',  45,   0),
  (v_chantier_id, 'Régulateur de débits constants circulaire',               'pce',  45,   0),
  (v_chantier_id, 'Diffuseur linéaire à fentes — pulsion',                   'pce',  20,   0),
  (v_chantier_id, 'Grilles de diffusion d''air',                             'pce',  45,   0),
  (v_chantier_id, 'Caisson pour grilles de pulsion d''air',                  'pce',  45,   0),
  (v_chantier_id, 'Diffuseur plafond hélicoïdal zone admin',                 'pce',  20,   0),
  (v_chantier_id, 'Module de soufflage laminaire',                           'pce',  45,   0),
  (v_chantier_id, 'Grilles de reprise d''air',                               'pce',  45,   0),
  (v_chantier_id, 'Caisson grilles de reprise d''air avec piquage',          'pce',  45,   0),
  (v_chantier_id, 'Diffuseur linéaire à fentes — reprise',                   'pce',  20,   0),
  (v_chantier_id, 'Raccord flexible',                                        'pce',  45,   0),
  (v_chantier_id, 'Soupape',                                                 'pce',  45,   0),
  (v_chantier_id, 'Fond grillagé',                                           'pce',  45,   0),
  (v_chantier_id, 'Portillon de révision rect. GALVA',                       'pce',  45,   0),
  (v_chantier_id, 'Grille compensation désenfumage plateau production',      'pce',  45,   0),
  (v_chantier_id, 'Portillon de révision rect. GALVA > +70°C',               'pce',  45,   0),
  (v_chantier_id, 'Portillon de révision rect. GALVA étanche',               'pce',  45,   0),
  (v_chantier_id, 'Portillon de révision rect. GALVA isolé',                 'pce',  45,   0),
  (v_chantier_id, 'Portillon de révision GALVA circulaire',                  'pce',  45,   0),
  (v_chantier_id, 'Portillon de révision rect. V4A',                         'pce',  45,   0),
  (v_chantier_id, 'Plaquette indicatrice autocollante',                      'pce',  200,  0),
  (v_chantier_id, 'Bouchon',                                                 'pce',  1000, 0),

  -- ── Organes de régulation ────────────────────────────────────────
  (v_chantier_id, 'VAV rectangulaire galva',                                 'pce',  45,   0),
  (v_chantier_id, 'VAV circulaire galva',                                    'pce',  45,   0),
  (v_chantier_id, 'CCF rectangulaire GALVA',                                 'pce',  8,    0),
  (v_chantier_id, 'Kit de montage CCF pour parois légères',                  'pce',  8,    0),
  (v_chantier_id, 'CCF circulaire GALVA',                                    'pce',  8,    0),
  (v_chantier_id, 'Clapets de désenfumage',                                  'pce',  8,    0),
  (v_chantier_id, 'Clapets de fermeture V4A 600°C',                         'pce',  8,    0),
  (v_chantier_id, 'Régulateur de débit constant mécanique circulaire',       'pce',  45,   0),
  (v_chantier_id, 'VAV rectangulaire V2A',                                   'pce',  45,   0),
  (v_chantier_id, 'Clapets de fermeture galva',                              'pce',  45,   0),
  (v_chantier_id, 'Pose des périphériques',                                  'pce',  45,   0);

  RAISE NOTICE '49 types de tâches insérés pour chantier %', v_chantier_id;

END $$;
