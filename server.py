# -*- coding: utf-8 -*-
"""
RiftMester - LoL build segéd a második monitorra.

Csak a Python beépített könyvtárait használja (nincs pip install).
- Figyeli a LoL klienst (helyi LCU API) és meccs közben a játék helyi adat-API-ját.
- Lekéri a hős buildjét (U.GG statisztika), tartalékként mentett adatot vagy a Riot saját ajánlását.
- Egy kis ablakban (Edge "app" mód) mutatja: rúnák, idézőigék, tárgyak, skill-sorrend.
- Magától frissíti saját magát egy GitHub-tárolóból (ha be van állítva).
"""

import base64
import hashlib
import json
import os
import re
import shutil
import ssl
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "3.9.0"
APP_NAME = "RiftMester"
RUNE_PREFIX = "RM: "
ITEMSET_PREFIX = "RiftMester"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
CACHE_DIR = os.path.join(BASE_DIR, "cache")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

ARGS = set(sys.argv[1:])
FROZEN = getattr(sys, "frozen", False)   # RiftMester.exe-ből fut (Python nélküli telepítés)
BACKGROUND = "--background" in ARGS      # Windows indulásakor fut, a LoL indulásakor nyitja az ablakot
RESTARTED = "--restarted" in ARGS        # frissítés utáni újraindulás
OPEN_NOW = "--open-now" in ARGS          # háttér módban is nyissa meg azonnal az ablakot (Windows-szal indítás)

DEFAULT_CONFIG = {
    "port": 21337,
    "league_path": "",            # pl. "C:\\Riot Games\\League of Legends" - üresen hagyva magától keresi
    "language": "hu_HU",          # Data Dragon nyelv (hu_HU, en_US, de_DE ...)
    "ui_lang": "hu",              # a program nyelve: "hu" vagy "en"
    "default_rank": "emerald_plus",
    "open_window": True,
    "window_monitor": "auto",     # "auto" = második monitor jobb széle, ha van; "off" = window_x/window_y szerint
    "window_width": 470,
    "window_height": 1000,
    "window_x": None,
    "window_y": None,
    "auto_collapse_in_game": True,  # meccs közben a rúna kártya magától összecsukódik
    "update_url": "https://raw.githubusercontent.com/Szozii/riftmester-releases/main/",  # innen frissül a program
    "update_mode": "auto",        # "auto" = magától frissít, "ask" = megkérdezi, "off" = soha
    "autostart": "off",           # "off" / "windows" (ablak a géppel együtt) / "lol" (háttérben vár, a LoL-lal nyílik)
    "auto_runes": True,           # hős kiválasztásakor magától betölti a rúnákat
    "rune_overwrite": True,       # ha nincs szabad rúnalap, az aktuálisat írja felül
    "auto_itemset": True,         # a buildet tárgylistaként beteszi a játékba (bolt -> ajánlott)
    "auto_spells": True,          # hős lezárásakor beállítja az idézőigéket is
    "flash_key": "D",             # a Flash melyik billentyűn legyen: "D" vagy "F"
    "season_start": "",           # statisztika kezdete (ÉÉÉÉ-HH-NN); üresen: az év eleje
    "debug": False,
}
SETTINGS_KEYS = ["ui_lang", "autostart", "auto_spells", "flash_key", "auto_runes", "rune_overwrite", "auto_itemset", "auto_collapse_in_game",
                 "window_monitor", "default_rank", "update_mode", "update_url", "season_start", "language"]

DDRAGON = "https://ddragon.leagueoflegends.com"
UGG_VERSIONS_URL = "https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/ugg-api-versions.json"
UGG_OVERVIEW_URL = "https://stats2.u.gg/lol/1.5/{kind}/{patch}/{mode}/{champ}/{ver}.json"
USER_AGENT = "LoL-Build-Ablak/" + VERSION

# A program módjai -> lehetséges U.GG azonosítók (az elsőt, ami működik, megjegyzi)
MODES = {
    "solo": ["ranked_solo_5x5"],
    "flex": ["ranked_flex_sr", "ranked_flex_5x5"],
    "aram": ["normal_aram"],
    "mayhem": ["aram_mayhem", "normal_aram_mayhem", "kiwi", "aram_kiwi"],
}
QUEUE_TO_MODE = {420: "solo", 440: "flex", 400: "solo", 430: "solo", 480: "solo", 490: "solo",
                 450: "aram", 100: "aram", 2400: "mayhem"}

UGG_REGION_WORLD = "12"
UGG_RANKS = {"emerald_plus": "17", "platinum_plus": "10", "diamond_plus": "11", "master_plus": "14", "overall": "8"}
UGG_RANK_FALLBACK = ["17", "10", "11", "8", "14", "15", "2", "1"]
UGG_ROLES = {"jungle": "1", "support": "2", "adc": "3", "top": "4", "mid": "5"}
UGG_ROLE_NAMES = {v: k for k, v in UGG_ROLES.items()}
LCU_POSITION_TO_ROLE = {"top": "top", "jungle": "jungle", "middle": "mid", "bottom": "adc", "utility": "support"}
ROLE_TO_LCU = {"top": "TOP", "jungle": "JUNGLE", "mid": "MIDDLE", "adc": "BOTTOM", "support": "UTILITY"}


def log(*args):
    line = " ".join([time.strftime("[%H:%M:%S]")] + [str(a) for a in args])
    if sys.stdout is not None:  # pythonw alatt nincs konzol
        try:
            print(line, flush=True)
            return
        except Exception:
            pass
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        p = os.path.join(CACHE_DIR, "naplo.txt")
        if os.path.exists(p) and os.path.getsize(p) > 500_000:
            os.replace(p, p + ".regi")
        with open(p, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg.update(json.load(f))
        except Exception as e:
            log("Hibás config.json, alapbeállításokkal indulok:", e)
    else:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2, ensure_ascii=False)
    return cfg


CONFIG = load_config()
_cfg_lock = threading.Lock()

# A frissítések új helye: a nyilvános riftmester-releases tároló (a forráskód privát).
OLD_UPDATE_URLS = {"https://raw.githubusercontent.com/Szozii/riftmester/main/",
                   "https://raw.githubusercontent.com/Szozii/riftmester/main"}
if (CONFIG.get("update_url") or "").strip() in OLD_UPDATE_URLS or not (CONFIG.get("update_url") or "").strip():
    CONFIG["update_url"] = DEFAULT_CONFIG["update_url"]
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as _f:
            json.dump(CONFIG, _f, indent=2, ensure_ascii=False)
    except Exception:
        pass


# ---------------------------------------------------------------- Nyelv (szerver oldali üzenetek)

TR_EN = {
    "A U.GG most nem elérhető, a legutóbb mentett adatot látod.": "U.GG is unavailable right now – showing the last saved data.",
    "ARAM Mayhem build nem érhető el, a sima ARAM buildet látod (az augmentek nélkül).": "No ARAM Mayhem build available – showing the regular ARAM build (without augments).",
    "Se a U.GG, se mentett adat nem elérhető – a Riot kliens saját rúna-ajánlását látod (tárgyak nélkül).": "Neither U.GG nor saved data is available – showing the Riot client's own rune recommendation (no items).",
    "A U.GG nem adott build adatot.": "U.GG returned no build data.",
    "Ehhez a hőshöz nincs elég adat.": "Not enough data for this champion.",
    "Nem sikerült build adatot szerezni.": "Couldn't get any build data.",
    "A U.GG adatformátuma megváltozott, nem tudom értelmezni.": "U.GG's data format changed and can't be read.",
    "A LoL kliens nem fut.": "The LoL client isn't running.",
    "Nincs szabad rúnalap-hely. Felülírjam az épp kiválasztottat?": "No free rune page slot. Overwrite the selected one?",
    "Az aktuális rúnalap nem szerkeszthető.": "The current rune page can't be edited.",
    "Nem sikerült": "Failed",
    "Nincs teljes rúna adat.": "Incomplete rune data.",
    "Nem található a játékos azonosító.": "Player ID not found.",
    "Ehhez a buildhez nincs tárgy adat.": "No item data for this build.",
    "Kezdés": "Starting items", "Core build": "Core build", "{n}. tárgy – választható": "Item {n} – options",
    "Fogyóeszközök": "Consumables", "Normál draft": "Normal draft", "Normál blind": "Normal blind",
    "Egy mindenkiért": "One for All", "Egyedi": "Custom", "Egyéb": "Other",
    "Csak Windows alatt érhető el.": "Only available on Windows.",
    "Nem sikerült létrehozni az indítási parancsikont.": "Couldn't create the startup shortcut.",
    "Nincs elérhető frissítés.": "No update available.",
    "A counter adat most nem érhető el.": "Counter data isn't available right now.",
    "Nem vagy hősválasztásban.": "You're not in champion select.",
    "Most nincs választásod vagy kitiltásod.": "You have no pick or ban right now.",
    "Még nem te következel.": "It's not your turn yet.",
    "Nincs idézőige adat.": "No summoner spell data.",
    "Nem találom a LoL mappáját (config.json → league_path).": "Can't find the LoL folder (config.json → league_path).",
    "fájl: nincs írási jog a LoL mappájába (indítsd rendszergazdaként)": "file: no write access to the LoL folder (run as administrator)",
}


def tr(hu, **kw):
    s = TR_EN.get(hu, hu) if CONFIG.get("ui_lang") == "en" else hu
    return s.format(**kw) if kw else s


def save_config():
    with _cfg_lock:
        tmp = CONFIG_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(CONFIG, f, indent=2, ensure_ascii=False)
        os.replace(tmp, CONFIG_PATH)


# ---------------------------------------------------------------- HTTP segédek

_ext_ctx = ssl.create_default_context()


def http_get_bytes(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout, context=_ext_ctx) as r:
        return r.read()


def http_get_json(url, timeout=12):
    return json.loads(http_get_bytes(url, timeout).decode("utf-8"))


def disk_cache_get(name):
    p = os.path.join(CACHE_DIR, name)
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def disk_cache_put(name, data):
    try:
        p = os.path.join(CACHE_DIR, name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, p)
    except Exception as e:
        log("Cache írás hiba:", e)


def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(li|p|stats|passive|active)>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _safe(fn, default=None):
    try:
        return fn()
    except Exception:
        if CONFIG.get("debug"):
            traceback.print_exc()
        return default


class AppError(Exception):
    """Felhasználónak megjeleníthető hiba, technikai részletekkel."""

    def __init__(self, msg, detail=""):
        super().__init__(msg)
        self.detail = detail


# ---------------------------------------------------------------- Data Dragon (képek, nevek)

