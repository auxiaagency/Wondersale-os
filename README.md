# Wondersale Retail ERP & Point-of-Sale System

A production-grade, multi-store retail management platform designed for speed, security, and scalability. Built as a high-performance **Django REST Framework** backend monolith powering an ultra-responsive, glassmorphic **React Single Page Application (SPA)**.

---

## 🚀 Key Modules & Capabilities

- **🛒 Point of Sale (Billing & Register Shifts):**
  - Instant barcode scan-to-cart (hardware USB/Bluetooth barcode scanner & RFID support).
  - Cash, card, split payments, store credit, and return/exchange processing.
  - Cash register opening/closing shifts with real-time drawer audits and variance tracking.
  - Automated digital receipt generation & WhatsApp PDF invoice dispatch via Meta Cloud API.
  - Thermal 80mm & A4 invoice printing with printable Code128 barcodes.

- **📦 Inventory & Supply Chain Management:**
  - Immutable stock ledger (`StockMovement`) tracking all adjustments, sales, purchases, damages, and returns.
  - Automated sequential UID and barcode label generator (`1000000+`).
  - Automated server-side WebP image conversion and multi-angle product photo galleries.
  - Write-off damage workflow with required photo evidence and financial loss calculations.
  - Bulk CSV import & export engine with fuzzy duplicate detection and conflict resolution.
  - Multi-store inventory isolation with store-specific stock levels.

- **👥 Staff & HR Management:**
  - Granular Role-Based Access Control (RBAC) across 8 module permissions.
  - Dual-mode attendance tracking: RFID/Barcode card tap kiosk and manual biometric logging.
  - Automated salary structure computation (base pay, daily overtime, deductions, bonuses).
  - Interim settlements, monthly payroll finalization, and employee financial ledgers.
  - Progressive brute-force login throttling and session rotation.

- **💼 Stakeholders & Vendor Accounts:**
  - Vendor and stakeholder balance ledgers.
  - Purchase invoices, expense accounting, profit-share distributions, and payout tracking.

- **📊 Accounting & Executive Intelligence:**
  - Real-time gross and net profit margins per product, category, and store location.
  - Financial trends, revenue curve visualization, and top-performing merchandise analytics.
  - Comprehensive operational expense categorization and audit trails.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11+, Django 5.2, Django REST Framework |
| **Database** | PostgreSQL (Production) / SQLite3 (Development fallback) |
| **Password Security** | Argon2 hashing (`argon2-cffi`), PBKDF2 fallback |
| **Image Processing** | Pillow (converts JPG, PNG, HEIC to WebP in-memory) |
| **Barcodes** | `python-barcode` (Code128 symbology) |
| **PDF Generation** | ReportLab (Tax invoices, customer receipts) |
| **Frontend** | React 19, Vite, Lucide Icons, Vanilla CSS |
| **Design System** | Glassmorphism, dynamic Dark/Light theme persistence |
| **Server/Deployment** | Gunicorn (WSGI), Nginx (Reverse Proxy & Static file server), Systemd |

---

## 📂 Project Architecture

```
wondersale_system/
├── backend/
│   ├── accounting/              # Financial ledgers, statements, and operating expenses
│   ├── inventory/               # Items, categories, stock ledger, POS sales, and shifts
│   ├── staff/                   # RBAC, attendance kiosk, payroll, and auth services
│   ├── stakeholders/            # Suppliers, stakeholder investments, and payouts
│   ├── wondersale_core/         # Root settings, security headers, middleware, WSGI/ASGI
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example             # Production environment template
├── frontend/
│   ├── src/
│   │   ├── components/          # Views: Billing, Inventory, Staff, Accounts, Settings
│   │   ├── hooks/               # Custom React hooks (e.g. useDebounce)
│   │   ├── utils/               # PDF generators, sound effects, RFID handlers, formatters
│   │   ├── api.js               # Centralized REST client with auth headers & CSRF
│   │   ├── index.css            # Custom CSS tokens & responsive styles
│   │   └── App.jsx              # Main layout, routing, and store selector
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── brand-kit/                   # High-resolution logos and vector SVG branding
├── start.bat                    # 1-click Windows starter (Dev mode)
└── README.md
```

---

## ⚡ Quickstart (Local Development)

### Windows (1-Click Launch)
Double-click `start.bat` in the root folder. It will:
1. Verify Python and Node.js.
2. Auto-create `backend/venv` and install `requirements.txt`.
3. Auto-install frontend `node_modules`.
4. Apply database migrations.
5. Launch both Django (Port 8000) and Vite (Port 5173) in separate windows and open your browser.

---

### Manual Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```
- API Endpoint: `http://127.0.0.1:8000/api/`
- Django Admin: `http://127.0.0.1:8000/admin/`

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- UI Interface: `http://localhost:5173/`

---

## 🔒 Security Hardening

- **No Plaintext Passwords:** Argon2 password hashing enabled by default.
- **Progressive Rate Limiting:** Brute-force protection on authentication endpoints.
- **Strict Headers:** CSP v4, HSTS, X-Content-Type-Options (`nosniff`), X-Frame-Options (`DENY`), and Referrer-Policy configured.
- **Rotating Server Logs:** Django file logs rotate automatically at 10MB (max 5 backups) in `backend/logs/`.
- **Zero Secret Leakage:** `.env`, databases (`db.sqlite3`), logs, and media files are strictly ignored by `.gitignore`.

---

## 🌐 Production Deployment (VPS with Nginx + Gunicorn)

### 1. Backend Service (`systemd`)
Create `/etc/systemd/system/wondersale.service`:
```ini
[Unit]
Description=Gunicorn daemon for Wondersale Retail Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/wondersale/backend
ExecStart=/var/www/wondersale/backend/venv/bin/gunicorn \
          --workers 3 \
          --bind 127.0.0.1:8000 \
          --timeout 120 \
          wondersale_core.wsgi:application

[Install]
WantedBy=multi-user.target
```

### 2. Frontend Production Build
```bash
cd /var/www/wondersale/frontend
npm install
npm run build
```

### 3. Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend Single Page App
    root /var/www/wondersale/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API & Admin Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static & Media Assets
    location /static/ {
        alias /var/www/wondersale/backend/staticfiles/;
    }

    location /media/ {
        alias /var/www/wondersale/backend/media/;
    }
}
```

---

## 🧪 Running Tests

To run the backend test suites:
```bash
cd backend
python manage.py test
```
To run specific module tests:
```bash
python manage.py test inventory
python manage.py test staff
python manage.py test accounting
python manage.py test stakeholders
```
