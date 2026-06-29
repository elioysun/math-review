#!/usr/bin/env python3
"""Serve a Vite/Vue SPA with history-mode route fallback."""

import argparse
import contextlib
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlsplit


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class SpaStaticRequestHandler(SimpleHTTPRequestHandler):
    fallback_filename = "index.html"
    asset_prefixes = ("/assets/",)

    def send_head(self):
        request_path = urlsplit(self.path).path
        translated_path = self.translate_path(request_path)

        if self._should_fallback(request_path, translated_path):
            original_path = self.path
            self.path = f"/{self.fallback_filename}"
            try:
                return super().send_head()
            finally:
                self.path = original_path

        return super().send_head()

    def _should_fallback(self, request_path: str, translated_path: str) -> bool:
        if self.command not in {"GET", "HEAD"}:
            return False

        if os.path.exists(translated_path):
            return False

        if any(request_path.startswith(prefix) for prefix in self.asset_prefixes):
            return False

        leaf_name = os.path.basename(request_path.rstrip("/"))
        if "." in leaf_name:
            return False

        fallback_path = os.path.join(os.getcwd(), self.fallback_filename)
        return os.path.isfile(fallback_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Serve static files and fall back to index.html for SPA routes.",
    )
    parser.add_argument(
        "--directory",
        default=os.getcwd(),
        help="Directory containing the built static site.",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    directory = os.path.abspath(args.directory)
    os.chdir(directory)

    httpd = ThreadingHTTPServer((args.host, args.port), SpaStaticRequestHandler)
    try:
        host, port = httpd.server_address[:2]
        print(f"Serving {directory} on http://{host}:{port}/", flush=True)
        with contextlib.suppress(KeyboardInterrupt):
            httpd.serve_forever()
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
