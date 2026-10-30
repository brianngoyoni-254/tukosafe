from . import admin, auth, checkins, contacts, get_me_home, health, journeys, outings, shares, sos, venues


def register_blueprints(app):
    app.register_blueprint(health.router)
    app.register_blueprint(auth.router)
    app.register_blueprint(contacts.router)
    app.register_blueprint(outings.router)
    app.register_blueprint(checkins.router)
    app.register_blueprint(shares.router)
    app.register_blueprint(get_me_home.router)
    app.register_blueprint(sos.router)
    app.register_blueprint(journeys.router)
    app.register_blueprint(venues.router)
    app.register_blueprint(admin.router)
