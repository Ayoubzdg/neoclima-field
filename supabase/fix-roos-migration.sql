-- ═══════════════════════════════════════════════════════════
-- SCRIPT DE CORRECTION ROOS — basé sur les données réelles
-- À exécuter dans Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── ÉTAPE 1 : S'assurer que l'entreprise ROOS a le bon code_acces
UPDATE entreprises
SET code_acces = 'ROOS'
WHERE LOWER(name) ILIKE '%roos%'
  AND code_acces != 'ROOS';

-- Vérification
SELECT id, name, code_acces, actif FROM entreprises;


-- ── ÉTAPE 2 : Lier les 2 chantiers à l'entreprise ROOS
UPDATE chantiers
SET entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1)
WHERE id IN (
  '40aaf764-bc64-4f62-a02b-94c0b5fd610b',  -- Satellite 10
  '6f832e43-6d59-446c-aa6d-69a226bce6d6'   -- Chantier ROOS principal
);

-- Vérification
SELECT id, name, statut, entreprise_id FROM chantiers;


-- ── ÉTAPE 3 : Nettoyer personnes et acces_chantier existants
-- (repart d'une base propre pour éviter les doublons)
DELETE FROM acces_chantier
WHERE personne_id IN (
  SELECT id FROM personnes
  WHERE entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1)
);

DELETE FROM personnes
WHERE entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1);


-- ── ÉTAPE 4 : Créer une personne par individu réel
-- On prend UN seul utilisateur par (nom, prenom) en privilégiant celui avec un PIN défini
-- Valerin Miftari : on garde l'entrée PIN 7455 (equipe Satellite)
-- Les doublons (PIN 7456, "Valein") sont ignorés
INSERT INTO personnes (entreprise_id, nom, prenom, role, code_pin, actif)
VALUES
  -- Chantier ROOS (6f832e43)
  (
    (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1),
    'Miftari', 'Valerin', 'monteur', '7455', true
  ),
  (
    (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1),
    'Luta', 'Edon', 'monteur', NULL, true
  ),
  (
    (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1),
    'Silva', 'Nuno', 'chef', '8813', true
  ),
  (
    (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1),
    'Reix', 'Jeremie', 'ca', '5538', true
  ),
  -- Satellite 10 uniquement (40aaf764)
  (
    (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1),
    'Azedag', 'Ayoub', 'admin', '8001', true
  ),
  (
    (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1),
    'Bigler', 'Luc', 'ca', '4963', true
  ),
  (
    (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1),
    'isufi', 'Faruk', 'monteur', NULL, true
  );

-- Vérification
SELECT id, nom, prenom, role, code_pin FROM personnes
WHERE entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1);


-- ── ÉTAPE 5 : Créer les acces_chantier avec les équipes
-- On relie chaque personne à son/ses chantier(s) avec l'équipe correspondante

-- Valerin Miftari → chantier ROOS (6f832e43) avec équipe 383a8ef5
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'Miftari' AND prenom = 'Valerin' LIMIT 1),
  '6f832e43-6d59-446c-aa6d-69a226bce6d6',
  '383a8ef5-332a-45e7-a984-5722a020899b'
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- Valerin Miftari → Satellite 10 (40aaf764) avec équipe 083203ad
-- (si tu veux qu'il voie aussi ce chantier au login)
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'Miftari' AND prenom = 'Valerin' LIMIT 1),
  '40aaf764-bc64-4f62-a02b-94c0b5fd610b',
  '083203ad-3620-4665-8223-867f84f7db78'
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- Edon Luta → chantier ROOS avec équipe 383a8ef5
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'Luta' AND prenom = 'Edon' LIMIT 1),
  '6f832e43-6d59-446c-aa6d-69a226bce6d6',
  '383a8ef5-332a-45e7-a984-5722a020899b'
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- Edon Luta → Satellite 10 avec équipe 083203ad
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'Luta' AND prenom = 'Edon' LIMIT 1),
  '40aaf764-bc64-4f62-a02b-94c0b5fd610b',
  '083203ad-3620-4665-8223-867f84f7db78'
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- Silva Nuno → chantier ROOS (sans équipe pour chef)
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'Silva' AND prenom = 'Nuno' LIMIT 1),
  '6f832e43-6d59-446c-aa6d-69a226bce6d6',
  NULL
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- Reix Jeremie → chantier ROOS
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'Reix' AND prenom = 'Jeremie' LIMIT 1),
  '6f832e43-6d59-446c-aa6d-69a226bce6d6',
  NULL
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- Azedag Ayoub → Satellite 10 (admin)
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'Azedag' AND prenom = 'Ayoub' LIMIT 1),
  '40aaf764-bc64-4f62-a02b-94c0b5fd610b',
  NULL
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- Bigler Luc → Satellite 10
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'Bigler' AND prenom = 'Luc' LIMIT 1),
  '40aaf764-bc64-4f62-a02b-94c0b5fd610b',
  NULL
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- isufi Faruk → Satellite 10 avec équipe b20fc1ab
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
VALUES (
  (SELECT id FROM personnes WHERE nom = 'isufi' AND prenom = 'Faruk' LIMIT 1),
  '40aaf764-bc64-4f62-a02b-94c0b5fd610b',
  'b20fc1ab-ca87-43fe-8c02-a37bf5bc9199'
)
ON CONFLICT (personne_id, chantier_id) DO UPDATE SET equipe_id = EXCLUDED.equipe_id;


-- ── ÉTAPE 6 : Vérification finale — doit afficher tous les accès ──
SELECT
  p.nom,
  p.prenom,
  p.role,
  p.code_pin,
  c.name  AS chantier,
  eq.name AS equipe
FROM acces_chantier ac
JOIN personnes  p  ON p.id  = ac.personne_id
JOIN chantiers  c  ON c.id  = ac.chantier_id
LEFT JOIN equipes eq ON eq.id = ac.equipe_id
ORDER BY p.nom, c.name;


-- ── TEST DIRECT : simuler le login de Valerin ──────────────
-- Ce SELECT doit retourner 1 ou 2 lignes (une par chantier)
SELECT * FROM login_personne('ROOS', '7455');