class StaticData:
    def __init__(self):
        self.lock = threading.Lock()
        self.version = None
        self.bundle = None
        self.champ_by_id = {}
        self.rune_slot = {}
        self.champ_detail = {}

    def ensure(self):
        with self.lock:
            if self.bundle is not None:
                return self.bundle
            lang = CONFIG.get("language", "hu_HU")
            try:
                version = http_get_json(DDRAGON + "/api/versions.json")[0]
            except Exception as e:
                cached = disk_cache_get("static_last.json")
                if cached:
                    log("Nincs net a Data Dragonhoz, a mentett adatot használom:", e)
                    self._index(cached)
                    return self.bundle
                raise
            cache_name = f"static_{version}_{lang}.json"
            data = disk_cache_get(cache_name)
            if not data:
                log("Data Dragon letöltése", version, lang, "...")
                base = f"{DDRAGON}/cdn/{version}/data/{lang}"
                champs = http_get_json(base + "/champion.json")["data"]
                items = http_get_json(base + "/item.json")["data"]
                runes = http_get_json(base + "/runesReforged.json")
                spells = http_get_json(base + "/summoner.json")["data"]
                data = {
                    "version": version,
                    "champions": {
                        c["key"]: {"id": c["id"], "name": c["name"], "title": c["title"],
                                   "tags": c.get("tags", []), "info": c.get("info", {})}
                        for c in champs.values()
                    },
                    "items": {
                        iid: {"name": it.get("name", ""), "plaintext": it.get("plaintext", ""),
                              "desc": strip_html(it.get("description", "")),
                              "gold": it.get("gold", {}).get("total", 0), "tags": it.get("tags", []),
                              "final": not it.get("into"), "from": it.get("from", [])}
                        for iid, it in items.items()
                    },
                    "runes": [
                        {"id": t["id"], "key": t["key"], "name": t["name"], "icon": t["icon"],
                         "slots": [[{"id": r["id"], "name": r["name"], "icon": r["icon"],
                                     "desc": strip_html(r.get("shortDesc", ""))} for r in s["runes"]]
                                   for s in t["slots"]]}
                        for t in runes
                    ],
                    "spells": {
                        s["key"]: {"id": s["id"], "name": s["name"], "desc": strip_html(s.get("description", "")),
                                   "image": s["image"]["full"]}
                        for s in spells.values()
                    },
                }
                disk_cache_put(cache_name, data)
            disk_cache_put("static_last.json", data)
            self._index(data)
            log("Statikus adatok készen:", data["version"])
            return self.bundle

    def reset(self):
        """Nyelvváltáskor újratöltjük a hős-, tárgy- és rúnaneveket."""
        with self.lock:
            self.bundle = None
            self.champ_detail = {}

    def _index(self, data):
        self.version = data["version"]
        self.bundle = data
        self.champ_by_id = {v["id"]: k for k, v in data["champions"].items()}
        self.rune_slot = {}
        for t in data["runes"]:
            for si, slot in enumerate(t["slots"]):
                for r in slot:
                    self.rune_slot[r["id"]] = (t["id"], si)

    def champion_detail(self, champ_id):
        if champ_id in self.champ_detail:
            return self.champ_detail[champ_id]
        self.ensure()
        lang = CONFIG.get("language", "hu_HU")
        name = f"champ/{self.version}_{lang}_{champ_id}.json"
        d = disk_cache_get(name)
        if not d:
            raw = http_get_json(f"{DDRAGON}/cdn/{self.version}/data/{lang}/champion/{champ_id}.json")["data"][champ_id]
            d = {
                "id": raw["id"], "name": raw["name"], "title": raw["title"],
                "passive": {"name": raw["passive"]["name"], "desc": strip_html(raw["passive"]["description"]),
                            "image": raw["passive"]["image"]["full"]},
                "spells": [{"key": "QWER"[i], "name": s["name"], "desc": strip_html(s["description"]),
                            "image": s["image"]["full"]} for i, s in enumerate(raw["spells"])],
                "allytips": raw.get("allytips", [])[:3],
            }
            disk_cache_put(name, d)
        self.champ_detail[champ_id] = d
        return d


STATIC = StaticData()


# ---------------------------------------------------------------- U.GG build adatok

class UggSource:
    def __init__(self):
        self.versions = None
        self.versions_time = 0
        self.cache = {}           # (patch, uggmode, champ) -> (time, raw)
        self.mode_ok = {}         # program mód -> működő U.GG azonosító

    def patches(self):
        if self.versions is None or time.time() - self.versions_time > 3600:
            try:
                self.versions = http_get_json(UGG_VERSIONS_URL)
                self.versions_time = time.time()
            except Exception as e:
                log("U.GG verziólista nem jött le:", e)
                self.versions = self.versions or {}

        def pkey(p):
            try:
                return tuple(int(x) for x in p.split("_"))
            except Exception:
                return (0,)

        keys = sorted(self.versions.keys(), key=pkey, reverse=True)
        if not keys:
            v = STATIC.ensure()["version"].split(".")
            major, minor = int(v[0]), int(v[1])
            keys = [f"{major}_{minor}"] + ([f"{major}_{minor - 1}"] if minor > 1 else [])
        return keys[:2]

    def raw(self, champ_key, mode, kind="overview"):
        """Visszaadja: (patch, U.GG mód, nyers adat). kind: "overview" (build) vagy "matchups" (counterek)."""
        candidates = MODES[mode]
        if mode in self.mode_ok:
            candidates = [self.mode_ok[mode]] + [m for m in candidates if m != self.mode_ok[mode]]
        errors = []
        for patch in self.patches():
            for um in candidates:
                ck = (kind, patch, um, champ_key)
                hit = self.cache.get(ck)
                if hit and time.time() - hit[0] < 1800:
                    return patch, um, hit[1]
                ver = (self.versions or {}).get(patch, {}).get(kind, "1.5.0")
                url = UGG_OVERVIEW_URL.format(kind=kind, patch=patch, mode=um, champ=champ_key, ver=ver)
                try:
                    data = http_get_json(url)
                    if data:
                        self.cache[ck] = (time.time(), data)
                        if kind == "overview":
                            self.mode_ok[mode] = um
                        return patch, um, data
                    errors.append(f"{patch}/{um}: üres")
                except urllib.error.HTTPError as e:
                    errors.append(f"{patch}/{um}: HTTP {e.code}")
                except Exception as e:
                    errors.append(f"{patch}/{um}: {e}")
        raise AppError(tr("A U.GG nem adott build adatot."), "; ".join(errors))


UGG = UggSource()


def _wr(a, b):
    """U.GG tömbök: [meccsek, győzelmek] vagy fordítva - a kisebb a győzelem."""
    try:
        a, b = float(a), float(b)
        wins, games = min(a, b), max(a, b)
        return (round(100.0 * wins / games, 1) if games else 0.0), int(games)
    except Exception:
        return 0.0, 0


def parse_overview_entry(o):
    """Egy U.GG overview bejegyzés feldolgozása.

    Ismert szerkezet: [0] rúnák, [1] idézőigék, [2] kezdő tárgyak, [3] core tárgyak,
    [4] skill-sorrend, [5] 4./5./6. tárgy opciók, [6] összesített WR, [7] kevés adat, [8] statmodok.
    Minden részt ellenőrzünk; ha a megszokott helyen nem stimmel, a többi elemet is végignézzük.
    """
    items = STATIC.bundle["items"]
    spells_db = STATIC.bundle["spells"]
    tree_ids = {t["id"] for t in STATIC.bundle["runes"]}

    def runes(p):
        wr, games = _wr(p[0], p[1])
        perk_ids = [int(x) for x in p[4]]
        primary, sub = int(p[2]), int(p[3])
        assert primary in tree_ids and sub in tree_ids and len(perk_ids) >= 6
        prim, sec = [], []
        for pid in perk_ids:
            tree, slot = STATIC.rune_slot.get(pid, (None, 9))
            assert tree is not None
            (prim if tree == primary else sec).append((slot, pid))
        prim.sort()
        sec.sort()
        return {"primary": primary, "sub": sub, "primaryPerks": [x[1] for x in prim],
                "subPerks": [x[1] for x in sec], "wr": wr, "games": games}

    def spells(s):
        wr, games = _wr(s[0], s[1])
        ids = [str(int(x)) for x in s[2]]
        assert len(ids) == 2 and all(i in spells_db for i in ids)
        return {"ids": ids, "wr": wr, "games": games}

    def itemset(s):
        wr, games = _wr(s[0], s[1])
        ids = [str(int(x)) for x in s[2]]
        assert ids and all(i in items for i in ids)
        return {"ids": ids, "wr": wr, "games": games}

    def abilities(a):
        wr, games = _wr(a[0], a[1])
        order = [str(x).upper() for x in a[2]]
        assert order and all(x in "QWER" for x in order)
        maxorder = str(a[3]).upper() if len(a) > 3 and isinstance(a[3], str) else ""
        if not maxorder:
            cnt, done = {"Q": 0, "W": 0, "E": 0}, []
            for x in order:
                if x in cnt:
                    cnt[x] += 1
                    if cnt[x] == 5:
                        done.append(x)
            maxorder = "".join(done + [k for k in "QWE" if k not in done])
        return {"order": order, "max": [c for c in maxorder if c in "QWE"], "wr": wr, "games": games}

    def options(slots):
        res = []
        assert isinstance(slots, list) and slots and isinstance(slots[0], list)
        for slot in slots:
            lst = []
            for it in slot:
                iid = str(int(it[0]))
                if iid not in items:
                    continue
                wr, games = _wr(it[1], it[2])
                lst.append({"id": iid, "wr": wr, "games": games})
            lst.sort(key=lambda x: -x["games"])
            res.append(lst[:5])
        assert any(res)
        return res

    def shards(s):
        ids = [int(x) for x in s[2]]
        assert len(ids) == 3 and all(5000 <= i < 5100 for i in ids)
        return {"ids": ids}

    def pick(pref, fn, used):
        order = [pref] + [i for i in range(len(o)) if i != pref]
        for i in order:
            if i in used or i >= len(o):
                continue
            try:
                r = fn(o[i])
                used.add(i)
                return r
            except Exception:
                continue
        return None

    used = set()
    out = {}
    out["runes"] = pick(0, runes, used)
    out["spells"] = pick(1, spells, used)
    out["skills"] = pick(4, abilities, used)
    out["options"] = pick(5, options, used) or []
    out["shards"] = pick(8, shards, used)
    out["starting"] = pick(2, itemset, used)
    out["core"] = pick(3, itemset, used)
    out["total"] = _safe(lambda: dict(zip(("wr", "games"), _wr(o[6][0], o[6][1]))), {"wr": 0, "games": 0})
    out["lowSample"] = _safe(lambda: bool(o[7]) if isinstance(o[7], bool) else False, False)
    if not (out["runes"] or out["core"]):
        raise AppError(tr("A U.GG adatformátuma megváltozott, nem tudom értelmezni."),
                       "parse: " + json.dumps(o)[:300])
    return out


def _entry_games(entry):
    try:
        return _wr(entry[0][6][0], entry[0][6][1])[1]
    except Exception:
        return 0


