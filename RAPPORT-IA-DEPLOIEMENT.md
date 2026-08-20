# Synthèse IA des rapports — déploiement (5 minutes)

L'app envoie les chiffres du rapport (jour ou hebdo) à une Edge Function
qui demande à Claude (Anthropic) de rédiger une synthèse professionnelle
en français. Le texte est **éditable avant impression** : l'IA propose,
tu valides.

## 1. Déployer la fonction

Supabase → **Edge Functions** → *Deploy new function* :

- Nom : `rapport-ia` (minuscules, exactement)
- Coller le contenu de `supabase/functions/rapport-ia/index.ts`
- **Verify JWT : OFF** (comme login et push-blocage)
- Deploy

## 2. Ajouter la clé API

Edge Functions → `rapport-ia` → **Secrets** :

| Secret | Valeur |
|---|---|
| `ANTHROPIC_API_KEY` | ta clé `sk-ant-…` (console.anthropic.com → API Keys) |
| `ANTHROPIC_MODEL` | *(optionnel)* défaut `claude-sonnet-4-5` |

⚠️ La clé ne transite JAMAIS par l'app ni par Vercel — uniquement côté Supabase.

## 3. Tester

1. App → Reporting → **Rapport du jour** → bouton **✨ Générer la synthèse**
2. La synthèse apparaît en quelques secondes, modifiable, incluse à l'impression
3. Pareil dans **Rapport hebdo**

En cas d'erreur, le message s'affiche dans le bloc (fonction non déployée,
secret manquant…) et le détail est dans Edge Functions → rapport-ia → Logs
(tag `[rapport-ia]`).

## Coût

~1 centime par synthèse avec claude-sonnet-4-5 (les données envoyées sont
déjà agrégées, pas les tâches brutes). Pour réduire encore :
`ANTHROPIC_MODEL = claude-haiku-4-5`.

## Plus tard (quand la qualité te convient)

Génération automatique à 17h : pg_cron qui appelle la fonction et stocke
la synthèse — on la branchera sur demande.
