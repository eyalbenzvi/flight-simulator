#!/usr/bin/env python3
"""Loads the simulator in headless Chromium, reports JavaScript errors, flies a few seconds in each mode and saves a screenshot.
Usage:  python3 tools/smoke_test.py [index.html | dist/index.html]      (pip install playwright && playwright install chromium)"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
page_file = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html').resolve()
STEP = """(sec) => { for (let i = 0; i < 60 * sec && !S.crashed; i++) { if (!S.arc || S.land || S.ap.on) { A.sync = true; readAttitude(); updateControls(1/60); physics(1/120); physics(1/120); } else arcadeStep(1/60);
  updateSystems(1/60); readAttitude(); TNOW += 1/60; } return [Math.round(S.V * 1.944) + ' kt', Math.round(S.pos.y) + ' m', S.onGround ? 'ground' : 'air', S.crashed ? 'CRASHED' : 'ok']; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']); errors = []
        pg = await b.new_page(viewport={'width': 900, 'height': 560}); pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
        await pg.goto(page_file.as_uri()); await pg.wait_for_function("!document.getElementById('fly').disabled", timeout=180000)
        print('loaded:', await pg.evaluate("() => ({ grid: [NX, NZ], localities: LOCS.length, meshes: cityMeshes.length, buildings: cityMeshes.reduce((a, m) => a + m.count, 0), roads: roadPaths.length })"), flush=True)
        await pg.evaluate("() => document.getElementById('fly').click()")
        for mode, name in ((0, 'easy'), (1, 'medium'), (2, 'expert')):
            print(name, await pg.evaluate("(m) => { setMode(m); spawn(FREE[2]); return (" + STEP + ")(20); }", mode), flush=True)
        print('take-off, easy:', await pg.evaluate("() => { setMode(0); spawn(FREE[0]); const step = " + STEP + "; step(0.1); S.thr = 1; return step(15); }"), flush=True)
        try:
            await pg.evaluate("() => { setMode(0); spawn(FREE[1]); }"); await pg.wait_for_timeout(4000); await pg.screenshot(path='smoke.png', timeout=120000)
        except Exception as e: print('screenshot skipped:', str(e)[:80])
        print('errors:', errors or 'none', flush=True); await b.close(); sys.exit(1 if errors else 0)
asyncio.run(main())
