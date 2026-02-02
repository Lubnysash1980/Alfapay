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
