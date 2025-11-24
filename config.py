"""
Configuration file for EM Calculator Web App
"""
import os
from datetime import timedelta
import redis

class Config:
    """Base configuration"""
    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'

    # Redis
    REDIS_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'

    # Session
    SESSION_TYPE = 'redis'
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True
    SESSION_KEY_PREFIX = 'emcalc:'
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=30)
    SESSION_REDIS = redis.from_url(REDIS_URL, decode_responses=True)

    # Celery
    CELERY_BROKER_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'
    CELERY_RESULT_BACKEND = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'
    CELERY_TASK_TRACK_STARTED = True
    CELERY_TASK_TIME_LIMIT = 3600  # 1 hour max

    # Authentication
    USERNAME = os.environ.get('APP_USERNAME') or 'admin'
    PASSWORD = os.environ.get('APP_PASSWORD') or 'change-me'

    # File paths
    TEMP_FOLDER = os.path.join(os.path.dirname(__file__), 'temp')
    SESSION_FOLDER = os.path.join(os.path.dirname(__file__), 'sessions')

    # Upload settings
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB max upload

    # Calculation settings
    MAX_WORKERS = int(os.environ.get('MAX_WORKERS', 4))

    @staticmethod
    def init_app(app):
        # Ensure temp and session folders exist
        os.makedirs(Config.TEMP_FOLDER, exist_ok=True)
        os.makedirs(Config.SESSION_FOLDER, exist_ok=True)


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    FLASK_ENV = 'development'


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    FLASK_ENV = 'production'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
