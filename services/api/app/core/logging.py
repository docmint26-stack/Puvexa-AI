"""Lightweight structured logging for the Puvexa backend.

Emits single-line JSON records to stdout so staging hosts can ship them to any
log aggregator. A JSON formatter is applied to the ``puvexa`` logger; callers
attach extra fields via ``extra={"fields": {...}}`` (never raw secrets —
middlewares and services only log safe identifiers: request ids, statuses,
claim ids, transaction statuses).

Future monitoring integration (e.g. Sentry / Application Insights) can be added
here by subscribing processors without changing call sites.
"""
import json
import logging
import sys
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """Writes records as one JSON object per line with a custom ``fields`` map."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            for key, value in fields.items():
                payload[str(key)] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def setup_logging(level: int = logging.INFO) -> None:
    """Configure the shared ``puvexa`` logger exactly once."""
    logger = logging.getLogger("puvexa")
    if logger.handlers:
        return
    logger.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)