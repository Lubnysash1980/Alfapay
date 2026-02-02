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
