from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from xml.sax.saxutils import escape

# Registrar fonte com suporte a acentuacao
pdfmetrics.registerFont(TTFont("DejaVu", "DejaVuSans.ttf"))

# Documento PDF
doc = SimpleDocTemplate(
    "flight-check-app/assets/ebook-legislacao-drones-brasil-venda.pdf",
    pagesize=A4,
    leftMargin=50,
    rightMargin=50,
    topMargin=50,
    bottomMargin=50,
)

styles = getSampleStyleSheet()

normal = ParagraphStyle(
    "NormalDejaVu",
    parent=styles["Normal"],
    fontName="DejaVu",
    fontSize=11,
    leading=16,
)

elements = []

# Ler Markdown corretamente em UTF-8
with open("ebook-legislacao-drones-brasil-pronto-para-venda.md", "r", encoding="utf-8") as f:
    for linha in f:
        txt = linha.strip()

        if not txt:
            elements.append(Spacer(1, 10))
            continue

        elements.append(Paragraph(escape(txt), normal))
        elements.append(Spacer(1, 6))

doc.build(elements)

print("PDF gerado com sucesso.")
