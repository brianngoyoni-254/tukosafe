from flask import Blueprint, jsonify

router = Blueprint("health", __name__)


@router.get("/health")
def health():
    return jsonify({"status": "ok", "service": "tukosafe-api"})


@router.get("/")
def root():
    return jsonify({
        "name": "TukoSafe API",
        "tagline": "Go Out. Have Fun. Get Home Safe.",
        "emergency_note": "TukoSafe is not an emergency service. In an emergency, call 999 or 112.",
    })
