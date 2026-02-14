// gitcybrahash_double_backend.mjs
// © 2026 <Твоє Ім'я>
// GitHub Integrated Version with Async Improvements, Batched Processing, Memory Protection, Double Backend (Double SHA), In-line Comments, Debug Logging, and Explanations

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

const HASH_FOLDER = "hash_storage";
const HASH_GROUP_SIZE = 100;
const OWNER_ID = "OWNER_ONLY";
const BATCH_SIZE = 10;
const MAX_HASH_MEMORY = 202;

// Double SHA-256 hash worker for generic data
async function doubleHashWorkerAsync(infoDict) {
  const raw = JSON.stringify(infoDict, Object.keys(infoDict).sort());
  const first = crypto.createHash("sha256").update(raw).digest();
  const h = crypto.createHash("sha256").update(first).digest("hex");
  // DEBUG log: computed hash for the provided data object
  console.debug("[DEBUG] doubleHashWorkerAsync computed hash:", h);
  return [h, infoDict];
}

// Double SHA-256 hash worker for audio data
async function doubleAudioHashWorkerAsync(audioBytes, sampleRate = 44100) {
  const first = crypto.createHash("sha256").update(audioBytes).digest();
  const h = crypto.createHash("sha256").update(first).digest("hex");
  const meta = { type: "audio", sample_rate: sampleRate, length_bytes: audioBytes.length };
  // DEBUG log: computed hash for audio bytes
  console.debug("[DEBUG] doubleAudioHashWorkerAsync computed audio hash:", h);
  return [h, meta];
}

// RootHash maintains the menu index and computes the root hash
class RootHash {
  constructor() {
    this.menuIndex = new Map(); // Stores hashes with metadata and timestamp
  }

  addEntry(level, h, meta) {
    // Enforce memory limit
    if (this.menuIndex.size >= MAX_HASH_MEMORY) {
      const oldestKey = this.menuIndex.keys().next().value;
      this.menuIndex.delete(oldestKey);
      console.debug("[DEBUG] Removed oldest hash to maintain memory limit:", oldestKey);
    }
    this.menuIndex.set(h, { level, timestamp: Date.now() / 1000, meta });
  }

  buildRootHash() {
    const obj = Object.fromEntries(this.menuIndex);
    const first = crypto.createHash("sha256").update(JSON.stringify(obj, Object.keys(obj).sort())).digest();
    const root = crypto.createHash("sha256").update(first).digest("hex");
    console.debug("[DEBUG] Root hash computed:", root);
    return root;
  }

  export() {
    return { menu: Object.fromEntries(this.menuIndex), root_hash: this.buildRootHash() };
  }
}

class RuleEngine {
  constructor(ownerId) { this.ownerId = ownerId; }
  authorize(requesterId) { return requesterId === this.ownerId; }
  biometricProtection(meta) { const forbidden = new Set(["fingerprint", "face", "iris"]); return ![...forbidden].some(k => meta.hasOwnProperty(k)); }
  evolutionRule(stats) { return { version: (stats.version || 1) + 1 }; }
}

class ITDepartment {
  constructor() { this.logs = []; this.systemHealth = { hash_levels: 0, total_hashes: 0, last_check: null }; }
  logEvent(message) { this.logs.push({ time: Date.now() / 1000, message }); console.debug("[DEBUG] IT log event:", message); }
  audit(levels) {
    let total = 0;
    for (const v of Object.values(levels)) total += Object.keys(v).length;
    this.systemHealth.hash_levels = Object.keys(levels).length;
    this.systemHealth.total_hashes = total;
    this.systemHealth.last_check = Date.now() / 1000;
    this.logEvent("System audit completed");
  }
  report() { return { health: this.systemHealth, logs: this.logs.slice(-10) }; }
}

class AutoMemoryCollector {
  constructor(ownerId = OWNER_ID) {
    this.levels = { 0: {} };
    this.root = new RootHash();
    this.rules = new RuleEngine(ownerId);
    this.itDepartment = new ITDepartment();
    this._ready = this._initDir();
  }
  async _initDir() { await fs.mkdir(HASH_FOLDER, { recursive: true }); }
  async ready() { await this._ready; }

