"""
Neoclima Field — Moteur de génération PPTX dynamique
Rapport client maître d'ouvrage — design exécutif premium
"""
import io
from itertools import groupby
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── Palette ───────────────────────────────────────────────────
DARK    = RGBColor(0x0F, 0x17, 0x22)
NAVY    = RGBColor(0x1A, 0x26, 0x38)
NC_BLUE = RGBColor(0x2C, 0x3E, 0x50)
NC_RED  = RGBColor(0xC0, 0x39, 0x2B)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT   = RGBColor(0xF1, 0xF5, 0xF9)
GREY    = RGBColor(0x64, 0x74, 0x8B)
GREEN   = RGBColor(0x05, 0x96, 0x69)
AMBER   = RGBColor(0xD9, 0x77, 0x06)
RED_VIG = RGBColor(0xDC, 0x26, 0x26)
SILVER  = RGBColor(0x94, 0xA3, 0xB8)
BLUE_KPI = RGBColor(0x1D, 0x4E, 0xD8)
PALE    = RGBColor(0xF8, 0xFA, 0xFC)
BORDER  = RGBColor(0xE2, 0xE8, 0xF0)
BAR_BG  = RGBColor(0xE2, 0xE8, 0xF0)

STATUS_COLORS = {
    "green":  GREEN,
    "amber":  AMBER,
    "red":    RED_VIG,
    "grey":   RGBColor(0xCB, 0xD5, 0xE1),
}

STATUT_GLOBAL_COLORS = {
    "MAÎTRISÉ":        GREEN,
    "SOUS SURVEILLANCE": AMBER,
    "CRITIQUE":        RED_VIG,
}

LOGO_PATH = os.path.join(os.path.dirname(__file__), "logo.png")  # monté dans Railway via var d'env ou inclus dans le build

# ── Helpers ───────────────────────────────────────────────────

def rect(sl, x, y, w, h, fill, line_color=None, line_width=0):
    s = sl.shapes.add_shape(1, x, y, w, h)
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    if line_color:
        s.line.color.rgb = line_color
        s.line.width = Pt(line_width)
    else:
        s.line.fill.background()
    return s


def txt(sl, text, x, y, w, h, size=12, color=WHITE, bold=False,
        align=PP_ALIGN.LEFT, italic=False, wrap=True):
    tb = sl.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = str(text)
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.bold = bold
    run.font.italic = italic
    run.font.name = 'Arial'
    return tb


def logo_white(sl, x, y, h_inch):
    import os
    logo = os.environ.get("LOGO_PATH", LOGO_PATH)
    try:
        img = Image.open(logo).convert("RGBA")
        r, g, b, a = img.split()
        r = r.point(lambda v: 255 - v)
        g = g.point(lambda v: 255 - v)
        b = b.point(lambda v: 255 - v)
        white = Image.merge("RGBA", (r, g, b, a))
        buf = io.BytesIO()
        white.save(buf, format="PNG")
        buf.seek(0)
        ratio = img.width / img.height
        sl.shapes.add_picture(buf, x, y, height=Inches(h_inch),
                              width=Inches(h_inch * ratio))
    except Exception:
        txt(sl, "NEOCLIMA", x, y, Inches(3), Inches(h_inch),
            size=18, bold=True, color=WHITE)


def slide_header(sl, title, subtitle, W, H, dark=True):
    bg = DARK if dark else NAVY
    rect(sl, 0, 0, W, Inches(1.15), bg)
    rect(sl, 0, 0, Inches(0.06), Inches(1.15), NC_RED)
    logo_white(sl, Inches(0.25), Inches(0.25), 0.52)
    txt(sl, title, Inches(2.2), Inches(0.20), W - Inches(2.4), Inches(0.55),
        size=20, bold=True, color=WHITE)
    txt(sl, subtitle, Inches(2.2), Inches(0.70), W - Inches(2.4), Inches(0.35),
        size=11, color=SILVER)


