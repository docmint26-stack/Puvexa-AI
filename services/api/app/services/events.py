"""Shared audit and notification primitives (no service imports -> no cycles)."""
from app.db.models import AuditEvent, Notification


def audit(db, user_id, action, entity_type, entity_id):
    db.add(AuditEvent(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id))


def notify(db, user_id, title, message, kind="case", href=None):
    db.add(Notification(user_id=user_id, title=title, message=message, type=kind, action_url=href))