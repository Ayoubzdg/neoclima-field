// ═══════════════════════════════════════════════════════════
// EDGE FUNCTION « push-blocage »
//
// Déclenchée par un Database Webhook sur UPDATE de tasks.
// Quand une tâche passe en « blocked » : notification push
// immédiate aux chefs / CA / admin abonnés (même app fermée).
//
// Discipline anti-spam (audit) : UN seul événement notifié —
// le blocage. Le reste vit dans l'app (badges, rapport du jour).
//
// Déploiement : voir NOTIFICATIONS-DEPLOIEMENT.md
// Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// ═══════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    // Webhook Supabase : { type: 'UPDATE', record: {...}, old_record: {...} }
    const record = payload.record
    const old = payload.old_record
    if (!record || record.status !== 'blocked' || old?.status === 'blocked') {
      // Update sans transition vers "blocked" → ignoré (log discret)
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    console.log(`[push-blocage] blocage détecté : "${record.label}" (${record.type_blocage ?? '?'})`)

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublic || !vapidPrivate) throw new Error('Secrets VAPID manquants')
    webpush.setVapidDetails('mailto:ayoub.azedag@outlook.fr', vapidPublic, vapidPrivate)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Zone de la tâche (pour un message parlant)
    let zoneName = ''
    if (record.zone_takt_id) {
      const { data: z } = await admin
        .from('zones_takt').select('name').eq('id', record.zone_takt_id).single()
      zoneName = z?.name ?? ''
    }

    // Destinataires : encadrement abonné (chefs, CA, admin)
    const { data: subs } = await admin
      .from('push_subs')
      .select('*')
      .in('role', ['chef', 'ca', 'admin'])

    if (!subs || subs.length === 0) {
      console.log('[push-blocage] AUCUN abonné (push_subs vide pour chef/ca/admin) — rien envoyé')
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }
    console.log(`[push-blocage] ${subs.length} abonné(s) trouvé(s)`)

    const message = JSON.stringify({
      title: '🚫 Blocage signalé',
      body: `${record.label}${zoneName ? ` — ${zoneName}` : ''}${record.type_blocage ? ` (${record.type_blocage})` : ''}`,
      url: '/production/blocages',
      tag: `blocage-${record.id}`,
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
        console.error(`[push-blocage] échec envoi (HTTP ${code ?? '?'}) : ${(e as Error).message?.slice(0, 200)}`)
        // 404/410 = abonnement mort (app désinstallée…) → nettoyage
        if (code === 404 || code === 410) {
          await admin.from('push_subs').delete().eq('endpoint', s.endpoint)
          console.log('[push-blocage] abonnement mort supprimé')
        }
      }
    }

    console.log(`[push-blocage] résultat : ${sent}/${subs.length} notification(s) envoyée(s)`)
    return new Response(JSON.stringify({ sent }), { status: 200 })
  } catch (e) {
    console.error('[push-blocage]', e)
    return new Response(JSON.stringify({ error: 'Erreur interne' }), { status: 500 })
  }
})
