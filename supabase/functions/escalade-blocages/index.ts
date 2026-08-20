// ═══════════════════════════════════════════════════════════
// EDGE FUNCTION « escalade-blocages »
//
// Appelée toutes les heures par pg_cron (automatisations.sql).
// Trouve les tâches bloquées depuis plus de 48 h jamais
// escaladées → notification push aux CA / admin + trace dans
// l'historique + marquage (une seule escalade par blocage).
//
// Déploiement : Edge Functions → nom : escalade-blocages
//   Verify JWT : OFF
// Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//   CRON_SECRET (le même que dans automatisations.sql)
// ═══════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  try {
    // Garde anti-abus : seul pg_cron (qui connaît le secret) déclenche
    const secret = Deno.env.get('CRON_SECRET')
    if (secret && req.headers.get('x-cron-secret') !== secret) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401 })
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublic || !vapidPrivate) throw new Error('Secrets VAPID manquants')
    webpush.setVapidDetails('mailto:ayoub.azedag@outlook.fr', vapidPublic, vapidPrivate)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Tâches bloquées depuis > 48 h, jamais escaladées
    const seuil = new Date(Date.now() - 48 * 3_600_000).toISOString()
    const { data: tasks, error } = await admin
      .from('tasks')
      .select('id, label, type_blocage, comment, updated_at, zone_takt_id, equipe_id')
      .eq('status', 'blocked')
      .is('escalade_at', null)
      .lt('updated_at', seuil)
    if (error) throw error

    if (!tasks || tasks.length === 0) {
      console.log('[escalade] aucun blocage > 48 h à escalader')
      return new Response(JSON.stringify({ escalades: 0 }), { status: 200 })
    }
    console.log(`[escalade] ${tasks.length} blocage(s) > 48 h détecté(s)`)

    // Noms de zones et d'équipes (une requête chacune)
    const zoneIds = [...new Set(tasks.map(t => t.zone_takt_id).filter(Boolean))]
    const equipeIds = [...new Set(tasks.map(t => t.equipe_id).filter(Boolean))]
    const [{ data: zones }, { data: equipes }] = await Promise.all([
      zoneIds.length ? admin.from('zones_takt').select('id, name').in('id', zoneIds) : Promise.resolve({ data: [] }),
      equipeIds.length ? admin.from('equipes').select('id, name').in('id', equipeIds) : Promise.resolve({ data: [] }),
    ])
    const zoneName = new Map((zones ?? []).map(z => [z.id, z.name]))
    const equipeName = new Map((equipes ?? []).map(e => [e.id, e.name]))

    // Destinataires : CA + admin abonnés
    const { data: subs } = await admin
      .from('push_subs').select('*').in('role', ['ca', 'admin'])

    let sent = 0
    for (const t of tasks) {
      const heures = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 3_600_000)
      const zone = t.zone_takt_id ? zoneName.get(t.zone_takt_id) ?? '' : ''
      const equipe = t.equipe_id ? equipeName.get(t.equipe_id) ?? '' : ''
      const message = JSON.stringify({
        title: `⏰ Blocage depuis ${heures} h${equipe ? ` — ${equipe}` : ''}`,
        body: `${t.label}${zone ? ` — ${zone}` : ''}${t.type_blocage ? ` (${t.type_blocage})` : ''} : toujours bloqué, intervention CA requise`,
        url: '/production/blocages',
        tag: `escalade-${t.id}`,
      })

      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message)
          sent++
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) {
            await admin.from('push_subs').delete().eq('endpoint', s.endpoint)
          }
        }
      }

      // Marquage + trace historique
      await admin.from('tasks').update({ escalade_at: new Date().toISOString() }).eq('id', t.id)
      await admin.from('task_history').insert({
        task_id: t.id,
        role: 'system',
        action: 'escalade_blocage',
        detail: `Blocage > 48 h escaladé au CA (${heures} h)${t.type_blocage ? ` — ${t.type_blocage}` : ''}`,
      }).then(({ error: e }) => { if (e) console.error('[escalade] historique :', e.message) })
    }

    console.log(`[escalade] ${tasks.length} escalade(s), ${sent} notification(s) envoyée(s)`)
    return new Response(JSON.stringify({ escalades: tasks.length, sent }), { status: 200 })
  } catch (e) {
    console.error('[escalade]', e)
    return new Response(JSON.stringify({ error: 'Erreur interne' }), { status: 500 })
  }
})