  _collapseLevel(level) {
    const stack = [level];
    while (stack.length > 0) {
      const lvl = stack.pop();
      const items = Object.entries(this.levels[lvl]);
      if (items.length === 0) continue;
      const first = crypto.createHash("sha256").update(JSON.stringify(items, Object.keys(items).sort())).digest();
      const collapsedHash = crypto.createHash("sha256").update(first).digest("hex");
      this.levels[lvl] = {};
      const nextLevel = lvl + 1;
      if (!this.levels[nextLevel]) this.levels[nextLevel] = {};
      const meta = { count: items.length };
      this.levels[nextLevel][collapsedHash] = meta;
      this.root.addEntry(nextLevel, collapsedHash, meta);
      console.debug("[DEBUG] Collapsed level", lvl, "into hash", collapsedHash);
      if (Object.keys(this.levels[nextLevel]).length >= HASH_GROUP_SIZE) stack.push(nextLevel);
    }
  }

  async collectBatch(infoList, requesterId = OWNER_ID) {
    await this.ready();
    if (!this.rules.authorize(requesterId)) return null;
    const results = [];
    for (let i = 0; i < infoList.length; i += BATCH_SIZE) {
      const batch = infoList.slice(i, i + BATCH_SIZE);
      // DEBUG: log before starting batch processing to reduce synchronous blocking
      console.debug("[DEBUG] Starting batch", i / BATCH_SIZE + 1);
      const batchResults = await Promise.all(batch.map(info => doubleHashWorkerAsync(info)));
      results.push(...batchResults);
    }
    for (const [h, info] of results) {
      this.levels[0][h] = info;
      this.root.addEntry(0, h, { type: "data" });
      if (Object.keys(this.levels[0]).length >= HASH_GROUP_SIZE) this._collapseLevel(0);
    }
    this.itDepartment.audit(this.levels);
    return this.root.buildRootHash();
  }

  async collectAudio(audioBytes, sampleRate = 44100, requesterId = OWNER_ID) {
    await this.ready();
    if (!this.rules.authorize(requesterId)) return null;
    const [h, meta] = await doubleAudioHashWorkerAsync(audioBytes, sampleRate);
    if (!this.rules.biometricProtection(meta)) return null;
    this.levels[0][h] = { audio: true };
    this.root.addEntry(0, h, meta);
    if (Object.keys(this.levels[0]).length >= HASH_GROUP_SIZE) this._collapseLevel(0);
    this.itDepartment.audit(this.levels);
    return h;
  }

  async exportRoot() {
    await this.ready();
    const data = this.root.export();
    await fs.writeFile(path.join(HASH_FOLDER, "root_hash.json"), JSON.stringify(data, null, 2));
    try { await execAsync("git add hash_storage/root_hash.json && git commit -m 'Update root_hash' && git push"); }
    catch (err) { console.error("GitHub integration error:", err); }
    console.debug("[DEBUG] Root hash exported");
    return data;
  }

  itReport() { return this.itDepartment.report(); }
}

class MenuBarFromRoot {
  constructor(rootData) { this.menu = rootData.menu; }
  show() {
    console.log("\n=== ROOT HASH MENU ===");
    let i = 1;
    for (const [h, v] of Object.entries(this.menu)) {
      const t = v.meta?.type || "data";
      console.log(`${i}. HASH ${h.slice(0, 12)} | level=${v.level} | type=${t}`);
      i++;
    }
    console.debug("[DEBUG] Menu displayed with", i - 1, "entries");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const collector = new AutoMemoryCollector();
    const batch = Array.from({ length: 100 }, (_, i) => ({ frame: i, time: Date.now() / 1000 }));
    await collector.collectBatch(batch);
    await collector.collectAudio(Buffer.from("FAKE_AUDIO_STREAM_001"), 44100);
    await collector.exportRoot();
    const menu = new MenuBarFromRoot(await collector.root.export());
    menu.show();
    console.log(JSON.stringify(collector.itReport(), null, 2));
  })();
}
