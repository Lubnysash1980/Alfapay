#!/bin/bash

# ===== 1️⃣ Активуємо віртуальне середовище =====
source ~/CYBRA/venv/bin/activate

# ===== 2️⃣ Завершуємо старі процеси FastAPI =====
pkill -f uvicorn 2>/dev/null

# ===== 3️⃣ Запускаємо Redis =====
redis-server --daemonize yes --dir ~/CYBRA/data

# ===== 4️⃣ Запускаємо FastAPI =====
nohup uvicorn app.main:app --host 127.0.0.1 --port 8090 &>/dev/null &

# ===== 5️⃣ Запускаємо Python воркери =====
nohup python3 ~/CYBRA/core/committee.py &>/dev/null &
nohup python3 ~/CYBRA/core/payment_exec.py &>/dev/null &

# ===== 6️⃣ Запускаємо інтерактивне меню =====
python3 ~/CYBRA/cybra_interactive.py
