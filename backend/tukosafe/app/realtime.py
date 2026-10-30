"""In-memory realtime fan-out (Flask has no native WebSockets).

Keeps the last N events per outing so clients can poll
GET /outings/<id>/events for live map + status updates.
"""
from __future__ import annotations

import collections
import threading

_MAX_EVENTS = 200
_rooms: dict[int, collections.deque] = {}
_lock = threading.Lock()


def broadcast(outing_id: int, event: dict) -> None:
    """Push an event to the in-memory room for an outing."""
    with _lock:
        room = _rooms.setdefault(outing_id, collections.deque(maxlen=_MAX_EVENTS))
        room.append(event)


def recent_events(outing_id: int) -> list[dict]:
    with _lock:
        room = _rooms.get(outing_id, collections.deque())
        return list(room)
