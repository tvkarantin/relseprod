"""Actor input construction.

Different Instagram Actors expect different input shapes, so the concrete
structure is built here and nowhere else.

Two documented families are supported:

``apify/instagram-reel-scraper`` (the default)
    ``{"username": ["example"], "resultsLimit": 20}``

``apify/instagram-scraper`` / ``apify/instagram-api-scraper``
    ``{"directUrls": ["https://www.instagram.com/example/"],
       "resultsType": "reels", "resultsLimit": 20}``

The shape is chosen from the configured actor id; it can also be forced with
``APIFY_ACTOR_INPUT_STYLE`` when a fork or a third-party actor is used.
"""

from __future__ import annotations

from enum import StrEnum


class ActorInputStyle(StrEnum):
    """Supported Actor input shapes."""

    AUTO = "auto"
    USERNAME = "username"
    DIRECT_URLS = "direct_urls"


DIRECT_URL_ACTOR_MARKERS: tuple[str, ...] = (
    "instagram-scraper",
    "instagram-api-scraper",
    "instagram-post-scraper",
    "instagram-profile-scraper",
)
"""Actor name fragments known to expect ``directUrls``."""

REELS_RESULTS_TYPE = "reels"


def resolve_input_style(actor_id: str, configured: ActorInputStyle | str | None = None) -> str:
    """Decide which input shape the configured Actor expects.

    ``configured`` wins when it is set to something other than ``auto``;
    otherwise the actor id is inspected.
    """
    style = ActorInputStyle(configured) if configured else ActorInputStyle.AUTO
    if style is not ActorInputStyle.AUTO:
        return str(style)

    normalized = actor_id.strip().lower().replace("~", "/")
    actor_name = normalized.rsplit("/", 1)[-1]

    # `instagram-reel-scraper` is a `*-scraper` too, so check it first.
    if "reel" in actor_name:
        return str(ActorInputStyle.USERNAME)
    if any(marker in actor_name for marker in DIRECT_URL_ACTOR_MARKERS):
        return str(ActorInputStyle.DIRECT_URLS)
    return str(ActorInputStyle.USERNAME)


def build_actor_input(
    username: str,
    profile_url: str,
    results_limit: int,
    *,
    actor_id: str = "",
    input_style: ActorInputStyle | str | None = None,
) -> dict[str, object]:
    """Build the JSON body sent to the Apify Actor.

    Args:
        username: normalized Instagram username (lowercase, no ``@``).
        profile_url: canonical profile URL.
        results_limit: maximum number of reels to fetch.
        actor_id: configured Actor id, used to detect the expected shape.
        input_style: explicit override of the detected shape.

    Returns:
        A JSON-serializable dictionary.
    """
    limit = max(1, int(results_limit))
    style = resolve_input_style(actor_id, input_style)

    if style == ActorInputStyle.DIRECT_URLS:
        return {
            "directUrls": [profile_url],
            "resultsType": REELS_RESULTS_TYPE,
            "resultsLimit": limit,
        }

    return {
        "username": [username],
        "resultsLimit": limit,
    }
