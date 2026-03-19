-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Neoclima Field Tracker V2
-- ═══════════════════════════════════════════════════════════
-- Politique par rôle :
--   monteur : ses tâches uniquement (via equipe_id)
--   chef    : toutes les tâches de son chantier
--   ca      : tout voir, tout modifier
--   admin   : accès total
-- ═══════════════════════════════════════════════════════════

-- Activer RLS sur toutes les tables
ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE secteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones_takt ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles_takt ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE contraintes ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_conformites ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesures ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE effectifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ── Fonction helper : récupérer le rôle de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM utilisateurs
  WHERE id = auth.uid()::UUID
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Fonction helper : récupérer le chantier_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_user_chantier()
RETURNS UUID AS $$
  SELECT chantier_id FROM utilisateurs
  WHERE id = auth.uid()::UUID
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Fonction helper : récupérer l'equipe_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION get_user_equipe()
RETURNS UUID AS $$
  SELECT equipe_id FROM utilisateurs
  WHERE id = auth.uid()::UUID
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Chantiers ───────────────────────────────────────────────
CREATE POLICY chantiers_select ON chantiers
  FOR SELECT USING (
    get_user_role() IN ('admin','ca','chef','monteur')
    AND id = get_user_chantier()
  );

CREATE POLICY chantiers_modify ON chantiers
  FOR ALL USING (get_user_role() IN ('admin','ca'));

-- ── Secteurs ────────────────────────────────────────────────
CREATE POLICY secteurs_select ON secteurs
  FOR SELECT USING (chantier_id = get_user_chantier());

CREATE POLICY secteurs_modify ON secteurs
  FOR ALL USING (get_user_role() IN ('admin','ca','chef'));

-- ── Zones Takt ──────────────────────────────────────────────
CREATE POLICY zones_takt_select ON zones_takt
  FOR SELECT USING (
    secteur_id IN (
      SELECT id FROM secteurs WHERE chantier_id = get_user_chantier()
    )
  );

CREATE POLICY zones_takt_modify ON zones_takt
  FOR ALL USING (get_user_role() IN ('admin','ca','chef'));

-- ── Tasks ───────────────────────────────────────────────────
-- Monteur : seulement ses tâches d'équipe
-- Chef/CA : toutes les tâches du chantier
CREATE POLICY tasks_select ON tasks
  FOR SELECT USING (
    CASE get_user_role()
      WHEN 'monteur' THEN equipe_id = get_user_equipe()
      WHEN 'chef'    THEN zone_takt_id IN (
        SELECT zt.id FROM zones_takt zt
        JOIN secteurs s ON zt.secteur_id = s.id
        WHERE s.chantier_id = get_user_chantier()
      )
      WHEN 'ca'    THEN zone_takt_id IN (
        SELECT zt.id FROM zones_takt zt
        JOIN secteurs s ON zt.secteur_id = s.id
        WHERE s.chantier_id = get_user_chantier()
      )
      WHEN 'admin' THEN true
      ELSE false
    END
  );

CREATE POLICY tasks_insert ON tasks
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin','ca','chef','monteur')
  );

CREATE POLICY tasks_update ON tasks
  FOR UPDATE USING (
    CASE get_user_role()
      WHEN 'monteur' THEN equipe_id = get_user_equipe()
      ELSE true
    END
  );

-- ── Task phases ─────────────────────────────────────────────
CREATE POLICY task_phases_all ON task_phases
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks)
  );

-- ── Contraintes ─────────────────────────────────────────────
CREATE POLICY contraintes_select ON contraintes
  FOR SELECT USING (
    task_id IN (SELECT id FROM tasks)
  );

CREATE POLICY contraintes_modify ON contraintes
  FOR ALL USING (get_user_role() IN ('admin','ca','chef'));

-- ── NC ──────────────────────────────────────────────────────
CREATE POLICY nc_select ON non_conformites
  FOR SELECT USING (
    zone_takt_id IN (
      SELECT zt.id FROM zones_takt zt
      JOIN secteurs s ON zt.secteur_id = s.id
      WHERE s.chantier_id = get_user_chantier()
    )
  );

CREATE POLICY nc_modify ON non_conformites
  FOR ALL USING (get_user_role() IN ('admin','ca','chef'));

-- ── Photos ──────────────────────────────────────────────────
CREATE POLICY photos_select ON photos
  FOR SELECT USING (
    zone_takt_id IN (
      SELECT zt.id FROM zones_takt zt
      JOIN secteurs s ON zt.secteur_id = s.id
      WHERE s.chantier_id = get_user_chantier()
    )
  );

CREATE POLICY photos_insert ON photos
  FOR INSERT WITH CHECK (get_user_role() IN ('admin','ca','chef','monteur'));

-- ── Equipes ─────────────────────────────────────────────────
CREATE POLICY equipes_select ON equipes
  FOR SELECT USING (chantier_id = get_user_chantier());

CREATE POLICY equipes_modify ON equipes
  FOR ALL USING (get_user_role() IN ('admin','ca','chef'));

-- ── Utilisateurs ────────────────────────────────────────────
CREATE POLICY utilisateurs_select ON utilisateurs
  FOR SELECT USING (
    chantier_id = get_user_chantier()
    OR id = auth.uid()::UUID
  );

CREATE POLICY utilisateurs_modify ON utilisateurs
  FOR ALL USING (get_user_role() IN ('admin','ca'));

-- ── Push subscriptions ──────────────────────────────────────
CREATE POLICY push_own ON push_subscriptions
  FOR ALL USING (user_id = auth.uid()::UUID);

-- ── Mesures ─────────────────────────────────────────────────
CREATE POLICY mesures_select ON mesures
  FOR SELECT USING (chantier_id = get_user_chantier());

CREATE POLICY mesures_modify ON mesures
  FOR ALL USING (get_user_role() IN ('admin','ca','chef'));

-- ── Task history ────────────────────────────────────────────
CREATE POLICY history_select ON task_history
  FOR SELECT USING (
    task_id IN (SELECT id FROM tasks)
  );

CREATE POLICY history_insert ON task_history
  FOR INSERT WITH CHECK (task_id IN (SELECT id FROM tasks));

-- ── Effectifs ───────────────────────────────────────────────
CREATE POLICY effectifs_select ON effectifs
  FOR SELECT USING (chantier_id = get_user_chantier());

CREATE POLICY effectifs_modify ON effectifs
  FOR ALL USING (get_user_role() IN ('admin','ca','chef'));

-- ── Weekly plans ────────────────────────────────────────────
CREATE POLICY weekly_plans_select ON weekly_plans
  FOR SELECT USING (chantier_id = get_user_chantier());

CREATE POLICY weekly_plans_modify ON weekly_plans
  FOR ALL USING (get_user_role() IN ('admin','ca','chef'));

-- ── Task types ──────────────────────────────────────────────
CREATE POLICY task_types_select ON task_types
  FOR SELECT USING (chantier_id = get_user_chantier());

CREATE POLICY task_types_modify ON task_types
  FOR ALL USING (get_user_role() IN ('admin','ca'));

-- ── Plans versions ──────────────────────────────────────────
CREATE POLICY plans_versions_select ON plans_versions
  FOR SELECT USING (
    zone_takt_id IN (
      SELECT zt.id FROM zones_takt zt
      JOIN secteurs s ON zt.secteur_id = s.id
      WHERE s.chantier_id = get_user_chantier()
    )
  );

CREATE POLICY plans_versions_modify ON plans_versions
  FOR ALL USING (get_user_role() IN ('admin','ca'));
