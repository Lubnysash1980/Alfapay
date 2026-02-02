#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=========================================================="
echo "🚀 CYBRA FULL DEPLOY SCRIPT — Termux Edition"
echo "=========================================================="

# -------- BASE SYSTEM --------
pkg update -y && pkg upgrade -y
pkg install -y python redis git curl jq zip nodejs npm nano

ROOT="$HOME/cybra_prod"
rm -rf "$ROOT"
mkdir -p "$ROOT"/{app,core,policies,logs,runtime/redis}
cd "$ROOT"

# -------- PYTHON VENV --------
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn redis pydantic requests rich aiohttp psutil

# -------- NODE.JS SETUP --------
npm init -y
npm install redis@4

# -------- POLICIES --------
cat > policies/recipients.json <<'JSON'
{
  "whitelist": [
    {"id":"WL_IBAN_ESTATE_001","iban":"UA-ESTATE-001","purpose":"property_tax","cap_per_txn":2000,"cap_per_day":10000}
  ]
}
JSON

cat > policies/caps.json <<'JSON'
{
  "global": { "per_txn": 5000, "per_day": 20000, "currency": "UAH", "sandbox": true }
}
JSON

# -------- PYTHON API --------
mkdir -p app
cat > app/main.py <<'PY'
from fastapi import FastAPI
from pydantic import BaseModel
import redis, json, time

r = redis.Redis(host="127.0.0.1", port=6379, decode_responses=True)
app = FastAPI(title="CYBRA PROD", version="1.0")

class Submission(BaseModel):
    type: str
    topic: str
    requires_committee: list[str] = []
    policy: dict = {}

@app.get("/health")
def health():
    return {
        "status":"ok",
        "ts":time.time(),
        "queues":{
            "submissions":r.llen("cybra:parliament:submissions"),
            "votes":r.llen("cybra:parliament:votes"),
            "payments":r.llen("cybra:payments:requests")
        }
    }

@app.post("/parliament/submit")
def submit(s: Submission):
    r.lpush("cybra:parliament:submissions", json.dumps(s.dict()))
    return {"queued": s.topic}
PY

# -------- COMMITTEE --------
cat > core/committee.py <<'PY'
import json, time, redis, hashlib
r = redis.Redis(host="127.0.0.1", port=6379, decode_responses=True)
SAFE = {"execute_payment_property"}

def h(d): return hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()

while True:
    it = r.brpop("cybra:parliament:submissions", timeout=2)
    if not it: continue
    _, raw = it
    sub = json.loads(raw)
    ok = sub["topic"] in SAFE
    vote = {"topic": sub["topic"], "approve": ok, "ts": time.time()}
    r.lpush("cybra:parliament:votes", json.dumps(vote))
    r.lpush("cybra:audit", json.dumps({"type":"vote", "hash": h(vote)}))
    if ok:
        r.lpush("cybra:payments:requests", json.dumps(sub))
PY

# -------- PAYMENT EXEC --------
cat > core/payment_exec.py <<'PY'
import json, time, redis
r = redis.Redis(host="127.0.0.1", port=6379, decode_responses=True)

while True:
    it = r.brpop("cybra:payments:requests", timeout=2)
    if not it: continue
    _, raw = it
    sub = json.loads(raw)
    res = {
        "status": "sandbox_only",
        "amount": sub.get("policy", {}).get("amount"),
        "ts": time.time()
    }
    r.lpush("cybra:payments:results", json.dumps(res))
    print("💸 PAYMENT:", res)
PY

# -------- NODE.JS HASH COLLECTOR --------
cat > gitcybrahash_adaptive.mjs <<'JS'
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
JS

# -------- START SCRIPT --------
cat > start.sh <<'BASH'
#!/data/data/com.termux/files/usr/bin/bash
cd "$HOME/cybra_prod"
source .venv/bin/activate

if ! pgrep redis-server >/dev/null; then
    redis-server --daemonize yes --dir runtime/redis
    sleep 1
fi

nohup uvicorn app.main:app --host 127.0.0.1 --port 8090 > logs/api.log 2>&1 &
nohup python core/committee.py > logs/committee.log 2>&1 &
nohup python core/payment_exec.py > logs/pay.log 2>&1 &
nohup node gitcybrahash_adaptive.mjs > logs/node_hash.log 2>&1 &

echo "✅ CYBRA FULL PLATFORM STARTED"
echo "API: http://127.0.0.1:8090/health"
BASH

chmod +x start.sh

# -------- AUTOSTART TERMUX --------
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start_cybra.sh <<'BASH'
#!/data/data/com.termux/files/usr/bin/bash
cd $HOME/cybra_prod
source .venv/bin/activate
./start.sh
BASH
chmod +x ~/.termux/boot/start_cybra.sh

echo "=========================================================="
echo "✅ CYBRA DEPLOY COMPLETE"
echo "Run: ./start.sh to launch platform manually"
echo "After reboot, CYBRA will start automatically in Termux"
echo "=========================================================="