def footer(sl, date_str, W, H):
    rect(sl, 0, H - Inches(0.28), W, Inches(0.28), NAVY)
    txt(sl, f"Neoclima   ·   Rapport d'avancement   ·   {date_str}   ·   CONFIDENTIEL",
        Inches(0.4), H - Inches(0.265), W - Inches(0.8), Inches(0.24),
        size=7.5, color=SILVER, align=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════
# POINT D'ENTRÉE PRINCIPAL
# ═══════════════════════════════════════════════════════════════

def generate_rapport(data: dict) -> bytes:
    """
    Génère le rapport PPTX et retourne les bytes.

    data = {
      "project": {
        "nom": str,              # Nom du chantier
        "client": str,           # Destinataire / MO
        "semaine": str,          # "Semaine 14 — du 31 mars au 4 avril 2025"
        "date": str,             # "04 avril 2025"
        "statut_global": str,    # "MAÎTRISÉ" | "SOUS SURVEILLANCE" | "CRITIQUE"
        "avancement_global": int,# 0-100
        "semaines_restantes": int,
        "phrase": str,           # Résumé en 1 phrase
      },
      "zones": [
        {"batiment": str, "niveau": str, "avancement": int,
         "statut": "green|amber|red|grey", "commentaire": str}
      ],
      "equipes": [
        {"nom": str, "effectif": int, "type": "Interne|Sous-traitant", "secteurs": str}
      ],
      "vigilances": [
        {"zone": str, "sujet": str, "action": str, "impact": str}
      ],
      "prochaines_etapes": [
        {"date": str, "titre": str, "detail": str}
      ],
      "faits_marquants": [str],   # optionnel, généré si absent
    }
    """
    P = data["project"]
    zones = data.get("zones", [])
    equipes = data.get("equipes", [])
    vigilances = data.get("vigilances", [])
    etapes = data.get("prochaines_etapes", [])
    statut_color = STATUT_GLOBAL_COLORS.get(P.get("statut_global", "SOUS SURVEILLANCE"), AMBER)

    # Auto-génère les faits marquants si non fournis
    faits = data.get("faits_marquants", [])
    if not faits:
        done_zones = [z for z in zones if z["avancement"] == 100]
        prog_zones = [z for z in zones if 0 < z["avancement"] < 100]
        for z in done_zones[:2]:
            faits.append(f"✓  {z['batiment']} {z['niveau']} — {z.get('commentaire', 'Réceptionné sans réserve.')}")
        for z in prog_zones[:2]:
            faits.append(f"◎  {z['batiment']} {z['niveau']} à {z['avancement']}% — {z.get('commentaire', 'En cours.')}")

    prs = Presentation()
    prs.slide_width  = Inches(13.333)
    prs.slide_height = Inches(7.5)
    W = prs.slide_width
    H = prs.slide_height

    # ─────────────────────────────────────────────────────────
    # SLIDE 1 — COUVERTURE
    # ─────────────────────────────────────────────────────────
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    rect(sl, 0, 0, W, H, DARK)
    rect(sl, 0, 0, Inches(0.06), H, NC_RED)
    rect(sl, Inches(0.06), 0, Inches(5.1), H, NAVY)
    rect(sl, Inches(5.16), 0, W - Inches(5.16), H, DARK)

    logo_white(sl, Inches(0.3), Inches(0.4), 0.65)
    rect(sl, Inches(0.3), Inches(3.35), Inches(3.5), Pt(2), NC_RED)

    txt(sl, "RAPPORT", Inches(0.3), Inches(1.4), Inches(4.8), Inches(0.55),
        size=11, color=SILVER)
    txt(sl, "D'AVANCEMENT", Inches(0.3), Inches(1.9), Inches(4.8), Inches(0.55),
        size=11, color=SILVER)
    txt(sl, P["nom"], Inches(0.3), Inches(2.15), Inches(4.7), Inches(1.1),
        size=22, bold=True, color=WHITE, wrap=True)
    txt(sl, P["semaine"], Inches(0.3), Inches(3.5), Inches(4.7), Inches(0.4),
        size=11, color=SILVER)
    txt(sl, f"Émis le {P['date']}", Inches(0.3), Inches(3.95), Inches(4.7), Inches(0.38),
        size=10, color=SILVER, italic=True)
    txt(sl, f"Destinataire : {P['client']}", Inches(0.3), Inches(4.4),
        Inches(4.7), Inches(0.38), size=10, color=SILVER)

    rect(sl, Inches(0.3), Inches(5.1), Inches(2.5), Inches(0.48), statut_color)
    txt(sl, "● " + P["statut_global"], Inches(0.3), Inches(5.12),
        Inches(2.5), Inches(0.46), size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

    # Grand % à droite
    txt(sl, f"{P['avancement_global']}%",
        Inches(6.0), Inches(1.5), Inches(5.0), Inches(2.5),
        size=110, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    txt(sl, "D'AVANCEMENT GLOBAL", Inches(5.8), Inches(4.05), Inches(5.5), Inches(0.5),
        size=13, color=SILVER, align=PP_ALIGN.CENTER)

    bw = Inches(5.5); bx = Inches(5.9); by = Inches(4.65); bh = Inches(0.12)
    rect(sl, bx, by, bw, bh, RGBColor(0x2A, 0x3A, 0x50))
    rect(sl, bx, by, int(bw * P["avancement_global"] / 100), bh, GREEN)

    sr = P.get("semaines_restantes", 0)
    txt(sl, f"{sr} semaine{'s' if sr != 1 else ''} restante{'s' if sr != 1 else ''}",
        Inches(5.8), Inches(4.88), Inches(5.5), Inches(0.4),
        size=12, color=SILVER, align=PP_ALIGN.CENTER)

    rect(sl, 0, H - Inches(0.35), W, Inches(0.35), RGBColor(0x0A, 0x10, 0x18))
    txt(sl, "CONFIDENTIEL — Usage exclusif du destinataire   ·   Neoclima SA",
        Inches(0.5), H - Inches(0.33), Inches(9), Inches(0.3),
        size=8, color=SILVER, italic=True)
    txt(sl, P["date"], W - Inches(2.0), H - Inches(0.33), Inches(1.8), Inches(0.3),
        size=8, color=SILVER, align=PP_ALIGN.RIGHT)

    # ─────────────────────────────────────────────────────────
    # SLIDE 2 — SYNTHÈSE EXÉCUTIVE
    # ─────────────────────────────────────────────────────────
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    rect(sl, 0, 0, W, H, LIGHT)
    slide_header(sl, "SYNTHÈSE EXÉCUTIVE", P["semaine"], W, H, dark=False)

    rect(sl, Inches(0.4), Inches(1.3), W - Inches(0.8), Inches(0.85), statut_color)
    rect(sl, Inches(0.4), Inches(1.3), Inches(0.08), Inches(0.85), RGBColor(0, 0, 0))
    phrase = P.get("phrase", "Le chantier progresse conformément au planning.")
    txt(sl, f"STATUT GLOBAL : {P['statut_global']}   ·   {phrase}",
        Inches(0.6), Inches(1.38), W - Inches(1.2), Inches(0.65),
        size=11.5, bold=True, color=WHITE, wrap=True)

    total_eff = sum(e.get("effectif", 0) for e in equipes)
    total_prev = max(total_eff, 1)
    nb_vig = len(vigilances)
    kpis = [
        (f"{P['avancement_global']}%", "Avancement\nglobal", NAVY,
         "●  En progression cette semaine"),
        (f"{total_eff}", "Intervenants\nsur site", BLUE_KPI,
         "●  Présence mobilisée"),
        (f"{nb_vig}", "Points de\nvigilance", AMBER if nb_vig > 0 else GREEN,
         "●  Actions en cours" if nb_vig > 0 else "●  Aucun point ouvert"),
        ("0", "Réserves\nblocantes", GREEN,
         "●  Aucune réserve critique"),
    ]
    for i, (val, label, color, note) in enumerate(kpis):
        kx = Inches(0.4) + i * Inches(3.2)
        ky = Inches(2.35)
        rect(sl, kx, ky, Inches(3.0), Inches(2.0), WHITE, line_color=BORDER, line_width=1)
        rect(sl, kx, ky, Inches(3.0), Inches(0.06), color)
        txt(sl, val, kx, ky + Inches(0.15), Inches(3.0), Inches(1.0),
            size=46, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
        txt(sl, label, kx, ky + Inches(1.1), Inches(3.0), Inches(0.5),
            size=10, color=GREY, align=PP_ALIGN.CENTER, wrap=True)
        txt(sl, note, kx + Inches(0.15), ky + Inches(1.6), Inches(2.7), Inches(0.35),
            size=8.5, color=color, italic=True)

    rect(sl, Inches(0.4), Inches(4.55), W - Inches(0.8), Inches(0.04), BORDER)
    txt(sl, "FAITS MARQUANTS DE LA SEMAINE", Inches(0.4), Inches(4.7),
        Inches(6), Inches(0.35), size=9, bold=True, color=GREY)

    fy = Inches(5.1)
    for fact in faits[:5]:
        col = GREEN if str(fact).startswith("✓") else AMBER
        rect(sl, Inches(0.4), fy, Inches(0.04), Inches(0.32), col)
        txt(sl, fact, Inches(0.55), fy, W - Inches(1.0), Inches(0.32),
            size=10.5, color=NAVY, wrap=False)
        fy += Inches(0.37)

    footer(sl, P["date"], W, H)

    # ─────────────────────────────────────────────────────────
    # SLIDE 3 — VUE VISUELLE PAR ZONE
    # ─────────────────────────────────────────────────────────
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    rect(sl, 0, 0, W, H, LIGHT)
    slide_header(sl, "VUE D'ENSEMBLE — AVANCEMENT PAR ZONE",
                 f"État au {P['date']}", W, H, dark=True)

    # Légende
    leg_x = Inches(10.5); leg_y = Inches(1.3)
    txt(sl, "LÉGENDE", leg_x, leg_y, Inches(3.0), Inches(0.3),
        size=8.5, bold=True, color=GREY)
    for i, (col, lbl) in enumerate([
        (GREEN, "Terminé"), (AMBER, "En cours"),
        (RED_VIG, "Vigilance"), (RGBColor(0xCB, 0xD5, 0xE1), "Planifié"),
    ]):
        rect(sl, leg_x, leg_y + Inches(0.38 + i * 0.32), Inches(0.22), Inches(0.22), col)
        txt(sl, lbl, leg_x + Inches(0.32), leg_y + Inches(0.38 + i * 0.32),
            Inches(2.0), Inches(0.22), size=9, color=NAVY)

    # Groupe les zones par batiment
    groups: dict[str, list] = {}
    for z in zones:
        bat = z.get("batiment", "Zone")
        groups.setdefault(bat, []).append(z)

    bat_names = list(groups.keys())[:3]
    col_w = Inches(3.6)
    col_gap = Inches(0.3)
    start_x = Inches(0.4)

    for gi, bat in enumerate(bat_names):
        bx = start_x + gi * (col_w + col_gap)
        by_start = Inches(1.35)
        rect(sl, bx, by_start, col_w, Inches(0.42), NAVY)
        txt(sl, bat.upper(), bx + Inches(0.15), by_start + Inches(0.08),
            col_w - Inches(0.3), Inches(0.32), size=11, bold=True, color=WHITE)

        for j, z in enumerate(groups[bat][:5]):
            zy = by_start + Inches(0.42 + j * 0.95)
            bg = WHITE if j % 2 == 0 else PALE
            rect(sl, bx, zy, col_w, Inches(0.87), bg, line_color=BORDER, line_width=0.5)
            # Tag niveau
            rect(sl, bx, zy, Inches(0.62), Inches(0.87), NAVY)
            lvl = z.get("niveau", "?")
            txt(sl, lvl, bx, zy, Inches(0.62), Inches(0.87),
                size=9, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
            # Barre progress
            pct = z.get("avancement", 0)
            bar_color = STATUS_COLORS.get(z.get("statut", "amber"), AMBER)
            bar_x = bx + Inches(0.72)
            bar_y = zy + Inches(0.22)
            bar_w = col_w - Inches(1.1)
            bar_h = Inches(0.26)
            rect(sl, bar_x, bar_y, bar_w, bar_h, BAR_BG)
            if pct > 0:
                rect(sl, bar_x, bar_y, int(bar_w * pct / 100), bar_h, bar_color)
            txt(sl, f"{pct}%", bar_x + bar_w + Inches(0.06), bar_y,
                Inches(0.38), bar_h, size=8.5, bold=True, color=bar_color)
            cmt = z.get("commentaire", "")[:45]
            txt(sl, cmt, bx + Inches(0.72), zy + Inches(0.54),
                col_w - Inches(0.82), Inches(0.26), size=7.5, color=GREY, italic=True)

    footer(sl, P["date"], W, H)

    # ─────────────────────────────────────────────────────────
    # SLIDE 4 — TABLEAU AVANCEMENT DÉTAILLÉ
    # ─────────────────────────────────────────────────────────
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    rect(sl, 0, 0, W, H, LIGHT)
    slide_header(sl, "AVANCEMENT DÉTAILLÉ PAR ZONE",
                 f"Tableau de suivi — {P['date']}", W, H, dark=False)

    STATUS_LABELS = {
        "green": ("✓ Terminé", GREEN),
        "amber": ("◎ En cours", AMBER),
        "red":   ("⚠ Vigilance", RED_VIG),
        "grey":  ("○ Planifié", GREY),
    }

    # En-tête tableau
    cols = ["BÂTIMENT", "ZONE / NIVEAU", "AVANCEMENT", "STATUT", "COMMENTAIRE"]
    col_ws = [Inches(1.6), Inches(1.5), Inches(1.4), Inches(1.6), Inches(6.0)]
    tx = Inches(0.35); ty = Inches(1.3); row_h = Inches(0.38)

    cx = tx
    for col_name, cw in zip(cols, col_ws):
        rect(sl, cx, ty, cw, row_h, NAVY)
        txt(sl, col_name, cx + Inches(0.08), ty + Inches(0.08), cw, row_h,
            size=9, bold=True, color=WHITE)
        cx += cw

    # Lignes données
    for ri, z in enumerate(zones[:13]):
        ry = ty + row_h + ri * row_h
        bg = WHITE if ri % 2 == 0 else PALE
        cx = tx
        for ci, (val, cw) in enumerate(zip([
            z.get("batiment", ""),
            z.get("niveau", ""),
            f"{z.get('avancement', 0)}%",
            "",
            z.get("commentaire", ""),
        ], col_ws)):
            rect(sl, cx, ry, cw, row_h, bg, line_color=BORDER, line_width=0.3)

            if ci == 2:  # Avancement — mini barre
                pct = z.get("avancement", 0)
                bar_color = STATUS_COLORS.get(z.get("statut", "amber"), AMBER)
                bbar_x = cx + Inches(0.08); bbar_y = ry + Inches(0.1)
                bbar_w = cw - Inches(0.55); bbar_h = Inches(0.18)
                rect(sl, bbar_x, bbar_y, bbar_w, bbar_h, BAR_BG)
                if pct > 0:
                    rect(sl, bbar_x, bbar_y, int(bbar_w * pct / 100), bbar_h, bar_color)
                txt(sl, f"{pct}%", bbar_x + bbar_w + Inches(0.05), ry + Inches(0.06),
                    Inches(0.35), row_h, size=8, bold=True, color=bar_color)
            elif ci == 3:  # Badge statut
                st = z.get("statut", "amber")
                badge_lbl, badge_col = STATUS_LABELS.get(st, ("◎ En cours", AMBER))
                bw_b = cw - Inches(0.15)
                rect(sl, cx + Inches(0.08), ry + Inches(0.07), bw_b, Inches(0.24), badge_col)
                txt(sl, badge_lbl, cx + Inches(0.08), ry + Inches(0.07), bw_b, Inches(0.24),
                    size=8, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
            else:
                txt(sl, str(val), cx + Inches(0.08), ry + Inches(0.09),
                    cw - Inches(0.12), row_h, size=9, color=NAVY)
            cx += cw

    footer(sl, P["date"], W, H)

    # ─────────────────────────────────────────────────────────
    # SLIDE 5 — ACTIVITÉ CHANTIER
    # ─────────────────────────────────────────────────────────
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    rect(sl, 0, 0, W, H, LIGHT)
    slide_header(sl, "ACTIVITÉ CHANTIER", "Mobilisation & dynamique terrain", W, H, dark=True)

    total_eff = sum(e.get("effectif", 0) for e in equipes)
    internes = sum(e.get("effectif", 0) for e in equipes if e.get("type") == "Interne")
    st_pct = round((total_eff - internes) / total_eff * 100) if total_eff else 0
    int_pct = 100 - st_pct

    # KPI grand effectif
    rect(sl, Inches(0.4), Inches(1.3), Inches(2.8), Inches(3.4), NAVY)
    txt(sl, str(total_eff), Inches(0.4), Inches(1.5), Inches(2.8), Inches(1.6),
        size=72, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    txt(sl, "INTERVENANTS\nSUR SITE", Inches(0.4), Inches(3.1), Inches(2.8), Inches(0.65),
        size=11, bold=True, color=SILVER, align=PP_ALIGN.CENTER, wrap=True)
    txt(sl, "DYNAMIQUE", Inches(0.4), Inches(3.85), Inches(2.8), Inches(0.28),
        size=8, bold=True, color=GREY, align=PP_ALIGN.CENTER)
    txt(sl, "↗  EN HAUSSE VS S-1", Inches(0.4), Inches(4.15), Inches(2.8), Inches(0.28),
        size=10, color=GREEN, bold=True, align=PP_ALIGN.CENTER)
    txt(sl, "RÉPARTITION", Inches(0.4), Inches(4.5), Inches(2.8), Inches(0.28),
        size=8, bold=True, color=GREY, align=PP_ALIGN.CENTER)
    txt(sl, f"Équipes internes — {int_pct}%", Inches(0.4), Inches(4.8),
        Inches(2.8), Inches(0.28), size=9.5, color=WHITE, align=PP_ALIGN.CENTER)
    txt(sl, f"Sous-traitants — {st_pct}%", Inches(0.4), Inches(5.1),
        Inches(2.8), Inches(0.28), size=9.5, color=SILVER, align=PP_ALIGN.CENTER)

    # Cards équipes (2 colonnes)
    eq_list = equipes[:8]
    card_w = Inches(4.9); card_h = Inches(1.3)
    cols_pos = [Inches(3.5), Inches(8.6)]
    for qi, equipe in enumerate(eq_list):
        col_idx = qi % 2
        row_idx = qi // 2
        ex = cols_pos[col_idx]
        ey = Inches(1.3) + row_idx * (card_h + Inches(0.15))
        rect(sl, ex, ey, card_w, card_h, WHITE, line_color=BORDER, line_width=1)
        rect(sl, ex, ey, Inches(0.06), card_h, NC_RED)
        txt(sl, equipe.get("nom", "Équipe"), ex + Inches(0.18), ey + Inches(0.12),
            card_w - Inches(1.2), Inches(0.4), size=11, bold=True, color=NAVY)
        eff_txt = f"{equipe.get('effectif', 0)} pers."
        txt(sl, eff_txt, ex + card_w - Inches(1.1), ey + Inches(0.12),
            Inches(1.0), Inches(0.4), size=14, bold=True, color=NC_RED, align=PP_ALIGN.RIGHT)
        type_col = NAVY if equipe.get("type") == "Interne" else AMBER
        txt(sl, equipe.get("type", "Interne"), ex + Inches(0.18), ey + Inches(0.5),
            Inches(1.5), Inches(0.28), size=9, color=type_col, bold=True)
        secteurs = equipe.get("secteurs", "")
        if secteurs:
            txt(sl, f"Secteurs : {secteurs}", ex + Inches(0.18), ey + Inches(0.78),
                card_w - Inches(0.3), Inches(0.28), size=9, color=GREY, italic=True)

    footer(sl, P["date"], W, H)

    # ─────────────────────────────────────────────────────────
    # SLIDE 6 — POINTS DE VIGILANCE
    # ─────────────────────────────────────────────────────────
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    rect(sl, 0, 0, W, H, LIGHT)
    subtitle_vig = "Suivi des situations nécessitant attention — Toutes maîtrisées" if vigilances \
        else "Aucun point de vigilance actif cette semaine"
    slide_header(sl, "POINTS DE VIGILANCE & ACTIONS EN COURS", subtitle_vig, W, H, dark=False)

    # En-tête tableau
    vig_cols = ["ZONE", "SITUATION", "ACTION EN COURS", "IMPACT PLANNING"]
    vig_ws = [Inches(2.0), Inches(3.5), Inches(4.2), Inches(3.0)]
    vx = Inches(0.35); vy = Inches(1.3)
    cvx = vx
    for cn, cw in zip(vig_cols, vig_ws):
        rect(sl, cvx, vy, cw, Inches(0.4), NC_BLUE)
        txt(sl, cn, cvx + Inches(0.1), vy + Inches(0.1), cw, Inches(0.4),
            size=9, bold=True, color=WHITE)
        cvx += cw

    for ri, v in enumerate(vigilances[:5]):
        ry = vy + Inches(0.4) + ri * Inches(0.88)
        bg = WHITE if ri % 2 == 0 else PALE
        cvx = vx
        for val, cw in zip([
            v.get("zone", ""),
            v.get("sujet", ""),
            v.get("action", ""),
            v.get("impact", ""),
        ], vig_ws):
            rect(sl, cvx, ry, cw, Inches(0.82), bg, line_color=BORDER, line_width=0.3)
            rect(sl, cvx, ry, Inches(0.06), Inches(0.82), AMBER)
            txt(sl, str(val), cvx + Inches(0.14), ry + Inches(0.1),
                cw - Inches(0.2), Inches(0.7), size=9, color=NAVY, wrap=True)
            cvx += cw

    # Conclusion
    concl_y = vy + Inches(0.4) + min(len(vigilances), 5) * Inches(0.88) + Inches(0.2)
    if concl_y < H - Inches(1.2):
        rect(sl, Inches(0.35), concl_y, W - Inches(0.7), Inches(0.06), BORDER)
        concl_text = (
            "Les points de vigilance identifiés sont activement traités. "
            "Aucun n'impacte la date de livraison contractuelle. "
            "Les solutions de continuité ont été identifiées pour chaque situation. "
            "Le planning de référence est maintenu."
        ) if vigilances else (
            "Aucun point de vigilance actif. Le chantier progresse conformément au planning."
        )
        rect(sl, Inches(0.35), concl_y + Inches(0.15), W - Inches(0.7), Inches(0.9), PALE)
        txt(sl, "ÉVALUATION GLOBALE DES RISQUES",
            Inches(0.5), concl_y + Inches(0.2), Inches(5), Inches(0.28),
            size=8.5, bold=True, color=GREY)
        txt(sl, concl_text, Inches(0.5), concl_y + Inches(0.48),
            W - Inches(0.8), Inches(0.55), size=9.5, color=NAVY, wrap=True)

    footer(sl, P["date"], W, H)

    # ─────────────────────────────────────────────────────────
    # SLIDE 7 — PROCHAINES ÉTAPES
    # ─────────────────────────────────────────────────────────
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    rect(sl, 0, 0, W, H, LIGHT)
    slide_header(sl, "PROCHAINES ÉTAPES — PLANNING 2 SEMAINES",
                 "Calendrier des actions validées", W, H, dark=True)

    # Timeline vertical
    STEP_COLORS = [NC_RED, NAVY, NC_BLUE, GREEN, AMBER]
    line_x = Inches(1.5); line_y_start = Inches(1.45); line_y_end = Inches(6.5)
    rect(sl, line_x, line_y_start, Inches(0.04), line_y_end - line_y_start, NC_RED)

    etapes_display = etapes[:5] if etapes else []
    step_h = Inches(0.95)
    max_steps = min(len(etapes_display), 5)
    spacing = (line_y_end - line_y_start - step_h) / max(max_steps - 1, 1) if max_steps > 1 else 0

    for si, e in enumerate(etapes_display):
        sy = line_y_start + si * spacing
        dot_color = STEP_COLORS[si % len(STEP_COLORS)]
        # Point sur la timeline
        rect(sl, line_x - Inches(0.12), sy + Inches(0.12),
             Inches(0.28), Inches(0.28), dot_color)
        # Date badge
        rect(sl, Inches(0.2), sy + Inches(0.08), Inches(1.1), Inches(0.32), dot_color)
        txt(sl, e.get("date", ""), Inches(0.2), sy + Inches(0.08),
            Inches(1.1), Inches(0.32), size=9.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        # Card contenu
        card_x = line_x + Inches(0.25)
        rect(sl, card_x, sy, W - card_x - Inches(0.4), step_h,
             WHITE, line_color=BORDER, line_width=0.5)
        rect(sl, card_x, sy, Inches(0.06), step_h, dot_color)
        txt(sl, e.get("titre", ""), card_x + Inches(0.18), sy + Inches(0.1),
            W - card_x - Inches(0.8), Inches(0.4),
            size=12, bold=True, color=NAVY)
        txt(sl, e.get("detail", ""), card_x + Inches(0.18), sy + Inches(0.5),
            W - card_x - Inches(0.8), Inches(0.38),
            size=9.5, color=GREY, italic=True)

    # Contact
    txt(sl, "Pour toute question relative à ce rapport :",
        Inches(0.35), H - Inches(0.85), Inches(8), Inches(0.28),
        size=8.5, color=GREY, italic=True)
    txt(sl, "Équipe Neoclima — direction.travaux@neoclima.ch   ·   +41 22 XXX XX XX",
        Inches(0.35), H - Inches(0.6), Inches(10), Inches(0.28),
        size=9.5, color=NAVY, bold=True)

    footer(sl, P["date"], W, H)

    # ── Sérialisation ──────────────────────────────────────────
    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    return buf.read()
