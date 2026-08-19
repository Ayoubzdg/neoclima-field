-- ═══════════════════════════════════════════════════════════
-- SÉCURITÉ ÉTAPE 1/3 — PINs HACHÉS (bcrypt)
-- À exécuter dans Supabase → SQL Editor. NE CASSE RIEN :
-- l'ancien login continue de fonctionner pendant la transition.
--
-- · code_pin_hash (bcrypt) calculé automatiquement par trigger
--   à chaque écriture de code_pin — l'admin panel continue de
--   saisir des PINs en clair, la base les hache toute seule.
-- · Nouveau RPC login_personne_hash : vérifie le HASH,
--   avec limite d'essais et journal (comme login_personne).
-- · La purge des PINs en clair est à la FIN, commentée :
--   à exécuter seulement quand l'étape 2 (Edge Function)
--   est en service et testée.
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Colonne hash + backfill ──────────────────────────────
ALTER TABLE personnes
  ADD COLUMN IF NOT EXISTS code_pin_hash TEXT;

UPDATE personnes
SET code_pin_hash = crypt(code_pin, gen_salt('bf'))
WHERE code_pin IS NOT NULL
  AND TRIM(code_pin) <> ''
  AND code_pin_hash IS NULL;

-- ── 2. Hachage automatique à chaque écriture de PIN ─────────
CREATE OR REPLACE FUNCTION fn_hash_code_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code_pin IS NOT NULL AND TRIM(NEW.code_pin) <> ''
     AND (TG_OP = 'INSERT' OR NEW.code_pin IS DISTINCT FROM OLD.code_pin) THEN
    NEW.code_pin_hash := crypt(NEW.code_pin, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hash_code_pin ON personnes;
CREATE TRIGGER trg_hash_code_pin
BEFORE INSERT OR UPDATE OF code_pin ON personnes
FOR EACH ROW
EXECUTE FUNCTION fn_hash_code_pin();

-- ── 3. RPC de login sur HASH (utilisé par l'Edge Function) ──
CREATE OR REPLACE FUNCTION login_personne_hash(
  p_code_entreprise TEXT,
  p_code_pin        TEXT
)
RETURNS TABLE(
  personne_id            UUID,
  nom                    TEXT,
  prenom                 TEXT,
  role                   TEXT,
  equipe_id              UUID,
  entreprise_id          UUID,
  entreprise_name        TEXT,
  chantier_id            UUID,
  chantier_name          TEXT,
  chantier_client        TEXT,
  chantier_takt_duree    INTEGER,
  chantier_budget_heures NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code  TEXT := UPPER(TRIM(p_code_entreprise));
  v_fails INTEGER;
  v_pid   UUID;
BEGIN
  -- Limite d'essais : 10 échecs / 15 min par code entreprise
  SELECT COUNT(*) INTO v_fails
  FROM login_attempts la
  WHERE la.code_entreprise = v_code
    AND la.success = false
    AND la.created_at > NOW() - INTERVAL '15 minutes';

  IF v_fails >= 10 THEN
    INSERT INTO login_attempts (code_entreprise, success) VALUES (v_code, false);
    RETURN;
  END IF;

  -- Vérification sur le HASH bcrypt
  SELECT p.id INTO v_pid
  FROM personnes p
  JOIN entreprises e ON e.id = p.entreprise_id
  WHERE e.code_acces = v_code
    AND p.code_pin_hash IS NOT NULL
    AND p.code_pin_hash = crypt(p_code_pin, p.code_pin_hash)
    AND p.actif = true
  LIMIT 1;

  INSERT INTO login_attempts (code_entreprise, success, personne_id)
  VALUES (v_code, v_pid IS NOT NULL, v_pid);

  IF v_pid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id, p.nom, p.prenom, p.role, ac.equipe_id,
    e.id, e.name,
    c.id, c.name, c.client, c.takt_duree, c.budget_heures
  FROM personnes p
  JOIN entreprises e     ON e.id = p.entreprise_id
  JOIN acces_chantier ac ON ac.personne_id = p.id
  JOIN chantiers c       ON c.id = ac.chantier_id
  WHERE p.id = v_pid AND c.statut = 'actif';
END;
$$;

-- ── 4. Vérification ─────────────────────────────────────────
SELECT
  COUNT(*)                                            AS personnes,
  COUNT(*) FILTER (WHERE code_pin_hash IS NOT NULL)   AS avec_hash
FROM personnes;

-- ═══════════════════════════════════════════════════════════
-- 5. PURGE DES PINs EN CLAIR — NE PAS EXÉCUTER MAINTENANT
--    Seulement quand l'Edge Function login (étape 2) est
--    déployée, que l'app est à jour et que tout le monde se
--    connecte via elle. Après cette purge, l'ancien
--    login_personne (comparaison en clair) ne fonctionne plus.
--
-- UPDATE personnes SET code_pin = NULL;
-- DROP FUNCTION IF EXISTS login_personne(TEXT, TEXT);
-- ═══════════════════════════════════════════════════════════
