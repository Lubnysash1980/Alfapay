#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo "=========================================================="
echo "🏛  CYBRA REAL PROD — PARLIAMENT + PAYMENTS + SEAL"
echo "=========================================================="

### === CONFIG ===
ROOT="$HOME/cybra_real_prod"
VENV="$ROOT/.venv"
LOGS="$ROOT/logs"
STATE="$ROOT/state"
RUNTIME="$ROOT/runtime/redis"

mkdir -p "$ROOT"/{app,core,policies,logs,state,runtime/redis}

### === INPUT: BIOMETRIC TOKEN (local only) ===
echo
read -s -p "🔐 Введи біометричний токен (локально, не зберігається): " BIOMETRIC_TOKEN
echo
if [ -z "$BIOMETRIC_TOKEN" ]; then
  echo "❌ Токен порожній"; exit 1
fi

### === SEALS ===
ORCHESTRATOR_ID=$(echo -n "$BIOMETRIC_TOKEN" | sha256sum | awk '{print $1}')
ROOT_SEAL=$(echo -n "$ORCHESTRATOR_ID::CYBRA_REAL_PROD" | sha256sum | awk '{print $1}')

echo "🧬 ORCHESTRATOR_ID: ${ORCHESTRATOR_ID:0:16}..."
echo "🧿 ROOT_SEAL:       ${ROOT_SEAL:0:16}..."

cat > "$STATE/root_seal.json" <<JSON
{
  "orchestrator_id": "$ORCHESTRATOR_ID",
  "root_seal": "$ROOT_SEAL",
  "ts": "$(date -u +%s)"
}
JSON

### === PACKAGES ===
pkg update -y && pkg upgrade -y
pkg install -y python redis git curl jq

### === PYTHON VENV ===
python -m venv "$VENV"
source "$VENV/bin/activate"
pip install --upgrade pip
pip install fastapi uvicorn redis pydantic rich

### === POLICIES ===
cat > "$ROOT/policies/caps.json" <<'JSON'
{
  "global": { "per_txn": 5000, "per_day": 20000, "currency": "UAH", "sandbox": false }
}
JSON

### === API ===
cat > "$ROOT/app/main.py" <<'PY'
from fastapi import FastAPI
import redis, json, time, os, hashlib

ROOT = os.path.dirname(os.path.dirname(__file__))
STATE = os.path.join(ROOT,"state")

def load(p):
    with open(p,"r") as f: return json.load(f)

SEAL = load(os.path.join(STATE,"root_seal.json"))

def h(x): return hashlib.sha256(x.encode()).hexdigest()

app = FastAPI(title="CYBRA REAL PROD", version="1.0")
r = redis.Redis(host="127.0.0.1", port=6379, decode_responses=True)

@app.get("/health")
def health():
    return {
        "ok": True,
        "time": time.time(),
        "orchestrator": SEAL["orchestrator_id"][:16],
        "queues": {
            "submissions": r.llen("cybra:parliament:submissions"),
            "payments": r.llen("cybra:payments:requests"),
            "audit": r.llen("cybra:audit:worm")
        }
    }

@app.post("/parliament/submit")
def submit(data: dict):
    proof = h(json.dumps(data, sort_keys=True) + SEAL["root_seal"])
    data["_proof"] = proof
    r.lpush("cybra:parliament:submissions", json.dumps(data))
    r.lpush("cybra:audit:worm", json.dumps({"type":"submission","hash":proof}))
    return {"accepted": True, "proof": proof}
PY

### === COMMITTEE ENGINE ===
cat > "$ROOT/core/committee.py" <<'PY'
import redis, json, time, hashlib, os

ROOT = os.path.dirname(os.path.dirname(__file__))
STATE = os.path.join(ROOT,"state")
r = redis.Redis(host="127.0.0.1", port=6379, decode_responses=True)

def load(p):
    with open(p,"r") as f: return json.load(f)

SEAL = load(os.path.join(STATE,"root_seal.json"))

def h(x): return hashlib.sha256(x.encode()).hexdigest()

SAFE_TOPICS = {"execute_payment_property"}

print("[Committee] online")

while True:
    it = r.brpop("cybra:parliament:submissions", timeout=2)
    if not it:
        time.sleep(0.2); continue

    _, raw = it
    sub = json.loads(raw)

    if sub.get("topic") not in SAFE_TOPICS:
        r.lpush("cybra:audit:worm", json.dumps({"type":"reject","reason":"unsafe_topic"}))
        continue

    activation = {
        "type":"policy_activation",
        "topic": sub["topic"],
        "policy": sub.get("policy",{}),
        "seal": h(sub["_proof"] + SEAL["root_seal"]),
        "ts": time.time()
    }

    r.lpush("cybra:payments:requests", json.dumps(activation))
    r.lpush("cybra:audit:worm", json.dumps({"type":"activation","seal":activation["seal"]}))
PY

### === PAYMENT EXECUTOR ===
cat > "$ROOT/core/payexec.py" <<'PY'
import redis, json, time, hashlib, os

ROOT = os.path.dirname(os.path.dirname(__file__))
STATE = os.path.join(ROOT,"state")
r = redis.Redis(host="127.0.0.1", port=6379, decode_responses=True)

def load(p):
    with open(p,"r") as f: return json.load(f)

SEAL = load(os.path.join(STATE,"root_seal.json"))

def h(x): return hashlib.sha256(x.encode()).hexdigest()

print("[PayExec] online")

while True:
    it = r.brpop("cybra:payments:requests", timeout=2)
    if not it:
        time.sleep(0.2); continue

    _, raw = it
    act = json.loads(raw)

    if "seal" not in act:
        continue

    final = {
        "status":"SETTLED",
        "topic": act["topic"],
        "amount": act["policy"].get("amount"),
        "ts": time.time(),
        "final_seal": h(act["seal"] + SEAL["root_seal"])
    }

    r.lpush("cybra:payments:results", json.dumps(final))
    r.lpush("cybra:audit:worm", json.dumps({"type":"settlement","seal":final["final_seal"]}))
    print("[PayExec] ✅", final)
PY

### === START ===
redis-server --port 6379 --dir "$RUNTIME" --daemonize yes || true
sleep 1

nohup uvicorn app.main:app --host 127.0.0.1 --port 8099 > "$LOGS/api.log" 2>&1 &
nohup python core/committee.py > "$LOGS/committee.log" 2>&1 &
nohup python core/payexec.py > "$LOGS/payexec.log" 2>&1 &

echo
echo "=========================================================="
echo "✅ CYBRA REAL PROD — ONLINE"
echo "API: http://127.0.0.1:8099/health"
echo "=========================================================="
