"""
Copyright © 2026 <Твоє Ім'я>
All rights reserved.
Author: <Твоє Ім'я>
"""

# =====================================================
# Auto Memory Collector with Hierarchical Hash Storage
# Modular design without hard dependency on cybra_parliament
# Includes MenuBar for console operations and logging
# =====================================================

import hashlib
import json
import os
import time
import threading
from collections import OrderedDict

# Attempt to import ParliamentModule; fallback if module not found
try:
    from cybra_parliament import ParliamentModule
    PARLIAMENT_AVAILABLE = True
except ModuleNotFoundError:
    print("[WARN] cybra_parliament module not found. Parliament features disabled.")
    PARLIAMENT_AVAILABLE = False

HASH_FOLDER = "hash_storage"
HASH_GROUP_SIZE = 100
AUTO_COLLECT_INTERVAL = 5
PATCH_INTERVAL = 10
RAM_HASH_ACCELERATOR = 4
VIDEO_RAM_ACCELERATOR = 2
CPU_HASH_ACCELERATOR = 3

class AutoMemoryCollector:
    def __init__(self, auto_collect=False, auto_patch=False, integrate_system=False, parliament=None):
        os.makedirs(HASH_FOLDER, exist_ok=True)
        self.levels = {}
        self.auto_collect = auto_collect
        self.auto_patch = auto_patch
        self.integrate_system = integrate_system
        self.parliament = parliament if PARLIAMENT_AVAILABLE else None
        print("[LOG] Initializing AutoMemoryCollector")

        if self.auto_collect:
            self._start_auto_collector()
        if self.auto_patch:
            self._start_auto_patch()
        if self.integrate_system:
            self._start_auto_integration()

    def _hash_info(self, info_dict):
        raw = json.dumps(info_dict, sort_keys=True)
        h = hashlib.sha256(raw.encode()).hexdigest()
        for _ in range(RAM_HASH_ACCELERATOR - 1):
            h = hashlib.sha256(h.encode()).hexdigest()
        for _ in range(VIDEO_RAM_ACCELERATOR):
            h = hashlib.sha256(h.encode()).hexdigest()
        for _ in range(CPU_HASH_ACCELERATOR):
            h = hashlib.sha256(h.encode()).hexdigest()
        print(f"[DEBUG] Hashed info to: {h}")
        return h

    def _save_level(self, level):
        if level not in self.levels:
            return
        path = os.path.join(HASH_FOLDER, f"level_{level}.json")
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(list(self.levels[level].items()), f)
        print(f"[DEBUG] Saved level {level} with {len(self.levels[level])} entries")

    def _collapse_level(self, level):
        items = list(self.levels[level].items())
        combined = json.dumps(items, sort_keys=True)
        collapsed_hash = hashlib.sha256(combined.encode()).hexdigest()
        print(f"[DEBUG] Collapsing level {level} into hash: {collapsed_hash}")

        self.levels[level] = OrderedDict()
        self._save_level(level)

        next_level = level + 1
        if next_level not in self.levels:
            self.levels[next_level] = OrderedDict()
        self.levels[next_level][collapsed_hash] = {'count': len(items), 'timestamp': time.time()}

        if len(self.levels[next_level]) >= HASH_GROUP_SIZE:
            self._collapse_level(next_level)
        self._save_level(next_level)

    def collect(self, info_dict):
        if not isinstance(info_dict, dict):
            raise TypeError("info_dict must be a dictionary")

        h = self._hash_info(info_dict)

        if 0 not in self.levels:
            self.levels[0] = OrderedDict()

        self.levels[0][h] = info_dict

        if self.parliament:
            decision = self.parliament.evaluate(h)
            print(f"[DEBUG] Parliament decision for hash {h}: {decision}")

        if len(self.levels[0]) >= HASH_GROUP_SIZE:
            self._collapse_level(0)
        self._save_level(0)
        print(f"[DEBUG] Collected info with hash: {h}")
        return h

    def retrieve(self, h):
        for level_data in self.levels.values():
            if h in level_data:
                print(f"[DEBUG] Retrieved info for hash: {h}")
                return level_data[h]
        print(f"[DEBUG] Hash not found: {h}")
        return None

    def _auto_collect_loop(self):
        while self.auto_collect:
            info = {
                'frame_id': int(time.time()),
                'scene': 'auto_generated',
                'timestamp': time.time(),
                'metadata': {'color':'auto','position':[0,0,0]}
            }
            print(f"[DEBUG] Auto collecting info: {info}")
            self.collect(info)
            time.sleep(AUTO_COLLECT_INTERVAL)

    def _auto_patch_loop(self):
        while self.auto_patch:
            for level_data in self.levels.values():
                for h, data in list(level_data.items()):
                    if 'metadata' not in data:
                        data['metadata'] = {'color':'patched','position':[0,0,0]}
                        level_data[h] = data
                        print(f"[DEBUG] Patched info hash: {h}")
            time.sleep(PATCH_INTERVAL)

    def _auto_integration_loop(self):
        while self.integrate_system:
            print("[DEBUG] Integration loop active")
            time.sleep(AUTO_COLLECT_INTERVAL)

    def _start_auto_collector(self):
        threading.Thread(target=self._auto_collect_loop, daemon=True).start()
        print("[DEBUG] Started auto collector thread")

    def _start_auto_patch(self):
        threading.Thread(target=self._auto_patch_loop, daemon=True).start()
        print("[DEBUG] Started auto patch thread")

    def _start_auto_integration(self):
        threading.Thread(target=self._auto_integration_loop, daemon=True).start()
        print("[DEBUG] Started auto integration thread")

class MenuBarInterface:
    def __init__(self, collector):
        self.collector = collector

    def show_menu(self):
        print("\n=== AutoMemoryCollector Menu ===")
        print("1. Collect new info")
        print("2. Retrieve info by hash")
        print("3. Exit")

    def run(self):
        while True:
            self.show_menu()
            choice = input("Select option: ").strip()
            if choice == '1':
                info_input = input("Enter info as JSON: ")
                try:
                    info_dict = json.loads(info_input)
                    h = self.collector.collect(info_dict)
                    print(f"[DEBUG] Collected info with hash: {h}")
                except json.JSONDecodeError:
                    print("[DEBUG] Invalid JSON input.")
            elif choice == '2':
                h = input("Enter hash to retrieve: ").strip()
                self.collector.retrieve(h)
            elif choice == '3':
                print("[DEBUG] Exiting menu.")
                break
            else:
                print("[DEBUG] Invalid option selected")

if __name__ == "__main__":
    parliament = None
    if PARLIAMENT_AVAILABLE:
        parliament = ParliamentModule(author="Твоє Ім'я")
    collector = AutoMemoryCollector(auto_collect=True, auto_patch=True, integrate_system=True, parliament=parliament)
    menu = MenuBarInterface(collector)
    menu.run()

