from __future__ import annotations

import os
import socket
import subprocess
import time
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest

API_KEY = "test-key"
REPO = Path(__file__).resolve().parents[1]


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture(scope="session")
def api_key() -> str:
    return API_KEY


@pytest.fixture(scope="session")
def base_url() -> Iterator[str]:
    """Base URL of the reference API (apps/api), started once per test session."""
    port = _free_port()
    process = subprocess.Popen(
        [str(REPO / "node_modules" / ".bin" / "tsx"), "apps/api/src/server.ts"],
        cwd=REPO,
        env={**os.environ, "PORT": str(port), "INTERFAZE_API_KEY": API_KEY, "INTERFAZE_ENGINE": "echo"},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    url = f"http://127.0.0.1:{port}"
    deadline = time.monotonic() + 30
    while True:
        if process.poll() is not None:
            stderr = process.stderr.read().decode() if process.stderr else ""
            raise RuntimeError(f"API server exited early:\n{stderr}")
        try:
            if httpx.get(f"{url}/health").is_success:
                break
        except httpx.TransportError:
            pass
        if time.monotonic() > deadline:
            process.kill()
            raise RuntimeError("API server did not start within 30s")
        time.sleep(0.2)

    yield f"{url}/v1"

    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
