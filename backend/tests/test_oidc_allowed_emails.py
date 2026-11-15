"""OIDC_ALLOWED_EMAILS keeps a private deployment behind a public provider such as Google."""

from contextlib import contextmanager
from unittest.mock import PropertyMock, patch

import pytest
from httpx import AsyncClient

from app.config import Settings


@contextmanager
def _oidc(allowed: str | None):
    with (
        patch.object(Settings, "dev_mode", new_callable=PropertyMock, return_value=False),
        patch.object(Settings, "oidc_configured", new_callable=PropertyMock, return_value=True),
        patch("app.api.auth.settings.oidc_allowed_emails", allowed),
        patch("app.api.auth.validate_oidc_id_token") as validate,
    ):
        yield validate


def _body(sub: str, email: str) -> dict:
    return {"external_id": sub, "email": email, "display_name": sub, "id_token": "t"}


class TestAllowedEmailSet:
    def test_parses_trims_and_lowercases(self):
        s = Settings(oidc_allowed_emails=" Saiff@Example.com, partner@example.com ,,")
        assert s.oidc_allowed_email_set == {"saiff@example.com", "partner@example.com"}

    def test_unset_is_empty(self):
        assert Settings(oidc_allowed_emails=None).oidc_allowed_email_set == frozenset()


class TestOidcAllowedEmails:
    @pytest.mark.asyncio
    async def test_listed_verified_email_signs_in(self, client: AsyncClient):
        with _oidc("me@example.com, partner@example.com") as validate:
            validate.return_value = {
                "sub": "g-1",
                "email": "me@example.com",
                "email_verified": True,
            }
            response = await client.post("/api/v1/auth/sync", json=_body("g-1", "me@example.com"))
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_matching_ignores_case(self, client: AsyncClient):
        with _oidc("Partner@Example.com") as validate:
            validate.return_value = {
                "sub": "g-2",
                "email": "partner@example.com",
                "email_verified": True,
            }
            response = await client.post(
                "/api/v1/auth/sync", json=_body("g-2", "partner@example.com")
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_unlisted_email_is_refused(self, client: AsyncClient):
        with _oidc("me@example.com") as validate:
            validate.return_value = {
                "sub": "g-3",
                "email": "stranger@gmail.com",
                "email_verified": True,
            }
            response = await client.post(
                "/api/v1/auth/sync", json=_body("g-3", "stranger@gmail.com")
            )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_listed_but_unverified_email_is_refused(self, client: AsyncClient):
        with _oidc("me@example.com") as validate:
            validate.return_value = {
                "sub": "g-4",
                "email": "me@example.com",
                "email_verified": False,
            }
            response = await client.post("/api/v1/auth/sync", json=_body("g-4", "me@example.com"))
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_no_list_keeps_the_old_behaviour(self, client: AsyncClient):
        with _oidc(None) as validate:
            validate.return_value = {"sub": "g-5", "email": "anyone@example.com"}
            response = await client.post(
                "/api/v1/auth/sync", json=_body("g-5", "anyone@example.com")
            )
        assert response.status_code == 200
