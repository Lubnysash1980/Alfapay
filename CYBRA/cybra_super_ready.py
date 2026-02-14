#!/usr/bin/env python3
import redis, json, threading, time, os, subprocess

BASE_DIR = os.path.expanduser('~/CYBRA')
AUDIT_FILE = os.path.join(BASE_DIR, 'audit_cache.json')
REDIS_PORT = 6379
API_PORT = 8090

# ====== Підключення до Redis ======
r = redis.Redis(host='127.0.0.1', port=REDIS_PORT, decode_responses=True)

# ====== Воркери з логом в реальному часі ======
def parliament_worker():
    while True:
        it = r.brpop("cybra:parliament:submissions", timeout=2)
        if it:
            _, task = it
            r.lpush("cybra:audit", task)
            print(f"[PARLIAMENT] Оброблено таск: {task}")
        time.sleep(0.2)

def payment_worker():
    while True:
        it = r.brpop("cybra:payments:requests", timeout=2)
        if it:
            _, task = it
            r.lpush("cybra:audit", task)
            print(f"[PAYMENT] Оброблено платіж: {task}")
        time.sleep(0.2)

# ====== Функція старту Redis та FastAPI ======
def start_services():
    # Завершуємо старі процеси FastAPI
    subprocess.run("pkill -f uvicorn", shell=True, stderr=subprocess.DEVNULL)

    # Redis
    subprocess.Popen(['redis-server', '--daemonize', 'yes', '--port', str(REDIS_PORT), '--dir', os.path.join(BASE_DIR,'data')])
    time.sleep(1)

    # FastAPI
    subprocess.Popen([
        os.path.join(BASE_DIR,'venv','bin','uvicorn'),
        'app.main:app',
        '--host', '127.0.0.1',
        '--port', str(API_PORT)
    ], cwd=BASE_DIR)
    print(f"🟢 Redis і FastAPI запущені на портах {REDIS_PORT}/{API_PORT}")

# ====== Меню ======
def show_menu():
    while True:
        print("\n====== CYBRA SUPER MENU ======")
        print("1. Додати таск")
        print("2. Додати платіж")
        print("3. Показати останні 10 записів аудиту")
        print("4. Експортувати аудит у файл")
        print("5. Очистити кеш аудиту")
        print("6. Вихід")
        choice = input("> ").strip()

        if choice == "1":
            payload = input("JSON таск: ")
            r.lpush("cybra:parliament:submissions", payload)
            print(f"✅ Таск додано: {payload}")
        elif choice == "2":
            payload = input("JSON платіж: ")
            r.lpush("cybra:payments:requests", payload)
            print(f"✅ Платіж додано: {payload}")
        elif choice == "3":
            print("\n===== ОСТАННІ 10 АУДИТІВ =====")
            for i in r.lrange("cybra:audit", -10, -1):
                print(i)
        elif choice == "4":
            data = r.lrange("cybra:audit", 0, -1)
            with open(AUDIT_FILE, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"✅ Аудит збережено у {AUDIT_FILE}")
        elif choice == "5":
            r.delete("cybra:audit")
            print("🗑️ Аудит кеш очищено")
        elif choice == "6":
            print("Вихід...")
            break
        else:
            print("❌ Невірна опція, спробуй ще раз")

# ====== MAIN ======
if __name__ == "__main__":
    start_services()
    # Старт воркерів у фоні
    threading.Thread(target=parliament_worker, daemon=True).start()
    threading.Thread(target=payment_worker, daemon=True).start()
    print("🟢 CYBRA Super Ready! Воркери запущені, парламент слухає таски в реальному часі.")
    show_menu()
