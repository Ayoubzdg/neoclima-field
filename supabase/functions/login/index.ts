// ═══════════════════════════════════════════════════════════
// EDGE FUNCTION « login » — SÉCURITÉ ÉTAPE 2/3
//
// Vérifie code entreprise + PIN (haché, avec limite d'essais
// via le RPC login_personne_hash) et émet un JWT signé 12 h
// contenant : personne_id, app_role, entreprise_id.
// Ce JWT est ensuite exigé par les politiques RLS (étape 3).
//
// Déploiement (dashboard Supabase → Edge Functions) :
//   1. New function → nom : login → coller ce fichier
//   2. Secrets → ajouter JWT_SECRET = le "JWT Secret" du projet
//      (Settings → API → JWT Settings → JWT Secret)
//   3. Désactiver "Verify JWT" pour cette fonction
//      (le login se fait AVANT d'avoir un JWT)
// ═══════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST uniquement' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  try {
    const { code_entreprise, code_pin } = await req.json()
    if (!code_entreprise || !code_pin) {
      return new Response(JSON.stringify({ error: 'code_entreprise et code_pin requis' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Client service role — seul l'Edge Function touche aux PINs
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Vérification hash + rate-limit + journal (RPC étape 1)
    const { data: rows, error } = await admin.rpc('login_personne_hash', {
      p_code_entreprise: code_entreprise,
      p_code_pin: code_pin,
    })
    if (error) throw error

    if (!rows || rows.length === 0) {
      // Même réponse pour mauvais PIN / entreprise inconnue / rate-limit
      return new Response(JSON.stringify({ results: [] }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const first = rows[0]

    // ── JWT signé avec le secret du projet (accepté par PostgREST) ──
    const secret = Deno.env.get('JWT_SECRET')
    if (!secret) throw new Error('Secret JWT_SECRET non configuré (Edge Functions → Secrets)')

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    )

    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        // 'authenticated' → PostgREST applique les politiques RLS "authenticated"
        role: 'authenticated',
        sub: first.personne_id,
        // Claims métier lus par les politiques RLS
        app_role: first.role,
        entreprise_id: first.entreprise_id,
        personne_nom: `${first.prenom ?? ''} ${first.nom}`.trim(),
        exp: getNumericDate(12 * 60 * 60), // 12 h — aligné sur la session app
      },
      key
    )

    return new Response(JSON.stringify({ token, results: rows }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[login]', e)
    return new Response(JSON.stringify({ error: 'Erreur interne' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
