-- ═══════════════════════════════════════════════════════════
-- FIX ROOS v2 — Robuste, exécuter bloc par bloc
-- ═══════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BLOC 1 — DIAGNOSTIC : affiche l'état actuel
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT 'ENTREPRISES' AS table_name, id::text, name, code_acces, actif::text FROM entreprises
UNION ALL
SELECT 'CHANTIERS', id::text, name, statut, entreprise_id::text FROM chantiers;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BLOC 2 — Corriger code_acces → 'ROOS'
-- (peu importe le nom actuel, on prend la 1ère entreprise)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPDATE entreprises
SET code_acces = 'ROOS',
    actif = true
WHERE id = (SELECT id FROM entreprises ORDER BY created_at LIMIT 1);

-- Vérification
SELECT id, name, code_acces, actif FROM entreprises;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BLOC 3 — Lier les chantiers à ROOS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPDATE chantiers
SET entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1)
WHERE id IN (
  '40aaf764-bc64-4f62-a02b-94c0b5fd610b',
  '6f832e43-6d59-446c-aa6d-69a226bce6d6'
);

-- Vérification
SELECT id, name, statut, entreprise_id FROM chantiers;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BLOC 4 — Nettoyer personnes existantes (repart propre)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DELETE FROM acces_chantier
WHERE personne_id IN (
  SELECT id FROM personnes
  WHERE entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1)
);

DELETE FROM personnes
WHERE entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1);

SELECT count(*) AS personnes_restantes FROM personnes;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BLOC 5 — Insérer les personnes (code_pin obligatoire → '0000' si vide)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSERT INTO personnes (entreprise_id, nom, prenom, role, code_pin, actif)
SELECT
  (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1),
  u.nom,
  NULLIF(TRIM(u.prenom), ''),
  u.role,
  COALESCE(NULLIF(TRIM(u.code_pin), ''), '0000'),  -- '0000' si pas de PIN
  true
FROM (
  -- Prend le meilleur enregistrement par (nom, prenom) :
  -- priorité au PIN le plus récent (code_pin le plus grand), pas de doublon
  SELECT DISTINCT ON (LOWER(TRIM(nom)), LOWER(TRIM(COALESCE(prenom, ''))))
    nom, prenom, role, code_pin
  FROM utilisateurs
  WHERE actif = true
  ORDER BY
    LOWER(TRIM(nom)),
    LOWER(TRIM(COALESCE(prenom, ''))),
    code_pin DESC NULLS LAST
) u;

-- Vérification
SELECT nom, prenom, role, code_pin FROM personnes
WHERE entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1)
ORDER BY nom;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BLOC 6 — Créer les acces_chantier depuis utilisateurs
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
SELECT DISTINCT ON (p.id, u.chantier_id)
  p.id,
  u.chantier_id,
  u.equipe_id
FROM utilisateurs u
JOIN personnes p ON
  LOWER(TRIM(p.nom))    = LOWER(TRIM(u.nom)) AND
  LOWER(TRIM(COALESCE(p.prenom, ''))) = LOWER(TRIM(COALESCE(u.prenom, '')))
JOIN chantiers c ON c.id = u.chantier_id
WHERE u.actif = true
  AND c.entreprise_id = (SELECT id FROM entreprises WHERE code_acces = 'ROOS' LIMIT 1)
ORDER BY p.id, u.chantier_id, u.equipe_id NULLS LAST
ON CONFLICT (personne_id, chantier_id)
DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

-- Vérification finale
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


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BLOC 7 — TEST LOGIN : doit retourner Miftari Valerin
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT * FROM login_personne('ROOS', '7455');

-- Si 0 résultats → vérifier que chantiers.statut = 'actif' :
-- SELECT id, name, statut FROM chantiers;
-- Si statut != 'actif', corriger avec :
-- UPDATE chantiers SET statut = 'actif' WHERE id = '6f832e43-6d59-446c-aa6d-69a226bce6d6';
