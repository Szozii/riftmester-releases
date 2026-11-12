# -*- coding: utf-8 -*-
# RiftMester – (c) Szozii. Minden jog fenntartva. All rights reserved.
# A program lefordított magja: rmcore_3_27_2.cp312-win_amd64.pyd
VERSION = "3.27.2"
CORE = "rmcore_3_27_2"

if __name__ == "__main__":
    import importlib, os, sys, glob, re
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)

    def _load(name):
        return importlib.import_module(name)

    core = None
    try:
        core = _load(CORE)
    except Exception:
        # A saját mag nem tölthető be – próbáljunk bármely más meglévő magot (a legújabbat).
        def _ver(fn):
            m = re.search(r"rmcore_(\d+)_(\d+)_(\d+)", os.path.basename(fn))
            return tuple(int(x) for x in m.groups()) if m else (0, 0, 0)
        others = sorted({re.match(r"(rmcore_\d+_\d+_\d+)", os.path.basename(f)).group(1)
                          for f in glob.glob(os.path.join(here, "rmcore_*.pyd"))},
                         key=lambda n: _ver(n), reverse=True)
        for name in others:
            if name == CORE:
                continue
            try:
                core = _load(name)
                break
            except Exception:
                continue
    if core is None:
        # Nincs betölthető mag – a launcher (exe) ebből tudja, hogy vissza kell állnia a beépített változatra.
        raise RuntimeError("Nem tölthető be a RiftMester magja.")
    core.main()
