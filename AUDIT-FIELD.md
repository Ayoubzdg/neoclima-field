# AUDIT FIELD — Chantier ventilation 18 MCHF

**Date : 19.08.2026 · Basé sur l'analyse ligne par ligne du code source réel (React/TypeScript/Supabase)**
**Périmètre : 30 utilisateurs simultanés, ~5 ST montage, ~3 ST isolation, monteurs / chefs d'équipe / chefs de chantier / CA / admin**

> Convention : chaque point distingue **EXISTANT** (vérifié dans le code, fichier cité) de ce qui est **PROPOSÉ**. Priorités : 🔴 Critique · 🟠 Haute · 🟡 Moyenne · ⚪ Faible.

---

## 0. Synthèse exécutive

Field est aujourd'hui un **bon prototype mono-entreprise** : le cœur terrain (tâches par zone Takt, QR codes, saisie quantités au doigt, blocages, PWA) est réel et fonctionne. Mais en l'état, **le déployer sur un chantier de 18 MCHF avec 8 sous-traitants serait une faute professionnelle**, pour trois raisons rédhibitoires, toutes vérifiées dans le code :

1. **Sécurité inexistante.** RLS désactivé sur les 22 tables (`supabase/disable-rls.sql`), clé anon publique par construction, PIN 4 chiffres comparés **en clair** sans limite d'essais, aucune expiration de session. Concrètement : **n'importe quel monteur d'un sous-traitant peut lire les coûts, les PINs de tout le monde et les données de toutes les entreprises via l'API REST Supabase**, sans même ouvrir l'application. Le contrôle par rôle n'existe que dans le menu (les liens sont masqués) — **toutes les routes, y compris `/reporting/financier` et `/parametres`, sont accessibles par URL à tout utilisateur connecté** (`ProtectedRoute.tsx` ne teste que `isAuthenticated`).
2. **Aucune séparation des entreprises sur les données de production.** `entreprise_id` existe sur `personnes` et `chantiers`, mais **ni sur `tasks`, ni sur `equipes`**. Un sous-traitant est identifié par… des mots-clés dans le nom d'équipe (`RapportHebdo.tsx:114`). Le cloisonnement demandé (un ST ne voit pas les autres) est impossible avec ce modèle.
3. **Aucun workflow de validation.** `done` posé par le monteur = comptabilisé directement dans l'avancement, le PPC et le rapport. Sur 18 MCHF avec des ST payés à l'avancement, **c'est le renard qui certifie le poulailler**. Aucun état "à contrôler", aucune signature, et l'historique n'enregistre que le rôle ("monteur"), jamais la personne ni l'entreprise.

**Note actuelle : 4/10** (excellent socle terrain, inapte au multi-entreprises et au pilotage financier).
**Note potentielle : 8,5/10** en 8–10 semaines de travail ciblé — l'architecture Supabase + PWA est la bonne, rien n'est à jeter, tout est à durcir.

Le reste de l'audit détaille rôle par rôle, fonction par fonction, avec la matrice de permissions, la roadmap et la checklist de mise en production.

---

## 1. État des lieux factuel (ce que Field fait VRAIMENT aujourd'hui)

**Fonctionne et a de la valeur :**

- Hiérarchie `chantier → secteurs → zones_takt → cycles (zone×semaine) → tasks → phases`, planification par Tableau de flux Takt (zones × semaines, création de tâches depuis un catalogue de 49 types CVC avec rendements).
- Terrain : Mes tâches (monteur), cycle de statut au tap, saisie quantité clavier natif, Dashboard chef (avancement pondéré quantités), blocages typés (6 causes) créant une contrainte, Lookahead 3 semaines, Weekly Plan avec engagement (`engage`) et PPC, agenda contraintes, NC avec photos avant/après, mesures aérauliques (±10 % codé en dur), effectifs jour, QR codes zone → tâches + plan, PDF viewer avec tâches positionnées sur plan, rapport hebdo PDF + PPTX (microservice), réalisme offline partiel (file de sync statuts/quantités), realtime + polling 30 s.
- Admin : CRUD utilisateurs/entreprises/personnes/accès, création de chantier clé en main, trigger SQL de sync `utilisateurs → personnes`.

**N'existe pas (contrairement aux apparences) :**

- Validation/contrôle des travaux, workflow isolation, notion de bâtiment/étage/système, notifications (la table `push_subscriptions` est morte, `NotificationStack` = toasts de sync uniquement), versioning réel des plans (`plans_versions` jamais écrite), matériaux (helpers présents, **aucun écran**), heures réalisées (**jamais saisies** → le Tableau financier affiche structurellement des zéros et une dérive fausse), causes de non-complétion PPC (jamais collectées), photos obligatoires, photos offline (perdues silencieusement en cas d'échec), historique consultable (table `task_history` en écriture seule, 1 seul type d'événement), travaux supplémentaires, tests automatisés.

---

## 2. Structure du projet

**EXISTANT.** `Projet (chantier) → Secteur → Zone Takt → Cycle (zone×semaine) → Tâche → Phases`. Les équipes sont rattachées au chantier ; l'affectation passe par `task.equipe_id`. Pas de bâtiment, pas d'étage, pas de système, pas d'entreprise sur les tâches.

**PROBLÈME.** Sur un 18 MCHF, un "secteur" devra encoder à la fois le bâtiment ET l'étage ("Bât. B — Niveau 2"), ce qui interdit toute agrégation par bâtiment ou par système (soufflage, extraction, désenfumage…) dans les dashboards CA. Et l'absence d'`entreprise_id` sur tâches/équipes rend le cloisonnement ST impossible (cf. §8).

**RECOMMANDATION.** Ne PAS complexifier la hiérarchie de navigation — les monteurs n'ont pas besoin de 7 niveaux. Garder la navigation actuelle et ajouter des **attributs de classification**, pas des niveaux :

```
chantier
 └─ secteur            ← + champ batiment (texte court) + champ niveau
     └─ zone_takt      ← inchangé (l'unité terrain reste la zone)
         └─ task       ← + systeme (soufflage|extraction|désenfumage|…)
                       ← + entreprise_id  (OBLIGATOIRE, cf. §8)
                       ← + lot (montage|isolation)  (cf. §7)
```

Trois colonnes + deux champs sur `tasks`. Zéro écran en plus pour le monteur, agrégation par bâtiment/système/entreprise débloquée pour le CA. La question directrice s'applique : un niveau hiérarchique de plus = de l'administration ; un attribut filtrable = du pilotage.

**PRIORITÉ. 🔴** pour `entreprise_id` et `lot` · 🟠 pour `batiment`/`systeme`.

---

## 3. Analyse par rôle

### 3.1 Monteur

| | EXISTANT | CIBLE |
|---|---|---|
| **Voit** | Ses tâches de la semaine (équipe), plans de zone, blocages | Idem + **uniquement les tâches de SON entreprise**, plan avec badge de version |
| **Fait** | Cycle statut au tap, quantités clavier, blocage typé, photo, scan QR | Idem + `done` → passe en **"À contrôler"** (pas comptabilisé), photo obligatoire sur certains types |
| **Ne doit pas faire** | ⚠️ Aujourd'hui il PEUT : ouvrir `/reporting/financier`, `/parametres`, `/planning` par URL ; modifier les tâches de n'importe quelle équipe via QR ou API | Aucun accès coûts/planning/paramètres/autres entreprises — **appliqué serveur (RLS)**, pas seulement masqué |
| **Notifications** | Aucune | Immédiate : nouvelle tâche affectée, blocage levé sur sa tâche, reprise demandée après contrôle |
| **Risques d'erreur** | `done` force `qte_realisee = qte_prevue` (`TacheDetail.tsx:72`) → écrase la vraie quantité ; tap accidentel change le statut ; photo perdue offline sans message | Confirmation 1-tap sur `done` ; ne jamais écraser une quantité saisie ; file photo offline |
| **UX** | Bonne base (gros boutons, FR, tap) | Objectif tenu si : ouverture app → 3 tâches du jour visibles sans un seul clic |

