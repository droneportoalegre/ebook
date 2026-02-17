#!/usr/bin/env python3
from __future__ import annotations

import shutil
import xml.sax.saxutils as saxutils
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

ROOT = Path("/Users/wesleysantos/projetos/ebook")
SOURCE_MD = ROOT / "ebook-legislacao-drones-brasil-pronto-para-venda.md"
OUTPUT_PDF = ROOT / "flight-check-app/assets/Drone-Legal-Brasil-v5.pdf"
FONTS_DIR = ROOT / "fonts"


def ensure_font_file(target_name: str, system_candidates: list[Path]) -> Path:
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    target = FONTS_DIR / target_name
    if target.exists():
        return target

    for cand in system_candidates:
        if cand.exists():
            shutil.copyfile(cand, target)
            return target

    raise FileNotFoundError(f"Fonte não encontrada para {target_name}")


def ensure_fonts() -> tuple[Path, Path]:
    # Preferência DejaVu. Se não houver no sistema, usamos fontes Unicode do macOS e
    # salvamos em /fonts com os nomes esperados para manter o script idempotente.
    regular = ensure_font_file(
        "DejaVuSans.ttf",
        [
            Path("/System/Library/Fonts/Supplemental/DejaVuSans.ttf"),
            Path("/Library/Fonts/DejaVuSans.ttf"),
            Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
            Path("/Library/Fonts/Arial Unicode.ttf"),
        ],
    )
    bold = ensure_font_file(
        "DejaVuSans-Bold.ttf",
        [
            Path("/System/Library/Fonts/Supplemental/DejaVuSans-Bold.ttf"),
            Path("/Library/Fonts/DejaVuSans-Bold.ttf"),
            Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
            Path("/Library/Fonts/Arial Bold.ttf"),
        ],
    )
    return regular, bold


def build_pdf() -> None:
    texto_md = SOURCE_MD.read_text(encoding="utf-8")

    regular_font, bold_font = ensure_fonts()

    pdfmetrics.registerFont(TTFont("DejaVu", str(regular_font)))
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(bold_font)))

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        leftMargin=52,
        rightMargin=52,
        topMargin=56,
        bottomMargin=56,
        title="Drone Legal Brasil",
        author="Wesley Santos",
    )

    styles = getSampleStyleSheet()
    styles["Normal"].fontName = "DejaVu"
    styles["Normal"].fontSize = 11
    styles["Normal"].leading = 16

    styles["Title"].fontName = "DejaVu-Bold"

    h1 = ParagraphStyle(
        "H1",
        parent=styles["Normal"],
        fontName="DejaVu-Bold",
        fontSize=20,
        leading=26,
        spaceBefore=14,
        spaceAfter=8,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Normal"],
        fontName="DejaVu-Bold",
        fontSize=15,
        leading=20,
        spaceBefore=12,
        spaceAfter=6,
    )
    h3 = ParagraphStyle(
        "H3",
        parent=styles["Normal"],
        fontName="DejaVu-Bold",
        fontSize=12.5,
        leading=17,
        spaceBefore=10,
        spaceAfter=5,
    )

    elements = []

    for raw in texto_md.splitlines():
        linha = raw.strip()

        if not linha:
            elements.append(Spacer(1, 8))
            continue

        if linha.startswith("# "):
            texto = saxutils.escape(linha[2:].strip())
            elements.append(Paragraph(texto, h1))
            continue

        if linha.startswith("## "):
            texto = saxutils.escape(linha[3:].strip())
            elements.append(Paragraph(texto, h2))
            continue

        if linha.startswith("### "):
            texto = saxutils.escape(linha[4:].strip())
            elements.append(Paragraph(texto, h3))
            continue

        if linha.startswith("- "):
            linha = f"• {linha[2:].strip()}"

        texto = saxutils.escape(linha)
        elements.append(Paragraph(texto, styles["Normal"]))

    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    doc.build(elements)

    print("PDF V5 gerado com acentuação UTF-8 correta")
    print("Legislação, operação, você, não, missão, ação, segurança")


if __name__ == "__main__":
    build_pdf()
