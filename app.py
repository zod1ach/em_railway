"""
EM Calculator Web Application
Main Flask application entry point
"""
import os
from flask import Flask, render_template, request, redirect, url_for, flash, session
from flask_session import Session
from celery import Celery
import redis

from config import config
from auth.login import check_auth, login_required, login_user, logout_user


def create_app(config_name='default'):
    """Application factory"""
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config[config_name])

    # Initialize Redis for sessions
    redis_url = app.config.get('REDIS_URL')
    if redis_url:
        # Flask-Session 0.8.0 handles encoding internally, don't use decode_responses
        app.config['SESSION_REDIS'] = redis.from_url(redis_url)

    config[config_name].init_app(app)

    # Initialize Flask-Session
    Session(app)

    # Initialize Celery
    celery = make_celery(app)
    app.celery = celery

    # Register blueprints
    from blueprints import hvac_nonmagnetic, hvac_magnetic, dc_bipole, wmm_geomag, cable_3d
    app.register_blueprint(hvac_nonmagnetic.bp)
    app.register_blueprint(hvac_magnetic.bp)
    app.register_blueprint(dc_bipole.bp)
    app.register_blueprint(wmm_geomag.bp)
    app.register_blueprint(cable_3d.bp)

    # Login route
    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            username = request.form.get('username')
            password = request.form.get('password')

            if check_auth(username, password):
                login_user()
                flash('Successfully logged in!', 'success')
                next_page = request.args.get('next')
                return redirect(next_page or url_for('index'))
            else:
                flash('Invalid username or password', 'danger')

        return render_template('login.html')

    # Logout route
    @app.route('/logout')
    def logout():
        logout_user()
        flash('Successfully logged out', 'info')
        return redirect(url_for('login'))

    # Main application route
    @app.route('/')
    @login_required
    def index():
        return render_template('index.html')

    # Health check for Railway
    @app.route('/health')
    def health():
        return {'status': 'healthy'}, 200

    return app


def make_celery(app):
    """Create Celery instance"""
    celery = Celery(
        app.import_name,
        broker=app.config['CELERY_BROKER_URL'],
        backend=app.config['CELERY_RESULT_BACKEND']
    )
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


app = create_app(os.environ.get('FLASK_CONFIG', 'production'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=app.config.get('DEBUG', False))
