import io
import os
import time
import logging
import requests
from decimal import Decimal
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

logger = logging.getLogger(__name__)

MAX_DAILY_WHATSAPP_MESSAGES = 5000
ORDER_RESEND_COOLDOWN_SECONDS = 60
MAX_MESSAGES_PER_PHONE_PER_HOUR = 10
META_API_TIMEOUT_SECONDS = 10

# ==============================================================================
# PRODUCTION SAFETY & COST CONTROLS FOR META WHATSAPP CLOUD API
# ==============================================================================
def load_whatsapp_env_settings():
    """
    Dynamically re-reads backend/.env so any runtime changes to rate limits
    (MAX_DAILY_WHATSAPP_MESSAGES, ORDER_RESEND_COOLDOWN_SECONDS, MAX_MESSAGES_PER_PHONE_PER_HOUR,
    META_API_TIMEOUT_SECONDS) or Meta credentials are immediately active without restarting the server.
    """
    env_file = settings.BASE_DIR / '.env'
    if env_file.exists():
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k.startswith(('META_', 'MAX_', 'ORDER_')):
                        os.environ[k] = v
        except Exception as e:
            logger.warning(f"Failed to refresh .env dynamically: {e}")

    return {
        'phone_id': os.getenv('META_WHATSAPP_PHONE_NUMBER_ID', ''),
        'access_token': os.getenv('META_WHATSAPP_ACCESS_TOKEN', ''),
        'business_id': os.getenv('META_WHATSAPP_BUSINESS_ACCOUNT_ID', ''),
        'webhook_verify_token': os.getenv('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN', ''),
        'max_daily': int(os.getenv('MAX_DAILY_WHATSAPP_MESSAGES', 500)),
        'order_cooldown': int(os.getenv('ORDER_RESEND_COOLDOWN_SECONDS', 60)),
        'max_per_phone_hour': int(os.getenv('MAX_MESSAGES_PER_PHONE_PER_HOUR', 5)),
        'timeout': int(os.getenv('META_API_TIMEOUT_SECONDS', 10)),
    }


def check_and_increment_whatsapp_limits(order_id, phone_number, force_resend=False):
    """
    Validates that sending this message does not violate production rate limits or daily budget.
    Returns (is_allowed: bool, rejection_reason: str).
    """
    limits = load_whatsapp_env_settings()
    order_cooldown_sec = limits['order_cooldown']
    max_daily = limits['max_daily']
    max_per_phone_hour = limits['max_per_phone_hour']

    today_str = timezone.now().strftime('%Y-%m-%d')
    daily_count_key = f"wa_quota_daily:{today_str}"
    order_lock_key = f"wa_cooldown_order:{order_id}"
    phone_rate_key = f"wa_rate_phone:{phone_number}"

    # 1. Check Per-Order Cooldown (Prevents accidental double-sends within cooldown window)
    if not force_resend:
        last_sent_time = cache.get(order_lock_key)
        if last_sent_time:
            remaining = int(order_cooldown_sec - (time.time() - last_sent_time))
            if remaining > 0:
                return False, f"Receipt already sent recently for this order. Please wait {remaining} seconds before re-sending."

    # 2. Check Daily Safety Cap
    daily_sent = cache.get(daily_count_key, 0)
    if daily_sent >= max_daily:
        logger.error(
            f"WhatsApp daily quota reached: {daily_sent}/{max_daily}. "
            "Blocking further automated outbound messages to prevent billing surge."
        )
        return False, (
            f"Store WhatsApp daily limit reached ({daily_sent}/{max_daily} messages today). "
            "Please use WhatsApp Web or print receipt to prevent excess API billing."
        )

    # 3. Check Per-Phone Hourly Rate Limit
    phone_count = cache.get(phone_rate_key, 0)
    if phone_count >= max_per_phone_hour:
        return False, f"Too many messages sent to phone ending in ...{phone_number[-4:]} recently. Limit is {max_per_phone_hour} per hour."

    return True, ""


