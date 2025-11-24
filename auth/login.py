"""
Authentication module for EM Calculator
"""
from functools import wraps
from flask import session, redirect, url_for, flash, request
from config import Config


def check_auth(username, password):
    """Check if username/password combination is valid"""
    return username == Config.USERNAME and password == Config.PASSWORD


def login_required(f):
    """Decorator to require login for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session or not session['logged_in']:
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function


def login_user():
    """Set session variables when user logs in"""
    session['logged_in'] = True
    session.permanent = False


def logout_user():
    """Clear session when user logs out"""
    session.clear()
