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
