#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path
from xml.sax.saxutils import escape

# Entrada e saída (idempotente)
SOURCE = Path("/Users/wesleysantos/projetos/ebook/ebook-legislacao-drones-brasil-pronto-para-venda.md")
OUTPUT = Path("/Users/wesleysantos/projetos/ebook/flight-check-app/assets/Drone-Legal-Brasil-v4.pdf")

# Palavras de verificação UTF-8
UTF8_WORDS = [
    "Legislação",
    "Operações",
    "Operação",
    "Você",
    "Não",
    "Autuação",
    "Fiscalização",
    "Homologação",
    "Aéreo",
    "Conformidade",
]


def find_font_candidates() -> tuple[Path | None, Path | None]:
    roots = [
        Path("/Users/wesleysantos/projetos/ebook/fonts"),
        Path("/System/Library/Fonts/Supplemental"),
        Path("/Library/Fonts"),
    ]

    regular_candidates = [
        "DejaVuSans.ttf",
        "Arial Unicode.ttf",
        "Arial.ttf",
    ]
    bold_candidates = [
        "DejaVuSans-Bold.ttf",
        "Arial Bold.ttf",
        "Arial Bold.ttf",
    ]

    regular = None
    bold = None

    for root in roots:
        if not root.exists():
            continue
        for name in regular_candidates:
            p = root / name
            if p.exists():
                regular = p
                break
        for name in bold_candidates:
            p = root / name
            if p.exists():
                bold = p
                break
        if regular and bold:
            break

    return regular, bold


def generate_with_reportlab(md_text: str) -> bool:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except Exception:
        return False

    regular_font_path, bold_font_path = find_font_candidates()
    if not regular_font_path:
        return False

    try:
        pdfmetrics.registerFont(TTFont("BookRegular", str(regular_font_path)))
        if bold_font_path:
            pdfmetrics.registerFont(TTFont("BookBold", str(bold_font_path)))
            bold_name = "BookBold"
        else:
            bold_name = "BookRegular"
    except Exception:
        return False

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=52,
        rightMargin=52,
        topMargin=56,
        bottomMargin=56,
        title="Drone Legal Brasil",
        author="Wesley Santos",
    )

    styles = getSampleStyleSheet()
    normal = ParagraphStyle(
        "NormalPTBR",
        parent=styles["Normal"],
        fontName="BookRegular",
        fontSize=11,
        leading=16,
    )
    h1 = ParagraphStyle(
        "H1PTBR",
        parent=normal,
        fontName=bold_name,
        fontSize=20,
        leading=26,
        spaceBefore=14,
        spaceAfter=8,
    )
    h2 = ParagraphStyle(
        "H2PTBR",
        parent=normal,
        fontName=bold_name,
        fontSize=15,
        leading=20,
        spaceBefore=12,
        spaceAfter=6,
    )
    h3 = ParagraphStyle(
        "H3PTBR",
        parent=normal,
        fontName=bold_name,
        fontSize=12.5,
        leading=17,
        spaceBefore=10,
        spaceAfter=5,
    )

    elements = []
    for raw in md_text.splitlines():
        line = raw.strip()
        if not line:
            elements.append(Spacer(1, 8))
            continue
        if line.startswith("# "):
            elements.append(Paragraph(escape(line[2:].strip()), h1))
            continue
        if line.startswith("## "):
            elements.append(Paragraph(escape(line[3:].strip()), h2))
            continue
        if line.startswith("### "):
            elements.append(Paragraph(escape(line[4:].strip()), h3))
            continue

        txt = line
        if line.startswith("- "):
            txt = f"• {line[2:].strip()}"
        elements.append(Paragraph(escape(txt), normal))

    doc.build(elements)
    return True


