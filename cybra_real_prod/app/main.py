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
