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
