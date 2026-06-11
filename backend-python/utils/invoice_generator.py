import os
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from datetime import datetime

def generate_invoice_pdf(order_data, output_path):
    """
    Génère un PDF Facture pour une commande AgriMarché.
    order_data doit contenir: id, shop_name, buyer_name, product_name, price, quantity, subtotal, delivery_fee, commission, total_amount, created_at
    """
    # Create directory if not exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    doc = SimpleDocTemplate(output_path, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []

    # header
    title_style = styles['Title']
    title_style.textColor = colors.HexColor("#2E7D32") # AgriMarché Green
    elements.append(Paragraph(f"AgriMarché - FACTURE", title_style))
    elements.append(Paragraph(f"Facture N° : {str(order_data['id'])[:8].upper()}", styles['Normal']))
    elements.append(Spacer(1, 20))

    # Info Grid
    info_data = [
        [Paragraph(f"<b>VENDEUR :</b><br/>{order_data['shop_name']}", styles['Normal']), 
         Paragraph(f"<b>CLIENT :</b><br/>{order_data['buyer_name']}", styles['Normal'])]
    ]
    info_table = Table(info_data, colWidths=[240, 240])
    elements.append(info_table)
    
    date_str = order_data['created_at'].strftime('%d/%m/%Y %H:%M') if isinstance(order_data['created_at'], datetime) else str(order_data['created_at'])
    elements.append(Paragraph(f"<b>Date de commande :</b> {date_str}", styles['Normal']))
    elements.append(Spacer(1, 30))

    # Items Table
    data = [
        ["Désignation", "P.U (F)", "Qty", "Total (F)"],
        [order_data['product_name'], f"{int(order_data['price']):,}", f"{order_data['quantity']}", f"{int(order_data['subtotal']):,}"]
    ]
    
    # Subtotal row
    data.append(["", "", "Sous-total :", f"{int(order_data['subtotal']):,} F"])
    
    # Fees
    if float(order_data.get('delivery_fee', 0)) > 0:
        data.append(["", "", "Livraison :", f"{int(order_data['delivery_fee']):,} F"])
    
    # Commission
    data.append(["", "", "Commission :", f"{int(order_data['commission']):,} F"])
    
    # Total
    data.append(["", "", "TOTAL GENERAL :", f"{int(order_data['total_amount']):,} F"])

    table = Table(data, colWidths=[200, 80, 100, 100])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#2E7D32")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (2, 1), (3, -1), 'RIGHT'),
        ('FONTNAME', (2, -1), (3, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (2, -1), (3, -1), colors.lightgrey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(table)
    
    elements.append(Spacer(1, 60))
    elements.append(Paragraph("Cette facture atteste de votre paiement sécurisé sur la plateforme AgriMarché.", styles['Italic']))
    elements.append(Paragraph("<i>Merci de votre confiance !</i>", styles['Italic']))

    doc.build(elements)
    return output_path
