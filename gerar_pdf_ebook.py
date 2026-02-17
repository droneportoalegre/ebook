#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors

from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Preformatted,
    ListFlowable,
    ListItem,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# -----------------------------
# CONFIG
# -----------------------------
MD_INPUT = "ebook-legislacao-drones-brasil-pronto-para-venda.md"
OUT_PDF = "flight-check-app/assets/Drone-Legal-Brasil-v5.pdf"

PAGE_SIZE = A4
MARGIN = 18 * mm

FONT_NORMAL = "DPA-DejaVu"
FONT_BOLD = "DPA-DejaVu-Bold"


def find_font_file(candidates):
    """Return first existing font file path from candidates."""
    for p in candidates:
        if p and Path(p).exists():
            return str(Path(p))
    return None


def register_unicode_fonts():
    """
    Register TTF fonts with robust PT-BR unicode support.
    Searches common macOS/Linux locations. You can also place fonts in ./fonts/
    """
    project_fonts = Path("fonts")
    local_fonts = [
        project_fonts / "DejaVuSans.ttf",
        project_fonts / "DejaVuSans-Bold.ttf",
        Path("DejaVuSans.ttf"),
        Path("DejaVuSans-Bold.ttf"),
    ]

    # Common macOS paths (varies by version)
    mac_candidates_normal = [
        "/System/Library/Fonts/Supplemental/DejaVuSans.ttf",
        "/Library/Fonts/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",  # fallback
    ]
    mac_candidates_bold = [
        "/System/Library/Fonts/Supplemental/DejaVuSans-Bold.ttf",
        "/Library/Fonts/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",  # fallback (no bold)
    ]

    normal_path = find_font_file([str(p) for p in local_fonts[:1]] + mac_candidates_normal)
    bold_path = find_font_file([str(p) for p in local_fonts[1:2]] + mac_candidates_bold)

    if not normal_path:
        raise FileNotFoundError(
            "Não encontrei uma fonte TTF Unicode. Coloque DejaVuSans.ttf em ./fonts/ "
            "ou instale a fonte no sistema. Caminhos tentados incluem /System/Library/Fonts/Supplemental/."
        )

    # Bold: if missing, reuse normal (still works, just not bold)
    if not bold_path:
        bold_path = normal_path

    pdfmetrics.registerFont(TTFont(FONT_NORMAL, normal_path))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, bold_path))


def build_styles():
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="DPA_Normal",
            parent=styles["Normal"],
            fontName=FONT_NORMAL,
            fontSize=11,
            leading=16,
            spaceAfter=6,
        )
    )

    styles.add(
        ParagraphStyle(
            name="DPA_H1",
            parent=styles["Heading1"],
            fontName=FONT_BOLD,
            fontSize=20,
            leading=24,
            spaceBefore=12,
            spaceAfter=10,
        )
    )

    styles.add(
        ParagraphStyle(
            name="DPA_H2",
            parent=styles["Heading2"],
            fontName=FONT_BOLD,
            fontSize=15,
            leading=18,
            spaceBefore=10,
            spaceAfter=8,
        )
    )

    styles.add(
        ParagraphStyle(
            name="DPA_H3",
            parent=styles["Heading3"],
            fontName=FONT_BOLD,
            fontSize=12.5,
            leading=16,
            spaceBefore=8,
            spaceAfter=6,
        )
    )

    styles.add(
        ParagraphStyle(
            name="DPA_Box",
            parent=styles["Normal"],
            fontName=FONT_NORMAL,
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#111111"),
            backColor=colors.HexColor("#F3F4F6"),
            borderPadding=8,
            leftIndent=6,
            rightIndent=6,
            spaceBefore=8,
            spaceAfter=8,
        )
    )

    styles.add(
        ParagraphStyle(
            name="DPA_Code",
            parent=styles["Normal"],
            fontName=FONT_NORMAL,
            fontSize=9.5,
            leading=13,
            backColor=colors.HexColor("#0B1020"),
            textColor=colors.whitesmoke,
            borderPadding=8,
            leftIndent=6,
            rightIndent=6,
            spaceBefore=8,
            spaceAfter=8,
        )
    )

    return styles


