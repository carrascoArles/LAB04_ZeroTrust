"""Genera el diagrama de arquitectura Zero Trust de AQP-SOLIDARIA (PNG y SVG).

Uso: python docs/architecture/build_diagram.py
Requiere matplotlib. Los componentes reflejan infra/template.yaml.
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.image as mpimg
import matplotlib.pyplot as plt
from matplotlib.offsetbox import AnnotationBbox, OffsetImage
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

HERE = Path(__file__).parent
plt.rcParams["font.family"] = ["Calibri", "Carlito", "DejaVu Sans"]
plt.rcParams["svg.fonttype"] = "none"

RED, BLUE, ORANGE, GREEN, GREY, YELLOW = (
    ("#FDECEA", "#C8310E"),
    ("#E8F1FB", "#2F6DB5"),
    ("#FFF4E0", "#C77700"),
    ("#E9F6EC", "#2E8B57"),
    ("#F2F4F7", "#667085"),
    ("#FFFBE6", "#A58A00"),
)
INK = "#1D2939"

fig, ax = plt.subplots(figsize=(11, 11.2))
ax.set_xlim(0, 110)
ax.set_ylim(0, 112)
ax.axis("off")


def zone(x, y, w, h, colors, title, dashed=False):
    fill, edge = colors
    ax.add_patch(
        FancyBboxPatch(
            (x, y), w, h, boxstyle="round,pad=0,rounding_size=1.2",
            fc=fill, ec=edge, lw=1.5, ls="--" if dashed else "-", zorder=1,
        )
    )
    ax.text(x + 1.2, y + h - 1.0, title, fontsize=10.5, fontweight="bold",
            color=edge, va="top", zorder=3)


def icon(name, x, y, zoom=0.3):
    img = mpimg.imread(HERE / "icons" / f"{name}.png")
    box = OffsetImage(img, zoom=zoom * 256 / img.shape[0])
    ax.add_artist(AnnotationBbox(box, (x, y), frameon=False, zorder=4))


def label(x, y, text, size=9.5, weight="normal", color=INK, ha="center"):
    ax.text(x, y, text, fontsize=size, fontweight=weight, color=color,
            ha=ha, va="top", linespacing=1.15, zorder=5)


def arrow(a, b, text=None, at=None, color=INK, dashed=False, rad=0.0, ha="center"):
    ax.add_patch(
        FancyArrowPatch(
            a, b, arrowstyle="-|>", mutation_scale=13, lw=1.4, color=color,
            ls="--" if dashed else "-", connectionstyle=f"arc3,rad={rad}", zorder=6,
        )
    )
    if text:
        x, y = at or ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        ax.text(x, y, text, fontsize=8.8, color=color, ha=ha, va="center", zorder=7,
                linespacing=1.1,
                bbox=dict(fc="white", ec="none", pad=1.2, alpha=0.95))


# --- Zona no confiable -------------------------------------------------------
zone(32, 92, 44, 19, RED, "ZONA NO CONFIABLE: navegador del usuario")
icon("users", 41, 102.5, 0.17)
label(41, 98.2, "Visitante · Donante\nGestor · Auditor")
ax.add_patch(FancyBboxPatch((52, 96.5), 21, 9.5, boxstyle="round,pad=0,rounding_size=0.8",
                            fc="white", ec=RED[1], lw=1.1, zorder=3))
label(62.5, 105.2, "SPA React", weight="bold")
label(62.5, 102.6, "tokens solo en memoria\nsin secretos ni credenciales")
arrow((47.5, 101.5), (52, 101.5))

# --- PA ----------------------------------------------------------------------
zone(82, 87, 27, 24, BLUE, "PA: Policy Administrator")
icon("cognito", 95.5, 102, 0.2)
label(95.5, 97.0, "Amazon Cognito", weight="bold")
label(95.5, 94.7, "Auth Code + PKCE · MFA TOTP\naccess token ≤ 15 min\nrefresh token revocable")

# --- Frontend ----------------------------------------------------------------
zone(1, 62, 26, 49, GREY, "ENTREGA DEL FRONTEND")
icon("cloudfront", 14, 100, 0.2)
label(14, 95.0, "CloudFront", weight="bold")
label(14, 92.7, "PEP del frontend\nHTTPS · HSTS · CSP")
icon("s3", 14, 77.5, 0.2)
label(14, 72.5, "S3 privado", weight="bold")
label(14, 70.2, "SPA compilada\nsin acceso público")

# --- PEP ---------------------------------------------------------------------
zone(32, 66, 77, 16, ORANGE, "PEP: Policy Enforcement Point")
icon("apigw", 42, 72.8, 0.19)
label(53, 77.2, "API Gateway HTTP API + JWT authorizer", weight="bold", ha="left")
label(53, 74.6, "valida emisor, firma, expiración, client_id y scope por ruta\n"
                "un ID token o token alterado responde 401 · throttling por stage", ha="left")

# --- Lambda / PE -------------------------------------------------------------
zone(32, 33, 54, 27, GREEN, "CÓMPUTO: 10 funciones Lambda (Node.js 24)")
icon("lambda", 41, 49, 0.2)
label(50, 55, "1 función y 1 rol IAM por endpoint", weight="bold", ha="left")
label(50, 52.5, "projects: list · get · stats · create · publish\n"
                "donations: create · simulate · me · get\n"
                "audit: list (extensión)", ha="left")
ax.add_patch(FancyBboxPatch((34, 34.8), 50, 7.4, boxstyle="round,pad=0,rounding_size=0.8",
                            fc="white", ec=GREEN[1], lw=1.2, zorder=3))
label(59, 41.4, "PE: Policy Engine · módulo authz", weight="bold", color=GREEN[1])
label(59, 38.9, "decide rol (cognito:groups) y propietario (sub) en cada solicitud")

# --- Telemetría ---------------------------------------------------------------
zone(90, 12, 19, 48, GREY, "TELEMETRÍA")
icon("cloudwatch", 99.5, 47.5, 0.17)
label(99.5, 43.5, "CloudWatch Logs", weight="bold")
label(99.5, 41.2, "JSON con requestId\nretención 14 días")
icon("cloudtrail", 99.5, 27.5, 0.17)
label(99.5, 23.5, "CloudTrail", weight="bold")
label(99.5, 21.2, "cambios de\ninfraestructura")

# --- Datos -------------------------------------------------------------------
zone(32, 7, 54, 21, BLUE, "DATOS: Amazon DynamoDB (on-demand)")
icon("dynamodb", 41, 15.5, 0.2)
label(50, 22.5, "Projects · Donations", ha="left", weight="bold")
label(50, 20.0, "Idempotency (TTL 24 h) · AuditEvents", ha="left", weight="bold")
label(50, 17.2, "TransactWriteItems condicionado:\nuna confirmación cuenta una sola vez", ha="left")

# --- Despliegue --------------------------------------------------------------
zone(1, 7, 26, 49, YELLOW, "DESPLIEGUE Y CALIDAD")
icon("sam", 14, 44.5, 0.19)
label(14, 39.6, "AWS SAM / CloudFormation", weight="bold")
label(14, 37.3, "infra/template.yaml\ndefine toda la pila")
icon("iam", 14, 25.5, 0.17)
label(14, 21.5, "IAM", weight="bold")
label(14, 19.2, "rol mínimo por función\nsin comodines")
label(14, 13.5, "GitHub Actions: lint, typecheck,\ntests, build y cfn-lint", size=9)

# --- Flujos ------------------------------------------------------------------
arrow((36.5, 102.5), (20.5, 101))
label(14, 107.6, "1. descarga la SPA (HTTPS)", size=8.8)
arrow((14, 88.5), (14, 82.2), "OAC", at=(17.5, 85.5))
arrow((73, 101), (86, 101), "2. login", at=(79, 103))
arrow((86, 97), (73, 97), "tokens", at=(79, 95))
arrow((62, 96.5), (62, 82), "3. Bearer access token", at=(62, 88))
arrow((95.5, 87), (95.5, 82), "JWKS", at=(100.5, 84.5), dashed=True, color=BLUE[1])
arrow((59, 66), (59, 60))
ax.text(60.5, 63, "4. solo si el token es válido: claims verificados", fontsize=8.8, color=INK, va="center", zorder=7)
arrow((59, 33), (59, 28))
ax.text(60.5, 30.5, "5. con el rol IAM de esa función", fontsize=8.8, color=INK, va="center", zorder=7)
arrow((86, 47), (90, 47))
ax.text(88, 48.6, "logs", fontsize=8.4, ha="center", color=INK, zorder=7)
arrow((104.5, 66), (104.5, 60), dashed=True)
ax.text(103.2, 63, "logs de acceso", fontsize=8.8, ha="right", va="center", color=INK, zorder=7)
arrow((27, 42), (32, 45), dashed=True, color=YELLOW[1])
ax.text(29.5, 47.5, "define", fontsize=8.8, ha="center", color=YELLOW[1], zorder=7)

ax.text(1, 3.2, "Fuera de alcance (declarado): postura de dispositivo, Verified Access, GuardDuty y Security Hub. "
                "Extensión opcional: Verified Permissions + Cedar como PE externo (HU-12).",
        fontsize=9, color="#475467", va="center")

fig.savefig(HERE / "zta-architecture.png", dpi=200, bbox_inches="tight", facecolor="white")
fig.savefig(HERE / "zta-architecture.svg", bbox_inches="tight", facecolor="white")
print("Diagrama generado")
