from pathlib import Path
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-4d%ap26=-ef_beba7ol-ghf$1!teipo=xn&2ircvtft5it9n0n'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True



# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    "api",
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
    'psycopg2',
    'permissions_api'
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', 
    'django.contrib.sessions.middleware.SessionMiddleware',
    "django.middleware.csrf.CsrfViewMiddleware",
    'corsheaders.middleware.CorsMiddleware',  # ✅ Correct position
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]



ROOT_URLCONF = 'impression_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [            BASE_DIR / 'templates',],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ]
    
}

WSGI_APPLICATION = 'impression_backend.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'Impression_inventory',
        'USER': 'root',
        'PASSWORD': 'Gargi@2275',
        'HOST': 'localhost',
        'PORT': '3306',
    },
    'tally': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'tally_sync_atpl_xihth',
        'USER': 'tally_sync_atpl_xihth',
        'PASSWORD': 'evM1jU0o6XkZVLgHNSsuc287QBfyKOIr',
        'HOST': 'db.sky9.ai',
        'PORT': '3306',
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}



AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


print("MEDIA_ROOT =", MEDIA_ROOT)


LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Kolkata'

USE_I18N = True

USE_TZ = False

import os
# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / "staticfiles" 
# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

CORS_ALLOW_ALL_ORIGINS = True  
AUTH_USER_MODEL = 'api.User'
ALLOWED_HOSTS = ['192.168.1.5', 'localhost', '127.0.0.1','flux-india.co.in','http://flux-india.co.in']

CORS_ALLOW_METHODS = [
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'
]
CORS_ALLOW_HEADERS = [
    'content-type', 'Authorization', 'x-csrftoken'
]



CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Monkey patch to skip MySQL/MariaDB version check (use carefully)
from django.db.backends.mysql.base import DatabaseWrapper

def skip_version_check(self):
    pass  # override to disable version check

DatabaseWrapper.check_database_version_supported = skip_version_check



CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

CORS_ALLOW_ALL_ORIGINS = True  


# from pathlib import Path
# # Build paths inside the project like this: BASE_DIR / 'subdir'.
# BASE_DIR = Path(__file__).resolve().parent.parent


# # SECURITY WARNING: keep the secret key used in production secret!
# SECRET_KEY = 'django-insecure-4d%ap26=-ef_beba7ol-ghf$1!teipo=xn&2ircvtft5it9n0n'

# # SECURITY WARNING: don't run with debug turned on in production!
# DEBUG = False



# # Application definition

# INSTALLED_APPS = [
#     'django.contrib.admin',
#     'django.contrib.auth',
#     'django.contrib.contenttypes',
#     'django.contrib.sessions',
#     'django.contrib.messages',
#     'django.contrib.staticfiles',
#     'api',
#     'corsheaders',
#     'rest_framework',
#     'rest_framework.authtoken',
#     'permissions_api',
# ]

# MIDDLEWARE = [
#     'django.middleware.security.SecurityMiddleware',
#     'whitenoise.middleware.WhiteNoiseMiddleware', 
#     'django.contrib.sessions.middleware.SessionMiddleware',
#     'corsheaders.middleware.CorsMiddleware',  # ✅ Correct position
#     'django.middleware.common.CommonMiddleware',
#     'django.middleware.csrf.CsrfViewMiddleware',
#     'django.contrib.auth.middleware.AuthenticationMiddleware',
#     'django.contrib.messages.middleware.MessageMiddleware',
#     'django.middleware.clickjacking.XFrameOptionsMiddleware',
# ]



# ROOT_URLCONF = 'impression_backend.urls'

# TEMPLATES = [
#     {
#         'BACKEND': 'django.template.backends.django.DjangoTemplates',
#         'DIRS': [            BASE_DIR / 'templates',],
#         'APP_DIRS': True,
#         'OPTIONS': {
#             'context_processors': [
#                 'django.template.context_processors.debug',
#                 'django.template.context_processors.request',
#                 'django.contrib.auth.context_processors.auth',
#                 'django.contrib.messages.context_processors.messages',
#             ],
#         },
#     },
# ]


# REST_FRAMEWORK = {
#     'DEFAULT_AUTHENTICATION_CLASSES': [
#         'rest_framework.authentication.TokenAuthentication',
#     ]
# }

# WSGI_APPLICATION = 'impression_backend.wsgi.application'


# # Database
# # https://docs.djangoproject.com/en/5.1/ref/settings/#databases

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.mysql',
#         'NAME': 'impression_inventory',
#         'USER': 'flux_database',
#         'PASSWORD': 'Flux@2025',
#         'HOST': 'localhost',
#         'PORT': '3306',
#     },
#     'tally': {
#         'ENGINE': 'django.db.backends.mysql',
#         'NAME': 'tally_sync_atpl_xihth',
#         'USER': 'tally_sync_atpl_xihth',
#         'PASSWORD': 'evM1jU0o6XkZVLgHNSsuc287QBfyKOIr',
#         'HOST': 'db.sky9.ai',
#         'PORT': '3306',
#     }
# }



# AUTH_PASSWORD_VALIDATORS = [
#     {
#         'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
#     },
#     {
#         'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
#     },
#     {
#         'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
#     },
#     {
#         'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
#     },
# ]



# MEDIA_URL = '/media/'
# MEDIA_ROOT = BASE_DIR / 'media'


# print("MEDIA_ROOT =", MEDIA_ROOT)

# LANGUAGE_CODE = 'en-us'

# TIME_ZONE = 'Asia/Kolkata'

# USE_I18N = True

# USE_TZ = False

# import os
# # Static files (CSS, JavaScript, Images)
# # https://docs.djangoproject.com/en/5.1/howto/static-files/

# STATIC_URL = '/static/'
# STATIC_ROOT = BASE_DIR / "staticfiles" 
# # Default primary key field type
# # https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

# DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
# STATICFILES_DIRS = [
#     BASE_DIR / "static",
# ]

# STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# CORS_ALLOW_ALL_ORIGINS = True  
# AUTH_USER_MODEL = 'api.User'
# ALLOWED_HOSTS = ['flux-india.co.in', 'www.flux-india.co.in', '127.0.0.1','localhost']


# CORS_ALLOW_METHODS = [
#     'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'
# ]
# CORS_ALLOW_HEADERS = [
#     'content-type', 'Authorization', 'x-csrftoken'
# ]

# CORS_ALLOWED_ORIGINS = [
#     'https://flux-india.co.in',   # ✅ correct
#     'https://www.flux-india.co.in',
#      "http://localhost:3000",
#     "http://127.0.0.1:3000",
# ]





# import os

# LOGGING = {
#     'version': 1,
#     'disable_existing_loggers': False,
#     'handlers': {
#         'file': {
#             'level': 'ERROR',
#             'class': 'logging.FileHandler',
#             'filename': os.path.join(BASE_DIR, 'django_error.log'),  # Or use an absolute path
#         },
#         'console': {
#             'class': 'logging.StreamHandler',
#         },
#     },
#     'loggers': {
#         'django': {
#             'handlers': ['file', 'console'],
#             'level': 'ERROR',
#             'propagate': True,
#         },
#     },
# }
