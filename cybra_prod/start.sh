#!/data/data/com.termux/files/usr/bin/bash
cd "$HOME/cybra_prod"
source .venv/bin/activate

if ! pgrep redis-server >/dev/null; then
    redis-server --daemonize yes --dir runtime/redis
    sleep 1
fi

nohup uvicorn app.main:app --host 127.0.0.1 --port 8090 > logs/api.log 2>&1 &
nohup python core/committee.py > logs/committee.log 2>&1 &
nohup python core/payment_exec.py > logs/pay.log 2>&1 &
nohup node gitcybrahash_adaptive.mjs > logs/node_hash.log 2>&1 &

echo "✅ CYBRA FULL PLATFORM STARTED"
echo "API: http://127.0.0.1:8090/health"
