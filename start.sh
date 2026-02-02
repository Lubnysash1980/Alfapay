#!/data/data/com.termux/files/usr/bin/bash
set -e

ROOT="$HOME/cybra_prod"
cd "$ROOT"
source .venv/bin/activate

# Redis
redis-server --daemonize yes --dir runtime/redis >/dev/null 2>&1 || true
sleep 1

# FastAPI
nohup uvicorn app.main:app --host 127.0.0.1 --port 8090 > logs/api.log 2>&1 &

# Python Committee
nohup python core/committee.py > logs/committee.log 2>&1 &

# Python Payment Executor
nohup python core/payment_exec.py > logs/pay.log 2>&1 &

# Node.js AutoMemoryCollector
nohup node gitcybrahash_adaptive.mjs > logs/node_collector.log 2>&1 &

echo "✅ CYBRA STARTED"
echo "API: http://127.0.0.1:8090/health"
