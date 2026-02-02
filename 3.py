# =====================================================
# CYBRA-PARLIAMENT RELEASE - Termux ready
# =====================================================

import hashlib
import multiprocessing
import time
import os
import json
from collections import OrderedDict

# -------------------------- Configuration --------------------------
AUTHOR_SECRET = os.getenv("AUTHOR_SECRET", "default_test_secret")
ROOT_HASH = hashlib.sha256(AUTHOR_SECRET.encode()).hexdigest()
AI_DIRECTOR_THRESHOLD = float(os.getenv("AI_DIRECTOR_THRESHOLD", "0.95"))
LICENSE_STORAGE_FILE = "licenses.json"
USE_MULTIPROCESSING = os.getenv("USE_MULTIPROCESSING", "1") == "1"
MAX_HASHMEMORY_ENTRIES = int(os.getenv("MAX_HASHMEMORY_ENTRIES", "1000"))
HASHMEMORY_STORAGE_FILE = "hashmemory.json"

# -------------------------- Utility Functions --------------------------

def check_author(root_hash):
    if not isinstance(root_hash, str):
        raise TypeError("root_hash must be a string")
    if root_hash != ROOT_HASH:
        raise PermissionError("Unauthorized: ROOT_HASH mismatch")
    return True

# -------------------------- Classes --------------------------

class HashMemory:
    def __init__(self, use_persistence=True):
        self.memory_map = OrderedDict()
        self.use_persistence = use_persistence
        if self.use_persistence:
            self._load()

    def store(self, data):
        raw = str(sorted(data.items()))
        h = hashlib.sha256(raw.encode()).hexdigest()
        if len(self.memory_map) >= MAX_HASHMEMORY_ENTRIES:
            self.memory_map.popitem(last=False)
        self.memory_map[h] = data
        if self.use_persistence:
            self._save()
        return h

    def retrieve(self, h):
        data = self.memory_map.get(h)
        if data:
            self.memory_map.move_to_end(h)
        return data

    def _load(self):
        try:
            if os.path.exists(HASHMEMORY_STORAGE_FILE):
                with open(HASHMEMORY_STORAGE_FILE, "r") as f:
                    items = json.load(f)
                    self.memory_map = OrderedDict(items)
        except (json.JSONDecodeError, IOError):
            self.memory_map = OrderedDict()

    def _save(self):
        try:
            with open(HASHMEMORY_STORAGE_FILE, "w") as f:
                json.dump(list(self.memory_map.items()), f)
        except IOError:
            pass


class ShootingModel3D:
    def __init__(self, model_signature):
        self.signature = model_signature

    def similarity(self, frame_data, weights=None):
        score = 0
        total_weight = 0
        if weights is None:
            weights = {k:1 for k in self.signature}
        for key in self.signature:
            weight = weights.get(key,1)
            if frame_data.get(key) == self.signature[key]:
                score += weight
            total_weight += weight
        return score / total_weight if total_weight > 0 else 0


def ai_director_control(frame_data, model_3d):
    match_score = model_3d.similarity(frame_data)
    status = "STOP_FRAME" if match_score < AI_DIRECTOR_THRESHOLD else "ACCEPT"
    return {"status": status, "match": match_score, "timestamp": frame_data.get("timestamp")}


class CybraParliament:
    def __init__(self):
        self.decision_log = []

    def debate(self, frame_result):
        frame_result["parliament_decision"] = "HOLD" if frame_result["status"] == "STOP_FRAME" else "PROCEED"
        frame_result["hash_segment"] = hashlib.sha256(str(sorted(frame_result.items())).encode()).hexdigest()
        self.decision_log.append(frame_result)
        return frame_result


class LicenseManager:
    def __init__(self):
        self.active_licenses = {}
        self._load()

    def _load(self):
        try:
            if os.path.exists(LICENSE_STORAGE_FILE):
                with open(LICENSE_STORAGE_FILE, "r") as f:
                    self.active_licenses = json.load(f)
        except (json.JSONDecodeError, IOError):
            self.active_licenses = {}

    def _save(self):
        try:
            with open(LICENSE_STORAGE_FILE, "w") as f:
                json.dump(self.active_licenses, f)
        except IOError:
            pass

    def issue_license(self, buyer_id, duration_sec):
        now = time.time()
        raw = f"{buyer_id}-{now}-{duration_sec}"
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        self.active_licenses[token_hash] = {"buyer_id": buyer_id, "expiry": now + duration_sec}
        self._save()
        return token_hash

    def verify_license(self, token_hash):
        meta = self.active_licenses.get(token_hash)
        return meta is not None and time.time() <= meta.get("expiry", 0)

# -------------------------- Menu Bar --------------------------

def menu_bar():
    license_mgr = LicenseManager()
    parliament = CybraParliament()
    hash_mem = HashMemory()

    while True:
        print("\n=== CYBRA-PARLIAMENT MENU ===")
        print("1. Перевірити автора")
        print("2. Запустити AI Director на кадрі")
        print("3. Провести дебати парламенту")
        print("4. Створити ліцензію")
        print("5. Перевірити ліцензію")
        print("6. Вихід")
        choice = input("Оберіть дію: ").strip()

        if choice == "1":
            try:
                check_author(ROOT_HASH)
                print("Автор підтверджений")
            except PermissionError as e:
                print(str(e))
        elif choice == "2":
            frame = {"position": [0,0,0], "color": "red", "timestamp": time.time()}
            model = ShootingModel3D({"position": [0,0,0], "color": "red"})
            result = ai_director_control(frame, model)
            print("AI Director result:", result)
        elif choice == "3":
            frame_result = {"status": "ACCEPT", "timestamp": time.time()}
            decision = parliament.debate(frame_result)
            print("Parliament decision:", decision)
        elif choice == "4":
            buyer = input("Введіть ID покупця: ")
            try:
                duration = int(input("Тривалість ліцензії в секундах: "))
                token = license_mgr.issue_license(buyer, duration)
                print("Виданий токен:", token)
            except ValueError:
                print("Невірний формат тривалості.")
        elif choice == "5":
            token = input("Введіть токен: ")
            print("Ліцензія дійсна?", license_mgr.verify_license(token))
        elif choice == "6":
            print("Вихід із меню...")
            break
        else:
            print("Невірний вибір, спробуйте ще раз.")

# -------------------------- Main Execution --------------------------

if __name__ == "__main__":
    def main():
        print("Starting Cybra-Parliament Release")
        menu_bar()

    main()

