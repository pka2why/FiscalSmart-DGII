"""Generate FiscalSmart end-user manual PDF (Spanish)."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Manual-Usuario-FiscalSmart.pdf"

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

INK = colors.HexColor("#061a14")
FOREST = colors.HexColor("#0d3b2e")
MOSS = colors.HexColor("#1f6b4f")
MIST = colors.HexColor("#e8f2ec")
MUTED = colors.HexColor("#3d5c4e")
RULE = colors.HexColor("#c5d9cd")


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "cover_brand": ParagraphStyle(
            "cover_brand",
            fontName="Arial-Bold",
            fontSize=28,
            textColor=colors.white,
            alignment=TA_CENTER,
            spaceAfter=12,
            leading=34,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            fontName="Arial-Bold",
            fontSize=18,
            textColor=colors.white,
            alignment=TA_CENTER,
            spaceAfter=8,
            leading=24,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            fontName="Arial",
            fontSize=11,
            textColor=MIST,
            alignment=TA_CENTER,
            leading=16,
        ),
        "h1": ParagraphStyle(
            "h1",
            fontName="Arial-Bold",
            fontSize=16,
            textColor=FOREST,
            spaceBefore=16,
            spaceAfter=10,
            leading=20,
        ),
        "h2": ParagraphStyle(
            "h2",
            fontName="Arial-Bold",
            fontSize=12.5,
            textColor=MOSS,
            spaceBefore=12,
            spaceAfter=6,
            leading=16,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="Arial",
            fontSize=10,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=8,
            leading=14,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            fontName="Arial",
            fontSize=10,
            textColor=INK,
            leading=13,
            leftIndent=4,
        ),
        "note": ParagraphStyle(
            "note",
            fontName="Arial",
            fontSize=9.5,
            textColor=MUTED,
            leading=13,
            spaceAfter=8,
            leftIndent=8,
            rightIndent=8,
        ),
        "caption": ParagraphStyle(
            "caption",
            fontName="Arial-Bold",
            fontSize=9,
            textColor=FOREST,
            spaceBefore=4,
            spaceAfter=4,
        ),
        "footer": ParagraphStyle(
            "footer",
            fontName="Arial",
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "toc": ParagraphStyle(
            "toc",
            fontName="Arial",
            fontSize=11,
            textColor=INK,
            leading=18,
            leftIndent=6,
        ),
    }
    return styles


def bullets(items, styles):
    return ListFlowable(
        [ListItem(Paragraph(i, styles["bullet"]), leftIndent=12, bulletColor=MOSS) for i in items],
        bulletType="bullet",
        start="•",
        leftIndent=18,
        spaceBefore=2,
        spaceAfter=8,
    )


def tip_box(text, styles):
    data = [[Paragraph(f"<b>Consejo:</b> {text}", styles["note"])]]
    t = Table(data, colWidths=[6.5 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), MIST),
                ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return t


def simple_table(headers, rows, col_widths):
    header_style = ParagraphStyle(
        "th", fontName="Arial-Bold", fontSize=9, textColor=colors.white, leading=12
    )
    cell_style = ParagraphStyle(
        "td", fontName="Arial", fontSize=9, textColor=INK, leading=12
    )
    data = [[Paragraph(h, header_style) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, cell_style) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), FOREST),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MIST]),
                ("GRID", (0, 0), (-1, -1), 0.4, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def add_page_number(canvas, doc):
    canvas.saveState()
    page = canvas.getPageNumber()
    if page > 1:
        canvas.setFillColor(FOREST)
        canvas.rect(0, LETTER[1] - 28, LETTER[0], 28, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Arial-Bold", 9)
        canvas.drawString(0.75 * inch, LETTER[1] - 18, "FiscalSmart — Manual de usuario")
        canvas.setFont("Arial", 8)
        canvas.drawRightString(LETTER[0] - 0.75 * inch, LETTER[1] - 18, f"Pág. {page}")
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(0.75 * inch, 0.55 * inch, LETTER[0] - 0.75 * inch, 0.55 * inch)
        canvas.setFillColor(MUTED)
        canvas.setFont("Arial", 8)
        canvas.drawCentredString(
            LETTER[0] / 2,
            0.35 * inch,
            "Bayonet Robles · info@bayonetrobles.com",
        )
    canvas.restoreState()


def cover_page(styles):
    story = []
    # Green banner via a full-width table
    banner = Table(
        [[
            Paragraph("FiscalSmart", styles["cover_brand"]),
        ], [
            Paragraph("Manual de usuario", styles["cover_title"]),
        ], [
            Paragraph(
                "Guía práctica para generar reportes 606 y 607<br/>con OCR y exportación a Excel",
                styles["cover_sub"],
            ),
        ]],
        colWidths=[6.5 * inch],
    )
    banner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), FOREST),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 48),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 40),
                ("TOPPADDING", (0, 1), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -2), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 20),
                ("RIGHTPADDING", (0, 0), (-1, -1), 20),
            ]
        )
    )
    story.append(Spacer(1, 1.2 * inch))
    story.append(banner)
    story.append(Spacer(1, 0.6 * inch))
    story.append(
        Paragraph(
            "Orientado a contadores, auxiliares administrativos y equipos de "
            "cuentas por pagar / cobrar en República Dominicana.",
            ParagraphStyle(
                "cnote",
                fontName="Arial",
                fontSize=10,
                textColor=MUTED,
                alignment=TA_CENTER,
                leading=14,
            ),
        )
    )
    story.append(Spacer(1, 0.35 * inch))
    story.append(
        Paragraph(
            "Sitio: <b>https://fiscal-smart-production.up.railway.app</b><br/>"
            "Soporte: <b>info@bayonetrobles.com</b>",
            ParagraphStyle(
                "clink",
                fontName="Arial",
                fontSize=10,
                textColor=FOREST,
                alignment=TA_CENTER,
                leading=15,
            ),
        )
    )
    story.append(PageBreak())
    return story


def build():
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.75 * inch,
        title="Manual de usuario — FiscalSmart",
        author="Bayonet Robles",
    )

    story = []
    story.extend(cover_page(styles))

    # TOC
    story.append(Paragraph("Contenido", styles["h1"]))
    for item in [
        "1. ¿Qué es FiscalSmart?",
        "2. Cómo obtener acceso e iniciar sesión",
        "3. Pantalla principal (Lotes)",
        "4. Empresas y miembros",
        "5. Flujo completo: del comprobante al Excel",
        "6. Formato 606 (compras) y 607 (ventas)",
        "7. Créditos OCR",
        "8. Resumen IT1",
        "9. Preguntas frecuentes y consejos",
    ]:
        story.append(Paragraph(item, styles["toc"]))
    story.append(PageBreak())

    # 1
    story.append(Paragraph("1. ¿Qué es FiscalSmart?", styles["h1"]))
    story.append(
        Paragraph(
            "FiscalSmart es una aplicación web para preparar los formatos de envío de datos "
            "<b>606 (compras y gastos)</b> y <b>607 (ventas e ingresos)</b> exigidos por la DGII. "
            "Usted sube facturas en PDF o imagen, la inteligencia artificial (Gemini) propone los datos "
            "fiscales, usted los revisa y corrige, y luego descarga el Excel listo para el periodo.",
            styles["body"],
        )
    )
    story.append(Paragraph("Lo que resuelve", styles["h2"]))
    story.append(
        bullets(
            [
                "Evitar tipiar a mano RNC, NCF, fechas, ITBIS y tipificaciones DGII.",
                "Organizar el trabajo por <b>empresa</b>, <b>periodo (YYYYMM)</b> y tipo de reporte.",
                "Mantener un historial de exportaciones del mismo lote.",
                "Controlar el uso de IA con un saldo de <b>créditos</b>.",
            ],
            styles,
        )
    )

    # 2
    story.append(Paragraph("2. Cómo obtener acceso e iniciar sesión", styles["h1"]))
    story.append(Paragraph("Solicitar acceso", styles["h2"]))
    story.append(
        Paragraph(
            "En la página de inicio use <b>Solicitar acceso</b> o vaya a <b>Contacto</b>. "
            "Complete nombre, email, empresa (opcional) y mensaje. El equipo le habilitará su cuenta "
            "y le confirmará por correo (<b>info@bayonetrobles.com</b>).",
            styles["body"],
        )
    )
    story.append(Paragraph("Iniciar sesión", styles["h2"]))
    story.append(
        bullets(
            [
                "Abra la aplicación e ingrese a <b>Iniciar sesión</b>.",
                "Escriba su <b>Email</b> y <b>Contraseña</b>.",
                "Pulse <b>Entrar</b>. Entrará a la pantalla de <b>Lotes fiscales</b>.",
            ],
            styles,
        )
    )
    story.append(
        tip_box(
            "Si olvida su contraseña, solicite ayuda a info@bayonetrobles.com. "
            "Para salir use <b>Cerrar sesión</b> / <b>Salir</b> en el menú o en la barra del lote.",
            styles,
        )
    )

    # 3
    story.append(Paragraph("3. Pantalla principal (Lotes)", styles["h1"]))
    story.append(
        Paragraph(
            "Desde el menú lateral puede ir a <b>Lotes</b>, <b>IT1</b>, <b>Créditos</b> y "
            "<b>Cerrar sesión</b>. También verá su saldo de créditos y el email de la cuenta.",
            styles["body"],
        )
    )
    story.append(Paragraph("Crear o abrir un lote", styles["h2"]))
    story.append(
        bullets(
            [
                "Indique el <b>Periodo</b> en formato <b>YYYYMM</b> (ejemplo: julio 2026 → <b>202607</b>).",
                "Elija el <b>Tipo</b>: <b>606 Compras</b> o <b>607 Ventas</b>.",
                "Pulse <b>Abrir / Crear lote</b>. Si ya existe ese lote para la empresa activa, se abre; si no, se crea.",
                "En la lista, pulse <b>Abrir →</b> sobre un lote existente.",
            ],
            styles,
        )
    )
    story.append(
        tip_box(
            "Hay un solo lote por combinación de empresa + tipo (606/607) + periodo. "
            "No mezcle compras y ventas en el mismo lote.",
            styles,
        )
    )

    # 4
    story.append(Paragraph("4. Empresas y miembros", styles["h1"]))
    story.append(
        Paragraph(
            "Su cuenta (tenant) puede gestionar varias empresas. Los lotes y el resumen IT1 "
            "corresponden a la <b>Empresa activa</b>. Los créditos se comparten a nivel de cuenta.",
            styles["body"],
        )
    )
    story.append(
        bullets(
            [
                "Use el selector <b>Empresa activa</b> para cambiar de compañía.",
                "Si es propietario, puede crear una <b>Nueva empresa</b> (nombre y RNC) y activarla.",
                "En <b>Miembros</b> puede agregar usuarios a esa empresa (email, nombre, contraseña y rol) o quitarlos.",
            ],
            styles,
        )
    )

    story.append(PageBreak())

    # 5
    story.append(Paragraph("5. Flujo completo: del comprobante al Excel", styles["h1"]))
    story.append(
        Paragraph(
            "Este es el recorrido habitual dentro de un lote (<b>606 · periodo</b> o <b>607 · periodo</b>).",
            styles["body"],
        )
    )

    steps = [
        (
            "Paso 1 — RNC informante",
            "Verifique el campo <b>RNC informante</b> del lote (el RNC de la empresa que declara). "
            "Al salir del campo se guarda automáticamente.",
        ),
        (
            "Paso 2 — Subir facturas",
            "Pulse <b>Subir facturas</b> y seleccione uno o varios archivos <b>PDF</b> o <b>imagen</b>. "
            "Subir no consume créditos. Las facturas quedan en estado pendiente hasta procesarlas.",
        ),
        (
            "Paso 3 — Procesar OCR",
            "Pulse <b>Procesar OCR</b>. El botón indica cuántas facturas se procesarán y cuántos créditos "
            "se usarán. Cada factura enviada a Gemini consume <b>1 crédito</b>.",
        ),
        (
            "Paso 4 — Revisar y corregir",
            "Abra <b>Previsualizar y corregir</b> (ícono de ojo) o edite desde la tabla. "
            "Revise RNC/cédula, NCF, fechas (YYYYMMDD), categoría DGII y montos. Guarde los cambios.",
        ),
        (
            "Paso 5 — Exportar Excel",
            "Cuando las facturas estén <b>completadas</b>, pulse <b>Exportar Excel</b>. "
            "Se descarga un archivo del tipo <b>Formato_606_YYYYMM_vN.xlsx</b> o <b>Formato_607_...</b>.",
        ),
        (
            "Paso 6 — Historial (opcional)",
            "Use <b>Historial</b> para ver exportaciones anteriores del lote y <b>Descargar</b> una versión previa.",
        ),
    ]
    for title, text in steps:
        block = [
            Paragraph(title, styles["h2"]),
            Paragraph(text, styles["body"]),
        ]
        story.append(KeepTogether(block))

    story.append(Paragraph("Estados útiles", styles["h2"]))
    story.append(
        simple_table(
            ["Situación", "Qué hacer"],
            [
                ["Pendiente / error", "Procesar OCR (o corregir y reprocesar si falló)."],
                ["Completada", "Lista para exportar. Puede seguir editando campos."],
                ["Sin créditos suficientes", "Procesará solo algunas; recargue créditos con el administrador."],
                ["No hay completadas", "No podrá exportar hasta completar al menos una factura."],
            ],
            [2.2 * inch, 4.3 * inch],
        )
    )
    story.append(Spacer(1, 10))

    # 6
    story.append(Paragraph("6. Formato 606 (compras) y 607 (ventas)", styles["h1"]))
    story.append(Paragraph("606 — Compras y gastos", styles["h2"]))
    story.append(
        Paragraph(
            "Se centra en el <b>suplidor</b>. Campos típicos: nombre del suplidor, RNC/cédula, NCF, "
            "tipo de gasto (códigos 01–11 DGII), total facturado, montos de bienes/servicios, "
            "ITBIS, forma de pago, fechas y propina legal si aplica.",
            styles["body"],
        )
    )
    story.append(Paragraph("607 — Ventas e ingresos", styles["h2"]))
    story.append(
        Paragraph(
            "Se centra en el <b>cliente</b>. Campos típicos: nombre del cliente, RNC/cédula, NCF, "
            "tipo de ingreso (01–04), monto facturado, ITBIS, desglose de formas de pago "
            "(efectivo, cheque/transferencia, tarjeta, crédito, etc.) y propina legal si aplica.",
            styles["body"],
        )
    )
    story.append(
        tip_box(
            "La IA sugiere la categoría según el contenido de la factura, pero la responsabilidad "
            "final de la tipificación DGII es suya. Revise siempre antes de exportar.",
            styles,
        )
    )

    story.append(PageBreak())

    # 7
    story.append(Paragraph("7. Créditos OCR", styles["h1"]))
    story.append(
        Paragraph(
            "En el menú <b>Créditos</b> verá el <b>Saldo actual</b>, paquetes de referencia e "
            "<b>Historial</b> de movimientos.",
            styles["body"],
        )
    )
    story.append(
        simple_table(
            ["Consume 1 crédito", "No consume créditos"],
            [
                ["Cada factura enviada a <b>Procesar OCR</b>", "Subir archivos"],
                ["Reintentos de OCR en pendientes/errores", "Editar y guardar campos"],
                ["", "Exportar Excel / historial"],
                ["", "Ver lotes, IT1 o cambiar de empresa"],
            ],
            [3.25 * inch, 3.25 * inch],
        )
    )
    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            "Si el saldo no alcanza para todas las pendientes, la app procesa las que pueda y "
            "avisa cuántas quedaron sin créditos. Algunos fallos de Gemini pueden generar "
            "<b>Reembolso OCR</b> en el historial.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "Para recargar, contacte al administrador o escriba a <b>info@bayonetrobles.com</b>. "
            "En esta versión no hay compra en línea dentro de la app.",
            styles["body"],
        )
    )

    # 8
    story.append(Paragraph("8. Resumen IT1", styles["h1"]))
    story.append(
        Paragraph(
            "El menú <b>IT1</b> muestra un resumen consolidado del periodo para la empresa activa "
            "(documentos 606/607, completadas/pendientes/errores e indicadores de totales e ITBIS). "
            "Es una vista de apoyo; el archivo oficial 606/607 se genera con <b>Exportar Excel</b> en cada lote.",
            styles["body"],
        )
    )

    # 9
    story.append(Paragraph("9. Preguntas frecuentes y consejos", styles["h1"]))

    faqs = [
        (
            "¿Qué formatos de archivo acepta?",
            "Imágenes (JPG, PNG, etc.) y PDF. Prefiera archivos legibles y completos.",
        ),
        (
            "¿Cómo deben ir las fechas?",
            "En formato <b>YYYYMMDD</b> (ejemplo: 15 de julio de 2026 → <b>20260715</b>).",
        ),
        (
            "¿Cómo valido RNC y NCF?",
            "La pantalla le advierte si el RNC/cédula o el NCF no parecen válidos "
            "(RNC 9 dígitos, cédula 11; NCF con patrones B/E/A habituales). Corrija antes de exportar.",
        ),
        (
            "¿Puedo borrar una factura del lote?",
            "Sí, use la opción de eliminar en la fila correspondiente si ya no debe incluirse.",
        ),
        (
            "Perdí la vista previa del archivo tras un reinicio",
            "Vuelva a subir el comprobante. Los datos ya extraídos pueden seguir en el lote, "
            "pero el archivo original a veces no se conserva tras redeploys.",
        ),
        (
            "¿El Excel es el formato oficial DGII?",
            "FiscalSmart genera el Excel de trabajo alineado a columnas 606/607. "
            "Siempre valide el archivo antes de remitíselo a la Oficina Virtual.",
        ),
    ]
    for q, a in faqs:
        story.append(Paragraph(q, styles["h2"]))
        story.append(Paragraph(a, styles["body"]))

    story.append(Spacer(1, 16))
    story.append(Paragraph("Checklist rápido antes de declarar", styles["h2"]))
    story.append(
        bullets(
            [
                "Periodo YYYYMM correcto y tipo 606 o 607 correcto.",
                "RNC informante de la empresa que declara.",
                "Todas las facturas del mes relevantes están completadas.",
                "RNC/NCF/fechas/montos revisados.",
                "Excel exportado y guardado (anote la versión del historial).",
            ],
            styles,
        )
    )

    story.append(Spacer(1, 20))
    closing = Table(
        [[
            Paragraph(
                "<b>¿Necesita ayuda?</b><br/>Escriba a info@bayonetrobles.com o use el formulario "
                "de contacto en la web de FiscalSmart.",
                ParagraphStyle(
                    "close",
                    fontName="Arial",
                    fontSize=10,
                    textColor=INK,
                    leading=14,
                    alignment=TA_CENTER,
                ),
            )
        ]],
        colWidths=[6.5 * inch],
    )
    closing.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), MIST),
                ("BOX", (0, 0), (-1, -1), 1, MOSS),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(closing)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