def record_successful_whatsapp_send(order_id, phone_number):
    """
    Records successful dispatch in cache to enforce cooldowns and rolling budget counters.
    """
    limits = load_whatsapp_env_settings()
    order_cooldown_sec = limits['order_cooldown']

    today_str = timezone.now().strftime('%Y-%m-%d')
    daily_count_key = f"wa_quota_daily:{today_str}"
    order_lock_key = f"wa_cooldown_order:{order_id}"
    phone_rate_key = f"wa_rate_phone:{phone_number}"

    # Update order cooldown
    cache.set(order_lock_key, time.time(), timeout=order_cooldown_sec)

    # Increment daily counter (persists 48h to cover timezone drift)
    try:
        cache.add(daily_count_key, 0, timeout=172800)
        cache.incr(daily_count_key)
    except Exception:
        cur = cache.get(daily_count_key, 0)
        cache.set(daily_count_key, cur + 1, timeout=172800)

    # Increment per-phone counter (persists 1 hour)
    try:
        cache.add(phone_rate_key, 0, timeout=3600)
        cache.incr(phone_rate_key)
    except Exception:
        cur_ph = cache.get(phone_rate_key, 0)
        cache.set(phone_rate_key, cur_ph + 1, timeout=3600)


def generate_invoice_pdf_buffer(order):
    """
    Generates an exact 80mm POS thermal receipt PDF matching the visual onscreen bill:
    - Red 'WONDER SALE' header + 'FOR BETTER NATION' tagline
    - Store address & Hamidiya Road, Bhopal phone
    - Invoice metadata (No, Customer, Mobile, GST, Date, Time, Payment Mode)
    - Item breakdown (Qty, MRP, Rate, Dis, Total)
    - Cash, Total Qty, Total Amount, Payable Amount
    - Cashier Name, GSTIN, THANK YOU AND VISIT AGAIN, and TERMS & CONDITIONS.
    """
    buffer = io.BytesIO()
    # 80mm thermal receipt dimensions: 78mm width, dynamic height
    receipt_width_pt = 78 * 2.83465 # ~221 pt
    
    # Calculate approximate height based on line items
    item_count = order.items.count()
    estimated_height_pt = max(520, 360 + (item_count * 32))

    doc = SimpleDocTemplate(
        buffer,
        pagesize=(receipt_width_pt, estimated_height_pt),
        rightMargin=8,
        leftMargin=8,
        topMargin=10,
        bottomMargin=10
    )
    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        'ReceiptHeader',
        parent=styles['Normal'],
        fontSize=15,
        leading=17,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#DC2626'),
        alignment=1
    )
    tagline_style = ParagraphStyle(
        'ReceiptTagline',
        parent=styles['Normal'],
        fontSize=7,
        leading=9,
        fontName='Helvetica-Bold',
        textColor=colors.black,
        alignment=1
    )
    store_meta_style = ParagraphStyle(
        'ReceiptStoreMeta',
        parent=styles['Normal'],
        fontSize=6.5,
        leading=8.5,
        textColor=colors.black,
        alignment=1
    )
    receipt_text_bold = ParagraphStyle(
        'ReceiptTextBold',
        parent=styles['Normal'],
        fontSize=6.5,
        leading=8.5,
        fontName='Helvetica-Bold',
        textColor=colors.black
    )
    receipt_text = ParagraphStyle(
        'ReceiptText',
        parent=styles['Normal'],
        fontSize=6.5,
        leading=8.5,
        textColor=colors.black
    )
    receipt_text_right = ParagraphStyle(
        'ReceiptTextRight',
        parent=styles['Normal'],
        fontSize=6.5,
        leading=8.5,
        textColor=colors.black,
        alignment=2
    )
    terms_head = ParagraphStyle(
        'TermsHead',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        fontName='Helvetica-Bold',
        textColor=colors.black,
        alignment=1
    )
    terms_body = ParagraphStyle(
        'TermsBody',
        parent=styles['Normal'],
        fontSize=5.5,
        leading=7.5,
        textColor=colors.HexColor('#1f2937'),
        alignment=0
    )

    elements = []

    is_return = bool(
        getattr(order, 'is_return', False) or
        (order.invoice_number and str(order.invoice_number).startswith('RET-')) or
        getattr(order, 'return_reference', None)
    )

    # Store Header
    store_name = 'WONDER SALE'
    store_address = (order.store.address if order.store and getattr(order.store, 'address', None) else '') or '3rd and 4th Floor, Bhopal Plaza, Near Bhopal Talkies, Hamidiya Road, Bhopal'
    store_phone = getattr(order.store, 'phone', '9755004996') if order.store else '9755004996'

    elements.append(Paragraph(f'<b>{store_name}</b>', header_style))
    tagline_text = 'RETURN & REFUND VOUCHER' if is_return else 'FOR BETTER NATION'
    elements.append(Paragraph(tagline_text, tagline_style))
    elements.append(Spacer(1, 3))
    elements.append(Paragraph(f'{store_address}. M-{store_phone}', store_meta_style))
    elements.append(Spacer(1, 4))

    # Meta Section
    local_created = timezone.localtime(order.created_at) if order.created_at else timezone.localtime()
    date_str = local_created.strftime('%d-%m-%Y')
    time_str = local_created.strftime('%I:%M %p')
    cust_display = order.customer_name or (order.customer.name if order.customer else 'Dear Customer')
    cust_phone = order.customer_phone or (order.customer.phone if order.customer else '')
    gst_no = getattr(order.store, 'gst_number', '23ANGPK5446D2Z8') or '23ANGPK5446D2Z8'
    payment_mode = str(order.payment_method or 'Cash').capitalize()
    cashier_display = order.cashier_name or (order.cashier.get_full_name() if order.cashier else 'Salman')

    voucher_title = 'VOUCHER NO.' if is_return else 'INVOICE NO.'
    mode_label = 'Refund Mode' if is_return else 'Payment Mode'

    meta_table_data = [
        [
            Paragraph(f'<b>{voucher_title} {order.invoice_number}</b>', receipt_text_bold),
            Paragraph(f'<b>Date:{date_str}</b>', receipt_text_right)
        ]
    ]

    if is_return and getattr(order, 'return_reference', None):
        meta_table_data.append([
            Paragraph(f'<b>Original Bill:</b> #{order.return_reference}', receipt_text_bold),
            Paragraph(f'Time:{time_str}', receipt_text_right)
        ])
        meta_table_data.append([
            Paragraph(f'Name :- {cust_display}', receipt_text),
            Paragraph(f'{mode_label}- {payment_mode}', receipt_text_right)
        ])
    else:
        meta_table_data.append([
            Paragraph(f'Name :- {cust_display}', receipt_text),
            Paragraph(f'Time:{time_str}', receipt_text_right)
        ])
        meta_table_data.append([
            Paragraph(f'Mobile No: {cust_phone}', receipt_text),
            Paragraph(f'{mode_label}- {payment_mode}', receipt_text_right)
        ])

    meta_table_data.append([
        Paragraph(f'GST NO : {gst_no}', receipt_text),
        Paragraph('', receipt_text_right)
    ])

    meta_table = Table(meta_table_data, colWidths=[115, 90])
    meta_table.setStyle(TableStyle([
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.black),
        ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 4))

    # Items Table Header & Rows
    # Qty, MRP, Rate, Dis, Total
    items_table_data = [
        [
            Paragraph('<b>Qty</b>', receipt_text_bold),
            Paragraph('<b>MRP</b>', receipt_text_right),
            Paragraph('<b>Rate</b>', receipt_text_right),
            Paragraph('<b>Dis</b>', receipt_text_right),
            Paragraph('<b>Total</b>', receipt_text_right)
        ]
    ]

    total_qty = 0
    for line in order.items.all():
        qty = line.quantity or 1
        total_qty += qty
        unit_rate = float(getattr(line, 'unit_selling_price', getattr(line, 'unit_price', 0)))
        mrp_val = float(getattr(line, 'mrp', getattr(line, 'item_mrp', unit_rate)) or unit_rate)
        dis_val = max(0.0, (mrp_val - unit_rate) * qty)
        total_val = float(line.total_price or (unit_rate * qty))

        # Item Name Row spanning across columns
        item_name = line.item_name or 'Item'
        items_table_data.append([
            Paragraph(f'<b>{item_name.upper()}</b>', receipt_text_bold),
            '', '', '', ''
        ])
        # Values Row
        items_table_data.append([
            Paragraph(str(qty), receipt_text),
            Paragraph(f'{mrp_val:,.2f}', receipt_text_right),
            Paragraph(f'{unit_rate:,.2f}', receipt_text_right),
            Paragraph(f'{dis_val:,.2f}', receipt_text_right),
            Paragraph(f'{total_val:,.2f}', receipt_text_right)
        ])

    items_table = Table(items_table_data, colWidths=[25, 45, 45, 40, 50])
    items_table_style = [
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.black),
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]
    # Span item names
    curr_r = 1
    for _ in order.items.all():
        items_table_style.append(('SPAN', (0, curr_r), (-1, curr_r)))
        curr_r += 2

    items_table.setStyle(TableStyle(items_table_style))
    elements.append(items_table)
    elements.append(Spacer(1, 4))

    # Totals Summary Section
    grand_total_val = float(order.total_amount or 0)
    totals_data = [
        [
            Paragraph(f'Cash : {grand_total_val:,.2f}', receipt_text_bold),
            Paragraph(f'Total Qty : {total_qty}', receipt_text_right)
        ],
        [
            Paragraph('Card : 0', receipt_text),
            Paragraph(f'Total Amount : {grand_total_val:,.2f}', receipt_text_right)
        ],
        [
            Paragraph('UPI : 0', receipt_text),
            Paragraph(f'<b>Payable Amount : {grand_total_val:,.2f}</b>', receipt_text_right)
        ]
    ]
    totals_table = Table(totals_data, colWidths=[105, 100])
    totals_table.setStyle(TableStyle([
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 4))

    # Cashier & Footer
    elements.append(Paragraph(f'Cashier Name - {cashier_display}', receipt_text))
    elements.append(Paragraph(f'GSTIN No - {gst_no}', receipt_text))
    elements.append(Spacer(1, 5))
    elements.append(Paragraph('<b>THANK YOU AND VISIT AGAIN</b>', tagline_style))
    elements.append(Spacer(1, 4))

    # Terms & Conditions
    elements.append(Paragraph('<b>TERMS & CONDITIONS</b>', terms_head))
    elements.append(Spacer(1, 2))
    terms_paragraphs = (
        '1. Check before you leave: Verify items, quantity, price and working condition at the counter.<br/>'
        '2. No warranty: Most products are imported/generic and carry no warranty unless stated.<br/>'
        '3. Returns/exchange: Only within 2 days with this bill and unused in original packaging.<br/>'
        '4. Disputes are subject to Bhopal jurisdiction only.'
    )
    elements.append(Paragraph(terms_paragraphs, terms_body))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def send_whatsapp_bill_for_order(order, recipient_phone=None, pdf_bytes=None, force_resend=False):
    """
    Sends WhatsApp message with attached PDF invoice using Meta Cloud API.
    Enforces production limits:
    - Daily volume threshold
    - Per-order cooldown (prevents rapid double-clicks)
    - Per-phone rate limits
    - Strict HTTP network timeouts
    Returns (success: bool, response_data: dict, error_message: str)
    """
    limits = load_whatsapp_env_settings()
    phone_id = limits['phone_id']
    access_token = limits['access_token']
    meta_timeout = limits['timeout']

    if not phone_id or not access_token:
        return False, {}, "Meta WhatsApp credentials (phone ID or access token) are not configured."

    target_phone = recipient_phone or order.customer_phone or (order.customer.phone if order.customer else '')
    clean_phone = ''.join(filter(str.isdigit, str(target_phone)))
    if len(clean_phone) == 10:
        clean_phone = f'91{clean_phone}'

    if not clean_phone:
        return False, {}, "Customer does not have a valid phone number."

    # 0. Check production rate limits and daily quota cap
    allowed, rejection_reason = check_and_increment_whatsapp_limits(order.id, clean_phone, force_resend=force_resend)
    if not allowed:
        logger.warning(f"WhatsApp rate limit / safety cap triggered: {rejection_reason}")
        return False, {}, rejection_reason

    try:
        local_created = timezone.localtime(order.created_at) if order.created_at else timezone.localtime()

        # 1. Use uploaded visual receipt PDF if provided, else fallback to generated PDF
        if not pdf_bytes:
            pdf_bytes = generate_invoice_pdf_buffer(order)

        # 2. Upload media
        media_url = f'https://graph.facebook.com/v20.0/{phone_id}/media'
        headers = {'Authorization': f'Bearer {access_token}'}
        is_return = bool(
            getattr(order, 'is_return', False) or
            (order.invoice_number and str(order.invoice_number).startswith('RET-')) or
            getattr(order, 'return_reference', None) or
            getattr(order, 'status', '') == 'refunded'
        )

        filename = f'Wondersale_Return_Voucher_{order.invoice_number}.pdf' if is_return else f'Wondersale_Bill_{order.invoice_number}.pdf'
        files = {'file': (filename, pdf_bytes, 'application/pdf')}
        form_data = {'messaging_product': 'whatsapp', 'type': 'application/pdf'}

        upload_res = requests.post(media_url, headers=headers, files=files, data=form_data, timeout=meta_timeout)
        upload_data = upload_res.json()
        if upload_res.status_code != 200 or 'id' not in upload_data:
            err = upload_data.get('error', {}).get('message', 'Media upload failed')
            logger.error(f"WhatsApp media upload error: {upload_data}")
            return False, upload_data, f"Meta Media Upload Failed: {err}"

        media_id = upload_data['id']

        # 3. Send template message
        cust_name = (order.customer_name or '').strip()
        if not cust_name and order.customer:
            cust_name = (order.customer.name or '').strip()
        if not cust_name:
            cust_name = 'Dear Customer'

        dt_str = local_created.strftime('%d/%m/%Y %I:%M %p')
        total_qty = sum((it.quantity or 1) for it in order.items.all()) or 1
        payment_mode = str(order.payment_method or 'Cash').upper()
        total_amt = f'{float(order.total_amount or 0):,.2f}'

        # Allow customizing return template name via environment variable
        return_template_name = os.getenv('META_WHATSAPP_RETURN_TEMPLATE_NAME', 'return_receipt')
        template_name = return_template_name if is_return else 'bill'

        if is_return:
            # Return receipt / voucher body parameters:
            # {{1}} = Customer Name (e.g. Dear Customer)
            # {{2}} = Return Voucher Number (e.g. RET-0001)
            # {{3}} = Original Bill Number (e.g. INV-0042)
            # {{4}} = Date & Time
            # {{5}} = Items Returned Count
            # {{6}} = Refund Mode (e.g. CASH / UPI / STORE CREDIT)
            # {{7}} = Refund Amount (e.g. 150.00)
            orig_ref = str(getattr(order, 'return_reference', '') or 'N/A')
            body_params = [
                {'type': 'text', 'text': cust_name or 'Dear Customer'},
                {'type': 'text', 'text': order.invoice_number or 'RET-0001'},
                {'type': 'text', 'text': orig_ref},
                {'type': 'text', 'text': dt_str or 'N/A'},
                {'type': 'text', 'text': str(total_qty)},
                {'type': 'text', 'text': payment_mode or 'CASH'},
                {'type': 'text', 'text': total_amt or '0.00'}
            ]
        else:
            # Standard sales bill body parameters:
            # {{1}} = Customer Name (e.g. Dear Customer)
            # {{2}} = Invoice Number
            # {{3}} = Date & Time
            # {{4}} = Items Count
            # {{5}} = Payment Mode
            # {{6}} = Grand Total Amount
            body_params = [
                {'type': 'text', 'text': cust_name or 'Dear Customer'},
                {'type': 'text', 'text': order.invoice_number or 'INV-0001'},
                {'type': 'text', 'text': dt_str or 'N/A'},
                {'type': 'text', 'text': str(total_qty)},
                {'type': 'text', 'text': payment_mode or 'CASH'},
                {'type': 'text', 'text': total_amt or '0.00'}
            ]

        msg_url = f'https://graph.facebook.com/v20.0/{phone_id}/messages'
        payload = {
            'messaging_product': 'whatsapp',
            'to': clean_phone,
            'type': 'template',
            'template': {
                'name': template_name,
                'language': {'code': 'en'},
                'components': [
                    {
                        'type': 'header',
                        'parameters': [
                            {
                                'type': 'document',
                                'document': {
                                    'id': media_id,
                                    'filename': filename
                                }
                            }
                        ]
                    },
                    {
                        'type': 'body',
                        'parameters': body_params
                    }
                ]
            }
        }

        send_res = requests.post(
            msg_url,
            headers={'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'},
            json=payload,
            timeout=meta_timeout
        )
        send_data = send_res.json()

        if send_res.status_code == 200 and 'messages' in send_data:
            # 4. Record successful dispatch to increment counters and cooldowns
            record_successful_whatsapp_send(order.id, clean_phone)
            label = "return voucher" if is_return else "bill"
            logger.info(f"WhatsApp {label} sent successfully for order {order.invoice_number} to {clean_phone}")
            return True, send_data, ""
        else:
            err = send_data.get('error', {}).get('message', 'Message send failed')
            logger.error(f"WhatsApp send message error: {send_data}")
            return False, send_data, f"Meta Send Failed: {err}"

    except Exception as e:
        logger.exception("Error sending WhatsApp bill")
        return False, {}, str(e)


def handle_whatsapp_webhook_verification(hub_mode, hub_verify_token, hub_challenge):
    """
    Verifies Meta WhatsApp webhook handshake.
    Meta sends GET request with:
    - hub.mode = 'subscribe'
    - hub.verify_token = <configured verify token>
    - hub.challenge = <random integer/string challenge>
    Returns (is_valid: bool, challenge: str)
    """
    settings_dict = load_whatsapp_env_settings()
    expected_token = settings_dict.get('webhook_verify_token') or os.getenv('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN', '')

    if hub_mode == 'subscribe' and hub_verify_token and expected_token and hub_verify_token == expected_token:
        logger.info("Meta WhatsApp webhook verified successfully.")
        return True, str(hub_challenge)
    
    logger.warning("Meta WhatsApp webhook verification failed: token mismatch or invalid mode.")
    return False, ""


def process_whatsapp_webhook_event(payload):
    """
    Safely processes asynchronous Meta WhatsApp Cloud API webhook callbacks:
    - Message delivery receipts (sent, delivered, read, failed)
    - Inbound messages or customer reactions
    """
    try:
        entry_list = payload.get('entry', [])
        for entry in entry_list:
            for change in entry.get('changes', []):
                value = change.get('value', {})
                statuses = value.get('statuses', [])
                for status_item in statuses:
                    msg_id = status_item.get('id')
                    status_val = status_item.get('status')
                    recipient_id = status_item.get('recipient_id')
                    errors = status_item.get('errors')
                    if errors:
                        logger.warning(f"WhatsApp webhook delivery status '{status_val}' for {recipient_id} ({msg_id}): {errors}")
                    else:
                        logger.info(f"WhatsApp webhook delivery status: {status_val} for {recipient_id} ({msg_id})")
        return True
    except Exception as e:
        logger.exception(f"Error handling WhatsApp webhook payload: {e}")
        return False

