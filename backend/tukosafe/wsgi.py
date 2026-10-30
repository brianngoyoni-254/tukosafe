"""WSGI entry point for gunicorn/production servers."""
from app import create_app

app = create_app()
