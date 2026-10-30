import app
a = app.create_app()
print("APP CREATED OK")
for r in sorted(a.url_map.iter_rules(), key=lambda x: x.rule):
    print(r.rule, list(r.methods))