### 3.2 Chef d'équipe / responsable sous-traitant

**EXISTANT : ce rôle n'existe pas.** Il n'y a que `monteur | chef | ca | admin`. Un chef d'équipe ST est aujourd'hui soit un `monteur` (il ne voit rien de plus), soit un `chef` (il voit TOUT le chantier, toutes les entreprises, tous les blocages — inacceptable).

**RECOMMANDATION 🔴.** Créer le rôle `chef_equipe` : voit toutes les tâches de **son entreprise** sur le chantier (toutes équipes de son entreprise), déclare les effectifs de ses équipes, **prévalide** les tâches de ses monteurs (statut "À contrôler" → "Prévalidé ST"), signale les blocages, voit son propre avancement. Ne voit jamais : coûts, autres entreprises, PPC global, paramètres. **Ne peut jamais valider définitivement ses propres prestations** — la validation finale est interne (chef de chantier Neoclima).

### 3.3 Chef de chantier

**EXISTANT.** Dashboard chef (effectifs, avancement pondéré, blocages, cartes équipe dépliables), Tableau de flux (accès ajouté 19.08), Weekly Plan, Lookahead, agenda contraintes, NC, effectifs, bon de travail. **Manque :** file "travaux à contrôler" (le concept n'existe pas), notifications de blocage (il doit ouvrir l'écran pour découvrir un blocage), vision par entreprise, retards par zone.

**CIBLE.** Sa journée doit tenir en 3 files : **À contrôler** (tâches "done" en attente), **Blocages** (avec délai depuis signalement), **Effectifs du jour**. Il valide/refuse en 1 tap (refus ⇒ motif obligatoire ⇒ retour "En cours" chez le monteur avec notification). Il voit les coûts en **heures** uniquement, pas en CHF (voir matrice). Notification immédiate : blocage sécurité, blocage > 4 h, effectif manquant. Résumé quotidien : le reste.

### 3.4 Chargé d'affaires

**EXISTANT.** Rapport hebdo (PPC, avancement, exports PDF/PPTX), Tableau financier — **mais celui-ci est structurellement faux** : `heures_realisees` n'est jamais saisi (≡0), taux horaire 130 CHF codé en dur, avancement en nombre de tâches et non en valeur, projection de fin ≡ 0. **PROBLÈME majeur : le seul écran "pilotage 18 MCHF" affiche des chiffres faux avec l'apparence de la précision.** C'est pire que pas d'écran.

**CIBLE.** Avancement par bâtiment / système / entreprise (débloqué par §2), courbe en S prévu/réalisé en **valeur** (Σ `qte × cout_unitaire` — les données existent déjà et ne sont jamais agrégées), productivité réelle (quantités/heures pointées — nécessite la saisie d'heures, cf. §15), retards par zone, travaux supplémentaires en attente de sa validation, prévision de fin par extrapolation du takt réel. Le CA valide : travaux supplémentaires, clôture hebdo, avancements ST (base de facturation).

### 3.5 Administrateur

**EXISTANT.** AdminPanel complet (1445 l.) : CRUD utilisateurs (⚠️ **PINs affichés en clair** avec un toggle), création chantier clé en main, entreprises/personnes/accès. Garde `role !== 'admin'` **dans le composant seulement**.

**CIBLE.** L'admin ne doit PAS être un super-utilisateur du quotidien : il configure (structure, entreprises, accès, types de tâches) et audite (logs). Retirer l'affichage des PINs en clair (reset uniquement), ajouter : désactivation immédiate d'un utilisateur (existe) **avec effet serveur** (n'existe pas : la session localStorage éternelle survit à la désactivation), journal des connexions, export de données.

---

## 4. Gestion des tâches — champs

**EXISTANT** (`models.ts:148`) : label, description, qte_prevue/realisee, unite, date_planifiee, date_debut/fin_reel, heures_prevues/realisees, status, type_blocage, comment, rect (position plan), engage, cout_unitaire, equipe_id, zone_takt_id, task_type_id, cycle_id, phases.

**Verdict champ par champ :**

