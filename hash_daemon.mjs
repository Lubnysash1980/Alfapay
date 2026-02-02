#!/usr/bin/env node
/**
 * hash_daemon.mjs
 * © 2026
 * Double SHA-256 Hash Daemon
 * Console + Git + Root Hash + Memory Protection
 */

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/* ================== CONFIG ================== */

const HASH_DIR = "./hash_storage";
const ROOT_FILE = "root_hash.json";
const OWNER_ID = "OWNER_ONLY";

const HASH_GROUP_SIZE = 100;
const MAX_HASH_MEMORY = 256;
const BATCH_SIZE = 10;

/* ================== UTILS ================== */

function doubleSHA256(data) {
  const first = crypto.createHash("sha256").update(data).digest();
  return crypto.createHash("sha256").update(first).digest("hex");
}

function now() {
  return Math.floor(Date.now() / 1000);
}

/* ================== ROOT HASH ================== */

class RootHash {
  constructor() {
    this.index = new Map();
  }

  add(level, hash, meta = {}) {
    if (this.index.size >= MAX_HASH_MEMORY) {
      const oldest = this.index.keys().next().value;
      this.index.delete(oldest);
    }
    this.index.set(hash, { level, meta, ts: now() });
  }

  build() {
    const obj = Object.fromEntries(this.index);
    return doubleSHA256(
      JSON.stringify(obj, Object.keys(obj).sort())
    );
  }

  export() {
    return {
      root_hash: this.build(),
      menu: Object.fromEntries(this.index),
    };
  }
}

/* ================== COLLECTOR ================== */

class HashCollector {
  constructor(owner = OWNER_ID) {
    this.owner = owner;
    this.levels = { 0: {} };
    this.root = new RootHash();
  }

  async init() {
    await fs.mkdir(HASH_DIR, { recursive: true });
  }

  authorize(id) {
    return id === this.owner;
  }

  collapse(level) {
    const entries = Object.entries(this.levels[level]);
    if (!entries.length) return;

    const collapsed = doubleSHA256(
      JSON.stringify(entries, Object.keys(entries).sort())
    );

    this.levels[level] = {};
    const next = level + 1;
    if (!this.levels[next]) this.levels[next] = {};

    const meta = { count: entries.length };
    this.levels[next][collapsed] = meta;
    this.root.add(next, collapsed, meta);

    if (Object.keys(this.levels[next]).length >= HASH_GROUP_SIZE) {
      this.collapse(next);
    }
  }

  async collectBatch(list, requester = OWNER_ID) {
    if (!this.authorize(requester)) return null;

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE);
      const results = batch.map(obj => {
        const raw = JSON.stringify(obj, Object.keys(obj).sort());
        return doubleSHA256(raw);
      });

      for (const h of results) {
        this.levels[0][h] = { type: "data" };
        this.root.add(0, h, { type: "data" });
      }

      if (Object.keys(this.levels[0]).length >= HASH_GROUP_SIZE) {
        this.collapse(0);
      }
    }

    return this.root.build();
  }

  async collectAudio(buffer) {
    const h = doubleSHA256(buffer);
    this.levels[0][h] = { type: "audio" };
    this.root.add(0, h, { type: "audio" });

    if (Object.keys(this.levels[0]).length >= HASH_GROUP_SIZE) {
      this.collapse(0);
    }
    return h;
  }

  async save() {
    const data = this.root.export();
    const file = path.join(HASH_DIR, ROOT_FILE);
    await fs.writeFile(file, JSON.stringify(data, null, 2));

    try {
      await execAsync(
        `git add ${file} && git commit -m "update root hash" && git push`
      );
    } catch {
      // git optional
    }

    return data;
  }
}

/* ================== CONSOLE ================== */

async function main() {
  console.log("=== HASH DAEMON STARTED ===");

  const daemon = new HashCollector();
  await daemon.init();

  const batch = Array.from({ length: 50 }, (_, i) => ({
    frame: i,
    time: now(),
  }));

  console.log("→ collecting batch hashes");
  const root1 = await daemon.collectBatch(batch);

  console.log("→ collecting audio hash");
  await daemon.collectAudio(Buffer.from("FAKE_AUDIO_STREAM"));

  const result = await daemon.save();

  console.log("\n=== ROOT HASH ===");
  console.log(result.root_hash);

  console.log("\n=== MENU ===");
  let i = 1;
  for (const [h, v] of Object.entries(result.menu)) {
    console.log(
      `${i}. ${h.slice(0, 12)} | level=${v.level} | type=${v.meta?.type ?? "data"}`
    );
    i++;
  }

  console.log("\n✓ DONE");
}

/* ================== RUN ================== */

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error("ERROR:", err);
    process.exit(1);
  });
}
