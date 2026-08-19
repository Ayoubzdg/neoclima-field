# Sécurité serveur — guide de déploiement

**Objectif : fermer la faille n°1 de l'audit.** Aujourd'hui, la clé anon (publique par construction) permet de lire et modifier TOUTES les tables — coûts, PINs, données de toutes les entreprises — sans même ouvrir l'app. Après ce déploiement : aucun accès sans JWT signé, PINs hachés, cloisonnement entreprise appliqué **par le serveur**.

Trois étapes **dans l'ordre**, chacune sans risque tant que la suivante n'est pas lancée. Compte 30–45 minutes au calme.

---

## Étape 1 — PINs hachés (5 min, aucun risque)

1. Supabase → **SQL Editor** → coller et exécuter `supabase/securite-1-hash-pins.sql`
2. Vérifier le résultat : `personnes` = `avec_hash` (tous les PINs sont hachés)

✅ Rien ne change pour les utilisateurs. L'ancien login continue de marcher. **Ne PAS exécuter le bloc "PURGE" commenté à la fin** — c'est pour plus tard.

---

## Étape 2 — Edge Function login (15 min)

1. Supabase → **Edge Functions** → **Deploy a new function** → nom : `login`
2. Coller le contenu de `supabase/functions/login/index.ts`
3. **Secrets** (menu Edge Functions → Secrets) : ajouter
   - Nom : `JWT_SECRET`
   - Valeur : Settings → API → **JWT Settings → JWT Secret** (le copier tel quel)
4. Dans les réglages de la fonction : **désactiver "Verify JWT"** (le login a lieu avant d'avoir un JWT)
5. Déployer, puis **tester** depuis l'onglet de la fonction ou avec :

```
curl -X POST https://<ton-projet>.supabase.co/functions/v1/login \
  -H "Content-Type: application/json" \
  -H "apikey: <anon key>" \
  -d '{"code_entreprise":"ROOS","code_pin":"7455"}'
```

Réponse attendue : `{"token":"eyJ...","results":[...]}`. Mauvais PIN → `{"results":[]}`.

6. `git push origin main` (si pas déjà fait) : l'app à jour **essaie l'Edge Function d'abord** et retombe sur l'ancien login si elle est absente — aucune coupure possible.
7. Se déconnecter / reconnecter dans l'app et vérifier que tout fonctionne normalement.

✅ À partir d'ici, chaque connexion vérifie le PIN **haché** et embarque un JWT signé 12 h. Mais les données restent ouvertes tant que l'étape 3 n'est pas faite.

---

## Étape 3 — RLS : fermer les données (15 min + tests)

**Prérequis absolus :** étapes 1 et 2 OK, app déployée, et **tous les utilisateurs reconnectés** (leur session doit contenir le JWT — au pire ils re-tapent leur PIN, 10 secondes). Idéalement : un soir, hors heures de chantier.

1. SQL Editor → exécuter `supabase/securite-2-rls.sql`
2. Vérifier le tableau final : toutes les tables `✓ RLS actif`
3. **Tester avec un compte de CHAQUE rôle** :
   - monteur : voit ses tâches, avance les statuts, photos ✓ — mais `/reporting` etc. vides même par API
   - chef_equipe (ST) : ne voit QUE les tâches de son entreprise
   - chef : contrôle/validation, dashboard complet ✓
   - ca : dashboard CA, paramètres ✓
   - admin : panel admin ✓
4. **Le test qui compte** (celui de la checklist d'audit) — dans un terminal, avec la seule clé anon :

```
curl "https://<ton-projet>.supabase.co/rest/v1/personnes?select=*" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
```

Résultat attendu : `[]`. Avant ce déploiement, cette commande renvoyait **tous les PINs de tout le monde**.

5. Quand tout est validé depuis quelques jours : exécuter le bloc **PURGE** commenté à la fin de `securite-1-hash-pins.sql` (supprime les PINs en clair + l'ancien RPC).

### 🆘 Rollback d'urgence

Si l'app est cassée après l'étape 3 : SQL Editor → exécuter `disable-rls.sql` (tout redevient comme avant, le temps de diagnostiquer). Les étapes 1 et 2 n'ont jamais besoin de rollback.

---

## Ce qui restera après (hors périmètre de ce guide)

- Buckets Storage encore publics (photos/plans accessibles par URL) → passer les buckets en privé + signed URLs, phase suivante
- MFA pour admin/CA — optionnel
- CORS du service PPTX Railway à restreindre
