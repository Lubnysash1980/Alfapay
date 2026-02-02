#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=========================================================="
echo "🚀 CYBRA FULL PRODUCTION PLATFORM — AUTO DEPLOY"
echo "=========================================================="

# -------- Пакети --------
pkg update -y && pkg upgrade -y
pkg install -y python nodejs redis git curl jq zip

# -------- Структура --------
ROOT="$HOME/CYBRA"
rm -rf "$ROOT"
mkdir -p "$ROOT"/{app,core,node,logs,data}

cd "$ROOT"

# -------- Python файли --------
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
    r.lpush("cybra:audit", json.dumps({"type":"vote", "hash":h(vote)}))
    if ok:
        r.lpush("cybra:payments:requests", json.dumps(sub))
PY

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

# -------- Node.js файл --------
cat > node/gitcybrahash_adaptive.mjs <<'JS'
import { createClient } from "redis";

const client = createClient();
client.on("error", err => console.log("Redis Client Error", err));
await client.connect();

console.log("✅ Node.js Redis client connected");
JS

# -------- npm init + залежності --------
cd node
if [ ! -f package.json ]; then
  npm init -y
fi
npm install redis@^4.6.7

cd ..

# -------- Стартовий скрипт --------
cat > start_all.sh <<'BASH'
#!/data/data/com.termux/files/usr/bin/bash
cd "$HOME/CYBRA"

# Redis
redis-server --daemonize yes --dir data
sleep 1
redis-cli ping

# FastAPI
nohup uvicorn app.main:app --host 127.0.0.1 --port 8090 > logs/api.log 2>&1 &

# Core процеси
nohup python core/committee.py > logs/committee.log 2>&1 &
nohup python core/payment_exec.py > logs/pay.log 2>&1 &

# Node.js
cd node
nohup node gitcybrahash_adaptive.mjs > ../logs/node.log 2>&1 &
cd ..

echo "✅ CYBRA STARTED"
echo "API: http://127.0.0.1:8090/health"
BASH

# -------- Права --------
chmod +x start_all.sh
chmod +x core/*.py
chmod +x node/*.mjs

echo "=========================================================="
echo "✔ DEPLOY COMPLETE — запускаємо CYBRA"
echo "=========================================================="

./start_all.sh
