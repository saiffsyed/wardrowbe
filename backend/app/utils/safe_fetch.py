"""Fetching pages and pictures from shops on the web without letting a URL reach the server's
own network (our fork). Every hop of a redirect is checked: only http(s), standard ports, and
hosts whose every address is public."""

import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

import httpx

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
)
MAX_REDIRECTS = 5
TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class FetchRefused(Exception):
    """The URL points somewhere we will not go, or the answer was not usable."""


async def _check_url(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise FetchRefused("not a web address")
    if parts.port not in (None, 80, 443):
        raise FetchRefused("unusual port")
    if parts.username or parts.password:
        raise FetchRefused("credentials in address")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            parts.hostname,
            parts.port or (443 if parts.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except OSError as e:
        raise FetchRefused("host not found") from e
    addresses = {info[4][0] for info in infos}
    if not addresses or not all(ipaddress.ip_address(a.split("%")[0]).is_global for a in addresses):
        raise FetchRefused("not a public address")


async def fetch(url: str, *, max_bytes: int, accept: str = "*/*") -> tuple[bytes, str, str]:
    """(body, content type, final URL). Raises FetchRefused for anything unusable."""
    headers = {"User-Agent": USER_AGENT, "Accept": accept, "Accept-Language": "en,*;q=0.5"}
    async with httpx.AsyncClient(
        timeout=TIMEOUT, follow_redirects=False, headers=headers
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            await _check_url(url)
            try:
                async with client.stream("GET", url) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise FetchRefused("redirect without a target")
                        url = urljoin(url, location)
                        continue
                    if response.status_code != 200:
                        raise FetchRefused(f"answered {response.status_code}")
                    declared = response.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > max_bytes:
                        raise FetchRefused("too large")
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > max_bytes:
                            raise FetchRefused("too large")
                    content_type = response.headers.get("content-type", "").split(";")[0].strip()
                    return bytes(body), content_type.lower(), url
            except httpx.HTTPError as e:
                raise FetchRefused("could not be reached") from e
    raise FetchRefused("too many redirects")
