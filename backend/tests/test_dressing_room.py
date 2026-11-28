"""Each person's dressing-room settings."""

import pytest
from httpx import AsyncClient

URL = "/api/v1/dressing-room/settings"


class TestDressingRoomSettings:
    @pytest.mark.asyncio
    async def test_defaults_until_changed(self, client: AsyncClient, auth_headers):
        response = await client.get(URL, headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {"figure": "women", "background": "auto", "figure_colour": "auto"}

        changed = await client.patch(
            URL, json={"figure": "men", "background": "#f6f1e7"}, headers=auth_headers
        )
        assert changed.status_code == 200, changed.text
        again = (await client.get(URL, headers=auth_headers)).json()
        assert again == {"figure": "men", "background": "#f6f1e7", "figure_colour": "auto"}

        await client.patch(URL, json={"figure_colour": "#a47e5f"}, headers=auth_headers)
        assert (await client.get(URL, headers=auth_headers)).json()["figure"] == "men"

    @pytest.mark.asyncio
    async def test_only_offered_colours(self, client: AsyncClient, auth_headers):
        for body in ({"background": "#123456"}, {"figure_colour": "red"}, {"figure": "child"}):
            response = await client.patch(URL, json=body, headers=auth_headers)
            assert response.status_code == 422, body