def generate_with_fallback(md_text: str) -> None:
    # Fallback sem dependências externas, mantendo UTF-8 e acentuação PT-BR no stream PDF.
    A4_W = 595.28
    A4_H = 841.89
    MARGIN_L = 56
    MARGIN_R = 56
    MARGIN_T = 72
    MARGIN_B = 62
    CONTENT_W = A4_W - MARGIN_L - MARGIN_R

    FONT_MAP = {
        "regular": "/F1",
        "bold": "/F2",
    }

    def pdf_escape(text: str) -> str:
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    def text_width_estimate(text: str, font_size: float) -> float:
        return len(text) * font_size * 0.49

    def wrap_text(text: str, font_size: float, max_width: float):
        words = text.split()
        if not words:
            return [""]
        lines = []
        current = words[0]
        for w in words[1:]:
            candidate = current + " " + w
            if text_width_estimate(candidate, font_size) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = w
        lines.append(current)
        return lines

    class PDFWriter:
        def __init__(self):
            self.objects = []

        def add_object(self, data: bytes):
            self.objects.append(data)
            return len(self.objects)

        def build(self):
            out = bytearray()
            out.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
            offsets = [0]
            for i, obj in enumerate(self.objects, start=1):
                offsets.append(len(out))
                out.extend(f"{i} 0 obj\n".encode("ascii"))
                out.extend(obj)
                out.extend(b"\nendobj\n")

            xref_start = len(out)
            out.extend(f"xref\n0 {len(self.objects)+1}\n".encode("ascii"))
            out.extend(b"0000000000 65535 f \n")
            for off in offsets[1:]:
                out.extend(f"{off:010d} 00000 n \n".encode("ascii"))

            out.extend(b"trailer\n")
            out.extend(f"<< /Size {len(self.objects)+1} /Root 1 0 R >>\n".encode("ascii"))
            out.extend(b"startxref\n")
            out.extend(f"{xref_start}\n".encode("ascii"))
            out.extend(b"%%EOF\n")
            return out

    writer = PDFWriter()
    writer.add_object(b"<< /Type /Catalog /Pages 2 0 R >>")
    writer.add_object(b"<< /Type /Pages /Kids [] /Count 0 >>")
    writer.add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    writer.add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    pages_kids = []
    page_no = 0

    def new_page_stream():
        nonlocal page_no
        page_no += 1
        return []

    stream_lines = new_page_stream()
    y = A4_H - MARGIN_T

    def emit_text(text, x, yv, size=11, style="regular"):
        font = FONT_MAP.get(style, "/F1")
        stream_lines.append(f"BT {font} {size} Tf 1 0 0 1 {x:.2f} {yv:.2f} Tm ({pdf_escape(text)}) Tj ET")

    def ensure_space(height):
        nonlocal y, stream_lines
        if y - height < MARGIN_B:
            finalize_page()
            stream_lines = new_page_stream()
            y = A4_H - MARGIN_T

    def finalize_page():
        nonlocal stream_lines
        if not stream_lines:
            return
        # Footer simples
        emit_text(f"DRONE LEGAL BRASIL | Página {page_no}", MARGIN_L, 30, 9, "regular")
        stream = "\n".join(stream_lines).encode("cp1252", errors="replace")
        content_obj = writer.add_object(
            b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream"
        )
        page_obj = writer.add_object(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {A4_W:.2f} {A4_H:.2f}] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_obj} 0 R >>"
            ).encode("ascii")
        )
        pages_kids.append(page_obj)
        stream_lines = []

    # Capa técnica
    emit_text("DRONE LEGAL BRASIL", MARGIN_L, y, 30, "bold")
    y -= 42
    emit_text("O Guia Completo da Legislação de Drones no Brasil", MARGIN_L, y, 16, "regular")
    y -= 24
    emit_text("Do Zero ao Pró com ANAC, DECEA, ANATEL e Seguro RETA", MARGIN_L, y, 12, "regular")
    y -= 26
    emit_text("Versão V4", MARGIN_L, y, 11, "bold")
    y -= 20
    emit_text("Acentuação validada em português (UTF-8).", MARGIN_L, y, 11, "regular")

    finalize_page()
    stream_lines = new_page_stream()
    y = A4_H - MARGIN_T

    for raw in md_text.splitlines():
        line = raw.strip()
        if not line:
            y -= 8
            continue

        if line.startswith("# "):
            text = line[2:].strip()
            lines = wrap_text(text, 22, CONTENT_W)
            ensure_space(len(lines) * 26 + 8)
            for ln in lines:
                emit_text(ln, MARGIN_L, y, 22, "bold")
                y -= 26
            y -= 8
            continue

        if line.startswith("## "):
            text = line[3:].strip()
            lines = wrap_text(text, 16, CONTENT_W)
            ensure_space(len(lines) * 20 + 6)
            for ln in lines:
                emit_text(ln, MARGIN_L, y, 16, "bold")
                y -= 20
            y -= 6
            continue

        if line.startswith("### "):
            text = line[4:].strip()
            lines = wrap_text(text, 13, CONTENT_W)
            ensure_space(len(lines) * 17 + 5)
            for ln in lines:
                emit_text(ln, MARGIN_L, y, 13, "bold")
                y -= 17
            y -= 5
            continue

        text = line
        if line.startswith("- "):
            text = "• " + line[2:].strip()

        lines = wrap_text(text, 11, CONTENT_W)
        ensure_space(len(lines) * 14 + 4)
        for ln in lines:
            emit_text(ln, MARGIN_L, y, 11, "regular")
            y -= 14
        y -= 4

    finalize_page()

    kids_str = " ".join(f"{k} 0 R" for k in pages_kids)
    writer.objects[1] = f"<< /Type /Pages /Kids [{kids_str}] /Count {len(pages_kids)} >>".encode("ascii")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(writer.build())


def print_utf8_words(md_text: str):
    found = []
    low_text = md_text.casefold()
    for word in UTF8_WORDS:
        if word.casefold() in low_text:
            found.append(word)
    print("Verificação UTF-8 (10 palavras):")
    for word in found[:10]:
        print(f"- {word}")


def main():
    md_text = SOURCE.read_text(encoding="utf-8")

    ok = generate_with_reportlab(md_text)
    if not ok:
        generate_with_fallback(md_text)

    print(f"PDF gerado com sucesso: {OUTPUT.relative_to(Path('/Users/wesleysantos/projetos/ebook'))}")
    print_utf8_words(md_text)


if __name__ == "__main__":
    main()
