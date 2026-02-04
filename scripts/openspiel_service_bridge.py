#!/usr/bin/env python3
"""
OpenSpiel service bridge.

Reads JSON from stdin:
  { "request": <SolverNodeRequestV2>, "timeoutMs": <number> }

Posts to OPENSPIEL_SERVICE_URL (default http://127.0.0.1:8787/solve) and prints JSON response.
On failure, prints a SolverErrorV2-shaped object.
"""

from __future__ import annotations

import json
import os
import socket
import sys
import urllib.error
import urllib.request


def error(code: str, message: str, node_hash: str | None, retriable: bool) -> dict:
    return {
        "ok": False,
        "code": code,
        "message": message,
        "provider": "openspiel",
        "nodeHash": node_hash,
        "retriable": retriable,
    }


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps(error("INVALID_REQUEST", f"invalid stdin payload: {exc}", None, False)))
        return 0

    request = payload.get("request")
    timeout_ms = payload.get("timeoutMs", 1000)
    node_hash = request.get("nodeHash") if isinstance(request, dict) else None

    if not isinstance(request, dict):
        print(json.dumps(error("INVALID_REQUEST", "missing request object", node_hash, False)))
        return 0

    try:
        timeout_sec = max(float(timeout_ms) / 1000.0, 0.001)
    except Exception:  # noqa: BLE001
        print(json.dumps(error("INVALID_REQUEST", "timeoutMs must be numeric", node_hash, False)))
        return 0

    service_url = os.getenv("OPENSPIEL_SERVICE_URL", "http://127.0.0.1:8787/solve")
    data = json.dumps(request).encode("utf-8")
    req = urllib.request.Request(
        service_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as response:  # noqa: S310
            out = response.read().decode("utf-8")
            parsed = json.loads(out)
            print(json.dumps(parsed))
            return 0
    except urllib.error.HTTPError as exc:
        code = "SOLVER_UNAVAILABLE"
        if exc.code == 400:
            code = "INVALID_REQUEST"
        elif exc.code == 404:
            code = "UNSUPPORTED_NODE"
        print(json.dumps(error(code, f"http {exc.code}: {exc.reason}", node_hash, exc.code >= 500)))
        return 0
    except urllib.error.URLError as exc:
        print(json.dumps(error("SOLVER_UNAVAILABLE", f"connection failed: {exc.reason}", node_hash, True)))
        return 0
    except socket.timeout:
        print(json.dumps(error("SOLVER_TIMEOUT", "request timed out", node_hash, True)))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps(error("INTERNAL_ERROR", f"bridge failure: {exc}", node_hash, False)))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