def build_from_raw(raw, role, rank, aram_like):
    region = raw.get(UGG_REGION_WORLD) or next(iter(raw.values()))
    want_rank = UGG_RANKS.get(rank, "17")
    rank_used = next((rk for rk in [want_rank] + UGG_RANK_FALLBACK + list(region.keys())
                      if rk in region and region[rk]), None)
    if rank_used is None:
        raise AppError(tr("Ehhez a hőshöz nincs elég adat."))
    by_role = region[rank_used]
    roles = []
    for rk, entry in by_role.items():
        wr, g = _safe(lambda: _wr(entry[0][6][0], entry[0][6][1]), (0, 0))
        roles.append({"role": "aram" if aram_like else UGG_ROLE_NAMES.get(rk, rk), "key": rk, "games": g, "wr": wr})
    roles.sort(key=lambda r: -r["games"])
    if not roles:
        raise AppError(tr("Ehhez a hőshöz nincs elég adat."))
    role_key = UGG_ROLES.get(role) if role not in ("auto", "", None) else None
    if aram_like or role_key not in by_role:
        role_key = roles[0]["key"]
    parsed = parse_overview_entry(by_role[role_key][0])
    if aram_like:
        roles = roles[:1]
    parsed.update({
        "role": "aram" if aram_like else UGG_ROLE_NAMES.get(role_key, role_key),
        "roles": roles,
        "rankUsed": next((k for k, v in UGG_RANKS.items() if v == rank_used), "overall"),
    })
    return parsed


def get_build(champ_key, role="auto", rank="emerald_plus", mode="solo"):
    """Tartalék-lánc: U.GG friss -> mentett U.GG adat -> (Mayhemnél ARAM) -> Riot kliens ajánlás."""
    STATIC.ensure()
    champ_key = str(champ_key)
    if mode not in MODES:
        mode = "solo"
    notes, errors = [], []
    modes_to_try = [mode] + (["aram"] if mode == "mayhem" else [])
    for m in modes_to_try:
        aram_like = m in ("aram", "mayhem")
        cache_name = f"builds/{m}_{champ_key}.json"
        try:
            patch, um, raw = UGG.raw(champ_key, m)
            b = build_from_raw(raw, role, rank, aram_like)
            disk_cache_put(cache_name, {"time": time.time(), "patch": patch, "raw": raw})
            b.update({"source": "ugg", "patch": patch.replace("_", "."), "stale": None})
        except Exception as e:
            errors.append(f"[{m}] {e} {getattr(e, 'detail', '')}".strip())
            saved = disk_cache_get(cache_name)
            if not saved:
                continue
            try:
                b = build_from_raw(saved["raw"], role, rank, aram_like)
            except Exception as e2:
                errors.append(f"[{m} mentett] {e2}")
                continue
            b.update({"source": "cache", "patch": saved.get("patch", "?").replace("_", "."),
                      "stale": time.strftime("%Y.%m.%d", time.localtime(saved.get("time", 0)))})
            notes.append(tr("A U.GG most nem elérhető, a legutóbb mentett adatot látod."))
        if m != mode:
            notes.append(tr("ARAM Mayhem build nem érhető el, a sima ARAM buildet látod (az augmentek nélkül)."))
        b.update({"mode": m, "requestedMode": mode, "champKey": champ_key, "notes": notes, "errors": errors})
        return b

    rec = _safe(lambda: CLIENT.recommended(champ_key, role, mode))
    if rec:
        notes.append(tr("Se a U.GG, se mentett adat nem elérhető – a Riot kliens saját rúna-ajánlását látod (tárgyak nélkül)."))
        rec.update({"mode": mode, "requestedMode": mode, "champKey": champ_key, "notes": notes, "errors": errors,
                    "source": "riot", "patch": STATIC.version, "stale": None})
        return rec
    raise AppError(tr("Nem sikerült build adatot szerezni."), " | ".join(errors))


# ---------------------------------------------------------------- Counterek (U.GG matchup adatok)

def _matchup_rows(node, champs):
    """Megkeresi a [hős_id, győzelem, meccs, ...] alakú sorokat - a pontos szerkezettől függetlenül."""
    rows = []
    if isinstance(node, list):
        if len(node) >= 3 and all(isinstance(x, (int, float)) for x in node[:3]) and str(int(node[0])) in champs:
            a, b = float(node[1]), float(node[2])
            if a >= 0 and b > 0:
                return [(str(int(node[0])), min(a, b), max(a, b))]
            return []
        for x in node:
            rows.extend(_matchup_rows(x, champs))
    return rows


COUNTER_CACHE = {}


def get_counters(champ_key, mode="solo", role="auto", n=3):
    """A hős legerősebb counterei: akik ellen a legrosszabb a győzelmi aránya (elég meccs mellett)."""
    STATIC.ensure()
    champ_key = str(champ_key)
    if mode not in MODES:
        mode = "solo"
    ck = (champ_key, mode, role)
    hit = COUNTER_CACHE.get(ck)
    if hit and time.time() - hit[0] < 1800:
        return hit[1]
    patch, um, raw = UGG.raw(champ_key, mode if mode != "mayhem" else "aram", "matchups")
    champs = STATIC.bundle["champions"]
    region = raw.get(UGG_REGION_WORLD) or next(iter(raw.values()))
    rank_key = next((rk for rk in UGG_RANK_FALLBACK + list(region.keys()) if rk in region and region[rk]), None)
    if rank_key is None:
        raise AppError(tr("Ehhez a hőshöz nincs elég adat."))
    by_role = region[rank_key]
    best = None
    want = UGG_ROLES.get(role)
    keys = ([want] if want in by_role else []) + list(by_role.keys())
    for rk in keys:
        rows = _matchup_rows(by_role[rk], champs)
        rows = [r for r in rows if r[0] != champ_key]
        games = sum(r[2] for r in rows)
        if rows and (best is None or (rk == want) or games > best[1]):
            best = (rows, games, rk)
            if rk == want:
                break
    if not best:
        raise AppError(tr("A counter adat most nem érhető el."))
    rows, total, rk = best
    merged = {}
    for c, w, g in rows:  # ha egy hős többször szerepelne, összevonjuk
        m = merged.setdefault(c, [0.0, 0.0])
        m[0] += w
        m[1] += g
    min_games = max(30, total * 0.004)
    lst = [(c, w / g, g) for c, (w, g) in merged.items() if g >= min_games]
    lst.sort(key=lambda x: x[1])  # a hős győzelmi aránya ellenük – a legkisebb a legerősebb counter
    out = {"champ": champ_key, "patch": patch.replace("_", "."), "role": UGG_ROLE_NAMES.get(rk, rk),
           "counters": [{"c": c, "wr": round(100 * (1 - r), 1), "games": int(g)} for c, r, g in lst[:n]]}
    COUNTER_CACHE[ck] = (time.time(), out)
    return out


# ---------------------------------------------------------------- LoL kliens (LCU) és élő meccs

_lcu_ctx = ssl.create_default_context()
_lcu_ctx.check_hostname = False
_lcu_ctx.verify_mode = ssl.CERT_NONE  # a kliens saját aláírású tanúsítványt használ, csak 127.0.0.1-re


