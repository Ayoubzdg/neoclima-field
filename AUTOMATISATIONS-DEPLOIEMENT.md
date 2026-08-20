# Automatisations — escalade blocages 48 h + rapport 17h (déploiement)

Deux automatisations sur la même infra (pg_cron appelle des Edge Functions) :

- **Escalade** : toutes les heures, les blocages > 48 h jamais escaladés →
  notification push CA/admin + trace dans l'historique de la tâche (une
  seule escalade par blocage).
- **Rapport 17h** : chaque jour ouvré, la synthèse IA du jour est générée
  pour chaque chantier actif, stockée, et chefs/CA/admin reçoivent
  « 📋 Rapport du jour prêt ». Elle apparaît préremplie dans
  Reporting → Rapport du jour (modifiable, régénérable).

## 1. Déployer les 2 fonctions

Supabase → **Edge Functions** → *Deploy new function* (×2) :

| Nom (minuscules) | Fichier à coller | Verify JWT |
|---|---|---|
| `escalade-blocages` | `supabase/functions/escalade-blocages/index.ts` | **OFF** |
| `rapport-auto` | `supabase/functions/rapport-auto/index.ts` | **OFF** |

## 2. Secrets

Invente un secret (longue chaîne aléatoire) : c'est le `CRON_SECRET` —
il garantit que seul pg_cron peut déclencher les fonctions.

Sur **chacune** des 2 fonctions, ajoute :

| Secret | escalade-blocages | rapport-auto |
|---|---|---|
| `CRON_SECRET` | ✔ | ✔ |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | ✔ (mêmes valeurs que push-blocage) | ✔ |
| `ANTHROPIC_API_KEY` | — | ✔ (même valeur que rapport-ia) |

## 3. SQL

Ouvre `supabase/automatisations.sql`, **remplace les 2 occurrences de
`<CRON_SECRET>`** par ton secret, puis exécute tout dans le SQL Editor.

Le script : active pg_cron + pg_net, crée la colonne d'escalade, la table
`rapports_jour_auto`, l'agrégateur `donnees_rapport_jour`, et planifie
les 2 tâches. La vérification finale doit montrer 2 jobs `active = true`.

⚠️ **Heures en UTC** : `0 15 * * 1-5` = 17h suisse en été. En hiver,
mets `0 16 * * 1-5` (SQL Editor : `SELECT cron.unschedule('rapport-auto-17h');`
puis re-planifie avec la nouvelle heure).

## 4. Tester sans attendre 17h

PowerShell :

```powershell
Invoke-RestMethod -Method Post -Uri "https://sseqiogfaekvylwkzfvy.supabase.co/functions/v1/rapport-auto" -Headers @{ "x-cron-secret" = "TON_SECRET" } -ContentType "application/json" -Body "{}"
```

→ réponse `{"generes":1}` + notification sur ton téléphone + la synthèse
apparaît dans Reporting → Rapport du jour. Relancer ne crée pas de
doublon (déjà généré = ignoré).

Même chose avec `/escalade-blocages` (réponse `{"escalades":0}` si aucun
blocage de plus de 48 h — normal).

## Surveillance

Edge Functions → Logs, tags `[escalade]` et `[rapport-auto]`.
Historique cron : `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;`
