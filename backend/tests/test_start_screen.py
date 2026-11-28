"""The screen the app opens on, kept with a person's preferences."""

import pytest
from httpx import AsyncClient

URL = "/api/v1/users/me/preferences"


class TestStartScreen:
    @pytest.mark.asyncio
    async def test_the_wardrobe_is_the_first_screen_until_changed(
        self, client: AsyncClient, auth_headers
    ):
        response = await client.get(URL, headers=auth_headers)
        assert response.json()["start_screen"] == "wardrobe"

        changed = await client.patch(URL, json={"start_screen": "lookbook"}, headers=auth_headers)
        assert changed.status_code == 200, changed.text
        assert (await client.get(URL, headers=auth_headers)).json()["start_screen"] == "lookbook"

    @pytest.mark.asyncio
    async def test_only_the_offered_screens_can_be_chosen(self, client: AsyncClient, auth_headers):
        response = await client.patch(URL, json={"start_screen": "settings"}, headers=auth_headers)
        assert response.status_code == 422
