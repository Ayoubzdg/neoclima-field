-- ============================================================
-- Mise à jour des types de tâches CVC
-- Rendement en pce/h/monteur = pcs_par_jour / (2 monteurs × 8h)
-- À exécuter dans Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  v_chantier_id UUID;
BEGIN

  -- ⚠️  Sélectionne automatiquement le chantier actif
  --     Si plusieurs projets : WHERE id = 'TON-UUID-ICI'
  SELECT id INTO v_chantier_id FROM chantiers WHERE statut = 'actif' LIMIT 1;

  IF v_chantier_id IS NULL THEN
    RAISE EXCEPTION 'Aucun chantier actif trouvé.';
  END IF;

  -- Supprimer les anciens types non utilisés dans des tâches
  DELETE FROM task_types
  WHERE chantier_id = v_chantier_id
    AND id NOT IN (SELECT DISTINCT task_type_id FROM tasks WHERE task_type_id IS NOT NULL);

  RAISE NOTICE 'Anciens task_types supprimés pour chantier %', v_chantier_id;

  -- Insérer les 49 types avec rendement réel (pce/h/monteur)
  -- Formule : rendement = pcs_par_jour / 16  (2 monteurs × 8h)
  INSERT INTO task_types (chantier_id, name, unite, rendement, cout_unitaire) VALUES

  -- ── Appareils ────────────────────────────────────────────────────────
  (v_chantier_id, 'Ventilo-convecteur',                                      'pce',  0.375,   0),  --    6 pcs/j

  -- ── Conduites ────────────────────────────────────────────────────────
  (v_chantier_id, 'Gaine galvanisée',                                        'ml',   25,      0),  --  400 ml/j
  (v_chantier_id, 'Canaux circulaires galva perforé',                        'pce',  2.8125,  0),  --   45 pcs/j
  (v_chantier_id, 'Canaux circulaires SAFE galva',                           'pce',  2.8125,  0),
  (v_chantier_id, 'Accessoires canaux circulaires SAFE galva',               'pce',  2.8125,  0),
  (v_chantier_id, 'Conduites inox V2A',                                      'ml',   15.625,  0),  --  250 ml/j
  (v_chantier_id, 'Canaux circulaires SAFE inox V2A',                        'pce',  5.625,   0),  --   90 pcs/j
  (v_chantier_id, 'Accessoires canaux circulaires SAFE inox V2A',            'pce',  2.8125,  0),
  (v_chantier_id, 'Gaine de désenfumage',                                    'pce',  2.8125,  0),

  -- ── Accessoires ──────────────────────────────────────────────────────
  (v_chantier_id, 'Diffusion d''air par gaines textiles',                    'pce',  0.375,   0),  --    6 pcs/j
  (v_chantier_id, 'Amortisseur de bruit quadratique',                        'pce',  2.8125,  0),
  (v_chantier_id, 'Amortisseur de bruit circulaire',                         'pce',  2.8125,  0),
  (v_chantier_id, 'Amortisseur de bruit quad. (pulsion VCF)',                'pce',  2.8125,  0),
  (v_chantier_id, 'Silencieux circulaire galva',                             'pce',  2.8125,  0),
  (v_chantier_id, 'Clapet de réglage manuel rectangulaire',                  'pce',  2.8125,  0),
  (v_chantier_id, 'Clapet de réglage manuel circulaire',                     'pce',  2.8125,  0),
  (v_chantier_id, 'Registre à iris',                                         'pce',  2.8125,  0),
  (v_chantier_id, 'Régulateur de débits constants circulaire',               'pce',  2.8125,  0),
  (v_chantier_id, 'Diffuseur linéaire à fentes — pulsion',                   'pce',  1.25,    0),  --   20 pcs/j
  (v_chantier_id, 'Grilles de diffusion d''air',                             'pce',  2.8125,  0),
  (v_chantier_id, 'Caisson pour grilles de pulsion d''air',                  'pce',  2.8125,  0),
  (v_chantier_id, 'Diffuseur plafond hélicoïdal zone admin',                 'pce',  1.25,    0),
  (v_chantier_id, 'Module de soufflage laminaire',                           'pce',  2.8125,  0),
  (v_chantier_id, 'Grilles de reprise d''air',                               'pce',  2.8125,  0),
  (v_chantier_id, 'Caisson grilles de reprise d''air avec piquage',          'pce',  2.8125,  0),
  (v_chantier_id, 'Diffuseur linéaire à fentes — reprise',                   'pce',  1.25,    0),
  (v_chantier_id, 'Raccord flexible',                                        'pce',  2.8125,  0),
  (v_chantier_id, 'Soupape',                                                 'pce',  2.8125,  0),
  (v_chantier_id, 'Fond grillagé',                                           'pce',  2.8125,  0),
  (v_chantier_id, 'Portillon de révision rect. GALVA',                       'pce',  2.8125,  0),
  (v_chantier_id, 'Grille compensation désenfumage plateau production',      'pce',  2.8125,  0),
  (v_chantier_id, 'Portillon de révision rect. GALVA > +70°C',               'pce',  2.8125,  0),
  (v_chantier_id, 'Portillon de révision rect. GALVA étanche',               'pce',  2.8125,  0),
  (v_chantier_id, 'Portillon de révision rect. GALVA isolé',                 'pce',  2.8125,  0),
  (v_chantier_id, 'Portillon de révision GALVA circulaire',                  'pce',  2.8125,  0),
  (v_chantier_id, 'Portillon de révision rect. V4A',                         'pce',  2.8125,  0),
  (v_chantier_id, 'Plaquette indicatrice autocollante',                      'pce',  12.5,    0),  --  200 pcs/j
  (v_chantier_id, 'Bouchon',                                                 'pce',  62.5,    0),  -- 1000 pcs/j

  -- ── Organes de régulation ────────────────────────────────────────────
  (v_chantier_id, 'VAV rectangulaire galva',                                 'pce',  2.8125,  0),
  (v_chantier_id, 'VAV circulaire galva',                                    'pce',  2.8125,  0),
  (v_chantier_id, 'CCF rectangulaire GALVA',                                 'pce',  0.5,     0),  --    8 pcs/j
  (v_chantier_id, 'Kit de montage CCF pour parois légères',                  'pce',  0.5,     0),
  (v_chantier_id, 'CCF circulaire GALVA',                                    'pce',  0.5,     0),
  (v_chantier_id, 'Clapets de désenfumage',                                  'pce',  0.5,     0),
  (v_chantier_id, 'Clapets de fermeture V4A 600°C',                         'pce',  0.5,     0),
  (v_chantier_id, 'Régulateur de débit constant mécanique circulaire',       'pce',  2.8125,  0),
  (v_chantier_id, 'VAV rectangulaire V2A',                                   'pce',  2.8125,  0),
  (v_chantier_id, 'Clapets de fermeture galva',                              'pce',  2.8125,  0),
  (v_chantier_id, 'Pose des périphériques',                                  'pce',  2.8125,  0);

  RAISE NOTICE '49 types de tâches insérés (rendement en pce/h/monteur) pour chantier %', v_chantier_id;

END $$;
