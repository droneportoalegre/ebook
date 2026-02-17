#!/usr/bin/env python3
import re
from pathlib import Path

A4_W = 595.28
A4_H = 841.89
MARGIN_L = 56
MARGIN_R = 56
MARGIN_T = 72
MARGIN_B = 62
CONTENT_W = A4_W - MARGIN_L - MARGIN_R
LINE_GAP = 4

SOURCE = Path('/Users/wesleysantos/projetos/ebook/ebook-legislacao-drones-brasil-pronto-para-venda.md')
OUTPUT = Path('/Users/wesleysantos/projetos/ebook/ebook-legislacao-drones-brasil-venda.pdf')

FONT_MAP = {
    'regular': '/F1',
    'bold': '/F2',
    'italic': '/F3',
    'bolditalic': '/F4'
}


def pdf_escape(text: str) -> str:
    return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def text_width_estimate(text: str, font_size: float) -> float:
    # Estimativa simples suficiente para quebra de linha estável.
    return len(text) * font_size * 0.50


def wrap_text(text: str, font_size: float, max_width: float):
    words = text.split()
    if not words:
        return ['']
    lines = []
    current = words[0]
    for w in words[1:]:
        candidate = current + ' ' + w
        if text_width_estimate(candidate, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = w
    lines.append(current)
    return lines


def parse_markdown(md: str):
    blocks = []
    lines = md.splitlines()

    for raw in lines:
        line = raw.rstrip()
        if not line:
            blocks.append(('space', ''))
            continue

        if line.startswith('---'):
            blocks.append(('divider', ''))
            continue

        if line.startswith('### '):
            blocks.append(('h3', line[4:].strip()))
            continue
        if line.startswith('## '):
            blocks.append(('h2', line[3:].strip()))
            continue
        if line.startswith('# '):
            blocks.append(('h1', line[2:].strip()))
            continue

        if re.match(r'^\d+\.\s+', line):
            blocks.append(('num', line))
            continue

        if line.startswith('- '):
            blocks.append(('bullet', line[2:].strip()))
            continue

        blocks.append(('p', line))

    return blocks


class PDFWriter:
    def __init__(self):
        self.objects = []

    def add_object(self, data: bytes):
        self.objects.append(data)
        return len(self.objects)

    def build(self):
        out = bytearray()
        out.extend(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
        offsets = [0]
        for i, obj in enumerate(self.objects, start=1):
            offsets.append(len(out))
            out.extend(f'{i} 0 obj\n'.encode('ascii'))
            out.extend(obj)
            out.extend(b'\nendobj\n')

        xref_start = len(out)
        out.extend(f'xref\n0 {len(self.objects)+1}\n'.encode('ascii'))
        out.extend(b'0000000000 65535 f \n')
        for off in offsets[1:]:
            out.extend(f'{off:010d} 00000 n \n'.encode('ascii'))

        out.extend(b'trailer\n')
        out.extend(f'<< /Size {len(self.objects)+1} /Root 1 0 R >>\n'.encode('ascii'))
        out.extend(b'startxref\n')
        out.extend(f'{xref_start}\n'.encode('ascii'))
        out.extend(b'%%EOF\n')
        return out


def build_pdf_from_blocks(blocks):
    writer = PDFWriter()

    # 1: Catalog (preenchido depois)
    writer.add_object(b'<< /Type /Catalog /Pages 2 0 R >>')

    # 2: Pages (preenchido depois)
    writer.add_object(b'<< /Type /Pages /Kids [] /Count 0 >>')

    # Fonts
    f1 = writer.add_object(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    f2 = writer.add_object(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
    f3 = writer.add_object(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>')
    f4 = writer.add_object(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique >>')
    _ = (f1, f2, f3, f4)

    pages_kids = []
    page_no = 0

    def new_page_stream():
        nonlocal page_no
        page_no += 1
        return []

    stream_lines = new_page_stream()
    y = A4_H - MARGIN_T

    def emit_text(text, x, yv, size=11, style='regular'):
        font = FONT_MAP.get(style, '/F1')
        stream_lines.append(f'BT {font} {size} Tf 1 0 0 1 {x:.2f} {yv:.2f} Tm ({pdf_escape(text)}) Tj ET')

    def emit_line(yv):
        stream_lines.append(f'0.85 w {MARGIN_L:.2f} {yv:.2f} m {A4_W-MARGIN_R:.2f} {yv:.2f} l S')

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
        # Footer
        stream_lines.append('0.3 0.3 0.3 rg')
        emit_text(f'DRONE LEGAL BRASIL  |  Página {page_no}', MARGIN_L, 30, 9, 'regular')
        stream = '\n'.join(stream_lines).encode('cp1252', errors='replace')
        content_obj = writer.add_object(
            b'<< /Length ' + str(len(stream)).encode('ascii') + b' >>\nstream\n' + stream + b'\nendstream'
        )
        page_obj = writer.add_object(
            (
                f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {A4_W:.2f} {A4_H:.2f}] '
                f'/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> '
                f'/Contents {content_obj} 0 R >>'
            ).encode('ascii')
        )
        pages_kids.append(page_obj)
        stream_lines = []

    # Capa interna
    emit_text('DRONE LEGAL BRASIL', MARGIN_L, y, 32, 'bold')
    y -= 44
    emit_text('O Guia Completo da Legislação de Drones no Brasil', MARGIN_L, y, 17, 'regular')
    y -= 26
    emit_text('Do Zero ao Pró com ANAC, DECEA, ANATEL e Seguro RETA', MARGIN_L, y, 13, 'italic')
    y -= 40
    emit_line(y)
    y -= 35
    emit_text('Autor: Wesley Santos', MARGIN_L, y, 12, 'regular')
    y -= 20
    emit_text('Versão de venda diagramada em PDF', MARGIN_L, y, 12, 'regular')
    y -= 20
    emit_text('Data de referência regulatória: 17 de fevereiro de 2026', MARGIN_L, y, 12, 'regular')
    y -= 32
    emit_text('Material educacional e estratégico.', MARGIN_L, y, 11, 'regular')
    y -= 18
    emit_text('Este PDF foi preparado para distribuição comercial.', MARGIN_L, y, 11, 'regular')

    finalize_page()
    stream_lines = new_page_stream()
    y = A4_H - MARGIN_T

    styles = {
        'h1': (24, 'bold', 16),
        'h2': (18, 'bold', 12),
        'h3': (14, 'bold', 10),
        'p': (11, 'regular', 7),
        'bullet': (11, 'regular', 7),
        'num': (11, 'regular', 7),
        'space': (0, 'regular', 8),
        'divider': (0, 'regular', 12)
    }

    for kind, text in blocks:
        if kind == 'space':
            y -= styles['space'][2]
            continue

        if kind == 'divider':
            ensure_space(22)
            emit_line(y)
            y -= styles['divider'][2]
            continue

        font_size, font_style, after = styles[kind]

        if kind in ('h1', 'h2', 'h3'):
            lines = wrap_text(text, font_size, CONTENT_W)
            need = len(lines) * (font_size + LINE_GAP) + after
            ensure_space(need)
            for ln in lines:
                emit_text(ln, MARGIN_L, y, font_size, font_style)
                y -= (font_size + LINE_GAP)
            y -= after
            continue

        if kind == 'bullet':
            wrapped = wrap_text(text, font_size, CONTENT_W - 16)
            need = len(wrapped) * (font_size + 2) + after
            ensure_space(need)
            for i, ln in enumerate(wrapped):
                prefix = '• ' if i == 0 else '  '
                emit_text(prefix + ln, MARGIN_L + 6, y, font_size, font_style)
                y -= (font_size + 2)
            y -= after
            continue

        if kind == 'num':
            wrapped = wrap_text(text, font_size, CONTENT_W)
            need = len(wrapped) * (font_size + 2) + after
            ensure_space(need)
            for ln in wrapped:
                emit_text(ln, MARGIN_L, y, font_size, font_style)
                y -= (font_size + 2)
            y -= after
            continue

        if kind == 'p':
            wrapped = wrap_text(text, font_size, CONTENT_W)
            need = len(wrapped) * (font_size + 2) + after
            ensure_space(need)
            for ln in wrapped:
                emit_text(ln, MARGIN_L, y, font_size, font_style)
                y -= (font_size + 2)
            y -= after

    finalize_page()

    kids_str = ' '.join(f'{k} 0 R' for k in pages_kids)
    writer.objects[1] = f'<< /Type /Pages /Kids [{kids_str}] /Count {len(pages_kids)} >>'.encode('ascii')

    OUTPUT.write_bytes(writer.build())
    return len(pages_kids)


def main():
    md = SOURCE.read_text(encoding='utf-8')
    blocks = parse_markdown(md)
    pages = build_pdf_from_blocks(blocks)
    print(f'PDF gerado: {OUTPUT}')
    print(f'Paginas: {pages}')


if __name__ == '__main__':
    main()
