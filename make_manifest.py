# -*- coding: utf-8 -*-
"""
Frissítés kiadása: ezt a GitHub-tárolóba feltöltés ELŐTT kell futtatni.
Elkészíti a version.json-t (verziószám + minden fájl ellenőrzőösszege),
amiből a telepített programok látják, hogy van új verzió, és ellenőrzik a letöltést.

Használat:  py make_manifest.py "Rövid leírás a változásról"
            py make_manifest.py "Rövid leírás" --export ..\\weboldal\\update
            (az --export a megadott mappába másolja a fájlokat és a version.json-t,
             így a weboldal update mappáját egy az egyben feltöltheted a tárhelyre)
A verziószámot a server.py elején lévő VERSION = "x.y.z" sorból veszi - azt előtte növeld meg!
"""
import hashlib
import json
import os
import re
import shutil
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
FILES = ["server.py", "web/index.html", "web/app.js", "web/i18n.js", "web/style.css", "OLVASS_EL.txt",
         "INDITAS.bat", "INDITAS_KONZOL_NELKUL.vbs", "make_manifest.py", "web/logo.svg"]

src = open(os.path.join(BASE, "server.py"), encoding="utf-8").read()
version = re.search(r'^VERSION\s*=\s*"([^"]+)"', src, re.M).group(1)
files = {}
for rel in FILES:
    p = os.path.join(BASE, *rel.split("/"))
    if os.path.exists(p):
        files[rel] = hashlib.sha256(open(p, "rb").read()).hexdigest()
args = [a for a in sys.argv[1:]]
export = None
if "--export" in args:
    i = args.index("--export")
    export = args[i + 1]
    del args[i:i + 2]
manifest = {"version": version, "notes": args[0] if args else "", "files": files}
with open(os.path.join(BASE, "version.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
print(f"version.json kész: v{version}, {len(files)} fájl")
if export:
    for rel in list(files) + ["version.json"]:
        dst = os.path.join(export, *rel.split("/"))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(BASE, *rel.split("/")), dst)
    print("Kimásolva ide:", os.path.abspath(export))
