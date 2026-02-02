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
