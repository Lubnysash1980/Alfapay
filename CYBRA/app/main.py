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
