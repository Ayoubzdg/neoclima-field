# Neoclima Field Tracker V2 — Guide de démarrage

## Prérequis
- Node.js 18+
- Compte Supabase (https://supabase.com)

---

## 1. Installation

```bash
npm install
```

---

## 2. Configuration Supabase

### a. Créer le projet Supabase
1. Aller sur https://supabase.com/dashboard
2. Créer un nouveau projet
3. Récupérer l'URL et la clé anon dans **Settings > API**

### b. Configurer les variables d'environnement
```bash
cp .env.example .env
```
Editer `.env` :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### c. Créer le schéma de base de données
Dans l'éditeur SQL de Supabase (Dashboard > SQL Editor) :
1. Exécuter `supabase/schema.sql` (schéma complet)
2. Exécuter `supabase/rls.sql` (sécurité par rôle)
3. Exécuter `supabase/seed.sql` (données de démo — optionnel)

### d. Créer les buckets Storage
Dans Supabase > Storage, créer deux buckets publics :
- `photos` — pour les photos de chantier
- `plans` — pour les plans PDF

---

## 3. Lancer l'application

```bash
npm run dev
```

L'application est accessible sur http://localhost:5173

---

## 4. Comptes de démo (après seed.sql)

Chantier : **Chantier Rolex Learning Center**

| Rôle | Nom | Code PIN |
|------|-----|----------|
| Monteur | Jean-Pierre Martin | 0001 |
| Monteur | Marc Dubois | 0002 |
| Chef chantier | Sophie Berger | 9999 |
| Conducteur travaux | Thomas Favre | 8888 |

---

## 5. Structure du projet

```
src/
├── components/        # Composants partagés (Layout, Auth, UI)
├── modules/           # Modules métier
│   ├── production/    # Tâches, Dashboard chef, QR Scanner
│   ├── planning/      # Gantt, Lookahead, PPC
│   ├── plans/         # Viewer PDF, Zones, QR Codes
│   ├── qualite/       # NC, Mesures
│   ├── equipes/       # Équipes, Effectifs
│   ├── reporting/     # Rapports PDF, Financier
│   └── parametres/    # Configuration
├── store/             # Zustand stores
├── lib/               # Supabase client + Offline (Dexie.js)
├── hooks/             # Hooks React réutilisables
├── utils/             # Utilitaires (dates, PPC, takt, QR)
└── types/             # Types TypeScript

supabase/
├── schema.sql         # Schéma DB complet
├── rls.sql            # Row Level Security
└── seed.sql           # Données de démo
```

---

## 6. Build production

```bash
npm run build
```

Déployer le dossier `dist/` sur Vercel, Netlify, ou autre.

---

## 7. Edge Functions Supabase (optionnel)

Pour les fonctionnalités avancées (PPC automatique, notifications push) :

```bash
# Installer Supabase CLI
npm install -g supabase

# Déployer les Edge Functions
supabase functions deploy calculate-ppc
supabase functions deploy send-push-notification
```

---

## 8. PWA — Installation sur mobile

1. Ouvrir l'URL dans Chrome (Android) ou Safari (iOS)
2. Menu → "Ajouter à l'écran d'accueil"
3. L'app fonctionne comme une app native (offline inclus)
