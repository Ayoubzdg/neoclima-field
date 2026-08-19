# Notifications push — guide de déploiement

**Résultat : un monteur signale un blocage → le chef reçoit une notification sur son téléphone dans la seconde, même app fermée.** Fini les blocages découverts 4 heures plus tard en ouvrant l'écran.

Un seul événement notifié (discipline anti-spam de l'audit) : le **blocage**. Tout le reste continue de vivre dans l'app.

Compte ~20 minutes. Tu as déjà fait plus dur avec le login.

---

## 1. Générer les clés VAPID (2 min, sur ton PC)

Dans PowerShell, dans le dossier du projet :

```powershell
npx web-push generate-vapid-keys
```

Ça affiche une **Public Key** et une **Private Key**. Garde-les sous la main (bloc-notes).

---

## 2. Secrets Supabase (2 min)

Supabase → Edge Functions → **Secrets** → ajouter :

| Nom | Valeur |
|---|---|
| `VAPID_PUBLIC_KEY` | la Public Key de l'étape 1 |
| `VAPID_PRIVATE_KEY` | la Private Key de l'étape 1 |

---

## 3. Déployer la fonction (5 min)

Comme pour `login` : Edge Functions → **Deploy a new function** → Via Editor
- Nom : `push-blocage`
- Coller le contenu de `supabase/functions/push-blocage/index.ts`
- **Désactiver "Verify JWT"** (c'est le webhook interne qui l'appelle)
- Deploy

---

## 4. Table des abonnements (1 min)

SQL Editor → exécuter `supabase/notifications-push.sql`

---

## 5. Le webhook (5 min) — c'est lui qui déclenche l'envoi

Supabase → **Database** → **Webhooks** → **Create a new hook** :

- **Name** : `blocage-push`
- **Table** : `tasks`
- **Events** : cocher **Update** uniquement
- **Type** : Supabase Edge Functions → choisir **push-blocage**
- Create

(La fonction filtre elle-même : elle n'envoie que si le statut vient de passer à "blocked" — les autres updates sont ignorés en 1 ms.)

---

## 6. Côté app (3 min)

1. Dans ton `.env` local **et** dans Vercel (Settings → Environment Variables), ajouter :

```
VITE_VAPID_PUBLIC_KEY=la_Public_Key_de_l_etape_1
```

2. `git push origin main` (si pas déjà fait) + **redéployer Vercel** (le changement de variable d'env nécessite un redeploy)

---

## 7. Tester (2 min)

1. Sur le téléphone du chef (ou le tien) : ouvrir le Dashboard chef → bouton **« Activer les alertes »** 🔔 → accepter la permission
2. Depuis un compte monteur : bloquer une tâche (n'importe laquelle, tu la débloqueras après)
3. → La notification « 🚫 Blocage signalé » doit arriver sur le téléphone dans les secondes

Si rien n'arrive : Edge Functions → push-blocage → **Logs** (tu sauras si le webhook l'appelle et ce qui coince — envoie-moi la ligne d'erreur).

**Note iOS** : sur iPhone, les notifications web ne marchent que si l'app est **installée sur l'écran d'accueil** (Partager → Sur l'écran d'accueil) — ce qui est de toute façon la bonne façon d'utiliser une PWA de chantier.

---

## Événements futurs (même infra, il suffira d'ajouter des webhooks/fonctions)

Reprise refusée → monteur · nouvelle révision de plan → équipes de la zone · travaux supp validés → demandeur · escalade blocage > 48 h (pg_cron). On les ajoutera quand le premier flux aura fait ses preuves sans spammer.
