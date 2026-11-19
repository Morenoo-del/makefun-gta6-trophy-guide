#!/usr/bin/env python3
"""Validate the Leonida Trophy Guide entry end to end.

Checks: 55/55 official name match against the starter's list, main.ts
determinism (two runs, byte-identical), offline load (zero external
requests, zero console errors), 55 rendered trophies, persistence,
export/import round-trip, spoiler hiding, and screenshot size limits.
"""
import functools
import http.server
import json
import os
import socket
import subprocess
import sys
import tempfile
import threading

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ENTRY = HERE
KIT_STARTER = os.path.join(
    os.path.dirname(HERE), "gta6-trophy-guide-01-kit", "starter",
    "app", "data", "trophies.json")
EXE = os.path.expanduser(
    "~/.cache/ms-playwright/chromium-1148/chrome-linux/chrome")
STORAGE_KEY = "gta6-trophy-guide-v1"

failures = []


def check(label, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + label + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(label)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def serve(directory, port):
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=directory)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    # 1. Trophy-name match against the official (starter) list.
    with open(os.path.join(ENTRY, "app", "data", "trophies.json")) as f:
        mine = json.load(f)["trophies"]
    with open(KIT_STARTER) as f:
        official = json.load(f)["trophies"]
    mine_names = {t["name"].lower() for t in mine}
    missing = [t["name"] for t in official if t["name"].lower() not in mine_names]
    extra = [t["name"] for t in mine if t["name"].lower() not in
             {t["name"].lower() for t in official}]
    check("trophy names 55/55", len(mine) == 55 and not missing and not extra,
          f"mine={len(mine)} official={len(official)} missing={missing} extra={extra}")
    check("every trophy has a guide + source",
          all(t.get("guide", "").strip() and t.get("sources") for t in mine))
    external = sum(1 for t in mine if any(s.get("url") for s in t["sources"]))
    check("guides citing external sources", True,
          f"{external}/55 cite an external guide link; "
          f"{55 - external} cite the official description only")
    check("missable flags", [t["name"] for t in mine if t["missable"]]
          == ["Positive Mental Attitude"])

    # 2. Determinism: run main.ts twice into different dirs, diff -r.
    outs = [tempfile.mkdtemp(prefix="gta6-out-a-"),
            tempfile.mkdtemp(prefix="gta6-out-b-")]
    for out in outs:
        env = dict(os.environ, MAKEFUN_OUTPUT_DIR=out)
        r = subprocess.run(["node", "main.ts"], cwd=ENTRY, env=env,
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout, r.stderr)
        check(f"main.ts runs (out={os.path.basename(out)})", r.returncode == 0,
              r.stderr.strip().splitlines()[-1] if r.stderr else r.stdout.strip())
    r = subprocess.run(["diff", "-r", outs[0], outs[1]],
                       capture_output=True, text=True)
    check("main.ts deterministic (two outputs byte-identical)",
          r.returncode == 0, r.stdout.strip()[:300] or "identical")
    with open(os.path.join(outs[0], "dossier.json"), "rb") as f:
        dossier = f.read()
    check("dossier.json written", len(dossier) > 1000, f"{len(dossier)} bytes")

    # 3. Browser checks: offline, console, render, persistence, export/import.
    port = free_port()
    httpd = serve(os.path.join(ENTRY, "app"), port)
    base = f"http://127.0.0.1:{port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=EXE)
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            requests, errors = [], []
            page.on("request", lambda req: requests.append(req.url))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"{base}/", wait_until="networkidle")
            page.wait_for_selector(".trophy-row")
            external_reqs = [u for u in requests if not u.startswith(base) and not u.startswith("data:")]
            check("offline: zero external requests", not external_reqs,
                  f"{len(requests)} requests, external={external_reqs}")
            check("zero console errors", not errors, str(errors[:3]))
            rows = page.locator(".trophy-row").count()
            check("55 trophies render", rows == 55, f"rows={rows}")
            names = page.locator(".trophy-name").all_text_contents()
            check("all rows have a name + grade badge",
                  all(n.strip() for n in names)
                  and page.locator("#trophy-list .tag-platinum, #trophy-list .tag-gold, #trophy-list .tag-silver, #trophy-list .tag-bronze").count() == 55)
            # Persistence: check one, reload, still checked.
            page.locator(".trophy-check").nth(0).click()
            page.wait_for_timeout(200)
            page.reload(wait_until="networkidle")
            page.wait_for_selector(".trophy-row")
            saved = page.evaluate(f"JSON.parse(localStorage.getItem('{STORAGE_KEY}')).earned")
            check("progress persists across reload", saved == [1], f"earned={saved}")
            check("progress bar shows 1/55",
                  "1 / 55" in page.locator("#progress-count").inner_text())
            # Export (real download) -> reset -> import -> restored.
            with page.expect_download() as dl:
                page.locator("#export-btn").click()
            download = dl.value
            tmp = os.path.join(tempfile.gettempdir(), "gta6-export-test.json")
            download.save_as(tmp)
            exported = json.load(open(tmp))
            check("export writes earned ids", exported.get("earned") == [1],
                  f"exported={exported.get('earned')}")
            page.on("dialog", lambda d: d.accept())
            page.locator("#reset-btn").click()
            page.wait_for_timeout(200)
            check("reset clears progress",
                  page.evaluate(f"JSON.parse(localStorage.getItem('{STORAGE_KEY}')).earned") == [])
            page.set_input_files("#import-file", tmp)
            page.wait_for_timeout(300)
            restored = page.evaluate(f"JSON.parse(localStorage.getItem('{STORAGE_KEY}')).earned")
            check("import restores progress", restored == [1], f"restored={restored}")
            # Spoiler: story names hidden.
            page.goto(f"{base}/?shot=spoiler", wait_until="networkidle")
            page.wait_for_selector(".trophy-row")
            body = page.locator("body").inner_text()
            check("spoiler hides story names",
                  "Just Like Paradise" not in body and "Hidden story trophy" in body)
            # Missable filter shows exactly one.
            page.goto(f"{base}/?shot=list&filter=missable", wait_until="networkidle")
            page.wait_for_selector(".trophy-row")
            check("missable filter shows 1 trophy",
                  page.locator(".trophy-row").count() == 1)
            # Roadmap renders 8 stages.
            page.goto(f"{base}/?shot=roadmap", wait_until="networkidle")
            page.wait_for_selector(".roadmap-stage")
            check("roadmap renders 8 stages",
                  page.locator(".roadmap-stage").count() == 8)
            browser.close()
    finally:
        httpd.shutdown()

    # 4. Screenshots: 3-4 files, each <=256 KiB, long side <=1280, short >=480.
    shot_dir = os.path.join(ENTRY, "screenshots")
    shots = sorted(f for f in os.listdir(shot_dir)
                   if f.lower().endswith((".jpg", ".jpeg", ".png")))
    check("3-4 screenshots", 3 <= len(shots) <= 4, f"{len(shots)}: {shots}")
    for name in shots:
        path = os.path.join(shot_dir, name)
        size = os.path.getsize(path)
        with Image.open(path) as im:
            w, h = im.size
        check(f"screenshot {name} within limits",
              size <= 262144 and max(w, h) <= 1280 and min(w, h) >= 480,
              f"{size} bytes, {w}x{h}")

    print()
    if failures:
        print(f"FAILURES: {len(failures)} — " + "; ".join(failures))
        return 1
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
