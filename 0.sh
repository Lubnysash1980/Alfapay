#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=========================================================="
echo "🚀 CYBRA FULL PRODUCTION PLATFORM — ONE SCRIPT DEPLOY"
echo "=========================================================="

# -------- BASE --------
pkg update -y && pkg upgrade -y
pkg install -y python redis git curl jq zip nodejs

ROOT="$HOME/cybra_prod"
rm -rf "$ROOT"
mkdir -p "$ROOT"/{app,core,policies,logs,runtime/redis}
cd "$ROOT"

# -------- VENV --------
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn redis pydantic requests rich aiohttp psutil

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

# -------- API --------
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
    return {"queued":s.topic}
PY

# -------- COMMITTEE --------
cat > core/committee.py <<'PY'
import json,time,redis,hashlib
r=redis.Redis(host="127.0.0.1",port=6379,decode_responses=True)
SAFE={"execute_payment_property"}

def h(d):return hashlib.sha256(json.dumps(d,sort_keys=True).encode()).hexdigest()

while True:
    it=r.brpop("cybra:parliament:submissions",timeout=2)
    if not it: continue
    _,raw=it
    sub=json.loads(raw)
    ok=sub["topic"] in SAFE
    vote={"topic":sub["topic"],"approve":ok,"ts":time.time()}
    r.lpush("cybra:parliament:votes",json.dumps(vote))
    r.lpush("cybra:audit",json.dumps({"type":"vote","hash":h(vote)}))
    if ok:
        r.lpush("cybra:payments:requests",json.dumps(sub))
PY

# -------- PAYMENT EXEC --------
cat > core/payment_exec.py <<'PY'
import json,time,redis
r=redis.Redis(host="127.0.0.1",port=6379,decode_responses=True)

while True:
    it=r.brpop("cybra:payments:requests",timeout=2)
    if not it: continue
    _,raw=it
    sub=json.loads(raw)
    res={
        "status":"sandbox_only",
        "amount":sub.get("policy",{}).get("amount"),
        "ts":time.time()
    }
    r.lpush("cybra:payments:results",json.dumps(res))
    print("💸 PAYMENT:",res)
PY

# -------- NODE MODULE --------
cat > core/gitcybrahash_adaptive.mjs <<'JS'
// Ваш Node.js код з gitcybrahash_adaptive.mjs
import './gitcybrahash_adaptive.mjs';
JS

# -------- START --------
cat > start.sh <<'BASH'
#!/data/data/com.termux/files/usr/bin/bash
cd "$HOME/cybra_prod"
source .venv/bin/activate

# Redis
redis-server --daemonize yes --dir runtime/redis >/dev/null 2>&1 || true
sleep 1

# Python Services
nohup uvicorn app.main:app --host 127.0.0.1 --port 8090 > logs/api.log 2>&1 &
nohup python core/committee.py > logs/committee.log 2>&1 &
nohup python core/payment_exec.py > logs/pay.log 2>&1 &

# Node.js AutoMemoryCollector
nohup node core/gitcybrahash_adaptive.mjs > logs/hash.log 2>&1 &

echo "✅ CYBRA STARTED"
echo "API: http://127.0.0.1:8090/health"
BASH

chmod +x start.sh
./start.sh

echo "=========================================================="
echo "✔ DEPLOY COMPLETE"
echo "=========================================================="