| Catégorie | Champs | Remarque |
|---|---|---|
| **Indispensables (saisie)** | label (via catalogue), qte_prevue, unite, zone, équipe, entreprise*, lot*, date_planifiee | * = à créer. Tout vient du catalogue de types : **zéro texte libre en création courante** ✅ déjà le cas dans TableauFluxTakt |
| **Indispensables (terrain)** | status, qte_realisee, type_blocage+comment si blocage | Déjà le cas |
| **Automatiques** | heures_prevues (=qte/rendement ✅ déjà calculé), date_debut_reel (au 1er "en cours" — **à automatiser**, aujourd'hui jamais posé par MesTaches), date_fin_reel (au "done"), created/updated_at, historique | |
| **Facultatifs** | description, rect (position plan), photos, phases | Les phases sont mortes : affichées en lecture seule, `updatePhaseStatus` jamais appelé (`TacheDetail`). **Supprimer ou activer — pas entre les deux** 🟡 |
| **À retirer de la tâche** | cout_unitaire | Doit vivre sur `task_types` uniquement et être joint côté serveur pour les rôles autorisés — aujourd'hui il est envoyé au client de tous les rôles |

**PROBLÈME transverse.** `done` écrase `qte_realisee = qte_prevue` (`TacheDetail.tsx:72-76`) : on perd l'information de sous/sur-réalisation. **RECOMMANDATION 🟠 :** proposer "Réalisé = prévu ?" avec la valeur pré-remplie, jamais écraser une saisie.

---

## 5. Workflow — statuts

**EXISTANT.** 8 statuts : `todo, en_cours, nappe_h, nappe_b, terminaux, raccordement, done, blocked`. Trois copies divergentes de la machine à états (`MesTaches`, `TacheDetail` et `ZoneTasksView` où done→**todo** au lieu de done→en_cours). Le sous-cycle CVC (nappe_h→…→raccordement) est **inatteignable par l'UI** — aucun chemin n'y entre. Aucune validation après done.

**PROBLÈME.** C'est exactement la multiplication de statuts que vous voulez éviter — 4 statuts métier morts qui compliquent le CHECK SQL, les 3 machines à états et tous les filtres, pour zéro usage. Et il manque le seul statut qui compte sur 18 MCHF : le contrôle.

**RECOMMANDATION 🔴.** 6 statuts, une seule machine à états partagée (un fichier `statusMachine.ts` importé partout) :

```
À FAIRE → EN COURS → À CONTRÔLER → VALIDÉ
              ↓ ↑ (retour si refus, motif obligatoire)
           BLOQUÉ (depuis À faire ou En cours)
           + ANNULÉ (chef/CA uniquement, remplace la suppression)
```

- Le monteur ne connaît que : À faire / En cours / Terminé (=À contrôler) / Bloqué. **Pour lui, rien ne change — un seul tap de plus n'existe même pas.**
- "À contrôler" → "Validé" : chef de chantier (ou prévalidation chef d'équipe ST puis validation chef — 2 niveaux uniquement pour les ST).
- **Seul "Validé" compte dans l'avancement, le PPC et la base de facturation ST.** L'écran chef affiche les deux courbes (déclaré / validé) pour voir le stock de contrôle.
- Le détail "nappe H / nappe B / terminaux / raccordement" devient ce qu'il aurait toujours dû être : des **phases** de la tâche (la table existe !) ou des tâches distinctes du catalogue — pas des statuts.
- Migration SQL : `nappe_* / terminaux / raccordement → en_cours`, ajout de `a_controler`, `valide`, `annule` au CHECK.

Contre-argument anticipé ("le contrôle va créer un goulot chez le chef") : c'est un tap par tâche, en lot par zone ("Tout valider dans B2-E03"), et c'est précisément le travail d'un chef de chantier. S'il ne contrôle pas dans Field, il contrôle sur papier — ou personne ne contrôle, et ça se découvre à la réception.

---

## 6. Montage → Isolation

**EXISTANT : rien.** Aucune occurrence de "isolation/calorifuge" dans le code, aucun type de tâche isolation dans le catalogue de 49 entrées, pas de dépendance entre tâches.

**RECOMMANDATION 🔴** (c'est un des 3 sous-traitants sur 8 — ce n'est pas une option) :

- Champ `lot: 'montage' | 'isolation'` sur `task_types` et `tasks`.
- Champ `tache_precedente_id` (nullable) sur `tasks` + un statut dérivé côté requête : une tâche isolation dont le prédécesseur montage n'est pas `valide` est affichée **"En attente montage"** (verrouillée, grisée chez le monteur isolation — il la voit venir mais ne peut pas la démarrer).
- **Automatisation cœur : montage `valide` → la tâche isolation liée passe `todo` + notification au chef d'équipe isolation.** Un trigger Postgres de 15 lignes, pas un moteur de workflow.
- Génération assistée : à la création d'une tâche montage de gaine, proposer "Créer la tâche isolation liée ?" (coche par défaut selon le type). Évite la double saisie de 2 000 tâches.
- Contrôle final après isolation = le même workflow §5, rien de spécial.

Le workflow complet devient : **Montage (ST montage) → À contrôler → Validé (chef Neoclima) → [auto] Isolation libérée (ST isolation) → À contrôler → Validé.** Deux validations internes, zéro validation croisée entre ST, traçabilité complète.

---

## 7. Sous-traitants — séparation stricte des données

**EXISTANT.** La séparation n'existe **à aucun niveau** :

- DB : RLS désactivé partout → la clé anon (publique) lit/écrit toutes les tables de toutes les entreprises, y compris `personnes.code_pin` en clair et les `cout_unitaire`.
- Modèle : pas d'`entreprise_id` sur `tasks`/`equipes` — même en voulant filtrer, on ne peut pas.
- App : le realtime diffuse les changements de **tous** les chantiers à **tous** les clients (`subscribeToChantier` ne filtre rien, le paramètre ne sert qu'à nommer le canal — `supabase.ts:1139`).
- UI : un `chef` voit tout ; un monteur ST voit les tâches des autres équipes via QR (filtre désactivable ? non pour monteur, mais les données sont dans le payload).

**RECOMMANDATION 🔴 — la seule architecture défendable :**

1. `entreprise_id NOT NULL` sur `equipes` et `tasks` (backfill par équipe).
2. **Authentification réelle** : Supabase Auth avec comptes anonymes-liés ou un Edge Function `login` qui vérifie le PIN (haché, avec rate-limit) et émet un **JWT signé contenant `personne_id`, `entreprise_id`, `role`, `chantier_id`**. Le client garde son UX PIN à 4-6 chiffres — seul le backend change.
3. **RLS réactivé**, politiques sur les claims du JWT :
   - monteur/chef_equipe : `SELECT/UPDATE tasks WHERE entreprise_id = jwt.entreprise_id AND chantier_id = jwt.chantier_id`, UPDATE limité aux colonnes terrain (trigger de garde : un monteur ne peut pas changer `qte_prevue`, `equipe_id`, `valide`…) ;
   - chef/ca/admin Neoclima : tout le chantier ;
   - `cout_unitaire`, tableau financier, PINs : **jamais dans les payloads** des rôles non autorisés — vues dédiées sans colonnes sensibles.
4. Realtime filtré par `chantier_id` (paramètre `filter` de `postgres_changes`) — et le RLS s'applique aussi aux messages realtime une fois activé.
5. Suppression : **personne ne supprime** de tâche/zone/NC — statut `annule` + trace. La suppression physique reste admin-DB uniquement.
6. Auto-validation interdite : contrainte en base — `valide_par_personne_id` doit appartenir à une entreprise ≠ celle de la tâche OU être Neoclima. Une règle SQL, pas une convention.

Sans le point 2+3, tout le reste de cet audit est du théâtre : **la vraie frontière de sécurité d'une app Supabase, c'est RLS. Aujourd'hui elle est explicitement désactivée.**

---

## 8. Matrice complète des permissions (CIBLE)

Rôles : **M** = Monteur · **CE** = Chef d'équipe ST · **CC** = Chef de chantier (Neoclima) · **CA** = Chargé d'affaires · **A** = Admin. "Ent." = limité à son entreprise.

| Fonction | M | CE | CC | CA | A |
|---|---:|---:|---:|---:|---:|
| Voir tâches affectées (son équipe) | Oui | Ent. | Oui | Oui | Oui |
| Voir toutes les tâches du chantier | Non | Non | Oui | Oui | Oui |
| Créer une tâche | Non | Non | Oui | Oui | Oui |
| Modifier planification (dates, qte prévue, équipe) | Non | Non | Oui | Oui | Oui |
| Saisir avancement (statut, qte réalisée) | Ses tâches | Ent. | Oui | Oui | Oui |
| Passer "À contrôler" (terminer) | Oui | Ent. | Oui | Oui | Oui |
| Prévalider (ST) | Non | Ent. | — | — | — |
| **Valider définitivement** | Non | **Non (jamais ses prestations)** | Oui | Oui | Oui |
| Annuler une tâche | Non | Non | Oui | Oui | Oui |
| Supprimer physiquement | Non | Non | Non | Non | DB seul |
| Signaler un blocage | Oui | Oui | Oui | Oui | Oui |
| Lever un blocage | Non | Ent.* | Oui | Oui | Oui |
| Créer/lever une contrainte | Non | Signaler | Oui | Oui | Oui |
| Créer une NC | Non | Non | Oui | Oui | Oui |
| Corriger une NC (statut "corrigée") | Assigné | Ent. | Oui | Oui | Oui |
| Valider levée NC | Non | Non | Oui | Oui | Oui |
| Déclarer effectifs | Non | Ent. | Oui | Oui | Oui |
| Saisir heures | Ses heures | Ent. | Oui | Oui | Oui |
| Voir avancement global chantier | Non | Ent. | Oui | Oui | Oui |
| Voir PPC / Weekly / Lookahead | Non | Ent. (lecture) | Oui | Oui | Oui |
| Engager la semaine (Weekly) | Non | Proposer | Oui | Oui | Oui |
| **Voir coûts CHF / Tableau financier** | Non | Non | **Heures seulement** | Oui | Oui |
| Voir rendements/cout_unitaire du catalogue | Non | Non | Rendements | Oui | Oui |
| Valider travaux supplémentaires | Non | Non | Proposer | **Oui** | Oui |
| Uploader un plan / nouvelle révision | Non | Non | Oui | Oui | Oui |
| Voir plans | Oui | Oui | Oui | Oui | Oui |
| Photos (ajouter) | Oui | Oui | Oui | Oui | Oui |
| Photos (supprimer) | Non | Non | Oui | Oui | Oui |
| Rapport hebdo / exports | Non | Ent. (le sien) | Oui | Oui | Oui |
| Paramètres chantier / zones / types | Non | Non | Zones | Oui | Oui |
| Gestion utilisateurs de son entreprise | Non | PIN reset* | Non | Non | Oui |
| Gestion entreprises / accès chantiers | Non | Non | Non | Non | Oui |
| Voir historique d'une tâche | Ses tâches | Ent. | Oui | Oui | Oui |
| Voir journal d'audit global | Non | Non | Non | Oui | Oui |

\* optionnel phase 2. **Chaque ligne de cette matrice doit exister en RLS/trigger, pas seulement en `if (role)` React** — c'est LE chantier n°1.

---

## 9. Plans et documents

**EXISTANT.** Un PDF par zone (`plan_url`), upload par PlanViewer, compteur `plan_version` incrémenté, table `plans_versions` **jamais alimentée**, pas d'historique consultable, PDF en cache service worker **CacheFirst 7 jours** (`vite.config.ts:41`), anciennes versions jamais supprimées du bucket et publiquement accessibles, viewer mono-page sans navigation (`pdfPage` figé), worker pdf.js chargé depuis un CDN externe (mort en offline).

**PROBLÈME.** Votre exigence — "un monteur ne doit jamais travailler involontairement avec un plan obsolète" — est aujourd'hui **garantie d'être violée** : le cache 7 jours sert l'ancien PDF même après révision, sans aucun signal.

**RECOMMANDATION 🟠 :**

- Alimenter `plans_versions` à chaque upload (indice, date, uploadeur, note de révision) + écran "historique des révisions".
- **Indice de révision visible en très gros sur le viewer** ("Rév. C — 12.08.2026") + comparaison au chargement : si la version cache ≠ version DB → bandeau rouge "NOUVELLE RÉVISION DISPONIBLE" + rechargement forcé (NetworkFirst pour les PDF, pas CacheFirst ; le cache ne sert qu'en offline avec bandeau "version possiblement obsolète — Rév. B téléchargée le…").
- Nouvelle révision → notification aux équipes ayant des tâches ouvertes dans la zone + les tâches de la zone passent en surbrillance "plan révisé" jusqu'à acquittement du chef.
- Ajouter la navigation multi-pages (le champ `plan_pages` existe déjà).
- Étendre aux autres documents (réservations, schémas, fiches techniques) = simple table `documents(zone_id|chantier_id, type, url, revision, obsolete)` — même mécanique. ⚪ phase 2.
- Buckets **privés + signed URLs** (cf. §16) : aujourd'hui plans et photos du chantier sont publics pour qui a l'URL.

---

## 10. Photos

**EXISTANT.** Upload depuis TacheDetail (type "avant" codé en dur), NC (constat), NcDetail (après). Jamais obligatoires. `compressImage()` écrit mais **jamais appelé** → originaux de plusieurs Mo uploadés. Échec offline → photo **silencieusement perdue** (`catch → console.error`). Champs x/y (position plan) jamais utilisés.

**RECOMMANDATION :**

- **Obligatoire** (bloque le passage "À contrôler") : travaux destinés à être cachés (gaines en faux-plafond avant fermeture — flag `photo_obligatoire` sur `task_types`), correction de NC (avant ET après), travaux supplémentaires, blocage "erreur de plan". **Facultative partout ailleurs** — une photo par tâche standard de pose est de l'administration, pas du pilotage. 🟠
- Activer `compressImage` (1 ligne à brancher) — à 30 utilisateurs × photos 5 Mo, c'est la différence entre une app utilisable en 4G de chantier et une app "qui rame". 🔴
- File offline : photo → IndexedDB (la table Dexie `photos` existe, elle est juste morte) → upload au retour réseau avec le reste de la file. Message clair "1 photo en attente d'envoi". 🔴 (cf. §17)
- Type auto ("avant" si statut≠done, "après" sinon) au lieu du "avant" codé en dur. ⚪

---

## 11. Blocages

**EXISTANT.** 6 causes codées en dur (matériau, accès, autre corps métier, gros œuvre, équipement, autre), description facultative. Incohérences réelles : depuis MesTaches le blocage crée une contrainte, depuis TacheDetail **non** ; la levée efface cause+commentaire **sans historique** et **sans lever la contrainte liée** (qui reste "ouverte" et pollue le Lookahead). Personne n'est notifié — le chef découvre en ouvrant l'écran.

**RECOMMANDATION 🟠.**

- Compléter les causes avec les vôtres : `plan_manquant`, `erreur_plan`, `validation_necessaire`, `reservation_manquante`, `securite`, `technique`. Toujours 1 tap, jamais de texte obligatoire (sauf "autre").
- **Routage automatique par cause** (règle métier, pas IA) :

| Cause | Destinataire immédiat | Escalade |
|---|---|---|
| Sécurité | Chef chantier + CA, immédiat | — |
| Matériau / réservation | Chef chantier | CA si > 48 h |
| Plan manquant / erreur plan | Chef chantier + CA | Bureau technique |
| Autre corps d'état / accès / gros œuvre | Chef chantier | CA si > 48 h (coordination) |
| Validation nécessaire | Chef chantier | CA si > 24 h |
| Technique / équipement / autre | Chef chantier | CA si > 48 h |

- Unifier : **tout blocage crée une contrainte** (un seul point d'entrée partagé) ; lever le blocage propose de lever la contrainte ; cause+durée archivées dans l'historique (aujourd'hui on perd la donnée qui nourrit le KPI "durée moyenne de blocage" et l'analyse des causes PPC).
- Timestamp de blocage → compteur visible "bloquée depuis 6 h" chez le chef (l'info existe : `updated_at`).

---

## 12. Travaux supplémentaires

**EXISTANT : rien.** Aucun module, aucun statut, aucun champ. Sur un 18 MCHF, les régies/TS finissent en litige si elles ne sont pas tracées **le jour même**.

**RECOMMANDATION 🟠 — module minimal, pas une GED :** table `travaux_supp (id, chantier_id, zone_id, entreprise_id, description, photos[], statut, qte_estimee, heures_estimees, cree_par, valide_par_cc, valide_par_ca, date_realisation, task_id)`.

Workflow exactement comme vous l'avez décrit, 4 statuts : `signale → analyse_cc → valide_ca → realise` (+ `refuse`). Monteur : bouton "Travail non prévu" = photo obligatoire + dictée/texte court, 30 secondes. Chef chantier qualifie (zone, estimation grossière). CA valide ou refuse — **rien ne se réalise sans validation CA tracée**. À la validation, création automatique d'une tâche normale liée (elle suit ensuite le workflow standard §5). Export mensuel de la liste pour la facturation. C'est un des rares modules **nouveaux** à construire — tout le reste de l'audit est du durcissement.

---

## 13. Dashboards

**Monteur — EXISTANT :** MesTaches est déjà proche de la cible. **CIBLE :** aujourd'hui = 3 blocs max : mes tâches du jour (triées zone), mes bloquées, mes reprises demandées (nouveau, vient du refus de contrôle). Rien d'autre. ✅ quasi acquis.

**Chef de chantier — EXISTANT :** effectifs, avancement pondéré, cartes équipes, blocages, alertes. **Manque :** file "à contrôler" (n'existe pas, cf. §5), retards par zone (comparaison date_planifiee vs aujourd'hui — les données existent), réserves (NC) dans le dashboard, vue par entreprise. **CIBLE :** ajouter 3 tuiles : À contrôler (n), Retards (zones en dépassement), NC ouvertes (n) — chaque tuile = lien vers la file d'action. 🟠

**Chargé d'affaires — EXISTANT :** rapport hebdo + tableau financier faux (§3.4). **CIBLE 🟠 :** un écran, 6 blocs : (1) avancement global en valeur + courbe S ; (2) barres par bâtiment et par système (débloqué par §2) ; (3) tableau par sous-traitant : avancement validé, PPC, blocages en cours, retard moyen — **c'est la base objective des situations mensuelles ST** ; (4) risques = zones en retard > X jours + blocages > 48 h + NC bloquantes ; (5) travaux supp en attente de SA validation ; (6) prévision de fin par takt réel constaté vs planifié. Le tout en < 5 minutes de lecture : ce dashboard EST l'exigence "le CA comprend le chantier en 5 minutes".

---

## 14. KPI

Ne garder que ce qui déclenche une décision :

| KPI | Source | EXISTANT ? | Décision qu'il déclenche |
|---|---|---|---|
| % avancement **validé** (vs déclaré) | tasks | Partiel (déclaré seul, pondération OK depuis 19.08) | Situations ST, alerte dérive déclaré/validé |
| PPC hebdo par équipe/entreprise | weekly | Oui (global) — causes jamais collectées | Fiabilité des engagements ST |
| Présents vs prévus | effectifs | Oui | Relance ST le matin même |
| Heures réalisées vs prévues | ⚠️ **jamais saisies** | Non | Productivité, dérive budget |
| Tâches bloquées + **âge moyen du blocage** | tasks+historique | Bloquées oui, âge non (donnée effacée à la levée) | Coordination, escalade |
| NC ouvertes / âge / par entreprise | nc | Partiel (compteurs) | Qualité ST, rétention |
| Reprises (refus de contrôle) | nouveau statut | Non | Qualité ST |
| Respect planning (zones en retard) | tasks vs dates | Non affiché | Re-planification takt |

**Décision structurante sur les heures 🟠 :** sans heures réalisées, pas de productivité ni de dérive — et le Tableau financier restera faux. La saisie la plus simple qui marche : **le chef d'équipe confirme chaque soir "n présents × h" par équipe** (l'écran Effectifs existe déjà — ajouter les heures au même geste, 10 secondes). Ne PAS demander de pointage par tâche aux monteurs : c'est le meilleur moyen de tuer l'adoption. La productivité par tâche se déduit statistiquement (quantités validées / heures d'équipe).

Supprimer/ne pas construire : "score" gamifié, météo, graphiques par jour de la semaine — décoration.

---

## 15. 30 utilisateurs simultanés — concurrence, perfs

**EXISTANT — points durs vérifiés :**

- **Écriture concurrente = last-write-wins intégral.** `updateStatus` fait un UPDATE complet sans condition de version. Scénario "deux personnes modifient la même tâche" : le chef corrige la quantité pendant que le monteur passe le statut → **la seconde écriture écrase la première silencieusement**, personne n'est averti. Pire en offline : la file rejoue des payloads périmés de plusieurs heures qui écrasent les valeurs fraîches du serveur (la fonction `resolveTaskConflict` existe… et n'est appelée nulle part — `sync.ts:72`).
- **Polling 30 s × 30 utilisateurs × 3 requêtes en cascade** (secteurs→zones→tasks, N+1) = ~180 requêtes/min de fond, plus le realtime **non filtré** qui pousse chaque changement à tous les clients de tous les chantiers.
- Photos non compressées de 5 Mo sur la 4G de chantier.

**RECOMMANDATION 🔴 :**

- **Verrouillage optimiste minimal** : `UPDATE … WHERE id=? AND updated_at=:vu` ; 0 ligne → recharger, re-appliquer le delta si compatible (statut vs quantité = champs orthogonaux, fusion triviale), sinon dialogue "modifiée par X, écraser ?". 30 lignes de code, supprime 95 % des écrasements.
- Les quantités en **delta** (`qte_realisee = qte_realisee + :delta` via RPC atomique) plutôt qu'en valeur absolue — deux saisies concurrentes s'additionnent au lieu de s'écraser. L'UI tap-to-type calcule déjà un delta (`TapQtyControl.onDelta`).
- Remplacer le cascade N+1 par une vue SQL ou une RPC unique `tasks_du_chantier(chantier_id)` ; polling à 60 s en fond, refresh au focus de l'app (event `visibilitychange`) — c'est le refresh au focus qui donne la sensation de fraîcheur, pas le polling agressif.
- Realtime filtré (`filter: chantier_id=eq.{id}`) + exécuter enfin `enable-realtime.sql` (toujours en attente).
- Volumétrie : ~5–10 000 tâches, 20–50 000 photos sur la durée — trivial pour Postgres **si** les index suivent (`tasks(entreprise_id)`, `tasks(status)`, `tasks(date_planifiee)`, `photos(task_id)`) et si les photos sont compressées. Prévoir le tier Supabase Pro (le free tier coupe les projets inactifs et limite le storage — inacceptable en production).

---

## 16. Mode hors connexion

**EXISTANT — la promesse offline est aux deux tiers vide :**

- Seuls statuts/quantités passent par la file Dexie. ✅ ce chemin marche.
- **Le cache de consultation n'est jamais rempli** : `cacheDonneesTerrain()` n'est appelée nulle part → ouvrir l'app hors ligne = écran vide "Aucune tâche". Zones, équipes, types : jamais en cache.
- **Photos offline : perdues sans message** (§10). NC, contraintes, effectifs offline : non gérés (échec silencieux).
- `retry_count` jamais lu : un item de sync invalide reste en file pour toujours et fige le compteur "n en attente".
- Détection `navigator.onLine` : un Wi-Fi captif sans Internet est vu "online".
- Historique jamais écrit en mode offline (le `addTaskHistory` est dans la branche online).

**Votre scénario cible** (terminer → photos → valider → coupure → retour réseau → sync sans perte) **échoue aujourd'hui à l'étape photos.**

**RECOMMANDATION 🔴 :**

1. Appeler `cacheDonneesTerrain(equipeId)` après login et à chaque refresh réussi (la fonction existe, 1 appel à brancher) → l'app s'ouvre toujours avec les données du dernier passage réseau + bandeau "hors ligne — données de 07:42".
2. Photos → table Dexie `photos` (existe) → rejouées par la file avec l'upload storage puis l'insert DB, dans cet ordre.
3. File : plafond de retries + statut "en erreur" visible et actionnable (réessayer/abandonner), au lieu du compteur muet.
4. Test de connectivité réel (ping léger vers Supabase) plutôt que `navigator.onLine` seul.
5. L'historique porte le timestamp du **geste terrain**, pas celui de la sync (champ `created_at` dans le payload de la file — le champ existe déjà).

Ne PAS viser : édition de planification offline, résolution de conflits sophistiquée multi-appareils. Terrain offline = consulter + avancer + photographier + bloquer. C'est tout, et c'est atteignable.

---

## 17. Notifications

**EXISTANT : zéro.** Table `push_subscriptions` et clé VAPID vestigiales, jamais utilisées. Les "notifications" sont des toasts de sync in-app. Toute l'information est en pull.

**RECOMMANDATION 🟠 — Web Push (la PWA le permet, l'infra Supabase Edge Functions suffit), avec une discipline stricte anti-spam :**

| Canal | Événements | Destinataire |
|---|---|---|
| **Immédiat (push)** | Blocage sécurité ; blocage sur le chemin critique ; tâche affectée aujourd'hui ; reprise demandée ; travaux supp validés/refusés ; nouvelle révision de plan sur SA zone | La personne concernée, jamais "tout le monde" |
| **Résumé quotidien 17h00** | Rapport du jour (§22) | Chef chantier, CA |
| **Silencieux (badge in-app)** | Blocages non critiques, NC, contraintes J-7, stock "à contrôler" | Files du dashboard |
| **Escalade auto** | Blocage > 48 h → CA ; "à contrôler" > 48 h → rappel chef ; contrainte non levée à J-2 → responsable + chef | Règles Postgres cron (pg_cron), pas de service externe |

Règle d'or : **un monteur ne reçoit jamais plus de ~3 pushes/jour ; un CA jamais une notification qu'un résumé peut porter.** Chaque type désactivable individuellement. Si vous spammez la semaine 1, les notifications sont désactivées la semaine 2 et le canal est mort pour toujours.

---

## 18. QR Codes

**EXISTANT.** QR par zone (contenu = code texte brut saisi **à la main** par l'admin, `generateShortCode()` jamais branché), impression A4/étiquettes, scan caméra → tâches de la zone (semaine courante, filtre équipe) + plan. Le code est saisissable à la main (pas une preuve de présence), aucun scan n'est tracé.

**Verdict : le QR zone est LE bon niveau.** Local/zone = oui (c'est fait, et c'est le geste terrain parfait : je suis devant le local, je scanne, je vois quoi faire ici). Équipement = ⚪ phase future (utile pour la maintenance/DOE, pas pour le montage). Tâche individuelle = **non** (personne ne collera 5 000 étiquettes). Système = non (pas physique).

**RECOMMANDATION 🟡 :** brancher `generateShortCode()` à la création de zone (supprime la saisie manuelle et les collisions) ; enrichir l'écran de scan avec les NC ouvertes et le plan de la zone (déjà partiellement le cas) ; tracer le scan dans l'historique (gratuit, et donne une donnée de présence terrain indicative) ; à terme, encoder une URL (`https://app…/z/NC-Z001`) pour que le scan hors app ouvre la PWA.

---

## 19. Automatisations

Toutes en règles métier (triggers Postgres / pg_cron) — aucune n'a besoin d'IA :

| Automatisation | EXISTANT ? | Mécanisme | Prio |
|---|---|---|---|
| Montage validé → isolation libérée + notif | Non | Trigger sur tasks (§6) | 🔴 |
| done → apparaît dans la file "à contrôler" du chef | Non (concept absent) | Statut §5 | 🔴 |
| Nouvelle révision plan → alerte équipes de la zone + invalidation cache | Non | Trigger + push §9 | 🟠 |
| Blocage > 48 h → escalade CA | Non | pg_cron horaire | 🟠 |
| date_debut_reel auto au 1er "en cours", date_fin_reel au "done" | Partiel (TacheDetail oui, MesTaches non) | Trigger DB (fiable partout, offline compris) | 🟠 |
| NC corrigée → contrôle demandé au chef | Non (statut "corrigée" absent) | Statut NC + notif | 🟠 |
| Contrainte J-2 non levée → rappel responsable | Non (le Lookahead l'affiche en pull) | pg_cron | 🟡 |
| Clôture hebdo → calcul et écriture PPC (`ppc_global` **jamais écrit** aujourd'hui malgré le texte UI) | Non | Appeler la fonction SQL `calcul_ppc` qui existe déjà | 🟠 |
| Retard ST (PPC < 60 % deux semaines) → alerte CA | Non | pg_cron hebdo | 🟡 |
| Effectif non déclaré à 08h → rappel chef d'équipe | Non | pg_cron | 🟡 |
| Blocage levé → proposer la levée de la contrainte liée | Non (incohérence §11) | App | 🟠 |

---

## 20. Intelligence artificielle

À ne PAS faire (une règle est plus fiable) : classification des blocages (ils sont déjà typés par un tap), détection de retard (comparaison de dates), escalades, calcul de prévision de fin (extrapolation takt).

À réelle valeur, phase 2 uniquement, jamais bloquant :

- **Synthèse hebdo rédigée** à partir des chiffres réels (le PPTX actuel insère des phrases creuses codées en dur — `'Coordination en cours. Solution identifiée.'`, `RapportHebdo.tsx:126` — c'est exactement ce qu'il faut remplacer : des chiffres vrais + 5 phrases générées et **relues par le CA avant envoi**). 🟡
- **Analyse des commentaires de blocage** sur un trimestre : thèmes récurrents par ST/zone → réunion de coordination outillée. 🟡
- **Dictée vocale → texte structuré** pour blocages et travaux supp (le clavier sur chantier avec des gants, c'est non). C'est le cas d'usage IA au meilleur ratio valeur/risque pour les monteurs. 🟡
- Détection d'anomalies de saisie (quantités aberrantes vs rendement) en garde-fou doux ("valeur inhabituelle — confirmer ?"). ⚪

---

## 21. Rapport quotidien automatique

**EXISTANT :** rien de quotidien (hebdo uniquement, en pull + exports). **RECOMMANDATION 🟠 :** généré à 17h00 (pg_cron → Edge Function → push + page), archivé, J-1 comparé. Toutes les données existent déjà sauf "validé" et "décisions" :

```
CHANTIER X — Mardi 19.08.2026
PERSONNEL      27/30 présents (ST Isol-B : 2 manquants)
PRODUCTION     43 tâches validées · 51 déclarées terminées (stock contrôle : 8)
               1 240 ml gaine · 86 pce terminaux
BLOCAGES       7 en cours (2 > 48 h ⚠) · 3 levés aujourd'hui
RÉSERVES (NC)  4 ouvertes / 3 fermées aujourd'hui
RETARDS        Zone B2-E03 : -2 j · Zone A1-E01 : -1 j
TRAVAUX SUPP   2 en attente de validation CA
DÉCISIONS      • Livraison gaines S35 à confirmer (blocage matériau, 52 h)
               • Révision plan B2 : 3 équipes non acquittées
```

La section DÉCISIONS n'est pas de l'IA : c'est la liste des escalades ouvertes (§19).

---

## 22. Sécurité (synthèse — le détail est aux §7/§8)

| Domaine | EXISTANT (vérifié) | CIBLE | Prio |
|---|---|---|---|
| Authentification | Code entreprise + PIN 4 ch. en clair, RPC SQL, pas de hash, pas de rate-limit, pas de lockout | Edge Function login : PIN haché (bcrypt), 5 essais/15 min, JWT signé avec claims | 🔴 |
| Session | localStorage éternel (commentaire "24h" mensonger, aucun TTL), survit à la désactivation de l'utilisateur | JWT exp. 12 h, re-PIN au retour, révocation serveur | 🔴 |
| MFA | Non | Non nécessaire pour monteurs (PIN+appareil suffit au risque) ; **oui pour admin/CA** (TOTP), qui voient les coûts | 🟡 |
| Autorisations | UI seulement ; routes ouvertes ; RLS désactivé | RLS complet + guard rôle par route (trivial une fois RLS en place) | 🔴 |
| Isolation entreprises | Aucune (pas d'entreprise_id sur tasks) | §7 | 🔴 |
| Storage | Buckets publics (photos, plans, y c. anciennes révisions) | Buckets privés + signed URLs 1 h | 🟠 |
| Logs | 1 event (status_change, rôle seul), écriture seule, rien en offline | §23 | 🟠 |
| Sauvegardes | Supabase par défaut (PITR selon plan) | Plan Pro + PITR 7 j + export hebdo testé (une restauration jamais testée n'existe pas) | 🟠 |
| Suppression | Physique possible (admin UI) ; realtime diffuse tout à tous | Soft-delete partout ; realtime filtré | 🔴 |
| Désactivation utilisateur | Flag `actif` OK mais sans effet sur session en cours | Vérif `actif` dans RLS → effet immédiat | 🔴 |
| Secrets | `.env` bien ignoré ; microservice PPTX Railway avec **CORS `*` + credentials** | Restreindre ALLOWED_ORIGINS ; l'anon key devient inoffensive avec RLS | 🟠 |
| PINs | Affichés en clair dans AdminPanel (toggle), défauts '0000'/'1100'/'1200' codés en dur | Jamais affichés, reset only, génération aléatoire, interdiction des défauts | 🔴 |

---

## 23. Traçabilité

**EXISTANT.** `task_history(role, action, detail)` : un seul type d'événement (changement de statut), enregistre "monteur → done" — **ni qui, ni quelle entreprise, ni la valeur précédente**. Aucun écran ne la lit. Rien en offline. Quantités, blocages, levées, NC, plans, validations, connexions : non tracés.

**RECOMMANDATION 🟠.** Votre format cible est le bon et il est bon marché : élargir la table (`personne_id, entreprise_id, old_value, new_value, source(app|offline_sync|admin)`), alimenter par **triggers Postgres** sur tasks/nc/contraintes/zones (plans)/travaux_supp — les triggers capturent aussi les écritures API directes et la file offline, ce que le code applicatif ne fera jamais de façon fiable. Ajouter : timeline dans TacheDetail (lecture de l'historique — la donnée devient enfin utile au terrain : "qui a bloqué et quand"), journal filtrable pour CA/admin, log des connexions dans l'Edge Function login. Rétention : vie du chantier + archive.

```
19.08.2026 14:32 · VENT-B2-E03-0045 · En cours → À contrôler
Ervin Avdiu (ROOS Montage SA) · app mobile
```

---

## 24. UX terrain

**EXISTANT — déjà bien :** français, gros boutons tap, quantités clavier natif, safe-area mobile, listes issues du catalogue (peu de texte libre), QR. **Reste à faire :**

- **Test des 30 secondes (monteur)** : quasi acquis — à condition d'ouvrir directement sur "aujourd'hui" trié par zone, sans choix à faire. Vérifier avec un vrai monteur ROOS, chronomètre en main, avant le pilote.
- Le monteur ne devrait JAMAIS voir : PPC, Gantt, paramètres, financier. Aujourd'hui il peut y naviguer (§3.1) — chaque écran de trop est une occasion de se perdre.
- Dictée vocale sur blocage/commentaire/travaux supp (§20) — gants + froid = pas de clavier.
- Mode gants/soleil : cibles tactiles ≥ 48 px (ok), contraste élevé, pas de gestes fins (le swipe a déjà été retiré à juste titre).
- États vides parlants : aujourd'hui une erreur réseau affiche "Aucune tâche planifiée" (`loadTasksDuJour` avale l'erreur, `productionStore.ts:53`) — un monteur croit qu'il n'a rien à faire. **Distinguer "rien à faire" de "pas pu charger"** 🔴 (c'est un bug de confiance, pas de cosmétique).
- Test des 5 minutes (CA) : dépend entièrement du dashboard §13 — aujourd'hui impossible (données financières fausses).

---

## 25. Les 10 causes d'échec les plus probables à 6 mois

| # | Cause | Prob. | Impact | Prévention |
|---|---|---|---|---|
| 1 | **Fuite de données entre ST** (coûts/PIN lus via API, RLS off) → conflit contractuel, arrêt de l'outil | Élevée | Fatal | RLS + JWT avant TOUT accès ST (bloquant lancement) |
| 2 | **Les monteurs ST ne saisissent pas** (pas leur outil, pas leur intérêt) → données vides → dashboards morts | Élevée | Fatal | Contractualiser l'usage (annexe sous-traitance : avancement validé dans Field = base de facturation) ; formation 30 min ; parrainage par les monteurs ROOS déjà utilisateurs |
| 3 | **Chiffres faux visibles** (financier à zéro, PPC sans causes) → perte de confiance du management → abandon | Élevée | Élevé | Ne JAMAIS montrer un écran non fiable : retirer le Tableau financier jusqu'à la saisie d'heures |
| 4 | Double saisie latente (Excel maintenu en parallèle "au cas où") | Élevée | Élevé | Décision de direction : Field = source unique dès le jour 1 du déploiement général ; les exports remplacent les fichiers |
| 5 | **Écrasements concurrents** (LWW) → "l'app perd mes saisies" → défiance terrain | Moyenne | Élevé | §15 (verrou optimiste + deltas) avant 30 utilisateurs |
| 6 | Photos/saisies perdues offline → même défiance | Moyenne | Élevé | §16 avant le pilote |
| 7 | Goulot de validation (chef ne contrôle pas, stock "à contrôler" explose) → avancement gelé | Moyenne | Moyen | Validation en lot par zone ; escalade > 48 h ; c'est une exigence managériale, pas logicielle |
| 8 | Plan obsolète utilisé → malfaçon réelle imputée à l'app | Moyenne | Élevé | §9 avant d'uploader la moindre révision |
| 9 | Spam de notifications → tout le monde coupe → canal mort | Moyenne | Moyen | §17 (discipline stricte, opt-out fin) |
| 10 | Personne-clé unique (un seul dev/admin connaît Field) → panne = paralysie | Moyenne | Élevé | Doc d'exploitation, 2e admin formé, runbook incidents, monitoring Supabase |

Les causes 2, 4 et 7 sont **organisationnelles** : aucun code ne les résout. Le déploiement doit être porté par la direction de travaux, pas par "l'informatique".

---

## 26. Journée idéale (cible, avec les modifications de cet audit)

- **06h45** — Chef de chantier, café : dashboard chef. Résumé de la veille, 8 tâches à contrôler, 2 blocages > 24 h, effectifs annoncés 27/30.
- **07h00** — Répartition : Tableau de flux, il glisse 2 tâches de l'équipe en sous-effectif vers Roos-Éq.2. Chefs d'équipe ST déclarent les présents (10 s chacun).
- **07h15** — Chaque monteur ouvre Field : ses 3–4 tâches du jour, triées par zone. Scan du QR du local en arrivant → tâches + plan Rév. C.
- **Journée** — Avancement au tap + quantités ; 1 blocage "réservation manquante" (photo, dicté) → push chef → contrainte créée, routée ; 1 travail non prévu photographié → file CA.
- **16h00** — Chefs d'équipe ST : prévalidation des tâches de leurs monteurs (tap en lot par zone).
- **16h30** — Chef de chantier : file "à contrôler", 2 refus avec motif (retour monteur, notif), le reste validé → l'isolation de B2-E03 se libère automatiquement, push au chef isolation.
- **17h00** — Rapport quotidien auto → push CA + archive. Le CA lit 90 secondes, tranche les 2 décisions en attente depuis son bureau.
- **Vendredi 16h30** — Weekly Plan : clôture, PPC calculé et écrit, causes de non-complétion saisies en 5 taps, engagement S+1.

---

## 27. Roadmap de déploiement

| Phase | Contenu | Durée | Critère de sortie |
|---|---|---|---|
| **1. Fondations** | RLS + Edge login + JWT + entreprise_id/lot/batiment/systeme + workflow 6 statuts + rôle chef_equipe + soft-delete + verrou optimiste + offline réparé (cache+photos) + audit triggers | 4–6 sem. | Pen-test interne : un compte monteur ST ne peut RIEN lire/écrire hors périmètre, via l'app ET via l'API |
| **2. Pilote 5 util.** | 1 chef + 1 chef d'équipe + 3 monteurs ROOS, 2 zones réelles, 2 semaines | 2 sem. | 90 % des tâches saisies sans aide ; 0 perte de données ; test 30 s réussi |
| **3. Équipe interne** | Tous les chefs + CA ; dashboards CC/CA ; contrôle/validation en réel ; rapport quotidien | 2–3 sem. | Le CA pilote sa réunion hebdo uniquement avec Field |
| **4. Sous-traitants** | 1er ST montage (2 sem.) puis les 4 autres ; puis ST isolation avec le workflow §6 ; formation 30 min/entreprise ; annexe contractuelle | 3–4 sem. | Chaque ST déclare effectifs + avancement sans relance |
| **5. Généralisation** | 30 utilisateurs, notifications complètes, escalades, travaux supp | 2 sem. | Charge réelle OK, < 3 push/jour/monteur |
| **6. Pilotage avancé** | Heures + financier vrai, KPI ST, prévision fin, IA (synthèse, dictée), équipements QR | continu | Situations mensuelles ST tirées de Field |

**Règle : on ne passe jamais à la phase suivante si le critère de sortie n'est pas tenu.** Total avant généralisation : ~3 mois — compatible avec un chantier qui démarre.

---

## 28. Priorisation

| # | Fonction | Impact /10 | Complexité /10 | Priorité | Échéance |
|---|---|---:|---:|---|---|
| 1 | RLS + auth JWT + hash PIN + rate-limit | 10 | 6 | 🔴 | Phase 1 |
| 2 | entreprise_id sur tasks/equipes + cloisonnement ST | 10 | 4 | 🔴 | Phase 1 |
| 3 | Workflow 6 statuts + validation + machine à états unique | 9 | 4 | 🔴 | Phase 1 |
| 4 | Offline réparé (cache jamais rempli, photos perdues, retries) | 9 | 4 | 🔴 | Phase 1 |
| 5 | Verrou optimiste + quantités en delta | 8 | 3 | 🔴 | Phase 1 |
| 6 | Rôle chef_equipe + guards de routes | 8 | 3 | 🔴 | Phase 1 |
| 7 | Montage→isolation (lot, dépendance, libération auto) | 8 | 4 | 🔴 | Phase 1–3 |
| 8 | Retirer/neutraliser le Tableau financier faux | 7 | 1 | 🔴 | Immédiat |
| 9 | Compression photos (brancher l'existant) | 7 | 1 | 🔴 | Immédiat |
| 10 | Révisions de plans + anti-obsolescence cache | 8 | 4 | 🟠 | Phase 3 |
| 11 | Blocages : causes complètes, routage, contrainte unifiée, âge | 7 | 3 | 🟠 | Phase 3 |
| 12 | Audit triggers + timeline tâche | 7 | 3 | 🟠 | Phase 1 |
| 13 | Notifications push + escalades | 7 | 5 | 🟠 | Phase 4–5 |
| 14 | Rapport quotidien auto | 7 | 3 | 🟠 | Phase 3 |
| 15 | Dashboard CA (bâtiment/système/ST, valeur) | 8 | 5 | 🟠 | Phase 3–6 |
| 16 | Travaux supplémentaires | 7 | 4 | 🟠 | Phase 5 |
| 17 | Heures réalisées (saisie chef d'équipe) + financier vrai | 8 | 4 | 🟠 | Phase 6 |
| 18 | PPC : causes de non-complétion + calcul auto à la clôture | 6 | 2 | 🟠 | Phase 3 |
| 19 | Dictée vocale | 5 | 3 | 🟡 | Phase 6 |
| 20 | Buckets privés + signed URLs | 6 | 2 | 🟠 | Phase 1 |
| 21 | QR auto-générés + scan tracé | 4 | 1 | 🟡 | Phase 3 |
| 22 | IA (synthèse hebdo, analyse blocages) | 4 | 4 | 🟡 | Phase 6 |
| 23 | Nettoyage code mort (dossiers " - Copie", flushSyncQueue, phases ou activation) | 3 | 1 | 🟡 | Fil de l'eau |
| 24 | MFA admin/CA | 4 | 3 | 🟡 | Phase 5 |
| 25 | Équipements QR / DOE | 3 | 5 | ⚪ | Futur |

---

## 29. MVP

**BLOQUANT AVANT LANCEMENT** (aucun ST ne se connecte avant) :
RLS + JWT + hash PIN (1) · cloisonnement entreprise (2) · workflow validation (3) · offline fiable (4) · verrou optimiste (5) · rôle chef_equipe + guards (6) · retrait du financier faux (8) · compression photos (9) · soft-delete · désactivation utilisateur effective · PINs jamais affichés · realtime filtré + `enable-realtime.sql` exécuté · Supabase plan Pro + sauvegardes testées.

**IMPORTANT MAIS PEUT ATTENDRE** (phases 3–5) :
Montage→isolation (avant l'arrivée des ST isolation) · révisions de plans · blocages enrichis + routage · rapport quotidien · notifications/escalades · dashboard CA · travaux supp · audit complet + timeline · causes PPC · signed URLs si pas fait en phase 1.

**CONFORT / PHASE FUTURE** :
Heures + financier (phase 6, mais planifié fermement — sinon il ne se fera jamais) · dictée vocale · IA · MFA · équipements QR · multi-pages PDF · analyse statistique des rendements.

---

## 30. Conclusion obligatoire

**1. Note actuelle : 4/10.** Cœur terrain réel et bien pensé (zones Takt, QR, saisie mobile, PWA) ; sécurité 0/10, multi-entreprises 1/10, fiabilité des chiffres de pilotage 2/10, traçabilité 2/10. En mono-équipe ROOS encadrée : 6/10. Pour 18 MCHF et 8 ST : inapte en l'état.

**2. Note potentielle : 8,5/10.** Rien à jeter : la stack (Supabase/PWA/React) et le modèle Takt sont les bons. 80 % du travail est du durcissement de l'existant, pas de la construction.

**3. Dix modifications prioritaires :** (1) RLS+JWT+hash PIN ; (2) entreprise_id partout + cloisonnement ; (3) workflow À contrôler/Validé ; (4) offline réparé (cache + photos) ; (5) verrou optimiste + deltas ; (6) rôle chef_equipe + guards de routes ; (7) chaîne montage→isolation automatique ; (8) neutraliser le financier faux + compresser les photos (immédiat, 1 jour) ; (9) révisions de plans anti-obsolescence ; (10) audit par triggers + timeline.

**4. À simplifier ou supprimer :** les 4 statuts CVC morts (nappe_h/b, terminaux, raccordement → phases ou tâches) ; les 3 machines à états dupliquées → une ; task_phases (activer ou supprimer) ; flushSyncQueue, resolveTaskConflict, cacheDonneesTerrain non branchés (brancher ou supprimer) ; dossiers " - Copie" ; Tableau financier actuel ; double enregistrement du service worker ; `plans_versions`/`push_subscriptions`/`materiaux` fantômes (implémenter ou retirer du schéma) ; phrases codées en dur du PPTX.

**5. Principaux risques :** fuite inter-ST (fatal, technique) ; non-adoption ST (fatal, contractuel/managérial) ; perte de confiance par chiffres faux ou saisies perdues (élevé) ; goulot de validation (moyen, managérial) ; personne-clé unique (élevé, organisationnel).

**6. Architecture recommandée :** conserver Supabase + PWA React. Ajouter : Edge Function d'authentification (JWT), RLS complet, triggers (audit, dates, libération isolation), pg_cron (escalades, rapport quotidien), buckets privés, realtime filtré, RPC agrégées (fin du N+1). Modèle : hiérarchie actuelle + attributs `batiment/systeme/lot/entreprise_id`. Pas de microservices supplémentaires (rapatrier ou sécuriser le service PPTX Railway).

**7. Workflow recommandé :** À faire → En cours → À contrôler → Validé (+ Bloqué, Annulé). Prévalidation chef d'équipe ST pour les monteurs ST. Seul "Validé" compte. Montage validé → isolation libérée automatiquement. Jamais d'auto-validation ST (contrainte en base).

**8. Matrice des permissions :** §8 — chaque ligne implémentée en RLS/trigger, l'UI n'étant qu'un confort.

**9. Roadmap :** §27 — six phases, critères de sortie mesurables, ~3 mois avant généralisation, jamais de phase suivante sans critère tenu.

**10. Checklist avant mise en production :**

- [ ] RLS activé sur les 22 tables, `disable-rls.sql` supprimé du repo
- [ ] Pen-test interne : compte monteur ST → 0 donnée hors périmètre (app ET API REST)
- [ ] PINs hachés, rate-limit login, session 12 h, désactivation à effet immédiat
- [ ] PINs par défaut ('0000','1100','1200') interdits et purgés de la base
- [ ] Workflow validation en place, avancement = validé uniquement
- [ ] Test offline complet : terminer + 2 photos + coupure 2 h + resync = 0 perte
- [ ] Test concurrence : 2 modifications simultanées de la même tâche = fusion ou dialogue, jamais d'écrasement muet
- [ ] `enable-realtime.sql` exécuté, realtime filtré par chantier
- [ ] Buckets privés, anciennes révisions inaccessibles publiquement
- [ ] Tableau financier retiré ou alimenté par des données vraies
- [ ] Photos compressées (< 300 Ko)
- [ ] Sauvegarde restaurée avec succès sur un projet de test (pas juste "activée")
- [ ] Supabase plan Pro, monitoring et alertes configurés
- [ ] CORS du service rapport restreint
- [ ] Test des 30 s (monteur réel) et des 5 min (CA) réussis, chronométrés
- [ ] Annexe contractuelle ST signée : Field = source unique de l'avancement
- [ ] 2e administrateur formé, runbook incident écrit
- [ ] Formation : 30 min/monteur, 1 h/chef, support identifié semaine 1

---

## Principe directeur — vérification finale

Chaque recommandation de ce document a passé le filtre : *fait-elle gagner du temps au chantier ou crée-t-elle de l'administration ?* Ont été **rejetés** à ce titre : pointage horaire par tâche pour les monteurs, photo obligatoire systématique, QR par tâche, niveaux hiérarchiques supplémentaires, statuts au-delà de six, KPI décoratifs, IA là où une règle suffit. La seule "administration" ajoutée est le contrôle des travaux — et sur un chantier de 18 MCHF avec 8 sous-traitants payés à l'avancement, ce n'est pas de l'administration : c'est le métier.

**SIMPLICITÉ → RAPIDITÉ → TRAÇABILITÉ → RESPONSABILITÉ → PILOTAGE.**
