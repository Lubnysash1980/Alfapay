// gitcybrahash_adaptive.mjs
// © 2026 <Твоє Ім'я>
// GitHub Integrated Version з Автоадаптацією для пристрою та інтеграцією з додатками, працює без Termux

import crypto from "crypto";
import fs from "fs/promises";

const HASH_FOLDER = "hash_storage";
const HASH_GROUP_SIZE = 100;
const OWNER_ID = "OWNER_ONLY";
let BATCH_SIZE = 10;
let PARALLEL_LIMIT = 5;
const MAX_HASH_MEMORY = 202;

async function doubleHashWorkerAsync(infoDict) {
  const raw = JSON.stringify(infoDict, Object.keys(infoDict).sort());
  const first = crypto.createHash("sha256").update(raw).digest();
  const h = crypto.createHash("sha256").update(first).digest("hex");
  return [h, infoDict];
}

class HashIndex {
  constructor() {
    this.menuIndex = new Map();
  }

  add(level, h, meta) {
    const timestamp = Date.now() / 1000;
    if (this.menuIndex.size >= MAX_HASH_MEMORY) {
      const oldestKey = this.menuIndex.keys().next().value;
      this.menuIndex.delete(oldestKey);
    }
    this.menuIndex.set(h, { level, timestamp, meta });
  }

  sweep(ttlSeconds) {
    const now = Date.now() / 1000;
    for (const [h, entry] of Array.from(this.menuIndex.entries())) {
      if (now - entry.timestamp > ttlSeconds) this.menuIndex.delete(h);
    }
  }

  entries() {
    return Object.fromEntries(this.menuIndex);
  }
}

class RootHashAggregator {
  constructor(index) {
    this.index = index;
  }

  build() {
    const obj = this.index.entries();
    const first = crypto.createHash("sha256").update(JSON.stringify(obj, Object.keys(obj).sort())).digest();
    return crypto.createHash("sha256").update(first).digest("hex");
  }

  export() {
    return {
      menu: this.index.entries(),
      root_hash: this.build()
    };
  }
}

class AutoMemoryCollector {
  constructor(ownerId = OWNER_ID) {
    this.levels = { 0: {} };
    this.index = new HashIndex();
    this.aggregator = new RootHashAggregator(this.index);
    this.ownerId = ownerId;
    this._ready = fs.mkdir(HASH_FOLDER, { recursive: true }).catch(err => {
      throw new Error(`Failed to initialize hash storage: ${err.message}`);
    });
  }

  _collapseLevel(level) {
    const stack = [level];
    while (stack.length) {
      const lvl = stack.pop();
      const items = Object.entries(this.levels[lvl]);
      if (!items.length) continue;

      const first = crypto.createHash("sha256").update(JSON.stringify(items)).digest();
      const collapsedHash = crypto.createHash("sha256").update(first).digest("hex");

      this.levels[lvl] = {};
      const next = lvl + 1;
      this.levels[next] ??= {};

      const meta = { count: items.length };
      this.levels[next][collapsedHash] = meta;
      this.index.add(next, collapsedHash, meta);

      if (Object.keys(this.levels[next]).length >= HASH_GROUP_SIZE) stack.push(next);
    }
  }

  adjustParallelLimits(deviceState) {
    if (deviceState.cpu > 80) {
      PARALLEL_LIMIT = Math.max(1, PARALLEL_LIMIT - 1);
      BATCH_SIZE = Math.max(1, BATCH_SIZE - 5);
    } else if (deviceState.cpu < 50) {
      PARALLEL_LIMIT = Math.min(10, PARALLEL_LIMIT + 1);
      BATCH_SIZE = Math.min(20, BATCH_SIZE + 5);
    }
  }

  async collectBatch(infoList, deviceState = { cpu: 50 }, ttl = 60) {
    await this._ready;
    this.adjustParallelLimits(deviceState);
    this.index.sweep(ttl);

    for (let i = 0; i < infoList.length; i += PARALLEL_LIMIT) {
      const slice = infoList.slice(i, i + PARALLEL_LIMIT);
      const results = await Promise.all(slice.map(info => doubleHashWorkerAsync(info)));

      for (const [h, meta] of results) {
        this.levels[0][h] = meta;
        this.index.add(0, h, { type: "data" });
        if (Object.keys(this.levels[0]).length >= HASH_GROUP_SIZE) this._collapseLevel(0);
      }
    }

    return this.aggregator.build();
  }

  exportRoot() {
    return this.aggregator.export();
  }

  async integrateWithDevice(deviceInterface) {
    await this._ready;
    if (!deviceInterface.isConnected()) throw new Error("Device not connected");

    const data = this.exportRoot();
    deviceInterface.syncHashes(data);
    deviceInterface.notifyApps(data);
  }

  async autoSyncWithDevice(deviceInterface, intervalMs = 10000) {
    await this._ready;
    const loop = async () => {
      try {
        if (deviceInterface.isConnected()) {
          const data = this.exportRoot();
          deviceInterface.syncHashes(data);
          deviceInterface.notifyApps(data);
        }
      } catch (err) {
        console.error("Auto-sync error:", err);
      } finally {
        setTimeout(loop, intervalMs);
      }
    };
    loop();
  }
}

