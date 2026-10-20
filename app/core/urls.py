"""URL normalisation helpers.

User-supplied URLs are stored verbatim and later rendered as ``href``
attributes that *other* people click (a student submits a file URL, an
instructor opens the submission). The scheme therefore has to be restricted
to the ones that are safe to navigate to: ``http`` and ``https``, plus a
same-origin relative path. Anything else -- ``javascript:``, ``data:``,
``file:``, ``vbscript:`` -- is rejected rather than being normalised into
something that merely looks harmless.
"""
from typing import Optional
from urllib.parse import urlparse

ALLOWED_SCHEMES = frozenset({"http", "https"})


class UnsafeUrlError(ValueError):
    """Raised when a URL uses a scheme that must not be rendered as a link."""


def is_relative_path(value: str) -> bool:
    """Whether the value is a root-relative, same-origin path.

    ``//host/x`` and ``/\\host/x`` are *not* relative paths: browsers
    resolve them against the current scheme and treat them as
    protocol-relative URLs, which leaves the site.
    """
    return value.startswith("/") and not value.startswith("//") and not value.startswith("/\\")


def safe_external_url(url: Optional[str]) -> Optional[str]:
    """Return ``url`` when it is safe to render as a link, otherwise raise.

    Safe means either an absolute ``http``/``https`` URL with a host, or a
    root-relative same-origin path. The value is returned trimmed, so the
    stored URL matches what a browser would resolve.
    """
    if url is None:
        return None

    value = str(url).strip()
    if not value:
        return None

    if is_relative_path(value):
        return value

    # urlparse strips ASCII newlines and tabs, so "java\nscript:alert(1)"
    # is parsed as the "javascript" scheme and rejected below.
    parsed = urlparse(value)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES or not parsed.netloc:
        raise UnsafeUrlError("Only http:// and https:// URLs are allowed")

    return value
