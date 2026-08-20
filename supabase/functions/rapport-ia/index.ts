// ═══════════════════════════════════════════════════════════
// RAPPORT-IA — synthèse rédigée par Claude (Anthropic)
//
// Reçoit les données déjà agrégées par l'app (rapport du jour
// ou hebdo) et renvoie une synthèse professionnelle en français,
// prête à être envoyée au client / à la direction.
//
// Déploiement : Edge Functions → Deploy new function
//   nom : rapport-ia (minuscules) · Verify JWT : OFF
// Secrets requis :
//   ANTHROPIC_API_KEY  = ta clé console.anthropic.com
//   ANTHROPIC_MODEL    = (optionnel) défaut claude-sonnet-4-5
// ═══════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Secret ANTHROPIC_API_KEY manquant' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5'

    const { type, chantier, periode, donnees } = await req.json() as {
      type: 'jour' | 'hebdo'
      chantier: string
      periode: string
      donnees: unknown
    }
    if (!type || !donnees) {
      return new Response(JSON.stringify({ error: 'Payload incomplet (type, donnees)' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    console.log(`[rapport-ia] type=${type} chantier="${chantier}" periode="${periode}"`)

    const consigne = type === 'jour'
      ? `Rédige la SYNTHÈSE DU JOUR de ce chantier (150-220 mots max), en 3 parties courtes :
1. "Résumé" — l'essentiel de la journée en 2-3 phrases (personnel, production, ambiance générale du chantier déduite des chiffres).
2. "Points de vigilance" — blocages, retards, effectifs manquants, réserves. Hiérarchise : le plus critique d'abord. S'il n'y a rien, dis-le en une phrase.
3. "Décisions attendues" — reprends les décisions en attente, en une ligne chacune, avec le destinataire (chef de chantier ou chargé d'affaires).`
      : `Rédige la SYNTHÈSE HEBDOMADAIRE de ce chantier (200-280 mots max), en 4 parties courtes :
1. "Bilan de la semaine" — avancement, production validée, heures, effectifs, en 3-4 phrases.
2. "Fiabilité du planning" — commente le PPC (≥80% = bon, 60-80% = à surveiller, <60% = dérive) et ce qu'il signifie concrètement.
3. "Points de vigilance" — blocages, zones en retard, dérives montage→isolation. Hiérarchise.
4. "Priorités semaine prochaine" — 2-3 recommandations concrètes déduites des données.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: `Tu es un directeur de travaux CVC (ventilation) expérimenté en Suisse romande. Tu rédiges des synthèses de chantier factuelles, professionnelles et directes, destinées au client et à la direction. Règles strictes :
- Uniquement des faits présents dans les données fournies — n'invente RIEN, aucun chiffre qui n'y figure pas.
- Français professionnel, phrases courtes, vouvoiement implicite (pas de "je"/"tu").
- Titres de sections en gras markdown (**Titre**), pas de listes à puces sauf pour les décisions/priorités.
- Si une donnée est vide ou absente, ne pas la mentionner (sauf si son absence est un problème, ex : effectifs non déclarés).`,
        messages: [{
          role: 'user',
          content: `Chantier : ${chantier ?? '?'} — Période : ${periode ?? '?'}

${consigne}

DONNÉES DU CHANTIER (JSON) :
${JSON.stringify(donnees, null, 1)}`,
        }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error(`[rapport-ia] Anthropic HTTP ${res.status} : ${detail.slice(0, 300)}`)
      return new Response(JSON.stringify({ error: `API Anthropic : HTTP ${res.status}` }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const json = await res.json() as { content?: { type: string; text?: string }[] }
    const texte = (json.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim()
    console.log(`[rapport-ia] synthèse générée (${texte.length} caractères)`)

    return new Response(JSON.stringify({ texte }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[rapport-ia]', e)
    return new Response(JSON.stringify({ error: 'Erreur interne rapport-ia' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
