-- ═══════════════════════════════════════════════════════════
-- FACTURATION DES SOUS-TRAITANTS
-- À exécuter UNE fois dans Supabase → SQL Editor
-- (prérequis : cloisonnement-entreprises.sql, securite-2-rls.sql)
--
-- Base de facturation = les présents déclarés chaque jour
-- (table effectifs). Ce script la rend fiable :
--   1. Cloisonnement : un sous-traitant ne lit et ne modifie
--      que les effectifs de SES équipes
--   2. Validation : seuls les présents validés par l'encadrement
--      (chef / CA / admin) sont facturables ; une fois validés,
--      le sous-traitant ne peut plus les modifier
--   3. Verrouillage : après clôture du mois, plus aucune
--      modification (sauf réouverture par l'admin)
--   4. Trace : chaque correction de présents est historisée
-- Puis : fiche de facturation, tarifs, relevés mensuels.
-- ═══════════════════════════════════════════════════════════


-- ── 1. Fiche de facturation de l'entreprise ─────────────────
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS raison_sociale   TEXT,
  ADD COLUMN IF NOT EXISTS adresse          TEXT,
  ADD COLUMN IF NOT EXISTS npa_localite     TEXT,
  ADD COLUMN IF NOT EXISTS contact_nom      TEXT,
  ADD COLUMN IF NOT EXISTS contact_email    TEXT;


-- ── 2. Tarifs (par entreprise et par chantier) ──────────────
-- Pas de ligne = entreprise NON facturée (ex : le titulaire).
CREATE TABLE IF NOT EXISTS tarifs_facturation (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id      UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  chantier_id        UUID NOT NULL REFERENCES chantiers(id)   ON DELETE CASCADE,
  facturable         BOOLEAN NOT NULL DEFAULT true,
  -- 'monteur' : prix × présents · 'equipe' : prix × équipe présente
  unite              TEXT NOT NULL DEFAULT 'monteur' CHECK (unite IN ('monteur', 'equipe')),
  prix_jour          NUMERIC(8,2) NOT NULL DEFAULT 4.50 CHECK (prix_jour >= 0),
  -- Au-delà de N jours facturés dans le mois pour une équipe,
  -- les jours suivants sont gratuits (NULL = pas de plafond)
  plafond_jours_mois INTEGER DEFAULT 20 CHECK (plafond_jours_mois IS NULL OR plafond_jours_mois > 0),
  -- Dégressif (désactivé si NULL) : au-delà de N unités le même
  -- jour, les unités suivantes sont au prix réduit
  degressif_seuil    INTEGER CHECK (degressif_seuil IS NULL OR degressif_seuil > 0),
  degressif_prix     NUMERIC(8,2) CHECK (degressif_prix IS NULL OR degressif_prix >= 0),
  -- En dessous de ce total, le relevé est reporté au mois suivant
  seuil_facturation  NUMERIC(8,2) NOT NULL DEFAULT 50,
  -- Les jours antérieurs ne sont pas facturés
  date_debut         DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entreprise_id, chantier_id)
);


-- ── 3. Relevés mensuels clôturés ────────────────────────────
-- Une ligne = un mois figé pour une entreprise sur un chantier.
-- Sa présence VERROUILLE les effectifs du mois (trigger §5).
CREATE TABLE IF NOT EXISTS releves_facturation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id    UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  chantier_id      UUID NOT NULL REFERENCES chantiers(id)   ON DELETE CASCADE,
  mois             DATE NOT NULL CHECK (EXTRACT(DAY FROM mois) = 1),
  -- 'a_facturer' ou 'reporte' (total sous le seuil → mois suivant)
  statut           TEXT NOT NULL CHECK (statut IN ('a_facturer', 'reporte')),
  unites           NUMERIC(10,1) NOT NULL DEFAULT 0,
  montant_mois     NUMERIC(10,2) NOT NULL DEFAULT 0,
  report_anterieur NUMERIC(10,2) NOT NULL DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Détail jour par jour + tarif appliqué, figés à la clôture
  detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
  cloture_par      TEXT,
  cloture_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entreprise_id, chantier_id, mois)
);


