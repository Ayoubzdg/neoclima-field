"""
Neoclima Field — Microservice génération rapport client
FastAPI · déployable Railway / Render / VPS
"""
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional
from gen_rapport import generate_rapport

app = FastAPI(
    title="Neoclima Rapport Service",
    description="Génération PPTX rapport client maître d'ouvrage",
    version="1.0.0",
)

# CORS — autorise l'app Neoclima Field + localhost dev
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schémas Pydantic ──────────────────────────────────────────

class ProjectInfo(BaseModel):
    nom: str
    client: str
    adresse: Optional[str] = None
    semaine: str                          # "Semaine 14 — du 31 mars au 4 avril 2025"
    date: Optional[str] = None           # auto si absent
    statut_global: str = "SOUS SURVEILLANCE"  # MAÎTRISÉ | SOUS SURVEILLANCE | CRITIQUE
    avancement_global: int = Field(ge=0, le=100)
    semaines_restantes: int = 0
    phrase: Optional[str] = None


class Zone(BaseModel):
    batiment: str
    niveau: str
    avancement: int = Field(ge=0, le=100)
    statut: str = "amber"                # green | amber | red | grey
    commentaire: Optional[str] = ""


class Equipe(BaseModel):
    nom: str
    effectif: int
    type: str = "Interne"                # Interne | Sous-traitant
    secteurs: Optional[str] = ""


class Vigilance(BaseModel):
    zone: str
    sujet: str
    action: str
    impact: str


class Etape(BaseModel):
    date: str
    titre: str
    detail: str


class RapportRequest(BaseModel):
    project: ProjectInfo
    zones: list[Zone] = []
    equipes: list[Equipe] = []
    vigilances: list[Vigilance] = []
    prochaines_etapes: list[Etape] = []
    faits_marquants: list[str] = []


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "neoclima-rapport", "ts": datetime.utcnow().isoformat()}


@app.post("/generate")
async def generate(req: RapportRequest):
    """
    Génère le rapport client PPTX.
    Retourne le fichier en binaire (application/vnd.openxmlformats…).
    """
    try:
        # Auto-date si non fournie
        data = req.model_dump()
        if not data["project"].get("date"):
            data["project"]["date"] = datetime.now().strftime("%d %B %Y")

        # Phrase par défaut
        if not data["project"].get("phrase"):
            data["project"]["phrase"] = (
                "Le chantier progresse conformément aux objectifs. "
                "Le planning de référence est maintenu."
            )

        pptx_bytes = generate_rapport(data)

        nom_safe = data["project"]["nom"].replace(" ", "_").replace("/", "-")[:40]
        filename = f"Neoclima_Rapport_{nom_safe}.pptx"

        return Response(
            content=pptx_bytes,
            media_type=(
                "application/vnd.openxmlformats-officedocument"
                ".presentationml.presentation"
            ),
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Generated-At": datetime.utcnow().isoformat(),
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération : {str(e)}")


@app.post("/generate/pdf")
async def generate_pdf(req: RapportRequest):
    """
    Génère le rapport en PDF (nécessite LibreOffice installé sur le serveur).
    """
    import subprocess, tempfile, pathlib

    data = req.model_dump()
    if not data["project"].get("date"):
        data["project"]["date"] = datetime.now().strftime("%d %B %Y")
    if not data["project"].get("phrase"):
        data["project"]["phrase"] = "Le chantier progresse conformément aux objectifs."

    try:
        pptx_bytes = generate_rapport(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur PPTX : {str(e)}")

    with tempfile.TemporaryDirectory() as tmp:
        pptx_path = pathlib.Path(tmp) / "rapport.pptx"
        pdf_path  = pathlib.Path(tmp) / "rapport.pdf"
        pptx_path.write_bytes(pptx_bytes)

        result = subprocess.run(
            ["soffice", "--headless", "--convert-to", "pdf",
             "--outdir", tmp, str(pptx_path)],
            capture_output=True, timeout=60
        )
        if result.returncode != 0 or not pdf_path.exists():
            raise HTTPException(status_code=500, detail="Échec conversion PDF (LibreOffice)")

        pdf_bytes = pdf_path.read_bytes()

    nom_safe = data["project"]["nom"].replace(" ", "_").replace("/", "-")[:40]
    filename = f"Neoclima_Rapport_{nom_safe}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
