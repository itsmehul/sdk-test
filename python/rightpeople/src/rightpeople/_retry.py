from __future__ import annotations

import random
import time
from email.utils import parsedate_to_datetime

import httpx

INITIAL_DELAY = 0.5
MAX_DELAY = 8.0
MAX_RETRY_AFTER = 60.0


def should_retry(response: httpx.Response) -> bool:
    override = response.headers.get("x-should-retry")
    if override == "true":
        return True
    if override == "false":
        return False
    return response.status_code in (408, 409, 429) or response.status_code >= 500


def _retry_after(headers: httpx.Headers | None) -> float | None:
    if headers is None:
        return None
    try:
        ms = float(headers.get("retry-after-ms", ""))
        if ms > 0:
            return ms / 1000
    except ValueError:
        pass

    value = headers.get("retry-after")
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(value).timestamp() - time.time()
    except (TypeError, ValueError):
        return None


def retry_delay(attempt: int, headers: httpx.Headers | None = None) -> float:
    """Seconds to wait: a reasonable server `retry-after`, else backoff with full jitter."""
    from_server = _retry_after(headers)
    if from_server is not None and 0 <= from_server <= MAX_RETRY_AFTER:
        return from_server
    return random.random() * min(MAX_DELAY, INITIAL_DELAY * 2**attempt)
