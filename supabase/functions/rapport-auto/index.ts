// ═══════════════════════════════════════════════════════════
// EDGE FUNCTION « rapport-auto »
//
// Appelée à 17h (jours ouvrés) par pg_cron (automatisations.sql).
// Pour chaque chantier actif : agrège les chiffres du jour
// (RPC donnees_rapport_jour), fait rédiger la synthèse par
// Claude, la stocke dans rapports_jour_auto, puis notifie
// chefs / CA / admin « rapport du jour prêt ».
//
// Déploiement : Edge Functions → nom : rapport-auto
//   Verify JWT : OFF
// Secrets requis : ANTHROPIC_API_KEY, VAPID_PUBLIC_KEY,
//   VAPID_PRIVATE_KEY, CRON_SECRET (même valeur que le SQL),
//   ANTHROPIC_MODEL (optionnel, défaut claude-sonnet-4-5)
// ═══════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

/** Date du jour en heure suisse (pg_cron tourne en UTC) */
function todaySuisse(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()) // fr-CA → format YYYY-MM-DD
}

/** Heure courante (0-23) en heure suisse */
function heureSuisse(): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date()))
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('CRON_SECRET')
    if (secret && req.headers.get('x-cron-secret') !== secret) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 })
    }

    // pg_cron tourne en UTC et ignore l'heure d'été : il appelle
    // la fonction à 15h ET 16h UTC, et seul l'appel qui tombe à
    // 17h suisse génère le rapport. Test manuel : body {"force":true}.
    const corps = await req.json().catch(() => ({})) as { force?: boolean }
    if (!corps.force && heureSuisse() !== 17) {
      return new Response(JSON.stringify({ skipped: 'hors créneau 17h suisse' }), { status: 200 })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('Secret ANTHROPIC_API_KEY manquant')
    const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5'

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const date = todaySuisse()
    const { data: chantiers, error } = await admin
      .from('chantiers').select('id, name').eq('statut', 'actif')
    if (error) throw error

    let generes = 0
    for (const c of chantiers ?? []) {
      // Déjà généré aujourd'hui ? (relance manuelle sans doublon)
      const { data: existant } = await admin
        .from('rapports_jour_auto').select('id')
        .eq('chantier_id', c.id).eq('date_rapport', date).maybeSingle()
      if (existant) {
        console.log(`[rapport-auto] ${c.name} : déjà généré aujourd'hui`)
        continue
      }

      // 1. Chiffres du jour (agrégation SQL)
      const { data: donnees, error: eD } = await admin
        .rpc('donnees_rapport_jour', { p_chantier_id: c.id, p_date: date })
      if (eD) { console.error(`[rapport-auto] ${c.name} : ${eD.message}`); continue }

      // 2. Synthèse rédigée par Claude
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          system: `Tu es un directeur de travaux CVC (ventilation) expérimenté en Suisse romande. Tu rédiges des synthèses de chantier factuelles, professionnelles et directes. Règles strictes : uniquement des faits présents dans les données fournies, n'invente RIEN ; français professionnel, phrases courtes ; titres de sections en gras markdown (**Titre**) ; si une donnée est vide, ne pas la mentionner (sauf si son absence est un problème, ex : effectifs non déclarés).`,
          messages: [{
            role: 'user',
            content: `Chantier : ${c.name} — Journée du ${date}

Rédige la SYNTHÈSE DU JOUR (150-220 mots max), en 3 parties courtes :
1. "Résumé" — l'essentiel de la journée en 2-3 phrases.
2. "Points de vigilance" — blocages, retards, effectifs manquants. Le plus critique d'abord. S'il n'y a rien, dis-le en une phrase.
3. "Décisions attendues" — travaux supp en attente et blocages anciens, une ligne chacun, avec le destinataire.

DONNÉES (JSON) :
${JSON.stringify(donnees, null, 1)}`,
          }],
        }),
      })
      if (!res.ok) {
        console.error(`[rapport-auto] ${c.name} : Anthropic HTTP ${res.status}`)
        continue
      }
      const json = await res.json() as { content?: { type: string; text?: string }[] }
      const synthese = (json.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim()

      // 3. Stockage
      const { error: eI } = await admin.from('rapports_jour_auto')
        .insert({ chantier_id: c.id, date_rapport: date, synthese, donnees })
      if (eI) { console.error(`[rapport-auto] ${c.name} : insert ${eI.message}`); continue }
      generes++
      console.log(`[rapport-auto] ${c.name} : synthèse générée (${synthese.length} car.)`)
    }

    // 4. Notification (une seule, globale) aux chefs / CA / admin
    if (generes > 0) {
      const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
      const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
      if (vapidPublic && vapidPrivate) {
        webpush.setVapidDetails('mailto:ayoub.azedag@outlook.fr', vapidPublic, vapidPrivate)
        const { data: subs } = await admin
          .from('push_subs').select('*').in('role', ['chef', 'ca', 'admin'])
        const message = JSON.stringify({
          title: '📋 Rapport du jour prêt',
          body: 'La synthèse de la journée est disponible — relis-la avant diffusion.',
          url: '/reporting/jour',
          tag: `rapport-jour-${date}`,
        })
        for (const s of subs ?? []) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message)
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode
            if (code === 404 || code === 410) {
              await admin.from('push_subs').delete().eq('endpoint', s.endpoint)
            }
          }
        }
      }
    }

    console.log(`[rapport-auto] terminé : ${generes} rapport(s) généré(s)`)
    return new Response(JSON.stringify({ generes }), { status: 200 })
  } catch (e) {
    console.error('[rapport-auto]', e)
    return new Response(JSON.stringify({ error: 'Erreur interne' }), { status: 500 })
  }
})
