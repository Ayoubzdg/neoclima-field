-- ═══════════════════════════════════════════════════════════
-- CLOISONNEMENT DES ENTREPRISES
-- À exécuter dans Supabase → SQL Editor
--
-- Objectif : chaque sous-traitant ne voit et ne modifie que
-- SES données. Prérequis indispensable avant d'ouvrir l'app
-- aux entreprises de montage et d'isolation.
--
-- 1. entreprise_id sur equipes et tasks (+ backfill)
-- 2. Trigger : une tâche hérite automatiquement de
--    l'entreprise de son équipe (cohérence garantie en base)
-- 3. Nouveau rôle chef_equipe (responsable sous-traitant)
-- 4. login_personne retourne l'entreprise (pour le filtrage app)
-- ═══════════════════════════════════════════════════════════


-- ── 1. Colonnes entreprise_id ───────────────────────────────

ALTER TABLE equipes
  ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);

CREATE INDEX IF NOT EXISTS idx_equipes_entreprise ON equipes(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_tasks_entreprise   ON tasks(entreprise_id);

-- Backfill équipes : par défaut, l'entreprise du chantier
-- (à ajuster à la main pour les équipes sous-traitantes :
--  UPDATE equipes SET entreprise_id = '<uuid ST>' WHERE id = '...')
UPDATE equipes eq
SET entreprise_id = c.entreprise_id
FROM chantiers c
WHERE eq.chantier_id = c.id
  AND eq.entreprise_id IS NULL
  AND c.entreprise_id IS NOT NULL;

-- Backfill tâches : héritent de leur équipe
UPDATE tasks t
SET entreprise_id = eq.entreprise_id
FROM equipes eq
WHERE t.equipe_id = eq.id
  AND t.entreprise_id IS NULL
  AND eq.entreprise_id IS NOT NULL;


-- ── 2. Trigger de cohérence ─────────────────────────────────
-- Toute tâche créée ou réaffectée hérite de l'entreprise de
-- son équipe. Garanti en base, quel que soit le code client.

CREATE OR REPLACE FUNCTION fn_task_entreprise_from_equipe()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.equipe_id IS NOT NULL THEN
    SELECT entreprise_id INTO NEW.entreprise_id
    FROM equipes WHERE id = NEW.equipe_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_entreprise ON tasks;
CREATE TRIGGER trg_task_entreprise
BEFORE INSERT OR UPDATE OF equipe_id ON tasks
FOR EACH ROW
EXECUTE FUNCTION fn_task_entreprise_from_equipe();


-- ── 3. Rôle chef_equipe ─────────────────────────────────────
-- Responsable sous-traitant : voit toutes les équipes de SON
-- entreprise sur le chantier, déclare les effectifs, mais ne
-- valide JAMAIS définitivement ses propres prestations.

ALTER TABLE personnes DROP CONSTRAINT IF EXISTS personnes_role_check;
ALTER TABLE personnes ADD CONSTRAINT personnes_role_check
  CHECK (role IN ('monteur','chef_equipe','chef','ca','admin'));

ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check
  CHECK (role IN ('monteur','chef_equipe','chef','ca','admin'));


-- ── 4. login_personne retourne l'entreprise ─────────────────
-- (changement du type de retour → DROP obligatoire avant CREATE)

DROP FUNCTION IF EXISTS login_personne(TEXT, TEXT);

CREATE FUNCTION login_personne(
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
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.id            AS personne_id,
    p.nom,
    p.prenom,
    p.role,
    ac.equipe_id,
    e.id            AS entreprise_id,
    e.name          AS entreprise_name,
    c.id            AS chantier_id,
    c.name          AS chantier_name,
    c.client        AS chantier_client,
    c.takt_duree    AS chantier_takt_duree,
    c.budget_heures AS chantier_budget_heures
  FROM personnes p
  JOIN entreprises e     ON e.id = p.entreprise_id
  JOIN acces_chantier ac ON ac.personne_id = p.id
  JOIN chantiers c       ON c.id = ac.chantier_id
  WHERE e.code_acces = UPPER(TRIM(p_code_entreprise))
    AND p.code_pin   = p_code_pin
    AND p.actif      = true
    AND c.statut     = 'actif';
$$;


-- ── 5. Vérification ─────────────────────────────────────────
SELECT eq.name AS equipe, e.name AS entreprise, COUNT(t.id) AS taches
FROM equipes eq
LEFT JOIN entreprises e ON e.id = eq.entreprise_id
LEFT JOIN tasks t ON t.equipe_id = eq.id
GROUP BY eq.name, e.name
ORDER BY e.name NULLS FIRST, eq.name;
