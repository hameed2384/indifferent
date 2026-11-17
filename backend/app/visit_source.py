"""Where a visitor came from (instagram, youtube, google, direct...).

The frontend works the source out on landing (utm_source, else the referrer)
and sends it with the visit ping, guest round starts and sign-ups, so the
admin Growth tab can show which channel actually brings people in. Values are
short lowercase slugs; anything else is dropped rather than stored."""
import re
from typing import Optional

_SOURCE_RE = re.compile(r"^[a-z0-9_.-]{1,32}$")


def clean_source(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = str(value).strip().lower()
    return v if _SOURCE_RE.match(v) else None
