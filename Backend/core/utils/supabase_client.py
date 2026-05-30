import logging
from functools import lru_cache

from django.conf import settings
import httpx

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_supabase_client():
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Supabase URL and service role key must be configured.")
    from supabase import create_client

    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def _storage_headers(content_type=None):
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _storage_base_url():
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Supabase URL and service role key must be configured.")
    return settings.SUPABASE_URL.rstrip("/")


def upload_private_file(file_obj, storage_path: str, content_type: str) -> str:
    payload = file_obj.read()
    try:
        client = get_supabase_client()
        client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=payload,
            file_options={"content-type": content_type, "upsert": "false"},
        )
    except Exception as exc:
        logger.exception("Supabase upload failed for %s", storage_path)
        raise RuntimeError(f"Supabase upload failed: {exc}") from exc
    return storage_path


def download_private_file(storage_path: str) -> bytes:
    try:
        client = get_supabase_client()
        response = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).download(storage_path)
        if hasattr(response, "content"):
            return response.content
        if isinstance(response, bytes):
            return response
        if hasattr(response, "read"):
            return response.read()
        raise RuntimeError("Unexpected Supabase download response.")
    except Exception as exc:
        logger.exception("Supabase download failed for %s", storage_path)
        raise RuntimeError(f"Supabase download failed: {exc}") from exc


def create_signed_url(storage_path: str) -> str:
    try:
        client = get_supabase_client()
        response = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).create_signed_url(
            storage_path, settings.SUPABASE_SIGNED_URL_TTL_SECONDS
        )
        if isinstance(response, dict):
            return response.get("signedURL") or response.get("signed_url") or ""
        return getattr(response, "signed_url", "") or getattr(response, "signedURL", "")
    except Exception as exc:
        logger.exception("Supabase signed URL failed for %s", storage_path)
        raise RuntimeError(f"Supabase signed URL failed: {exc}") from exc
