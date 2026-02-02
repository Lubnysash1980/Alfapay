import hashlib

class HashMemory:
    """Віртуальна пам'ять через hash-сегменти"""
    def __init__(self):
        self.memory_map = {}  # hash -> metadata

    def store(self, data: dict):
        raw = str(sorted(data.items()))
        h = hashlib.sha256(raw.encode()).hexdigest()
        self.memory_map[h] = None  # дані не зберігаються
        return h

    def retrieve(self, h: str):
        return self.memory_map.get(h, None)
