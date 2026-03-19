-- ═══════════════════════════════════════════════════════════
-- NEOCLIMA FIELD TRACKER V2 — Schéma complet
-- ═══════════════════════════════════════════════════════════
-- À exécuter dans l'éditeur SQL Supabase (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Équipes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID, -- référence ajoutée après chantiers
  name        TEXT NOT NULL,
  couleur     TEXT DEFAULT '#3B82F6',
  code_pin    TEXT,
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipes_chantier ON equipes(chantier_id);

-- ── Chantiers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chantiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  adresse       TEXT,
  client        TEXT,
  date_debut    DATE,
  date_fin_prev DATE,
  budget_heures NUMERIC(10,2) DEFAULT 0,
  takt_duree    INTEGER DEFAULT 5,
  statut        TEXT DEFAULT 'actif' CHECK (statut IN ('actif','termine','archive')),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chantiers_statut ON chantiers(statut);

-- Ajouter FK sur équipes maintenant que chantiers existe
ALTER TABLE equipes ADD CONSTRAINT fk_equipes_chantier
  FOREIGN KEY (chantier_id) REFERENCES chantiers(id) ON DELETE CASCADE;

-- ── Utilisateurs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utilisateurs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID REFERENCES chantiers(id) ON DELETE CASCADE,
  equipe_id   UUID REFERENCES equipes(id) ON DELETE SET NULL,
  nom         TEXT NOT NULL,
  prenom      TEXT,
  role        TEXT NOT NULL DEFAULT 'monteur' CHECK (role IN ('monteur','chef','ca','admin')),
  code_pin    TEXT,
  email       TEXT UNIQUE,
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_chantier ON utilisateurs(chantier_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_equipe ON utilisateurs(equipe_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_role ON utilisateurs(role);

-- ── Secteurs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secteurs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID REFERENCES chantiers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  ordre       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_secteurs_chantier ON secteurs(chantier_id);

-- ── Zones Takt ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones_takt (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secteur_id   UUID REFERENCES secteurs(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  superficie   NUMERIC(8,2),
  volume       NUMERIC(10,2),
  qr_code      TEXT UNIQUE,
  plan_url     TEXT,
  plan_type    TEXT,
  plan_pages   INTEGER DEFAULT 1,
  plan_version INTEGER DEFAULT 1,
  ordre        INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zones_takt_secteur ON zones_takt(secteur_id);
CREATE INDEX IF NOT EXISTS idx_zones_takt_qr ON zones_takt(qr_code);

-- ── Plans versionnés ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_takt_id UUID REFERENCES zones_takt(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  url          TEXT NOT NULL,
  note         TEXT,
  cree_par     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plans_zone ON plans_versions(zone_takt_id);

-- ── Types de tâches (catalogue) ─────────────────────────────
CREATE TABLE IF NOT EXISTS task_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id   UUID REFERENCES chantiers(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  unite         TEXT NOT NULL DEFAULT 'ml',
  phases        JSONB DEFAULT '[]',
  rendement     NUMERIC(8,2),
  cout_unitaire NUMERIC(8,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_task_types_chantier ON task_types(chantier_id);

-- ── Cycles Takt ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycles_takt (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_takt_id UUID REFERENCES zones_takt(id) ON DELETE CASCADE,
  semaine      DATE NOT NULL,
  statut       TEXT DEFAULT 'planifie' CHECK (statut IN ('planifie','en_cours','complete','partiel')),
  ppc          NUMERIC(5,2),
  note_chef    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(zone_takt_id, semaine)
);
CREATE INDEX IF NOT EXISTS idx_cycles_zone ON cycles_takt(zone_takt_id);
CREATE INDEX IF NOT EXISTS idx_cycles_semaine ON cycles_takt(semaine);

-- ── Tâches de production ────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID REFERENCES cycles_takt(id) ON DELETE CASCADE,
  zone_takt_id     UUID REFERENCES zones_takt(id),
  task_type_id     UUID REFERENCES task_types(id),
  equipe_id        UUID REFERENCES equipes(id) ON DELETE SET NULL,
  label            TEXT NOT NULL,
  description      TEXT,
  qte_prevue       NUMERIC(10,2) DEFAULT 0,
  qte_realisee     NUMERIC(10,2) DEFAULT 0,
  unite            TEXT DEFAULT 'ml',
  date_planifiee   DATE,
  date_debut_reel  TIMESTAMPTZ,
  date_fin_reel    TIMESTAMPTZ,
  heures_prevues   NUMERIC(6,2) DEFAULT 0,
  heures_realisees NUMERIC(6,2) DEFAULT 0,
  status           TEXT DEFAULT 'todo' CHECK (status IN ('todo','en_cours','nappe_h','nappe_b','terminaux','raccordement','done','blocked')),
  type_blocage     TEXT,
  comment          TEXT,
  rect             JSONB,
  engage           BOOLEAN DEFAULT false,
  cout_unitaire    NUMERIC(8,2) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_cycle ON tasks(cycle_id);
CREATE INDEX IF NOT EXISTS idx_tasks_zone ON tasks(zone_takt_id);
CREATE INDEX IF NOT EXISTS idx_tasks_equipe ON tasks(equipe_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date_planifiee);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Phases de tâche ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_phases (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  ordre      INTEGER NOT NULL,
  status     TEXT DEFAULT 'todo' CHECK (status IN ('todo','en_cours','done')),
  date_debut TIMESTAMPTZ,
  date_fin   TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phases_task ON task_phases(task_id);

-- ── Contraintes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contraintes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  cycle_id        UUID REFERENCES cycles_takt(id),
  type            TEXT NOT NULL CHECK (type IN ('materiau','acces','gros_oeuvre','autre_corps','equipement','autre')),
  description     TEXT NOT NULL,
  responsable     TEXT,
  date_besoin     DATE,
  date_levee_prev DATE,
  date_levee_reel DATE,
  statut          TEXT DEFAULT 'ouverte' CHECK (statut IN ('ouverte','en_cours','levee')),
  bloquant        BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contraintes_task ON contraintes(task_id);
CREATE INDEX IF NOT EXISTS idx_contraintes_statut ON contraintes(statut);
CREATE INDEX IF NOT EXISTS idx_contraintes_date ON contraintes(date_besoin);

-- ── Materiaux ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materiaux (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrainte_id UUID REFERENCES contraintes(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  designation   TEXT NOT NULL,
  reference     TEXT,
  quantite      NUMERIC(10,2) DEFAULT 1,
  unite         TEXT DEFAULT 'pce',
  fournisseur   TEXT,
  statut        TEXT DEFAULT 'manquant' CHECK (statut IN ('manquant','commande','livre')),
  date_besoin   DATE,
  date_commande DATE,
  date_livraison DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materiaux_task ON materiaux(task_id);
CREATE INDEX IF NOT EXISTS idx_materiaux_statut ON materiaux(statut);

-- ── Non-conformités ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS non_conformites (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            UUID REFERENCES tasks(id) ON DELETE SET NULL,
  zone_takt_id       UUID REFERENCES zones_takt(id) ON DELETE CASCADE,
  numero             SERIAL,
  titre              TEXT NOT NULL,
  description        TEXT,
  gravite            TEXT DEFAULT 'mineure' CHECK (gravite IN ('mineure','majeure','bloquante')),
  statut             TEXT DEFAULT 'ouverte' CHECK (statut IN ('ouverte','en_cours','levee','validee')),
  assignee_equipe_id UUID REFERENCES equipes(id) ON DELETE SET NULL,
  date_echeance      DATE,
  date_levee         DATE,
  valide_par         TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nc_zone ON non_conformites(zone_takt_id);
CREATE INDEX IF NOT EXISTS idx_nc_statut ON non_conformites(statut);

CREATE TRIGGER update_nc_updated_at
  BEFORE UPDATE ON non_conformites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Mesures et essais ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID REFERENCES tasks(id) ON DELETE SET NULL,
  zone_takt_id   UUID REFERENCES zones_takt(id) ON DELETE CASCADE,
  chantier_id    UUID REFERENCES chantiers(id),
  type           TEXT NOT NULL CHECK (type IN ('debit','pression','etancheite','bruit','temperature','autre')),
  designation    TEXT,
  valeur_prevue  NUMERIC(10,3),
  valeur_mesuree NUMERIC(10,3),
  unite          TEXT,
  conforme       BOOLEAN,
  ecart_pct      NUMERIC(6,2),
  mesure_par     TEXT,
  date_mesure    DATE,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mesures_zone ON mesures(zone_takt_id);
CREATE INDEX IF NOT EXISTS idx_mesures_chantier ON mesures(chantier_id);

-- ── Photos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL,
  zone_takt_id UUID REFERENCES zones_takt(id) ON DELETE CASCADE,
  nc_id        UUID REFERENCES non_conformites(id) ON DELETE SET NULL,
  url          TEXT NOT NULL,
  x            NUMERIC(6,2),
  y            NUMERIC(6,2),
  legende      TEXT,
  type         TEXT DEFAULT 'general' CHECK (type IN ('general','blocage','nc','reception','avant','apres')),
  auteur_role  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_task ON photos(task_id);
CREATE INDEX IF NOT EXISTS idx_photos_zone ON photos(zone_takt_id);

-- ── Historique tâches ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  role       TEXT,
  action     TEXT,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id);

-- ── Effectifs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS effectifs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id       UUID REFERENCES chantiers(id) ON DELETE CASCADE,
  equipe_id         UUID REFERENCES equipes(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  monteurs_prevus   INTEGER DEFAULT 0,
  monteurs_presents INTEGER DEFAULT 0,
  note              TEXT,
  UNIQUE(chantier_id, equipe_id, date)
);
CREATE INDEX IF NOT EXISTS idx_effectifs_chantier_date ON effectifs(chantier_id, date);

-- ── Weekly Work Plan (LPS) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id UUID REFERENCES chantiers(id) ON DELETE CASCADE,
  semaine     DATE NOT NULL,
  statut      TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon','engage','cloture')),
  ppc_global  NUMERIC(5,2),
  note        TEXT,
  cree_par    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chantier_id, semaine)
);

-- ── Causes de non-completion (LPS) ─────────────────────────
CREATE TABLE IF NOT EXISTS causes_non_completion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  weekly_plan_id  UUID REFERENCES weekly_plans(id) ON DELETE CASCADE,
  cause           TEXT NOT NULL CHECK (cause IN ('contrainte_non_levee','ressource_insuffisante','plan_non_disponible','autre')),
  detail          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Notifications push ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT,
  auth_key    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Sync queue (offline events) ─────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  TEXT NOT NULL,
  table_name TEXT NOT NULL,
  operation  TEXT NOT NULL CHECK (operation IN ('insert','update','delete')),
  record_id  UUID,
  payload    JSONB NOT NULL,
  synced     BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_device ON sync_queue(device_id, synced);

-- ── Paramètres ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parametres (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- FONCTIONS ET VUES UTILES
-- ═══════════════════════════════════════════════════════════

-- Vue : avancement par zone takt
CREATE OR REPLACE VIEW vue_avancement_zone AS
SELECT
  zt.id AS zone_takt_id,
  zt.name AS zone_name,
  s.chantier_id,
  COUNT(t.id) AS total_tasks,
  COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS tasks_done,
  COUNT(CASE WHEN t.status = 'blocked' THEN 1 END) AS tasks_blocked,
  ROUND(
    CASE WHEN COUNT(t.id) > 0
    THEN COUNT(CASE WHEN t.status = 'done' THEN 1 END)::NUMERIC / COUNT(t.id) * 100
    ELSE 0 END, 1
  ) AS avancement_pct
FROM zones_takt zt
JOIN secteurs s ON zt.secteur_id = s.id
LEFT JOIN tasks t ON t.zone_takt_id = zt.id
GROUP BY zt.id, zt.name, s.chantier_id;

-- Vue : contraintes urgentes (besoin dans 7 jours)
CREATE OR REPLACE VIEW vue_contraintes_urgentes AS
SELECT
  c.*,
  t.label AS task_label,
  t.zone_takt_id,
  zt.name AS zone_name,
  s.chantier_id
FROM contraintes c
JOIN tasks t ON c.task_id = t.id
JOIN zones_takt zt ON t.zone_takt_id = zt.id
JOIN secteurs s ON zt.secteur_id = s.id
WHERE c.statut != 'levee'
  AND c.date_besoin IS NOT NULL
  AND c.date_besoin <= CURRENT_DATE + INTERVAL '7 days';

-- Fonction : calcul PPC d'un cycle
CREATE OR REPLACE FUNCTION calcul_ppc(p_cycle_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_engages INTEGER;
  total_completes INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE engage = true),
    COUNT(*) FILTER (WHERE engage = true AND status = 'done')
  INTO total_engages, total_completes
  FROM tasks
  WHERE cycle_id = p_cycle_id;

  IF total_engages = 0 THEN RETURN NULL; END IF;
  RETURN ROUND(total_completes::NUMERIC / total_engages * 100, 1);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- FONCTIONS D'AUTHENTIFICATION (SECURITY DEFINER)
-- Ces fonctions s'exécutent en tant que superuser et
-- bypasse le RLS — nécessaire pour le login PIN.
-- ═══════════════════════════════════════════════════════════

-- Connexion par code PIN : retourne l'utilisateur + email pour auth
CREATE OR REPLACE FUNCTION login_with_pin(p_code_pin TEXT, p_chantier_id UUID)
RETURNS TABLE (
  user_id     UUID,
  email       TEXT,
  nom         TEXT,
  prenom      TEXT,
  role        TEXT,
  equipe_id   UUID,
  chantier_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.nom, u.prenom, u.role, u.equipe_id, u.chantier_id
  FROM utilisateurs u
  WHERE u.code_pin = p_code_pin
    AND u.chantier_id = p_chantier_id
    AND u.actif = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Liste des chantiers actifs : accessible avant authentification
CREATE OR REPLACE FUNCTION get_chantiers_actifs()
RETURNS SETOF chantiers AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM chantiers
  WHERE statut = 'actif'
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
