# -*- coding: utf-8 -*-
# RiftMester – (c) Szozii. Minden jog fenntartva. All rights reserved.
# A program lefordított magja: rmcore_3_9_1.cp312-win_amd64.pyd
VERSION = "3.9.1"
CORE = "rmcore_3_9_1"

if __name__ == "__main__":
    import importlib, os, sys, webbrowser
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        core = importlib.import_module(CORE)
    except ImportError:
        webbrowser.open("https://github.com/Szozii/riftmester-releases/releases/latest/download/RiftMester-Setup.exe")
        raise SystemExit("A RiftMester ezen verziójához a telepítős (.exe) változat kell.")
    core.main()
