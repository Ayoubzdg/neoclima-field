// ═══════════════════════════════════════════════════════════
// EDGE FUNCTION « push-travaux-supp »
//
// Déclenchée par un Database Webhook sur INSERT + UPDATE de
// travaux_supp. Deux événements notifiés :
//
//  1. SIGNALEMENT (insert, statut=signale)
//     → chef + CA + admin : « Travail supp. signalé »
//  2. TRANSMISSION AU CA (signale → valide_cc)
//     → CA + admin : « Travail supp. à autoriser »
//
// Déploiement (comme push-blocage) :
//  - Edge Functions → Deploy new function → nom : push-travaux-supp
//  - Désactiver "Verify JWT"
//  - Webhook : Database → table travaux_supp → Insert + Update
//    → Supabase Edge Functions → push-travaux-supp
//  - Secrets VAPID déjà en place (partagés avec push-blocage)
// ═══════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    const old = payload.old_record

    // ── Quel événement ? ────────────────────────────────────
    let titre = ''
    let roles: string[] = []

    if (payload.type === 'INSERT' && record?.statut === 'signale') {
      titre = '⚡ Travail supp. signalé'
      roles = ['chef', 'ca', 'admin']
    } else if (
      payload.type === 'UPDATE' &&
      old?.statut === 'signale' &&
      record?.statut === 'valide_cc'
    ) {
      titre = '⚡ Travail supp. à autoriser'
      roles = ['ca', 'admin']
    } else {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    console.log(`[push-ts] ${titre} : "${(record.description ?? '').slice(0, 60)}"`)

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublic || !vapidPrivate) throw new Error('Secrets VAPID manquants')
    webpush.setVapidDetails('mailto:ayoub.azedag@outlook.fr', vapidPublic, vapidPrivate)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Zone (message parlant)
    let zoneName = ''
    if (record.zone_takt_id) {
      const { data: z } = await admin
        .from('zones_takt').select('name').eq('id', record.zone_takt_id).single()
      zoneName = z?.name ?? ''
    }

    const { data: subs } = await admin
      .from('push_subs')
      .select('*')
      .in('role', roles)

    if (!subs || subs.length === 0) {
      console.log(`[push-ts] aucun abonné pour rôles ${roles.join('/')}`)
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }
    console.log(`[push-ts] ${subs.length} abonné(s) trouvé(s)`)

    const desc = (record.description ?? '').slice(0, 80)
    const heures = record.heures_estimees != null ? ` · ~${record.heures_estimees} h` : ''
    const auteur = record.cree_par ? ` — ${record.cree_par}` : ''

    const message = JSON.stringify({
      title: titre,
      body: `${desc}${zoneName ? ` (${zoneName})` : ''}${heures}${auteur}`,
      url: '/production/travaux-supp',
      tag: `ts-${record.id}-${record.statut}`,
    })

    let sent = 0
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message
        )
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        console.error(`[push-ts] échec envoi (HTTP ${code ?? '?'}) : ${(e as Error).message?.slice(0, 200)}`)
        if (code === 404 || code === 410) {
          await admin.from('push_subs').delete().eq('endpoint', s.endpoint)
          console.log('[push-ts] abonnement mort supprimé')
        }
      }
    }

    console.log(`[push-ts] résultat : ${sent}/${subs.length} notification(s) envoyée(s)`)
    return new Response(JSON.stringify({ sent }), { status: 200 })
  } catch (e) {
    console.error('[push-ts]', e)
    return new Response(JSON.stringify({ error: 'Erreur interne' }), { status: 500 })
  }
})