-- ── 4. Validation + historique des présents ─────────────────
ALTER TABLE effectifs
  ADD COLUMN IF NOT EXISTS valide_par TEXT,
  ADD COLUMN IF NOT EXISTS valide_at  TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS effectifs_historique (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effectif_id     UUID,
  chantier_id     UUID,
  equipe_id       UUID,
  date            DATE,
  presents_avant  INTEGER,
  presents_apres  INTEGER,
  heures_avant    NUMERIC(4,1),
  heures_apres    NUMERIC(4,1),
  modifie_par     TEXT,
  role            TEXT,
  modifie_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_effectifs_hist ON effectifs_historique(chantier_id, date);


-- ── 5. Trigger : validation, verrouillage, trace ────────────
-- SECURITY DEFINER : doit lire releves_facturation (réservée à
-- l'admin) quel que soit l'utilisateur qui écrit.
CREATE OR REPLACE FUNCTION fn_effectifs_controle()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claims     TEXT := COALESCE(current_setting('request.jwt.claims', true), '');
  v_role       TEXT;
  v_nom        TEXT;
  v_entreprise UUID;
BEGIN
  -- Accès direct à la base (SQL Editor, maintenance) : pas de contrôle
  IF v_claims = '' THEN
    RETURN NEW;
  END IF;

  v_role := COALESCE(v_claims::json->>'app_role', '');
  v_nom  := v_claims::json->>'personne_nom';

  -- a) Mois clôturé → plus aucune modification
  SELECT entreprise_id INTO v_entreprise FROM equipes WHERE id = NEW.equipe_id;
  IF EXISTS (
    SELECT 1 FROM releves_facturation r
    WHERE r.chantier_id = NEW.chantier_id
      AND r.entreprise_id = v_entreprise
      AND r.mois = date_trunc('month', NEW.date)::date
  ) THEN
    RAISE EXCEPTION 'Mois clôturé pour la facturation : les présents ne sont plus modifiables';
  END IF;

  IF v_role IN ('chef', 'ca', 'admin') THEN
    -- b) Toute saisie de l'encadrement vaut validation
    NEW.valide_at  := now();
    NEW.valide_par := COALESCE(v_nom, v_role);
  ELSE
    -- c) Le terrain propose ; il ne peut plus toucher une ligne validée
    IF TG_OP = 'UPDATE' AND OLD.valide_at IS NOT NULL THEN
      RAISE EXCEPTION 'Présents déjà validés par le chef de chantier';
    END IF;
    NEW.valide_at  := NULL;
    NEW.valide_par := NULL;
  END IF;

  -- d) Trace des corrections
  IF TG_OP = 'UPDATE' AND (
       NEW.monteurs_presents IS DISTINCT FROM OLD.monteurs_presents
    OR NEW.heures_jour       IS DISTINCT FROM OLD.heures_jour
  ) THEN
    INSERT INTO effectifs_historique
      (effectif_id, chantier_id, equipe_id, date, presents_avant, presents_apres,
       heures_avant, heures_apres, modifie_par, role)
    VALUES
      (OLD.id, OLD.chantier_id, OLD.equipe_id, OLD.date, OLD.monteurs_presents, NEW.monteurs_presents,
       OLD.heures_jour, NEW.heures_jour, COALESCE(v_nom, v_role), v_role);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_effectifs_controle ON effectifs;
CREATE TRIGGER trg_effectifs_controle
BEFORE INSERT OR UPDATE ON effectifs
FOR EACH ROW
EXECUTE FUNCTION fn_effectifs_controle();


-- ── 6. RLS effectifs : cloisonnement par entreprise ─────────
-- (avant : tout utilisateur connecté lisait et modifiait les
--  effectifs de toutes les entreprises)
DROP POLICY IF EXISTS lecture_authentifiee  ON effectifs;
DROP POLICY IF EXISTS ecriture_authentifiee ON effectifs;
DROP POLICY IF EXISTS maj_authentifiee      ON effectifs;
DROP POLICY IF EXISTS effectifs_select      ON effectifs;
DROP POLICY IF EXISTS effectifs_modify      ON effectifs;
DROP POLICY IF EXISTS effectifs_insert      ON effectifs;
DROP POLICY IF EXISTS effectifs_update      ON effectifs;

CREATE OR REPLACE FUNCTION equipe_de_mon_entreprise(p_equipe_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM equipes e
    WHERE e.id = p_equipe_id AND e.entreprise_id::text = jwt_entreprise_id()
  )
$$ LANGUAGE sql STABLE;

CREATE POLICY effectifs_select ON effectifs FOR SELECT TO authenticated
  USING (est_interne() OR equipe_de_mon_entreprise(equipe_id));

CREATE POLICY effectifs_insert ON effectifs FOR INSERT TO authenticated
  WITH CHECK (est_interne() OR equipe_de_mon_entreprise(equipe_id));

CREATE POLICY effectifs_update ON effectifs FOR UPDATE TO authenticated
  USING (est_interne() OR equipe_de_mon_entreprise(equipe_id))
  WITH CHECK (est_interne() OR equipe_de_mon_entreprise(equipe_id));


-- ── 7. RLS tarifs / relevés / historique ────────────────────
ALTER TABLE tarifs_facturation   ENABLE ROW LEVEL SECURITY;
ALTER TABLE releves_facturation  ENABLE ROW LEVEL SECURITY;
ALTER TABLE effectifs_historique ENABLE ROW LEVEL SECURITY;

-- Tarifs et relevés : admin uniquement (données commerciales)
DROP POLICY IF EXISTS tarifs_admin ON tarifs_facturation;
CREATE POLICY tarifs_admin ON tarifs_facturation FOR ALL TO authenticated
  USING (jwt_app_role() = 'admin') WITH CHECK (jwt_app_role() = 'admin');

DROP POLICY IF EXISTS releves_admin ON releves_facturation;
CREATE POLICY releves_admin ON releves_facturation FOR ALL TO authenticated
  USING (jwt_app_role() = 'admin') WITH CHECK (jwt_app_role() = 'admin');

-- Historique : lecture encadrement ; l'écriture passe par le trigger
DROP POLICY IF EXISTS effectifs_hist_lecture ON effectifs_historique;
CREATE POLICY effectifs_hist_lecture ON effectifs_historique FOR SELECT TO authenticated
  USING (est_interne());


-- ── 8. Vérification ─────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'effectifs')                 AS politiques_effectifs_attendu_3,
  (SELECT COUNT(*) FROM pg_trigger  WHERE tgname = 'trg_effectifs_controle')       AS trigger_attendu_1,
  (SELECT COUNT(*) FROM pg_tables   WHERE schemaname = 'public'
     AND tablename IN ('tarifs_facturation','releves_facturation','effectifs_historique')
     AND rowsecurity)                                                               AS tables_rls_attendu_3,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'effectifs' AND column_name IN ('valide_par','valide_at')) AS colonnes_validation_attendu_2;
