import crypto from 'crypto';
import fs from 'fs/promises';
import { createClient } from 'redis';

const HASH_FOLDER = 'hash_storage';
const HASH_GROUP_SIZE = 100;
const PARALLEL_LIMIT = 5;

const r = createClient({ url: 'redis://127.0.0.1:6379' });
await r.connect();
await fs.mkdir(HASH_FOLDER, { recursive: true });

class AutoMemoryCollector {
    constructor() {
        this.index = new Map();
    }

    async collectBatch(infoList) {
        for (let i = 0; i < infoList.length; i += PARALLEL_LIMIT) {
            const slice = infoList.slice(i, i + PARALLEL_LIMIT);
            const hashes = await Promise.all(slice.map(info => this.doubleHash(info)));
            hashes.forEach(h => this.index.set(h, Date.now()));
        }
        return Array.from(this.index.keys());
    }

    async doubleHash(infoDict) {
        const raw = JSON.stringify(infoDict, Object.keys(infoDict).sort());
        const first = crypto.createHash('sha256').update(raw).digest();
        return crypto.createHash('sha256').update(first).digest('hex');
    }
}

const collector = new AutoMemoryCollector();

async function pollRedis() {
    while (true) {
        const votes = await r.lRange('cybra:parliament:votes', 0, -1);
        const payments = await r.lRange('cybra:payments:requests', 0, -1);
        const batch = votes.concat(payments).map(x => JSON.parse(x));
        if (batch.length > 0) {
            const hashes = await collector.collectBatch(batch);
            await r.set('cybra:root_hash', JSON.stringify(hashes));
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

console.log("Node.js Hash Collector Running...");
pollRedis();
