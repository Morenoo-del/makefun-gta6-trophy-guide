#!/usr/bin/env python3
"""Take the four screenshots for the Leonida Trophy Guide entry.

Serves app/ on a local port, renders the real app in headless Chromium,
and saves JPEGs into screenshots/. Every shot is a real render of the
app's own code — nothing is edited or composited afterwards.
"""
import http.server
import functools
import os
import socket
import sys
import threading

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(HERE, "app")
SHOT_DIR = os.path.join(HERE, "screenshots")


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def serve(port):
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=APP_DIR)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def main():
    port = free_port()
    httpd = serve(port)
    base = f"http://127.0.0.1:{port}"
    os.makedirs(SHOT_DIR, exist_ok=True)
    try:
        with sync_playwright() as p:
            # Use the installed Chromium 1148 build (the default 1255 shell
            # is not downloaded on this machine).
            exe = os.path.expanduser(
                "~/.cache/ms-playwright/chromium-1148/chrome-linux/chrome")
            browser = p.chromium.launch(executable_path=exe)
            # 1 — cover: checklist with a guide open beside it (missable trophy).
            # 1280x800 keeps the landscape cover while showing the guide's
            # first lines beside the checklist.
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(f"{base}/?shot=guide&id=28", wait_until="networkidle")
            page.wait_for_selector(".trophy-row")
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(SHOT_DIR, "1-cover.jpg"),
                            type="jpeg", quality=82)
            page.close()
            # 2 — roadmap + missable flags.
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f"{base}/?shot=roadmap", wait_until="networkidle")
            page.wait_for_selector(".roadmap-stage")
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(SHOT_DIR, "2-roadmap.jpg"),
                            type="jpeg", quality=82)
            page.close()
            # 3 — spoiler setting on, story trophies hidden.
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.goto(f"{base}/?shot=spoiler", wait_until="networkidle")
            page.wait_for_selector(".trophy-row")
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(SHOT_DIR, "3-spoiler.jpg"),
                            type="jpeg", quality=82)
            page.close()
            # 4 — progress: check several trophies in the real UI first.
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.goto(f"{base}/", wait_until="networkidle")
            page.wait_for_selector(".trophy-row")
            checks = page.locator(".trophy-check")
            for i in [0, 1, 2, 3, 13, 14, 27, 32]:
                checks.nth(i).click()
                page.wait_for_timeout(120)
            page.wait_for_timeout(400)
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(200)
            page.screenshot(path=os.path.join(SHOT_DIR, "4-progress.jpg"),
                            type="jpeg", quality=82)
            page.close()
            browser.close()
    finally:
        httpd.shutdown()
    for name in sorted(os.listdir(SHOT_DIR)):
        path = os.path.join(SHOT_DIR, name)
        print(f"{name}: {os.path.getsize(path)} bytes")
    print("done")


if __name__ == "__main__":
    sys.exit(main())
