import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file if present
env_file_path = BASE_DIR / '.env'
if env_file_path.exists():
    try:
        with open(env_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception as e:
        print(f"Warning: could not load .env file: {e}")

# Determine environment (production vs development)
DJANGO_ENV = os.environ.get('DJANGO_ENV', 'development').lower()
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('1', 'true', 'yes')

# SECRET_KEY Configuration
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY environment variable must be set in production!")
    # Development fallback
    SECRET_KEY = 'django-insecure-z@oj*$-6y$2@c3seyqru0@xo=%glb@yji0=h_w6f*k!osm7dk!'

# ALLOWED_HOSTS
raw_allowed_hosts = os.environ.get('ALLOWED_HOSTS')
if raw_allowed_hosts:
    ALLOWED_HOSTS = [h.strip() for h in raw_allowed_hosts.split(',') if h.strip()]
else:
    if DEBUG:
        ALLOWED_HOSTS = ['*']
    else:
        ALLOWED_HOSTS = ['wonder.sale', 'api.wonder.sale', 'localhost', '127.0.0.1']

# Custom admin URL prefix (can be customized via ADMIN_URL_PREFIX env var)
ADMIN_URL_PREFIX = os.environ.get('ADMIN_URL_PREFIX', 'admin/').strip('/') + '/'

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party apps
    'corsheaders',
    'rest_framework',
    'csp',
    # Domain modules
    'inventory.apps.InventoryConfig',
    'staff.apps.StaffConfig',
    'stakeholders.apps.StakeholdersConfig',
    'accounting.apps.AccountingConfig',
]

MIDDLEWARE = [
    'wondersale_core.middleware.RequestIDMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'csp.middleware.CSPMiddleware',
    'wondersale_core.middleware.SecurityHeadersMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'wondersale_core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'wondersale_core.wsgi.application'

# Database configuration: PostgreSQL with seamless fallback to SQLite
if os.environ.get('POSTGRES_DB'):
    db_options = {
        'connect_timeout': int(os.environ.get('POSTGRES_CONNECT_TIMEOUT', 10)),
    }
    ssl_mode = os.environ.get('POSTGRES_SSLMODE')
    if ssl_mode:
        db_options['sslmode'] = ssl_mode
    elif not DEBUG:
        db_options['sslmode'] = 'require'

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'wondersale'),
            'USER': os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
            'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': db_options,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'CONN_MAX_AGE': 600,
        }
    }

# Password Hashing with Argon2 first
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 12},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Ensure directories exist on startup (especially on fresh VPS deployment)
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
STATIC_ROOT.mkdir(parents=True, exist_ok=True)

# Image upload & WebP conversion settings
WEBP_QUALITY = int(os.environ.get('WEBP_QUALITY', 80))

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ==============================================================================
# SECURITY, COOKIES & SSL SETTINGS
# ==============================================================================
if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() in ('1', 'true', 'yes')
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', 31536000))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
else:
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False

    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

# HTTP-Only & SameSite Cookie Policies
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

# Basic Security Headers
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# ==============================================================================
# CONTENT SECURITY POLICY (CSP v4 Format)
# ==============================================================================
CONTENT_SECURITY_POLICY = {
    'DIRECTIVES': {
        'default-src': ("'self'",),
        'script-src': ("'self'", "'unsafe-inline'"),
        'style-src': ("'self'", "'unsafe-inline'", "https://fonts.googleapis.com"),
        'font-src': ("'self'", "https://fonts.gstatic.com", "data:"),
        'img-src': ("'self'", "data:", "blob:", "https://*"),
        'connect-src': (
            "'self'",
            "http://localhost:*",
            "http://127.0.0.1:*",
            "https://wonder.sale",
            "https://*.wonder.sale",
        ),
        'frame-ancestors': ("'none'",),
    }
}

# ==============================================================================
# CORS & CSRF CONFIGURATION
# ==============================================================================
if not DEBUG:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        'https://wonder.sale',
        'https://app.wonder.sale',
        'https://api.wonder.sale',
    ]
    raw_cors = os.environ.get('CORS_ALLOWED_ORIGINS')
    if raw_cors:
        CORS_ALLOWED_ORIGINS.extend([o.strip() for o in raw_cors.split(',') if o.strip()])
else:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOWED_ORIGINS = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]

CORS_ALLOW_CREDENTIALS = True

# CSRF trusted origins
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://wonder.sale',
    'https://app.wonder.sale',
    'https://api.wonder.sale',
]
raw_csrf = os.environ.get('CSRF_TRUSTED_ORIGINS')
if raw_csrf:
    CSRF_TRUSTED_ORIGINS.extend([o.strip() for o in raw_csrf.split(',') if o.strip()])

# ==============================================================================
# REST FRAMEWORK SETTINGS
# ==============================================================================
REST_FRAMEWORK_RENDERERS = ['rest_framework.renderers.JSONRenderer']
if DEBUG:
    REST_FRAMEWORK_RENDERERS.append('rest_framework.renderers.BrowsableAPIRenderer')

import sys
TESTING = 'test' in sys.argv

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'DEFAULT_RENDERER_CLASSES': REST_FRAMEWORK_RENDERERS,
    'DEFAULT_THROTTLE_CLASSES': [] if TESTING else [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/minute',
        'user': '1000/minute',
    },
}

# ==============================================================================
# LOGGING CONFIGURATION
# ==============================================================================
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} [{name}:{lineno}] {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'wondersale.log',
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': os.environ.get('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': True,
        },
        'django.security': {
            'handlers': ['console', 'file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'wondersale': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
