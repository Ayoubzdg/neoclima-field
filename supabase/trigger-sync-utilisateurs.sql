-- ═══════════════════════════════════════════════════════════
-- TRIGGER : sync automatique utilisateurs → personnes
-- À exécuter UNE SEULE FOIS dans Supabase → SQL Editor
--
-- Après ça, chaque création/modification dans utilisateurs
-- se répercute instantanément dans personnes + acces_chantier.
-- Plus besoin de sync JavaScript.
-- ═══════════════════════════════════════════════════════════


-- ── 1. Fonction appelée par le trigger ──────────────────────
CREATE OR REPLACE FUNCTION fn_sync_utilisateur_to_personne()
RETURNS TRIGGER AS $$
DECLARE
  v_entreprise_id UUID;
  v_personne_id   UUID;
BEGIN
  -- Récupérer l'entreprise liée au chantier
  SELECT entreprise_id INTO v_entreprise_id
  FROM chantiers
  WHERE id = NEW.chantier_id;

  -- Si le chantier n'est pas encore rattaché à une entreprise → on ignore
  IF v_entreprise_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sans PIN on ne peut pas se connecter → on crée quand même (PIN = '0000')
  -- Le chef devra générer un vrai PIN depuis l'admin panel

  -- Chercher une personne existante par (entreprise, nom, prénom)
  SELECT id INTO v_personne_id
  FROM personnes
  WHERE entreprise_id = v_entreprise_id
    AND LOWER(TRIM(nom))    = LOWER(TRIM(NEW.nom))
    AND LOWER(TRIM(COALESCE(prenom, ''))) = LOWER(TRIM(COALESCE(NEW.prenom, '')))
  LIMIT 1;

  IF v_personne_id IS NULL THEN
    -- ── Nouveau : créer dans personnes ──
    INSERT INTO personnes (entreprise_id, nom, prenom, role, code_pin, actif)
    VALUES (
      v_entreprise_id,
      NEW.nom,
      NULLIF(TRIM(COALESCE(NEW.prenom, '')), ''),
      NEW.role,
      COALESCE(NULLIF(TRIM(COALESCE(NEW.code_pin, '')), ''), '0000'),
      COALESCE(NEW.actif, true)
    )
    RETURNING id INTO v_personne_id;
  ELSE
    -- ── Existant : mettre à jour PIN, rôle, statut actif ──
    UPDATE personnes SET
      code_pin = CASE
        WHEN NEW.code_pin IS NOT NULL AND TRIM(NEW.code_pin) != ''
        THEN NEW.code_pin
        ELSE code_pin  -- conserver l'ancien PIN si pas de nouveau
      END,
      role  = NEW.role,
      actif = COALESCE(NEW.actif, true)
    WHERE id = v_personne_id;
  END IF;

  -- Créer ou mettre à jour l'accès au chantier avec l'équipe
  INSERT INTO acces_chantier (personne_id, chantier_id, equipe_id)
  VALUES (v_personne_id, NEW.chantier_id, NEW.equipe_id)
  ON CONFLICT (personne_id, chantier_id)
  DO UPDATE SET equipe_id = EXCLUDED.equipe_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 2. Supprimer le trigger s'il existe déjà (idempotent) ───
DROP TRIGGER IF EXISTS trg_sync_utilisateur ON utilisateurs;


-- ── 3. Créer le trigger ─────────────────────────────────────
CREATE TRIGGER trg_sync_utilisateur
AFTER INSERT OR UPDATE ON utilisateurs
FOR EACH ROW
EXECUTE FUNCTION fn_sync_utilisateur_to_personne();


-- ── 4. Sync rétroactive : aligne les utilisateurs existants ─
-- (règle Ervin, Sofian et tous les autres en attente)
UPDATE utilisateurs SET updated_at = NOW()
WHERE actif = true;
-- Si la colonne updated_at n'existe pas, utiliser à la place :
-- UPDATE utilisateurs SET nom = nom WHERE actif = true;


-- ── 5. Vérification finale ───────────────────────────────────
SELECT
  p.nom,
  p.prenom,
  p.role,
  p.code_pin,
  p.actif,
  c.name AS chantier,
  eq.name AS equipe
FROM personnes p
JOIN acces_chantier ac ON ac.personne_id = p.id
JOIN chantiers c ON c.id = ac.chantier_id
LEFT JOIN equipes eq ON eq.id = ac.equipe_id
ORDER BY p.nom, c.name;
