# Facturation des sous-traitants — déploiement et mode d'emploi

Neoclima facture en direct chaque sous-traitant pour l'utilisation de Field.
Base de calcul : les **présents validés par le chef de chantier**.

## Règles de calcul (paramétrables par entreprise et par chantier)

| Paramètre | Valeur par défaut |
|---|---|
| Unité | par monteur présent |
| Prix | CHF 4.50 HT par monteur et par jour (CHF 9 pour une équipe de 2) |
| Plafond | 20 jours facturés par équipe et par mois, les suivants sont offerts |
| Dégressif | désactivé |
| Seuil de facturation | CHF 50 : en dessous, le relevé est reporté au mois suivant |

Une entreprise **sans tarif n'est pas facturée** (cas du titulaire).

## Déploiement

1. Supabase → SQL Editor → exécuter `supabase/facturation.sql`.
   La dernière ligne doit afficher `3 · 1 · 3 · 2`.
2. Pousser le code (`git add -A`, `git commit`, `git push origin main`).
3. Se reconnecter en admin → menu **Administration → Facturation**.

## Mise en route

1. Pour chaque sous-traitant : ouvrir sa carte, **Créer le tarif**, remplir la
   **fiche de facturation** (raison sociale, adresse, contact, e-mail).
2. Ne pas créer de tarif pour le titulaire.
3. Expliquer au chef de chantier son nouveau geste quotidien (ci-dessous).

## Au quotidien

- **Monteur** : déclare les présents de son équipe à la clôture de journée.
  C'est une proposition.
- **Chef de chantier** : Équipes → Effectifs → corrige si besoin →
  **Valider les présents du jour**. Après validation, le monteur ne peut plus
  modifier. Seuls les présents validés sont facturés.

## En fin de mois

1. Administration → Facturation → choisir le mois terminé.
2. Traiter les alertes de chaque carte :
   - *à valider* : présents déclarés que le chef n'a pas validés ;
   - *jours sans présents* : heures ou tâches saisies un jour où l'équipe
     n'a déclaré personne.
3. **Clôturer le mois** : le relevé est figé et les présents du mois sont
   verrouillés pour cette entreprise.
4. **Imprimer / PDF** ou **CSV** : c'est l'annexe de ta facture.
5. Émettre la facture dans l'outil comptable (numéro, TVA, QR-facture).

La clôture se fait dans l'ordre, mois après mois, y compris les mois sans
activité (sinon un report pourrait être perdu). Une erreur après clôture :
**Rouvrir le mois** (dernier mois clôturé uniquement), corriger, reclôturer.

## Ce que le script SQL change en base

- Effectifs cloisonnés : un sous-traitant ne lit et ne modifie que ceux de
  ses équipes (avant : tout utilisateur connecté modifiait tout).
- Toute saisie par chef / CA / admin vaut validation (nom et date tracés).
- Chaque correction de présents est historisée (`effectifs_historique`).
- Tarifs et relevés visibles par le rôle admin uniquement.