class LCU:
    def __init__(self):
        self.port = None
        self.auth = None
        self.install_dir = None
        self.last_lookup = 0
        self.last_process_lookup = 0
        self.lock = threading.Lock()
        self.state = {
            "connected": False, "phase": "None", "championKey": None, "position": None, "queueId": None,
            "queueMode": None, "enemies": [], "allies": [], "inGame": False, "myItems": [], "level": 0,
        }

    def _lockfile_candidates(self):
        paths = []
        remembered = disk_cache_get("league_path.json") or {}
        for base in (CONFIG.get("league_path"), remembered.get("path")):
            if base:
                paths.append(os.path.join(base, "lockfile"))
        for drive in "CDEF":
            paths.append(f"{drive}:\\Riot Games\\League of Legends\\lockfile")
            paths.append(f"{drive}:\\Games\\Riot Games\\League of Legends\\lockfile")
            paths.append(f"{drive}:\\Program Files\\Riot Games\\League of Legends\\lockfile")
        return paths

    def _from_process(self):
        """Ha nincs lockfile a szokásos helyen: a kliens folyamatából olvassuk ki (ritkán, mert drágább)."""
        if os.name != "nt" or time.time() - self.last_process_lookup < 30:
            return None
        self.last_process_lookup = time.time()
        try:
            cmd = ["powershell", "-NoProfile", "-Command",
                   "(Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\").CommandLine"]
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=10,
                                 creationflags=0x08000000).stdout  # CREATE_NO_WINDOW
            port = re.search(r"--app-port=(\d+)", out)
            tok = re.search(r"--remoting-auth-token=([\w-]+)", out)
            inst = re.search(r'--install-directory=([^"]+?)"?\s+--', out + " --")
            if inst:
                self.install_dir = inst.group(1).strip().strip('"')
                disk_cache_put("league_path.json", {"path": self.install_dir})
            if port and tok:
                return port.group(1), tok.group(1)
        except Exception:
            pass
        return None

    def connect(self):
        if self.port and time.time() - self.last_lookup < 30:
            return True
        if not self.port and time.time() - self.last_lookup < 4:
            return False
        self.last_lookup = time.time()
        found = None
        for p in self._lockfile_candidates():
            try:
                if os.path.exists(p):
                    with open(p, "r") as f:
                        parts = f.read().strip().split(":")
                    found = (parts[2], parts[3])
                    self.install_dir = os.path.dirname(p)
                    break
            except Exception:
                continue
        if not found:
            found = self._from_process()
        if found:
            if found[0] != self.port:
                log("Kapcsolódva a LoL klienshez (port", found[0] + ")")
                HISTORY.refresh_later(6)
            self.port = found[0]
            self.auth = "Basic " + base64.b64encode(f"riot:{found[1]}".encode()).decode()
            return True
        self.port = None
        return False

    def request(self, method, path, body=None, timeout=4):
        if not self.port:
            raise RuntimeError("Nincs kapcsolat a klienssel")
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"https://127.0.0.1:{self.port}{path}", data=data, method=method,
                                     headers={"Authorization": self.auth, "Content-Type": "application/json",
                                              "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout, context=_lcu_ctx) as r:
            txt = r.read().decode("utf-8")
            return json.loads(txt) if txt else None

    def get(self, path):
        return self.request("GET", path)

    # -- állapot
    def poll_once(self):
        if not self.connect():
            self._set(connected=False, phase="None", inGame=False, lockedKey=None)
            return 5
        try:
            phase = self.get("/lol-gameflow/v1/gameflow-phase")
        except Exception:
            self.port = None
            self.last_lookup = 0
            self._set(connected=False, phase="None", inGame=False)
            return 3
        upd = {"connected": True, "phase": phase}
        if phase != "ChampSelect":
            AUTO.reset()
            upd["lockedKey"] = None
        try:
            q = (self.get("/lol-gameflow/v1/session") or {}).get("gameData", {}).get("queue", {}) or {}
            upd["queueId"] = q.get("id")
            upd["queueMode"] = queue_mode(q)
        except Exception:
            pass

        if phase == "ChampSelect":
            try:
                s = self.get("/lol-champ-select/v1/session")
                me = s.get("localPlayerCellId")
                allies, enemies = [], []
                for p in s.get("myTeam", []):
                    cid = p.get("championId") or p.get("championPickIntent") or 0
                    if p.get("cellId") == me:
                        if cid:
                            upd["championKey"] = str(cid)
                        upd["lockedKey"] = str(p["championId"]) if p.get("championId") else None
                        upd["position"] = LCU_POSITION_TO_ROLE.get((p.get("assignedPosition") or "").lower())
                    elif cid:
                        allies.append(str(cid))
                for p in s.get("theirTeam", []):
                    if p.get("championId"):
                        enemies.append(str(p["championId"]))
                # draftban csak a végleges (lezárt) választásnál importálunk, nem hoverre
                picks = [a for grp in (s.get("actions") or []) for a in grp
                         if a.get("actorCellId") == me and a.get("type") == "pick"]
                if picks:
                    done = [a for a in picks if a.get("completed") and a.get("championId")]
                    upd["lockedKey"] = str(done[-1]["championId"]) if done else None
                upd.update({"allies": allies, "enemies": enemies, "inGame": False, "myItems": [], "level": 0})
            except Exception:
                pass
            self._set(**upd)
            if upd.get("lockedKey"):
                AUTO.on_champion(upd["lockedKey"], upd.get("position"), upd.get("queueMode"))
            return 1.5

        if phase in ("InProgress", "Reconnect"):
            upd["inGame"] = True
            _safe(lambda: SCOUT.on_phase(phase))
            live = live_game()
            if live:
                upd.update(live)
            self._set(**upd)
            return 3

        upd["inGame"] = False
        prev_phase = self.snapshot().get("phase")
        self._set(**upd)
        if phase in ("EndOfGame", "PreEndOfGame", "WaitingForStats", "Lobby", "None") and prev_phase in ("InProgress", "WaitingForStats", "PreEndOfGame"):
            HISTORY.refresh_later(8)
        return 4

    def _set(self, **kw):
        with self.lock:
            self.state.update(kw)

    def snapshot(self):
        with self.lock:
            return dict(self.state)

    def loop(self):
        while True:
            try:
                wait = self.poll_once()
            except Exception:
                if CONFIG.get("debug"):
                    traceback.print_exc()
                wait = 5
            time.sleep(wait)

    # -- hősválasztás: teljes élő állapot a felületnek
    def champselect(self):
        if not self.connect():
            return {"active": False, "connected": False}
        try:
            phase = self.get("/lol-gameflow/v1/gameflow-phase")
        except Exception:
            return {"active": False, "connected": False}
        if phase != "ChampSelect":
            return {"active": False, "connected": True, "phase": phase, "queueMode": self.snapshot().get("queueMode")}
        s = self.get("/lol-champ-select/v1/session") or {}
        me = s.get("localPlayerCellId")
        my_cells = {p.get("cellId") for p in s.get("myTeam", [])}
        actions = [a for grp in (s.get("actions") or []) for a in grp]
        hovers, bans_mine, bans_theirs = {}, [], []
        my_action, upcoming = None, None
        for a in actions:
            cid = a.get("championId") or 0
            if a.get("type") == "pick" and cid and not a.get("completed"):
                hovers[a.get("actorCellId")] = str(cid)
            if a.get("type") == "ban" and a.get("completed") and cid:
                (bans_mine if a.get("actorCellId") in my_cells else bans_theirs).append(str(cid))
            if a.get("actorCellId") == me and not a.get("completed") and a.get("type") in ("pick", "ban"):
                if a.get("isInProgress"):
                    my_action = a
                elif upcoming is None and a.get("type") == "pick":
                    upcoming = a
        for key, dst in (("myTeamBans", bans_mine), ("theirTeamBans", bans_theirs)):
            for cid in (s.get("bans") or {}).get(key) or []:
                if cid and str(cid) not in dst:
                    dst.append(str(cid))

        def member(p, mine):
            cid = p.get("championId") or 0
            hov = p.get("championPickIntent") or 0
            name = ""
            if mine:
                name = p.get("gameName") or p.get("summonerName") or ""
            return {"cell": p.get("cellId"), "champ": str(cid) if cid else None,
                    "hover": str(hov) if hov and not cid else hovers.get(p.get("cellId")) if not cid else None,
                    "pos": LCU_POSITION_TO_ROLE.get((p.get("assignedPosition") or "").lower()),
                    "name": name, "me": p.get("cellId") == me,
                    "spells": [p.get("spell1Id"), p.get("spell2Id")]}

        timer = s.get("timer") or {}
        if not hasattr(self, "_cs_lists") or self._cs_lists[0] != s.get("gameId"):
            pick = _safe(lambda: self.get("/lol-champ-select/v1/pickable-champion-ids"), []) or []
            ban = _safe(lambda: self.get("/lol-champ-select/v1/bannable-champion-ids"), []) or []
            self._cs_lists = (s.get("gameId"), [str(x) for x in pick], [str(x) for x in ban])
        else:
            pick = _safe(lambda: self.get("/lol-champ-select/v1/pickable-champion-ids"), None)
            if pick:
                self._cs_lists = (self._cs_lists[0], [str(x) for x in pick], self._cs_lists[2])
        return {
            "active": True, "connected": True, "phase": "ChampSelect",
            "queueMode": self.snapshot().get("queueMode"),
            "timer": {"phase": timer.get("phase"), "left": int(timer.get("adjustedTimeLeftInPhase") or 0)},
            "myTeam": [member(p, True) for p in s.get("myTeam", [])],
            "theirTeam": [member(p, False) for p in s.get("theirTeam", [])],
            "bans": {"mine": bans_mine, "theirs": bans_theirs},
            "bench": [str(b.get("championId")) for b in (s.get("benchChampions") or []) if b.get("championId")],
            "benchEnabled": bool(s.get("benchEnabled")),
            "myTurn": my_action.get("type") if my_action else None,
            "myAction": (my_action or upcoming or {}).get("id"),
            "pickable": self._cs_lists[1], "bannable": self._cs_lists[2],
        }

    def champselect_action(self, champ, lock=False):
        """A saját aktuális (vagy következő) választásodra/kitiltásodra teszi a hőst; lock=True: le is zárja."""
        st = self.champselect()
        if not st.get("active"):
            return {"ok": False, "error": tr("Nem vagy hősválasztásban.")}
        aid = st.get("myAction")
        if not aid:
            return {"ok": False, "error": tr("Most nincs választásod vagy kitiltásod.")}
        body = {"championId": int(champ)}
        if lock:
            if not st.get("myTurn"):
                return {"ok": False, "error": tr("Még nem te következel.")}
            body["completed"] = True
        try:
            self.request("PATCH", f"/lol-champ-select/v1/session/actions/{aid}", body)
            return {"ok": True}
        except urllib.error.HTTPError as e:
            return {"ok": False, "error": f"{tr('Nem sikerült')} (HTTP {e.code})"}
        except Exception as e:
            return {"ok": False, "error": f"{tr('Nem sikerült')}: {e}"}

    def set_spells(self, ids):
        """Idézőigék beállítása hősválasztásban. A Flash (4) a beállított billentyűre (D = 1., F = 2.) kerül."""
        ids = [int(x) for x in ids][:2]
        if len(ids) != 2:
            return {"ok": False, "error": tr("Nincs idézőige adat.")}
        if 4 in ids:
            other = ids[1] if ids[0] == 4 else ids[0]
            ids = [4, other] if CONFIG.get("flash_key", "D") == "D" else [other, 4]
        if not self.connect():
            return {"ok": False, "error": tr("A LoL kliens nem fut.")}
        try:
            self.request("PATCH", "/lol-champ-select/v1/session/my-selection", {"spell1Id": ids[0], "spell2Id": ids[1]})
            return {"ok": True, "ids": ids}
        except urllib.error.HTTPError as e:
            return {"ok": False, "error": f"{tr('Nem sikerült')} (HTTP {e.code})"}
        except Exception as e:
            return {"ok": False, "error": f"{tr('Nem sikerült')}: {e}"}

    def bench_swap(self, champ):
        try:
            self.request("POST", f"/lol-champ-select/v1/session/bench/swap/{int(champ)}")
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": f"{tr('Nem sikerült')}: {e}"}

    # -- Riot saját ajánlása (tartalék)
    def recommended(self, champ_key, role, mode):
        if not self.connect():
            return None
        map_id = 12 if mode in ("aram", "mayhem") else 11
        pos = ROLE_TO_LCU.get(role) or ROLE_TO_LCU.get(self.snapshot().get("position") or "", "NONE")
        pages = None
        for p in (pos, "NONE"):
            try:
                pages = self.get(f"/lol-perks/v1/recommended-pages/champion/{champ_key}/position/{p}/map/{map_id}")
                if pages:
                    break
            except Exception:
                continue
        if not pages:
            return None
        pg = pages[0]
        perks = [int(x["id"] if isinstance(x, dict) else x) for x in pg.get("perks", [])]
        primary, sub = int(pg.get("primaryPerkStyleId", 0)), int(pg.get("secondaryPerkStyleId", 0))
        prim = sorted([(STATIC.rune_slot[p][1], p) for p in perks if STATIC.rune_slot.get(p, (0,))[0] == primary])
        sec = sorted([(STATIC.rune_slot[p][1], p) for p in perks if STATIC.rune_slot.get(p, (0,))[0] == sub])
        shards = [p for p in perks if 5000 <= p < 5100]
        spells = [str(x) for x in pg.get("summonerSpellIds", [])]
        return {
            "runes": {"primary": primary, "sub": sub, "primaryPerks": [x[1] for x in prim],
                      "subPerks": [x[1] for x in sec], "wr": 0, "games": 0},
            "shards": {"ids": shards} if len(shards) == 3 else None,
            "spells": {"ids": spells, "wr": 0, "games": 0} if len(spells) == 2 else None,
            "skills": None, "starting": None, "core": None, "options": [],
            "total": {"wr": 0, "games": 0}, "lowSample": False,
            "role": role if role in ROLE_TO_LCU else (self.snapshot().get("position") or "auto"),
            "roles": [], "rankUsed": "overall",
        }

    # -- rúnalap beállítása a kliensben
    def import_runes(self, name, primary, sub, perks, overwrite=False):
        if not self.connect():
            return {"ok": False, "error": tr("A LoL kliens nem fut.")}
        pages = self.get("/lol-perks/v1/pages") or []
        for p in pages:
            if str(p.get("name", "")).startswith((RUNE_PREFIX.strip(), "LBA:")) and p.get("isDeletable", True):
                _safe(lambda: self.request("DELETE", f"/lol-perks/v1/pages/{p['id']}"))
        body = {"name": f"{RUNE_PREFIX}{name}"[:25], "primaryStyleId": primary, "subStyleId": sub,
                "selectedPerkIds": perks, "current": True}
        try:
            self.request("POST", "/lol-perks/v1/pages", body)
            return {"ok": True}
        except urllib.error.HTTPError:
            if not overwrite:
                return {"ok": False, "full": True,
                        "error": tr("Nincs szabad rúnalap-hely. Felülírjam az épp kiválasztottat?")}
        try:
            cur = self.get("/lol-perks/v1/currentpage")
            if not cur or not cur.get("isEditable", True):
                return {"ok": False, "error": tr("Az aktuális rúnalap nem szerkeszthető.")}
            body["id"] = cur["id"]
            self.request("PUT", f"/lol-perks/v1/pages/{cur['id']}", body)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": f"{tr('Nem sikerült')}: {e}"}


def queue_mode(q):
    qid = q.get("id")
    if qid in QUEUE_TO_MODE:
        return QUEUE_TO_MODE[qid]
    txt = " ".join(str(q.get(k, "")) for k in ("gameMode", "description", "detailedDescription", "name")).lower()
    if "mayhem" in txt or "kiwi" in txt:
        return "mayhem"
    if "aram" in txt:
        return "aram"
    if "flex" in txt:
        return "flex"
    return None


def live_game():
    """Meccs közben a játék saját helyi adat-API-ja (2999-es port): csapatok, tárgyaid, szinted."""
    try:
        req = urllib.request.Request("https://127.0.0.1:2999/liveclientdata/allgamedata")
        with urllib.request.urlopen(req, timeout=2, context=_lcu_ctx) as r:
            d = json.loads(r.read().decode("utf-8"))
        ap = d.get("activePlayer", {})
        names = {ap.get("riotId"), ap.get("summonerName")} - {None, ""}
        players = d.get("allPlayers", [])
        me = next((p for p in players if p.get("riotId") in names or p.get("summonerName") in names), None)
        if not me:
            return None

        def key_of(p):
            raw = p.get("rawChampionName", "")
            return STATIC.champ_by_id.get(raw.replace("game_character_displayname_", ""))

        res = {
            "enemies": [k for k in (key_of(p) for p in players if p.get("team") != me.get("team")) if k],
            "allies": [k for k in (key_of(p) for p in players if p.get("team") == me.get("team") and p is not me) if k],
            "myItems": [str(it.get("itemID")) for it in me.get("items", []) if it.get("itemID")],
            "level": int(ap.get("level") or me.get("level") or 0),
        }
        mk = key_of(me)
        if mk:
            res["championKey"] = mk
        lp = []
        for p in players:
            k = key_of(p)
            if not k:
                continue
            sp = json.dumps(p.get("summonerSpells") or {}).lower()
            lp.append({"c": k, "ally": p.get("team") == me.get("team"),
                       "pos": LCU_POSITION_TO_ROLE.get(str(p.get("position") or "").lower()), "smite": "smite" in sp})
        res["livePos"] = lp
        gm = str(d.get("gameData", {}).get("gameMode", "")).upper()
        if gm in ("KIWI",):
            res["queueMode"] = "mayhem"
        elif gm == "ARAM":
            res["queueMode"] = res.get("queueMode") or "aram"
        return res
    except Exception:
        return None


CLIENT = LCU()


# ---------------------------------------------------------------- Automatikus rúna + tárgylista betöltés

MODE_LABEL = {"solo": "Solo/Duo", "flex": "Flex", "aram": "ARAM", "mayhem": "Mayhem"}


def _counts(ids):
    out = []
    for i in ids:
        if out and out[-1][0] == i:
            out[-1][1] += 1
        else:
            out.append([i, 1])
    return out


def league_install_dir():
    cands = [CONFIG.get("league_path"), CLIENT.install_dir, (disk_cache_get("league_path.json") or {}).get("path")]
    for d in "CDEF":
        cands += [f"{d}:\\Riot Games\\League of Legends", f"{d}:\\Games\\Riot Games\\League of Legends",
                  f"{d}:\\Program Files\\Riot Games\\League of Legends"]
    for c in cands:
        if c and os.path.isdir(os.path.join(c, "Config")):
            return c
    return None


def itemset_blocks(b):
    blocks = []

    def blk(title, ids):
        ids = [str(i) for i in ids if str(i) in STATIC.bundle["items"]]
        if ids:
            blocks.append({"type": title[:40], "items": [{"id": i, "count": c} for i, c in _counts(ids)],
                           "hideIfSummonerSpell": "", "showIfSummonerSpell": ""})

    if b.get("starting"):
        blk(f"{tr('Kezdés')} ({b['starting']['wr']}% WR)", b["starting"]["ids"])
    if b.get("core"):
        blk(f"{tr('Core build')} ({b['core']['wr']}% WR)", b["core"]["ids"])
    for i, opts in enumerate(b.get("options") or []):
        if opts:
            blk(tr("{n}. tárgy – választható", n=i + 4), [o["id"] for o in opts[:4]])
    blk(tr("Fogyóeszközök"), ["2003", "2055"])
    return blocks


def _itemset_via_client(champ_key, title, blocks, aram):
    me = CLIENT.get("/lol-summoner/v1/current-summoner") or {}
    sid = me.get("summonerId")
    if not sid:
        raise RuntimeError(tr("Nem található a játékos azonosító."))
    path = f"/lol-item-sets/v1/item-sets/{sid}/sets"
    cur = CLIENT.get(path) or {}
    keep = [x for x in (cur.get("itemSets") or [])
            if not (str(x.get("title", "")).startswith(ITEMSET_PREFIX)
                    and int(champ_key) in (x.get("associatedChampions") or []))]
    new = {
        "title": title, "associatedChampions": [int(champ_key)], "associatedMaps": [12] if aram else [11],
        "blocks": blocks, "map": "any", "mode": "any", "preferredItemSlots": [], "sortrank": 0,
        "startedFrom": "blank", "type": "custom", "uid": hashlib.md5(f"rm{champ_key}{time.time()}".encode()).hexdigest(),
    }
    body = {"accountId": cur.get("accountId") or me.get("accountId"), "itemSets": [new] + keep,
            "timestamp": int(time.time() * 1000)}
    CLIENT.request("PUT", path, body)
    # ellenőrzés: tényleg bent van-e
    after = CLIENT.get(path) or {}
    if not any(x.get("title") == title for x in after.get("itemSets") or []):
        raise RuntimeError("a kliens nem mentette el")


def _itemset_via_file(champ_id, title, blocks):
    base = league_install_dir()
    if not base:
        raise RuntimeError(tr("Nem találom a LoL mappáját (config.json → league_path)."))
    folder = os.path.join(base, "Config", "Champions", champ_id, "Recommended")
    os.makedirs(folder, exist_ok=True)
    data = {"title": title, "type": "custom", "map": "any", "mode": "any", "priority": False, "sortrank": 0,
            "blocks": [{"type": b_["type"], "items": b_["items"]} for b_ in blocks]}
    with open(os.path.join(folder, "RiftMester.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def import_itemset(champ_key, name, b):
    """A buildet tárgylistaként beteszi a játékba: a kliens API-ján ÉS fájlként is (tartalék)."""
    blocks = itemset_blocks(b)
    if not blocks:
        return tr("Ehhez a buildhez nincs tárgy adat.")
    title = f"{ITEMSET_PREFIX} · {name} · {MODE_LABEL.get(b.get('mode'), '')}"[:75]
    aram = b.get("mode") in ("aram", "mayhem")
    champ_id = STATIC.bundle["champions"].get(str(champ_key), {}).get("id", "")
    errors, ok = [], []
    if CLIENT.connect():
        try:
            _itemset_via_client(champ_key, title, blocks, aram)
            ok.append("client")
        except Exception as e:
            errors.append(f"kliens: {e}")
    try:
        _itemset_via_file(champ_id, title, blocks)
        ok.append("file")
    except PermissionError:
        errors.append(tr("fájl: nincs írási jog a LoL mappájába (indítsd rendszergazdaként)"))
    except Exception as e:
        errors.append(f"fájl: {e}")
    log("Tárgylista:", name, "sikerült:", ok or "-", "hibák:", errors or "-")
    return "ok" if ok else " · ".join(errors)


class AutoImporter:
    def __init__(self):
        self.last = None
        self.busy = False
        self.status = {}

    def reset(self):
        self.last = None

    def on_champion(self, key, position, qmode):
        if not (CONFIG.get("auto_runes") or CONFIG.get("auto_itemset") or CONFIG.get("auto_spells")):
            return
        sig = (key, position, qmode)
        if sig == self.last or self.busy:
            return
        self.last = sig
        self.busy = True
        threading.Thread(target=self._run, args=(key, position, qmode), daemon=True).start()

    def _run(self, key, position, qmode):
        st = {"champ": key, "time": time.time(), "runes": None, "items": None, "spells": None}
        try:
            b = get_build(key, position or "auto", CONFIG.get("default_rank", "emerald_plus"), qmode or "solo")
            name = STATIC.bundle["champions"].get(key, {}).get("name", "Build")
            r = b.get("runes")
            if CONFIG.get("auto_runes"):
                if r and b.get("shards") and len(r["primaryPerks"]) >= 4 and len(r["subPerks"]) >= 2:
                    perks = r["primaryPerks"][:4] + r["subPerks"][:2] + b["shards"]["ids"]
                    res = CLIENT.import_runes(name, r["primary"], r["sub"], perks, bool(CONFIG.get("rune_overwrite", True)))
                    st["runes"] = "ok" if res.get("ok") else res.get("error", "hiba")
                else:
                    st["runes"] = tr("Nincs teljes rúna adat.")
            if CONFIG.get("auto_spells") and b.get("spells"):
                res = CLIENT.set_spells(b["spells"]["ids"])
                st["spells"] = "ok" if res.get("ok") else res.get("error", "hiba")
            if CONFIG.get("auto_itemset"):
                try:
                    st["items"] = import_itemset(key, name, b)
                except Exception as e:
                    st["items"] = f"{tr('Nem sikerült')}: {e}"
            log("Automatikus betöltés:", name, "rúnák:", st["runes"], "idézőigék:", st["spells"], "tárgylista:", st["items"])
        except Exception as e:
            st["error"] = str(e)
            log("Automatikus betöltés hiba:", e)
        self.status = st
        self.busy = False


AUTO = AutoImporter()


# ---------------------------------------------------------------- Meccselőzmény és statisztika

STAT_QUEUES = {"solo": {420}, "flex": {440}, "aram": {450, 100}, "mayhem": {2400}}
QUEUE_NAMES = {420: "Solo/Duo", 440: "Flex", 450: "ARAM", 100: "ARAM", 2400: "ARAM Mayhem", 400: "Normál draft",
               430: "Normál blind", 480: "Swiftplay", 490: "Swiftplay", 1700: "Arena", 1710: "Arena", 900: "URF",
               1900: "URF", 1020: "Egy mindenkiért", 0: "Egyedi"}


def parse_game(g, puuid):
    pid = None
    for pi in g.get("participantIdentities") or []:
        if (pi.get("player") or {}).get("puuid") == puuid:
            pid = pi.get("participantId")
    parts = g.get("participants") or []
    p = next((x for x in parts if x.get("participantId") == pid), None) or (parts[0] if len(parts) == 1 else None)
    if not p or not g.get("gameId"):
        return None
    st = p.get("stats") or {}
    dur = int(g.get("gameDuration") or 0)
    if dur > 100000:  # ha ezredmásodpercben jönne
        dur //= 1000
    return {"id": g["gameId"], "t": int(g.get("gameCreation") or 0), "dur": dur, "q": int(g.get("queueId") or 0),
            "c": str(p.get("championId")), "win": bool(st.get("win")),
            "k": int(st.get("kills") or 0), "d": int(st.get("deaths") or 0), "a": int(st.get("assists") or 0),
            "cs": int(st.get("totalMinionsKilled") or 0) + int(st.get("neutralMinionsKilled") or 0),
            "remake": dur and dur < 300}


class History:
    def __init__(self):
        self.lock = threading.Lock()
        self.puuid = None
        self.matches = {}
        self.ranked = []
        self.mastery = []
        self.summoner = None
        self.last = 0
        self.loading = False

    def refresh_later(self, sec):
        t = threading.Timer(sec, self.refresh)
        t.daemon = True
        t.start()

    def _load(self, puuid):
        self.puuid = puuid
        data = disk_cache_get(f"history/{puuid}.json") or {}
        self.matches = {str(m["id"]): m for m in data.get("matches", [])}

    def refresh(self):
        if self.loading:
            return
        self.loading = True
        try:
            if not CLIENT.connect():
                return
            me = CLIENT.get("/lol-summoner/v1/current-summoner") or {}
            puuid = me.get("puuid")
            if not puuid:
                return
            with self.lock:
                if puuid != self.puuid:
                    self._load(puuid)
            self.summoner = {"name": me.get("gameName") or me.get("displayName") or "", "tag": me.get("tagLine") or "",
                             "icon": me.get("profileIconId"), "level": me.get("summonerLevel")}
            pages = [(0, 49), (50, 99)] if self.matches else [(0, 49), (50, 99), (100, 149), (150, 199)]
            for b, e in pages:
                try:
                    d = CLIENT.get(f"/lol-match-history/v1/products/lol/current-summoner/matches?begIndex={b}&endIndex={e}")
                except Exception:
                    break
                games = ((d or {}).get("games") or {}).get("games") or []
                new = 0
                with self.lock:
                    for g in games:
                        m = parse_game(g, puuid)
                        if m and str(m["id"]) not in self.matches:
                            self.matches[str(m["id"])] = m
                            new += 1
                if not games or (b > 0 and new == 0):
                    break
            with self.lock:
                disk_cache_put(f"history/{puuid}.json", {"matches": list(self.matches.values())})
            rk = _safe(lambda: CLIENT.get("/lol-ranked/v1/current-ranked-stats"), {}) or {}
            self.ranked = [{"queue": q.get("queueType"), "tier": q.get("tier"), "division": q.get("division"),
                            "lp": q.get("leaguePoints"), "wins": q.get("wins"), "losses": q.get("losses")}
                           for q in (rk.get("queues") or []) if q.get("queueType") in ("RANKED_SOLO_5x5", "RANKED_FLEX_SR")]
            ms = _safe(lambda: CLIENT.get("/lol-champion-mastery/v1/local-player/champion-mastery"), []) or []
            self.mastery = [{"c": str(m.get("championId")), "points": m.get("championPoints"), "level": m.get("championLevel")}
                            for m in sorted(ms, key=lambda m: -(m.get("championPoints") or 0))[:8]]
            self.last = time.time()
            log("Meccselőzmény frissítve:", len(self.matches), "meccs tárolva")
        except Exception as e:
            log("Meccselőzmény hiba:", e)
        finally:
            self.loading = False

    def season_start_ms(self):
        s = (CONFIG.get("season_start") or "").strip()
        try:
            t = time.strptime(s, "%Y-%m-%d")
        except Exception:
            t = time.strptime(time.strftime("%Y") + "-01-01", "%Y-%m-%d")
        return int(time.mktime(t) * 1000)

    def stats(self, queue="all"):
        if CLIENT.port and time.time() - self.last > 600 and not self.loading:
            threading.Thread(target=self.refresh, daemon=True).start()
        ss = self.season_start_ms()
        with self.lock:
            allm = [m for m in self.matches.values() if m["t"] >= ss and not m.get("remake")]
        allm.sort(key=lambda m: -m["t"])
        qs = STAT_QUEUES.get(queue)
        ms = [m for m in allm if qs is None or m["q"] in qs]

        def agg(lst):
            g = len(lst)
            w = sum(1 for m in lst if m["win"])
            k, d, a = (sum(m[x] for m in lst) for x in ("k", "d", "a"))
            return {"games": g, "wins": w, "losses": g - w, "wr": round(100 * w / g, 1) if g else 0,
                    "kda": round((k + a) / max(d, 1), 2) if g else 0,
                    "k": round(k / g, 1) if g else 0, "d": round(d / g, 1) if g else 0, "a": round(a / g, 1) if g else 0}

        per = {}
        for m in ms:
            per.setdefault(m["c"], []).append(m)
        champs = [dict(agg(v), c=c) for c, v in per.items()]
        champs.sort(key=lambda x: (-x["games"], -x["wr"]))
        fav_src = {}
        for m in allm:
            fav_src.setdefault(m["c"], []).append(m)
        favs = sorted((dict(agg(v), c=c) for c, v in fav_src.items()), key=lambda x: -x["games"])[:6]
        if len(favs) < 3:
            have = {f["c"] for f in favs}
            favs += [{"c": m["c"], "games": 0, "wr": 0, "mastery": m["points"]} for m in self.mastery if m["c"] not in have][:6 - len(favs)]
        recent = [dict(m, qn=tr(QUEUE_NAMES.get(m["q"], "Egyéb"))) for m in ms[:15]]
        streak = 0
        for m in ms:
            if not ms or m["win"] != ms[0]["win"]:
                break
            streak += 1
        return {"total": agg(ms), "champs": champs, "recent": recent, "favorites": favs, "ranked": self.ranked,
                "summoner": self.summoner, "stored": len(self.matches), "lastRefresh": self.last,
                "seasonStart": time.strftime("%Y.%m.%d", time.localtime(ss / 1000)), "loading": self.loading,
                "streak": {"n": streak, "win": bool(ms and ms[0]["win"])}, "connected": bool(CLIENT.port)}


HISTORY = History()


# ---------------------------------------------------------------- In game: a 10 játékos tapasztalata a hősével

EXP_TIERS = [(500, "divine"), (300, "mythic"), (100, "legendary"), (50, "master"), (20, "advanced"), (-1, "beginner")]
POINTS_PER_GAME = 900  # becslés: kb. ennyi mastery pont jár egy meccsre


def exp_tier(games):
    for limit, name in EXP_TIERS:
        if games > limit:
            return name
    return "beginner"


class LiveScout:
    """A töltőképernyőtől kezdve összegyűjti mind a 10 játékos adatait (háttérszálon, fokozatosan)."""

    def __init__(self):
        self.lock = threading.Lock()
        self.game_id = None
        self.players = []
        self.loading = False

    def snapshot(self):
        live = CLIENT.snapshot().get("livePos") or []
        with self.lock:
            players = [dict(p) for p in self.players]
        for p in players:  # hiányzó pozíció és Smite pótlása a játék élő adataiból
            lv = next((x for x in live if x["c"] == p["champ"] and x["ally"] == p["ally"]), None)
            if lv:
                p["smite"] = lv["smite"]
                if not p.get("pos") and lv.get("pos"):
                    p["pos"] = lv["pos"]
        return {"active": bool(self.game_id), "gameId": self.game_id, "loading": self.loading, "players": players}

    def on_phase(self, phase):
        if phase not in ("InProgress", "Reconnect"):
            return
        try:
            gs = CLIENT.get("/lol-gameflow/v1/session") or {}
        except Exception:
            return
        gd = gs.get("gameData") or {}
        gid = gd.get("gameId")
        if not gid or gid == self.game_id:
            return
        me = _safe(lambda: CLIENT.get("/lol-summoner/v1/current-summoner"), {}) or {}
        my_puuid = me.get("puuid")
        picks = {x.get("puuid"): x.get("championId") for x in gd.get("playerChampionSelections") or [] if x.get("puuid")}
        team1, team2 = gd.get("teamOne") or [], gd.get("teamTwo") or []
        mine_is_one = any(p.get("puuid") == my_puuid for p in team1)
        players = []
        for team, ally in ((team1, mine_is_one), (team2, not mine_is_one)):
            for p in team:
                puuid = p.get("puuid")
                cid = p.get("championId") or picks.get(puuid)
                if not puuid or not cid:
                    continue
                players.append({"puuid": puuid, "champ": str(cid), "ally": ally, "me": puuid == my_puuid,
                                "name": p.get("gameName") or p.get("summonerName") or p.get("riotIdGameName") or "",
                                "tag": p.get("tagLine") or p.get("riotIdTagLine") or "",
                                "pos": LCU_POSITION_TO_ROLE.get(str(p.get("selectedPosition") or p.get("assignedPosition") or "").lower()),
                                "done": False})
        with self.lock:
            self.game_id, self.players, self.loading = gid, players, True
        log("In game: adatgyűjtés", len(players), "játékosról")
        threading.Thread(target=self._fill, args=(gid,), daemon=True).start()

    def _fill(self, gid):
        ss = HISTORY.season_start_ms()
        for i in range(len(self.players)):
            if self.game_id != gid:
                return
            p = dict(self.players[i])
            try:
                self._one(p, ss)
            except Exception as e:
                p["error"] = str(e)
            p["done"] = True
            with self.lock:
                if self.game_id == gid and i < len(self.players):
                    self.players[i] = p
        with self.lock:
            self.loading = False

    def _one(self, p, ss):
        puuid, cid = p["puuid"], int(p["champ"])
        if not p["name"]:
            sm = _safe(lambda: CLIENT.get(f"/lol-summoner/v2/summoners/puuid/{puuid}"), {}) or {}
            p["name"], p["tag"] = sm.get("gameName") or sm.get("displayName") or "", sm.get("tagLine") or ""
        # mastery – több lehetséges végponton próbáljuk
        m = None
        for path in (f"/lol-champion-mastery/v1/{puuid}/champion-mastery",
                     f"/lol-champion-mastery/v1/{puuid}/champion-mastery/top?limit=200"):
            data = _safe(lambda: CLIENT.get(path))
            lst = data if isinstance(data, list) else (data or {}).get("masteries") if isinstance(data, dict) else None
            if lst:
                m = next((x for x in lst if int(x.get("championId") or 0) == cid), {"championPoints": 0, "championLevel": 0})
                break
        if m is not None:
            p["mastery"] = {"level": int(m.get("championLevel") or 0), "points": int(m.get("championPoints") or 0)}
        # meccselőzmény (a kliens a legutóbbi kb. 100-150 meccset adja ki)
        games, seen = [], 0
        for b, e in ((0, 49), (50, 99), (100, 149)):
            d = _safe(lambda: CLIENT.get(f"/lol-match-history/v1/products/lol/{puuid}/matches?begIndex={b}&endIndex={e}"))
            lst = ((d or {}).get("games") or {}).get("games") or []
            if not lst:
                break
            for g in lst:
                mm = parse_game(g, puuid)
                if mm:
                    seen += 1
                    if mm["c"] == str(cid) and not mm.get("remake"):
                        games.append(mm)
            if len(lst) < 40:
                break
        season = [g for g in games if g["t"] >= ss]
        w = sum(1 for g in games if g["win"])
        k, dd, a = (sum(g[x] for g in games) for x in ("k", "d", "a"))
        p["recent"] = {"games": len(games), "wins": w, "losses": len(games) - w,
                       "wr": round(100 * w / len(games), 1) if games else 0,
                       "kda": round((k + a) / max(dd, 1), 2) if games else 0, "seen": seen, "season": len(season)}
        est = round(p.get("mastery", {}).get("points", 0) / POINTS_PER_GAME)
        total = max(len(games), est)
        p["total"], p["estimated"] = total, est > len(games)
        p["tier"] = exp_tier(total)
        # rang (Solo/Duo)
        rk = _safe(lambda: CLIENT.get(f"/lol-ranked/v1/ranked-stats/{puuid}"), {}) or {}
        q = (rk.get("queueMap") or {}).get("RANKED_SOLO_5x5") or next((x for x in rk.get("queues") or [] if x.get("queueType") == "RANKED_SOLO_5x5"), None)
        if q and q.get("tier") and q.get("tier") not in ("NONE", ""):
            p["rank"] = {"tier": q.get("tier"), "division": q.get("division"), "lp": q.get("leaguePoints"),
                         "wins": q.get("wins"), "losses": q.get("losses")}


SCOUT = LiveScout()


# ---------------------------------------------------------------- Automatikus indítás (Windows)

STARTUP_DIR = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
STARTUP_LNK = os.path.join(STARTUP_DIR, "RiftMester.lnk")


def apply_autostart(mode):
    if os.name != "nt":
        return tr("Csak Windows alatt érhető el.")
    for old in ("RiftMester.lnk", "LoL Build Ablak.lnk"):
        _safe(lambda: os.remove(os.path.join(STARTUP_DIR, old)))
    if mode == "off":
        return "ok"
    exe = sys.executable
    pyw = os.path.join(os.path.dirname(exe), "pythonw.exe")
    if os.path.exists(pyw) and not FROZEN:
        exe = pyw
    flags = "--background" + (" --open-now" if mode == "windows" else "")
    args = flags if FROZEN else f'"{os.path.join(BASE_DIR, "server.py")}" ' + flags
    ps = ("$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:RM_LNK);$s.TargetPath=$env:RM_EXE;"
          "$s.Arguments=$env:RM_ARGS;$s.WorkingDirectory=$env:RM_DIR;$s.Description='RiftMester';$s.Save()")
    env = dict(os.environ, RM_LNK=STARTUP_LNK, RM_EXE=exe, RM_ARGS=args, RM_DIR=BASE_DIR)
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps], env=env, capture_output=True, timeout=20,
                       creationflags=0x08000000)
    except Exception as e:
        return f"{tr('Nem sikerült')}: {e}"
    return "ok" if os.path.exists(STARTUP_LNK) else tr("Nem sikerült létrehozni az indítási parancsikont.")


def get_settings():
    s = {k: CONFIG.get(k, DEFAULT_CONFIG.get(k)) for k in SETTINGS_KEYS}
    s["version"] = VERSION
    s["autostartActive"] = os.path.exists(STARTUP_LNK) if os.name == "nt" else False
    s["windows"] = os.name == "nt"
    return s


def set_settings(body):
    msg = "ok"
    bools = {"auto_runes", "rune_overwrite", "auto_itemset", "auto_collapse_in_game", "auto_spells"}
    choices = {"flash_key": {"D", "F"}, "autostart": {"off", "windows", "lol"}, "window_monitor": {"auto", "off"},
               "default_rank": set(UGG_RANKS), "update_mode": {"auto", "ask", "off"}}
    old_auto = CONFIG.get("autostart")
    for k, v in (body or {}).items():
        if k not in SETTINGS_KEYS:
            continue
        if k in bools:
            CONFIG[k] = bool(v)
        elif k in choices:
            if v in choices[k]:
                CONFIG[k] = v
        elif k == "season_start":
            v = str(v or "").strip()
            if v == "" or re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
                CONFIG[k] = v
        elif k == "update_url":
            v = str(v or "").strip()
            if v == "" or v.startswith("https://"):
                CONFIG[k] = v
        elif k == "ui_lang":
            if v in ("hu", "en") and v != CONFIG.get("ui_lang"):
                CONFIG["ui_lang"] = v
                CONFIG["language"] = "en_US" if v == "en" else "hu_HU"
                STATIC.reset()
        elif k == "language":
            if re.fullmatch(r"[a-z]{2}_[A-Z]{2}", str(v)):
                CONFIG[k] = v
    save_config()
    if CONFIG.get("autostart") != old_auto or (CONFIG.get("autostart") != "off" and not get_settings()["autostartActive"]):
        msg = apply_autostart(CONFIG.get("autostart", "off"))
    if body and ("update_url" in body or "update_mode" in body):
        threading.Thread(target=UPDATER.check, daemon=True).start()
    out = get_settings()
    out["message"] = msg
    return out


# ---------------------------------------------------------------- Önfrissítés

UPDATE_ALLOWED_EXT = {".py", ".pyd", ".js", ".css", ".html", ".txt", ".bat", ".vbs", ".md", ".svg", ".png", ".ico"}


def vtuple(v):
    try:
        return tuple(int(x) for x in str(v).split("."))
    except Exception:
        return (0,)


class Updater:
    def __init__(self):
        self.info = {"current": VERSION, "available": None, "notes": "", "justUpdated": None, "error": None}
        self.manifest = None
        self.lock = threading.Lock()
        prev = disk_cache_get("update_done.json")
        if prev and prev.get("version") == VERSION:
            self.info["justUpdated"] = {"version": VERSION, "notes": prev.get("notes", "")}
            _safe(lambda: os.remove(os.path.join(CACHE_DIR, "update_done.json")))

    def base_url(self):
        u = (CONFIG.get("update_url") or "").strip()
        if not u.startswith("https://"):
            return None
        return u if u.endswith("/") else u + "/"

    def check(self):
        base = self.base_url()
        if not base or CONFIG.get("update_mode", "auto") == "off":
            return False
        try:
            m = http_get_json(base + "version.json?t=" + str(int(time.time() // 300)))
            self.info["error"] = None
        except Exception as e:
            self.info["error"] = f"Frissítés-ellenőrzés sikertelen: {e}"
            return False
        if vtuple(m.get("version")) > vtuple(VERSION):
            self.manifest = m
            self.info["available"] = m.get("version")
            self.info["notes"] = m.get("notes", "")
            log("Új verzió elérhető:", m.get("version"))
            return True
        return False

    def apply(self):
        """Letölti, ellenőrzi (sha256), majd kicseréli a fájlokat és újraindítja a programot."""
        with self.lock:
            m, base = self.manifest, self.base_url()
            if not m or not base:
                return {"ok": False, "error": tr("Nincs elérhető frissítés.")}
            staged = {}
            try:
                for rel, sha in (m.get("files") or {}).items():
                    rel_n = rel.replace("\\", "/")
                    if (rel_n.startswith("/") or ".." in rel_n.split("/") or rel_n == "config.json"
                            or os.path.splitext(rel_n)[1].lower() not in UPDATE_ALLOWED_EXT):
                        raise AppError(f"Tiltott fájl a frissítésben: {rel}")
                    data = http_get_bytes(base + urllib.parse.quote(rel_n))
                    if hashlib.sha256(data).hexdigest() != str(sha).lower():
                        raise AppError(f"Sérült letöltés (ellenőrzőösszeg nem egyezik): {rel}")
                    staged[rel_n] = data
                if "server.py" in staged:
                    compile(staged["server.py"].decode("utf-8"), "server.py", "exec")  # szintaxis-ellenőrzés
            except Exception as e:
                self.info["error"] = f"Frissítés sikertelen: {e}"
                log(self.info["error"])
                return {"ok": False, "error": str(e)}
            backup = os.path.join(CACHE_DIR, "backup_" + VERSION)
            for rel, data in staged.items():
                dst = os.path.join(BASE_DIR, *rel.split("/"))
                if os.path.exists(dst):
                    b = os.path.join(backup, *rel.split("/"))
                    os.makedirs(os.path.dirname(b), exist_ok=True)
                    shutil.copy2(dst, b)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst + ".new", "wb") as f:
                    f.write(data)
                os.replace(dst + ".new", dst)
            disk_cache_put("update_done.json", {"version": m.get("version"), "notes": m.get("notes", "")})
            log("Frissítve:", m.get("version"), "- újraindulás")
            threading.Thread(target=restart_self, daemon=True).start()
            return {"ok": True}

    def loop(self):
        time.sleep(3)
        while True:
            if self.check() and CONFIG.get("update_mode", "auto") == "auto":
                self.apply()
            time.sleep(6 * 3600)


UPDATER = Updater()


def restart_self():
    """
    Újraindítás frissítés után. Windowson az új példányt teljesen leválasztjuk (konzol nélküli pythonw,
    külön folyamatcsoport), különben a bezáródó INDITAS.bat konzolablak az új példányt is leállítaná.
    """
    # FONTOS sorrend: előbb elindítjuk az új példányt (az legfeljebb 2 percig vár, hogy felszabaduljon a port),
    # és csak utána lépünk ki. Korábban előbb leállt a szerver, a főszál kilépett, és ezzel ezt a szálat is
    # megölte, mielőtt az új példányt elindíthatta volna – ezért nem indult újra a program.
    global RESTARTING
    RESTARTING = True
    time.sleep(1.0)  # a böngésző még megkapja a választ
    args = [a for a in sys.argv[1:] if a != "--restarted"] + ["--restarted"]
    exe, kw = sys.executable, {}
    if os.name == "nt" and not FROZEN:
        pyw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
        if os.path.exists(pyw):
            exe = pyw
    if os.name == "nt":
        DETACHED_PROCESS, NEW_GROUP, NO_WINDOW = 0x00000008, 0x00000200, 0x08000000
        kw["creationflags"] = DETACHED_PROCESS | NEW_GROUP | NO_WINDOW
        kw["close_fds"] = True
    try:
        cmd = [exe] + args if FROZEN else [exe, os.path.join(BASE_DIR, "server.py")] + args
        if FROZEN:  # a PyInstaller-es .exe új, önálló példányként induljon (ne a kilépő régi ideiglenes mappáját használja)
            kw["env"] = dict(os.environ, PYINSTALLER_RESET_ENVIRONMENT="1")
        subprocess.Popen(cmd, cwd=BASE_DIR,
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kw)
        log("Új példány elindítva:", exe)
    except Exception as e:
        log("Újraindítás sikertelen:", e)
    _safe(lambda: HTTPD.server_close())
    os._exit(0)


# ---------------------------------------------------------------- Helyi webszerver a felületnek

MIME = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
        ".ico": "image/x-icon", ".json": "application/json"}
LAST_PING = 0.0
HTTPD = None
RESTARTING = False


class RMServer(ThreadingHTTPServer):
    """
    Windowson nem kérünk SO_REUSEADDR-t (az két példányt is engedne ugyanazon a porton),
    de kizárólagos foglalást sem: az újraindításkor a régi, lezárt kapcsolatok miatt percekig
    nem engedné újra lefoglalni a portot (ez okozta, hogy frissítés után nem indult újra).
    """
    allow_reuse_address = os.name != "nt"
    daemon_threads = True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if CONFIG.get("debug"):
            log("http", fmt % args)

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _err(self, e):
        detail = getattr(e, "detail", "") or ""
        if not isinstance(e, AppError):
            detail = (detail + "\n" + traceback.format_exc()).strip()
        log("HIBA:", e, detail[:500])
        return self._json({"error": str(e), "detail": detail[-2000:], "version": VERSION,
                           "patch": STATIC.version, "path": self.path}, 500)

    def do_GET(self):
        global LAST_PING
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if u.path == "/api/state":
                LAST_PING = time.time()
                s = CLIENT.snapshot()
                s["app"] = {"version": VERSION, "name": APP_NAME, "update": UPDATER.info,
                            "autoCollapse": bool(CONFIG.get("auto_collapse_in_game", True)),
                            "flashKey": CONFIG.get("flash_key", "D")}
                s["autoImport"] = AUTO.status
                return self._json(s)
            if u.path == "/api/static":
                return self._json(STATIC.ensure())
            if u.path == "/api/champion":
                return self._json(STATIC.champion_detail(q["id"]))
            if u.path == "/api/build":
                return self._json(get_build(q["champ"], q.get("role", "auto"),
                                            q.get("rank", CONFIG["default_rank"]), q.get("mode", "solo")))
            if u.path == "/api/raw":
                return self._json(UGG.raw(q["champ"], q.get("mode", "solo"))[2])
            if u.path == "/api/config":
                return self._json({"default_rank": CONFIG["default_rank"]})
            if u.path == "/api/settings":
                return self._json(get_settings())
            if u.path == "/api/img":
                return self._img(q.get("u", ""))
            if u.path == "/api/ingame":
                return self._json(SCOUT.snapshot())
            if u.path == "/api/champselect":
                return self._json(CLIENT.champselect())
            if u.path == "/api/counters":
                return self._json(get_counters(q["champ"], q.get("mode", "solo"), q.get("role", "auto")))
            if u.path == "/api/stats":
                return self._json(HISTORY.stats(q.get("queue", "all")))
            return self._static(u.path)
        except Exception as e:
            return self._err(e)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        try:
            n = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            if u.path == "/api/import-runes":
                return self._json(CLIENT.import_runes(body.get("name", "Build"), int(body["primary"]),
                                                      int(body["sub"]), [int(x) for x in body["perks"]],
                                                      bool(body.get("overwrite"))))
            if u.path == "/api/settings":
                return self._json(set_settings(body))
            if u.path == "/api/cs-action":
                return self._json(CLIENT.champselect_action(body["champ"], bool(body.get("lock"))))
            if u.path == "/api/set-spells":
                return self._json(CLIENT.set_spells(body.get("ids") or []))
            if u.path == "/api/cs-bench":
                return self._json(CLIENT.bench_swap(body["champ"]))
            if u.path == "/api/import-itemset":
                bld = get_build(str(body["champ"]), body.get("role", "auto"), body.get("rank", CONFIG["default_rank"]),
                                body.get("mode", "solo"))
                name = STATIC.bundle["champions"].get(str(body["champ"]), {}).get("name", "Build")
                res = import_itemset(str(body["champ"]), name, bld)
                return self._json({"ok": res == "ok", "error": None if res == "ok" else res})
            if u.path == "/api/history-refresh":
                threading.Thread(target=HISTORY.refresh, daemon=True).start()
                return self._json({"ok": True})
            if u.path == "/api/update":
                if not UPDATER.manifest:
                    UPDATER.check()
                return self._json(UPDATER.apply())
            return self._json({"error": "ismeretlen"}, 404)
        except Exception as e:
            return self._err(e)

    def _img(self, url):
        """Helyi képproxy: a hősképeket egyszer tölti le, utána a gépről adja (gyorsabb, és a felület
        ki tudja olvasni belőle a hős színeit)."""
        pu = urllib.parse.urlparse(url)
        if pu.scheme != "https" or pu.hostname not in ("ddragon.leagueoflegends.com", "raw.communitydragon.org"):
            self.send_error(400)
            return
        ext = os.path.splitext(pu.path)[1].lower() or ".img"
        name = hashlib.sha1(url.encode()).hexdigest() + ext
        path = os.path.join(CACHE_DIR, "img", name)
        data = None
        if os.path.exists(path):
            with open(path, "rb") as f:
                data = f.read()
        else:
            try:
                data = http_get_bytes(url, timeout=15)
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path + ".tmp", "wb") as f:
                    f.write(data)
                os.replace(path + ".tmp", path)
            except Exception:
                self.send_error(404)
                return
        ctype = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=604800")
        self.end_headers()
        self.wfile.write(data)

    def _static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        full = os.path.normpath(os.path.join(WEB_DIR, path.lstrip("/")))
        if not full.startswith(WEB_DIR) or not os.path.isfile(full):
            self.send_error(404)
            return
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(os.path.splitext(full)[1], "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


# ---------------------------------------------------------------- Ablak megnyitása (második monitor)

def detect_second_monitor():
    """Visszaadja a nem elsődleges monitor munkaterületét (x, y, szél, mag) vagy None-t."""
    if os.name != "nt":
        return None
    try:
        ps = ("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | "
              "ForEach-Object { '{0};{1};{2};{3};{4}' -f $_.Primary,$_.WorkingArea.X,$_.WorkingArea.Y,"
              "$_.WorkingArea.Width,$_.WorkingArea.Height }")
        out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True,
                             timeout=10, creationflags=0x08000000).stdout
        screens = []
        for line in out.strip().splitlines():
            p = line.strip().split(";")
            if len(p) == 5:
                screens.append((p[0].lower() == "true", int(p[1]), int(p[2]), int(p[3]), int(p[4])))
        others = [s for s in screens if not s[0]]
        if others:
            s = others[0]
            return s[1], s[2], s[3], s[4]
    except Exception as e:
        log("Monitor felismerés nem sikerült:", e)
    return None


def open_window(url):
    w, h = int(CONFIG["window_width"]), int(CONFIG["window_height"])
    pos = None
    if CONFIG.get("window_x") is not None and CONFIG.get("window_y") is not None:
        pos = (int(CONFIG["window_x"]), int(CONFIG["window_y"]))
    elif CONFIG.get("window_monitor", "auto") == "auto":
        mon = detect_second_monitor()
        if mon:
            x, y, mw, mh = mon
            h = min(h, mh)
            pos = (x + mw - w, y)
            log(f"Második monitor: ablak ide: {pos}")
    if os.name == "nt":
        exes = [
            os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        ]
        for exe in exes:
            if os.path.exists(exe):
                profile = os.path.join(CACHE_DIR, "ablak-profil")
                args = [exe, f"--app={url}", f"--window-size={w},{h}", f"--user-data-dir={profile}",
                        "--no-first-run", "--no-default-browser-check", "--disable-extensions",
                        "--disable-background-networking", "--disable-sync", "--disable-features=Translate"]
                if pos:
                    args.append(f"--window-position={pos[0]},{pos[1]}")
                subprocess.Popen(args)
                return
    import webbrowser
    webbrowser.open(url)


def window_open_recently(sec=8):
    return LAST_PING and time.time() - LAST_PING < sec


def window_manager(url):
    """
    Kézi indítás: az ablak azonnal megnyílik; ha bezárod, a program kilép.
    Háttér mód (Windows indulásakor): akkor nyitja meg az ablakot, amikor elindítod a LoL klienst.
    """
    opened_for_session = False
    started = time.time()
    while True:
        time.sleep(3)
        st = CLIENT.snapshot()
        if BACKGROUND:
            if st["connected"] and not opened_for_session:
                opened_for_session = True
                if not window_open_recently() and CONFIG.get("open_window", True):
                    log("LoL kliens elindult - ablak megnyitása")
                    open_window(url)
            if not st["connected"]:
                opened_for_session = False
        else:
            if RESTARTED and not LAST_PING and time.time() - started > 20:
                open_window(url)  # frissítés után nem jött vissza az ablak
                started = time.time() + 10**9
            if LAST_PING and time.time() - LAST_PING > 40:
                log("Az ablak bezárult, kilépés.")
                os._exit(0)


def take_over_old_instance(port):
    """Ha a porton egy régi verzió (pl. "LoL Build Ablak") vagy régebbi RiftMester fut, leállítjuk."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/state", timeout=3) as r:
            app = (json.loads(r.read().decode("utf-8")) or {}).get("app") or {}
    except Exception:
        app = {}
    if app.get("name") == APP_NAME and vtuple(app.get("version")) >= vtuple(VERSION):
        return False  # ugyanez vagy újabb fut már - nem bántjuk
    if os.name != "nt":
        return False
    log("Régi verzió fut a háttérben (", app.get("name") or "LoL Build Ablak", app.get("version") or "", ") - leállítom.")
    try:
        out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True, timeout=10,
                             creationflags=0x08000000).stdout
        pids = {line.split()[-1] for line in out.splitlines()
                if f"127.0.0.1:{port} " in line and "LISTEN" in line.upper()}
        for pid in pids:
            if pid.isdigit() and int(pid) != os.getpid():
                subprocess.run(["taskkill", "/f", "/pid", pid], capture_output=True, timeout=10, creationflags=0x08000000)
        return bool(pids)
    except Exception as e:
        log("Nem sikerült leállítani a régi verziót:", e)
        return False


def cleanup_old_autostart():
    if os.name == "nt":
        old = os.path.join(STARTUP_DIR, "LoL Build Ablak.lnk")
        if os.path.exists(old):
            _safe(lambda: os.remove(old))
            log("A régi (LoL Build Ablak) automatikus indítás eltávolítva.")


def cleanup_old_cores():
    """A lefordított mag minden verzióban más nevű fájl (rmcore_x_y_z.pyd), mert a futó fájlt Windows
    nem engedi felülírni. Induláskor a régi, már nem használt magokat töröljük."""
    cur = __name__ if __name__.startswith("rmcore_") else None
    try:
        for fn in os.listdir(BASE_DIR):
            if fn.startswith("rmcore_") and fn.endswith(".pyd") and not (cur and fn.startswith(cur + ".")):
                _safe(lambda: os.remove(os.path.join(BASE_DIR, fn)))
    except Exception:
        pass


def main():
    global HTTPD
    cleanup_old_cores()
    port = int(CONFIG["port"])
    url = f"http://127.0.0.1:{port}/"
    show = CONFIG.get("open_window", True) and "--no-window" not in ARGS
    httpd = None
    cleanup_old_autostart()
    tries = 120 if RESTARTED else 1  # frissítés után akár 2 percig is próbálkozunk
    try:
        httpd = RMServer(("127.0.0.1", port), Handler)
    except OSError:
        if not RESTARTED and take_over_old_instance(port):
            tries = 10
    for attempt in range(0 if httpd else tries):
        try:
            httpd = RMServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            time.sleep(1)
    if httpd is None:
        log("Már fut egy példány.")
        if show and not BACKGROUND:
            open_window(url)
        return
    HTTPD = httpd
    threading.Thread(target=CLIENT.loop, daemon=True).start()
    threading.Thread(target=lambda: _safe(STATIC.ensure), daemon=True).start()
    threading.Thread(target=UPDATER.loop, daemon=True).start()
    log(f"{APP_NAME} {VERSION} fut: {url}" + (" (háttér mód: a LoL indulásakor nyílik az ablak)" if BACKGROUND else ""))
    if show and not RESTARTED and (not BACKGROUND or OPEN_NOW):
        open_window(url)
    if show or BACKGROUND:
        threading.Thread(target=window_manager, args=(url,), daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    while RESTARTING:  # ha épp újraindulunk, a főszál megvárja, amíg az újraindító szál végez
        time.sleep(0.5)


if __name__ == "__main__":
    main()