def md_to_flowables(md_text, styles):
    """
    Minimal markdown-to-reportlab converter:
    - #, ##, ### headings
    - blank lines
    - bullet lists (- or *)
    - fenced code blocks ``` ```
    - simple "boxes" starting with **DICA DE OURO:** / **ATENÇÃO:** / **IMPORTANTE:** / **RESUMO DO CAPÍTULO:**
    Everything else becomes Paragraph.
    """
    lines = md_text.splitlines()
    elements = []
    i = 0

    bullet_buffer = []
    in_code = False
    code_lines = []

    def flush_bullets():
        nonlocal bullet_buffer
        if not bullet_buffer:
            return
        items = []
        for b in bullet_buffer:
            # escape XML for Paragraph
            txt = escape(b.strip())
            items.append(ListItem(Paragraph(txt, styles["DPA_Normal"]), leftIndent=12))
        elements.append(ListFlowable(items, bulletType="bullet", leftIndent=18))
        elements.append(Spacer(1, 4))
        bullet_buffer = []

    def add_box(label, content):
        label_escaped = escape(label.strip())
        content_escaped = escape(content.strip())
        html = f"<b>{label_escaped}</b><br/>{content_escaped}"
        elements.append(Paragraph(html, styles["DPA_Box"]))

    box_re = re.compile(r"^\*\*(DICA DE OURO|ATENÇÃO|IMPORTANTE|RESUMO DO CAP[IÍ]TULO)\s*:?\*\*\s*(.*)$", re.I)

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip("\n")

        # Code block start/end
        if line.strip().startswith("```"):
            flush_bullets()
            if not in_code:
                in_code = True
                code_lines = []
            else:
                in_code = False
                code_text = "\n".join(code_lines)
                # Use Preformatted to preserve spacing; keep unicode
                elements.append(Preformatted(code_text, styles["DPA_Code"]))
                elements.append(Spacer(1, 6))
            i += 1
            continue

        if in_code:
            code_lines.append(line)
            i += 1
            continue

        # Page breaks (optional marker)
        if line.strip() == "---PAGEBREAK---":
            flush_bullets()
            elements.append(PageBreak())
            i += 1
            continue

        # Blank line
        if not line.strip():
            flush_bullets()
            elements.append(Spacer(1, 6))
            i += 1
            continue

        # Headings
        if line.startswith("# "):
            flush_bullets()
            elements.append(Paragraph(escape(line[2:].strip()), styles["DPA_H1"]))
            i += 1
            continue
        if line.startswith("## "):
            flush_bullets()
            elements.append(Paragraph(escape(line[3:].strip()), styles["DPA_H2"]))
            i += 1
            continue
        if line.startswith("### "):
            flush_bullets()
            elements.append(Paragraph(escape(line[4:].strip()), styles["DPA_H3"]))
            i += 1
            continue

        # Boxes
        m = box_re.match(line.strip())
        if m:
            flush_bullets()
            label = m.group(1).upper()
            content = m.group(2) or ""
            add_box(label, content)
            i += 1
            continue

        # Bullets
        if line.strip().startswith("- ") or line.strip().startswith("* "):
            bullet_buffer.append(line.strip()[2:])
            i += 1
            continue

        # Normal paragraph
        flush_bullets()

        # basic markdown bold **text** => <b>text</b>
        safe = escape(line.strip())
        safe = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", safe)

        elements.append(Paragraph(safe, styles["DPA_Normal"]))
        i += 1

    flush_bullets()
    return elements


def main():
    # 1) Register Unicode fonts (THIS is the fix)
    register_unicode_fonts()

    # 2) Load markdown as UTF-8 (THIS is the fix)
    md_path = Path(MD_INPUT)
    if not md_path.exists():
        raise FileNotFoundError(f"Arquivo markdown não encontrado: {MD_INPUT}")

    md_text = md_path.read_text(encoding="utf-8")

    # 3) Build PDF
    out_path = Path(OUT_PDF)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    styles = build_styles()

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="Drone Legal Brasil",
        author="Wesley Santos",
    )

    elements = md_to_flowables(md_text, styles)
    doc.build(elements)

    # 4) Quick unicode sanity log
    print("PDF gerado com sucesso:", out_path)
    print("Teste de acentuação:", "Legislação, operação, você, não, missão, ação, segurança, homologação, aeronáutica, conformidade")


if __name__ == "__main__":
    main()
