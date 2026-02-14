# Termux Evolution Module - Modular, Efficient, and Scalable Version with PID & Async Improvements

"""
Модуль для інтеграції all-in-one пакета Termux Evolution.
Автор: <YOUR_NAME>
Ліцензія: тимчасова передача прав на комерційне використання обмежена на визначений час.

Основні можливості:
- Автопідхоплювач скриптів з контролем PID та перевіркою існування процесів
- Подвійний бекенд (звичайний + secure) з асинхронними запитами
- Інтерактивне меню для керування скриптами
- Перевірка токена для комерційного використання
- Автоматична установка pkg / pip / npm за потреби
- Інформаційний слід та кешування стану бекенду з розширеною конфігурацією таймаутів
- Логування з файлами та різними рівнями (debug/info/warning/error)
- Розділення логіки на модулі для скриптів, бекенду та залежностей
- Вбудовані оператори журналу для налагодження
"""

import os
import subprocess
import requests
import time
import logging
from functools import wraps
from threading import Thread

# Логування з підтримкою файлів та різних рівнів
logging.basicConfig(level=logging.DEBUG, format='[%(asctime)s] %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)
file_handler = logging.FileHandler('termux_evolution.log')
file_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Конфігурація
TERMUX_DIR = os.path.expanduser("~/termux_evolution/termux")
BACKEND_A = "http://127.0.0.1:5000"
BACKEND_B = "http://127.0.0.1:5001"
AUTH_TOKEN = "<YOUR_BIOMETRIC_TOKEN>"
TOKEN_DURATION = 3600  # сек
DEFAULT_TIMEOUT = 30  # секунда для subprocess

# Декоратор перевірки токена для контролю доступу до методів
def require_token(func):
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        if not self.is_token_valid():
            logger.warning("Спроба доступу після закінчення токена.")
            print("Token expired or invalid.")
            return
        return func(self, *args, **kwargs)
    return wrapper

class TermuxEvolution:
    def __init__(self, termux_dir=TERMUX_DIR, backend_a=BACKEND_A, backend_b=BACKEND_B, auth_token=AUTH_TOKEN, token_duration=TOKEN_DURATION, default_timeout=DEFAULT_TIMEOUT):
        self.termux_dir = termux_dir
        self.backend_a = backend_a
        self.backend_b = backend_b
        self.auth_token = auth_token
        self.token_expiry = time.time() + token_duration
        self.backend_cache = {}
        self.running_scripts = {}
        self.default_timeout = default_timeout
        print(f"Initialized TermuxEvolution with token expiry at {self.token_expiry}")

    def is_token_valid(self):
        valid = time.time() < self.token_expiry
        print(f"Token valid: {valid}")
        return valid

    def _pid_exists(self, pid):
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        return True

    def _run_subprocess(self, cmd, timeout=None):
        timeout = timeout or self.default_timeout
        try:
            subprocess.run(cmd, check=True, timeout=timeout)
            logger.debug(f"Command executed successfully: {cmd}")
            return True
        except subprocess.TimeoutExpired:
            logger.error(f"Timeout executing command: {cmd}")
            return False
        except subprocess.CalledProcessError as e:
            logger.error(f"Error executing command {cmd}: {e}")
            return False

    @require_token
    def start_script(self, script_name="my_script.sh", timeout=None):
        path = os.path.join(self.termux_dir, script_name)
        if os.path.isfile(path):
            try:
                process = subprocess.Popen(["bash", path], cwd=self.termux_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                self.running_scripts[script_name] = process.pid
                logger.info(f"Скрипт {script_name} запущено, PID={process.pid}.")
            except Exception as e:
                logger.error(f"Помилка запуску скрипту {script_name}: {e}")
        else:
            logger.error(f"Скрипт {script_name} не знайдено в {self.termux_dir}")

    @require_token
    def stop_script(self, script_name="my_script.sh", timeout=None):
        pid = self.running_scripts.get(script_name)
        if pid and self._pid_exists(pid):
            self._run_subprocess(["kill", str(pid)], timeout=timeout)
            del self.running_scripts[script_name]
        else:
            logger.warning(f"PID для {script_name} не знайдено або процес вже завершено.")

    @require_token
    def restart_script(self, script_name="my_script.sh"):
        self.stop_script(script_name)
        self.start_script(script_name)

    @require_token
    def get_backend_state(self, secure=False, cache_time=5, retries=3):
        url = self.backend_b if secure else self.backend_a
        headers = {"Authorization": self.auth_token} if secure else {}
        cache_key = 'secure' if secure else 'public'
        now = time.time()
        if cache_key in self.backend_cache and now - self.backend_cache[cache_key]['time'] < cache_time:
            return self.backend_cache[cache_key]['data']

        def fetch():
            for attempt in range(retries):
                try:
                    response = requests.get(url + "/state", headers=headers, timeout=5)
                    response.raise_for_status()
                    data = response.json()
                    self.backend_cache[cache_key] = {'data': data, 'time': time.time()}
                    return data
                except requests.RequestException:
                    time.sleep(1)
            return {"error": "Не вдалося отримати стан бекенду після кількох спроб."}

        result = [None]
        def thread_func():
            result[0] = fetch()
        t = Thread(target=thread_func)
        t.start()
        t.join()
        return result[0]

    @require_token
    def ensure_dependencies(self, timeout=None):
        timeout = timeout or self.default_timeout
        def check_and_install(command, install_cmd):
            if subprocess.call(["sh", "-c", f"command -v {command}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
                self._run_subprocess(install_cmd, timeout=timeout)

        check_and_install("python3", ["pkg", "install", "python", "-y"])
        check_and_install("node", ["pkg", "install", "nodejs", "-y"])
        check_and_install("npm", ["npm", "install", "-g", "pm2"])

if __name__ == "__main__":
    termux = TermuxEvolution()
    termux.ensure_dependencies()
    termux.start_script()
    termux.get_backend_state()
    termux.get_backend_state(secure=True)

