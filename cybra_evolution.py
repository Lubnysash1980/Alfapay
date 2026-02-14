# cybra_evolution.py — ЄДИНА ЗВЕДЕНА ВЕРСІЯ (Python + Bash логіка інтегрована)
import os
import subprocess
import time
import threading
import redis
import json
import sys
import requests

# =================== CONFIG ===================
BASE_DIR = os.path.expanduser('~/CYBRA')
REDIS_DIR = os.path.join(BASE_DIR, 'data')
VENV_DIR = os.path.join(BASE_DIR, 'venv')
PYTHON_BIN = os.path.join(VENV_DIR, 'bin', 'python')
REDIS_PORT = 6379
API_PORT = 8090

FOLDERS = ['app', 'core', 'node', 'logs', 'data', 'scripts']
REQUIREMENTS = [
    'redis==7.1.0', 'fastapi==0.128.0', 'uvicorn==0.40.0',
    'pydantic==2.12.5', 'requests==2.32.5', 'starlette==0.50.0'
]

r = redis.Redis(host='127.0.0.1', port=REDIS_PORT, decode_responses=True)

# =================== CORE SETUP ===================

def ensure_structure():
    os.makedirs(BASE_DIR, exist_ok=True)
    for f in FOLDERS:
        os.makedirs(os.path.join(BASE_DIR, f), exist_ok=True)


def ensure_venv():
    if not os.path.exists(VENV_DIR):
        subprocess.run(['python3', '-m', 'venv', VENV_DIR], check=True)
    subprocess.run([PYTHON_BIN, '-m', 'pip', 'install', '--upgrade', 'pip'], check=True)
    subprocess.run([PYTHON_BIN, '-m', 'pip', 'install'] + REQUIREMENTS, check=True)


def ensure_files():
    app_main = os.path.join(BASE_DIR, 'app', 'main.py')
    if not os.path.exists(app_main):
        with open(app_main, 'w') as f:
            f.write('''from fastapi import FastAPI
import redis, time
app = FastAPI()
r = redis.Redis(host="127.0.0.1", port=6379, decode_responses=True)
@app.get("/health")
def health():
    return {"status":"ok","ts":time.time()}
''')

    committee = os.path.join(BASE_DIR, 'core', 'committee.py')
    if not os.path.exists(committee):
        with open(committee, 'w') as f:
            f.write('''import redis,time,json
r=redis.Redis(host="127.0.0.1",port=6379,decode_responses=True)
while True:
    it=r.brpop("cybra:parliament:submissions",timeout=2)
    if it:
        _,v=it
        r.lpush("cybra:audit",v)
    time.sleep(1)
''')

    payment = os.path.join(BASE_DIR, 'core', 'payment_exec.py')
    if not os.path.exists(payment):
        with open(payment, 'w') as f:
            f.write('''import redis,time
r=redis.Redis(host="127.0.0.1",port=6379,decode_responses=True)
while True:
    it=r.brpop("cybra:payments:requests",timeout=2)
    if it:
        _,v=it
        r.lpush("cybra:audit",v)
    time.sleep(1)
''')


def ensure_node():
    node_dir = os.path.join(BASE_DIR, 'node')
    pkg = os.path.join(node_dir, 'package.json')
    if not os.path.exists(pkg):
        subprocess.run(['npm', 'init', '-y'], cwd=node_dir)
        subprocess.run(['npm', 'install', 'redis@^4.6.7'], cwd=node_dir)


def start_redis():
    subprocess.Popen(['redis-server', '--daemonize', 'yes', '--dir', REDIS_DIR])
    time.sleep(1)


def start_api():
    try:
        subprocess.Popen([
            PYTHON_BIN, '-m', 'uvicorn', 'app.main:app',
            '--host', '127.0.0.1', '--port', str(API_PORT)
        ], cwd=BASE_DIR)
    except Exception:
        pass


def start_python_workers():
    threading.Thread(target=subprocess.run, args=([PYTHON_BIN, 'core/committee.py'],), daemon=True).start()
    threading.Thread(target=subprocess.run, args=([PYTHON_BIN, 'core/payment_exec.py'],), daemon=True).start()

# =================== MENU ===================

def show_menu():
    while True:
        try:
            redis_status = '🟢 Підключено' if r.ping() else '🔴'
        except Exception:
            redis_status = '🔴'
        try:
            api = requests.get(f'http://127.0.0.1:{API_PORT}/health', timeout=1)
            api_status = '🟢 API анфроузен' if api.status_code == 200 else '🔴'
        except Exception:
            api_status = '⚠️ API фроузен'

        print('\n================ CYBRA MENU ================')
        print(f'Статус Redis: {redis_status}')
        print(f'Статус API:   {api_status}')
        print('1. Показати аудит')
        print('2. Додати таск')
        print('3. Активація парламенту')
        print('4. Перевірка патчів')
        print('5. Перевірка структури')
        print('6. Старт всіх сервісів')
        print('7. Вихід')

        c = input('> ').strip()
        if c == '1':
            for i in r.lrange('cybra:audit', -10, -1): print(i)
        elif c == '2':
            payload = input('JSON: ')
            r.lpush('cybra:parliament:submissions', payload)
        elif c == '3':
            start_python_workers()
        elif c == '4':
            subprocess.run(['git', '-C', BASE_DIR, 'pull'], check=False)
        elif c == '5':
            ensure_structure(); ensure_files(); ensure_node()
        elif c == '6':
            start_redis(); start_api(); start_python_workers()
        elif c == '7':
            break

# =================== MAIN ===================

if __name__ == '__main__':
    ensure_structure()
    ensure_venv()
    ensure_files()
    ensure_node()
    show_menu()

