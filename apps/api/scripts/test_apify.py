"""Development script: run the configured Apify Actor against a real profile.

Usage (from ``apps/api`` with the venv active)::

    python -m scripts.test_apify natgeo
    python -m scripts.test_apify --limit 2 natgeo

The username can also be supplied via ``TEST_INSTAGRAM_USERNAME``.

The script prints only the *keys* of the first dataset item plus a few
non-sensitive scalars. The token is never printed, and the anonymized sample is
written to ``docs/apify-sample-output.json``.

⚠️  This performs a real Actor run and consumes Apify credits. Keep the limit low.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from app.core.config import API_DIR, get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging
from app.services.apify import ApifyService
from app.services.apify_input import build_actor_input, resolve_input_style
from app.services.instagram import normalize_instagram_profile
from app.services.reel_normalizer import normalize_apify_reel

SAMPLE_OUTPUT_PATH = API_DIR.parent.parent / "docs" / "apify-sample-output.json"

SENSITIVE_KEY_MARKERS: tuple[str, ...] = (
    "token",
    "password",
    "secret",
    "cookie",
    "authorization",
    "email",
    "phone",
)

MAX_SAMPLE_STRING = 120


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test the Apify integration")
    parser.add_argument(
        "profile",
        nargs="?",
        default=os.getenv("TEST_INSTAGRAM_USERNAME", ""),
        help="Instagram username or profile URL (or TEST_INSTAGRAM_USERNAME)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=2,
        help="How many reels to request (keep it small: 1-2)",
    )
    parser.add_argument(
        "--no-sample",
        action="store_true",
        help="Do not write docs/apify-sample-output.json",
    )
    return parser.parse_args(argv)


def anonymize(value: Any, depth: int = 0) -> Any:
    """Strip long/sensitive values so the sample can be committed safely."""
    if depth > 4:
        return "…"
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            if any(marker in str(key).lower() for marker in SENSITIVE_KEY_MARKERS):
                result[str(key)] = "<redacted>"
            else:
                result[str(key)] = anonymize(item, depth + 1)
        return result
    if isinstance(value, list):
        return [anonymize(item, depth + 1) for item in value[:3]]
    if isinstance(value, str):
        if len(value) > MAX_SAMPLE_STRING:
            return f"{value[:MAX_SAMPLE_STRING]}… (truncated)"
        return value
    return value


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    configure_logging("INFO")
    settings = get_settings()

    missing = [
        name
        for name, value in (
            ("APIFY_API_TOKEN", settings.apify_api_token),
            ("APIFY_ACTOR_ID", settings.apify_actor_id),
        )
        if not value
    ]
    if missing:
        print(f"❌ Не заданы переменные окружения: {', '.join(missing)}")
        print("   Заполните их в apps/api/.env и повторите запуск.")
        return 2

    if not args.profile:
        print("❌ Укажите Instagram username: python -m scripts.test_apify <username>")
        return 2

    try:
        profile = normalize_instagram_profile(args.profile)
    except AppError as exc:
        print(f"❌ {exc.message} ({exc.details})")
        return 2

    limit = max(1, args.limit)
    style = resolve_input_style(settings.apify_actor_id, settings.apify_actor_input_style)
    actor_input = build_actor_input(
        username=profile.username,
        profile_url=profile.profile_url,
        results_limit=limit,
        actor_id=settings.apify_actor_id,
        input_style=settings.apify_actor_input_style,
    )

    print(f"▶ Actor:        {settings.apify_actor_id}")
    print(f"▶ Input style:  {style}")
    print(f"▶ Actor input:  {json.dumps(actor_input, ensure_ascii=False)}")
    print(f"▶ Profile:      {profile.username} ({profile.profile_url})")
    print("▶ Токен НЕ выводится и не сохраняется.\n")

    with ApifyService(settings) as apify:
        try:
            run = apify.start_run(actor_input)
            print(f"✔ Run started:  id={run.id} status={run.status}")

            if not run.is_successful:
                run = apify.wait_for_completion(run.id)
            print(f"✔ Run finished: status={run.status} dataset={run.dataset_id}")

            items = apify.get_dataset_items(run.dataset_id, limit=limit)
        except AppError as exc:
            print(f"\n❌ {exc.code}: {exc.message}")
            if exc.details:
                print(f"   details: {exc.details}")
            return 1

    print(f"✔ Dataset items: {len(items)}")
    if not items:
        print("\n⚠ Actor завершился успешно, но вернул 0 элементов.")
        return 0

    first = items[0]
    print(f"\n📋 Ключи первого элемента ({len(first)}):")
    for key in sorted(first):
        print(f"   - {key}: {type(first[key]).__name__}")

    normalized = normalize_apify_reel(first)
    if normalized is None:
        print("\n⚠ Нормализатор пропустил элемент: нет instagram_id и shortcode.")
    else:
        print("\n🔎 Результат нормализации первого элемента:")
        for name in (
            "instagram_id",
            "shortcode",
            "original_url",
            "video_url",
            "thumbnail_url",
            "views_count",
            "likes_count",
            "comments_count",
            "published_at",
            "duration",
        ):
            print(f"   {name:16} = {getattr(normalized, name)!r}")
        caption = normalized.caption or ""
        print(f"   {'caption':16} = {caption[:60]!r}{'…' if len(caption) > 60 else ''}")

    if not args.no_sample:
        sample = {
            "actorId": settings.apify_actor_id,
            "inputStyle": style,
            "actorInput": actor_input,
            "itemCount": len(items),
            "firstItemKeys": sorted(first),
            "firstItemAnonymized": anonymize(first),
        }
        path = Path(SAMPLE_OUTPUT_PATH)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n💾 Обезличенный пример сохранён: {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
