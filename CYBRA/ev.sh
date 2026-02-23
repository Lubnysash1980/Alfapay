#!/data/data/com.termux/files/usr/bin/bash
BASE_DIR=$HOME/CYBRA

while true; do
  echo "=== CYBRA MENU ==="
  echo "1) Запустити сервер API"
  echo "2) Зупинити сервер API"
  echo "3) Перезапустити сервер API"
  echo "4) Перевірити статус Redis"
  echo "5) Очистити Redis"
  echo "6) Переглянути всі ключі Redis"
  echo "7) Переглянути всі патчі"
  echo "8) Переглянути аудит"
  echo "9) Переглянути останній патч"
  echo "10) Переглянути кількість патчів"
  echo "11) Переглянути кількість ключів Redis"
  echo "12) Переглянути моніторинг"
  echo "13) Переглянути health-звіт"
  echo "14) Переглянути лог API"
  echo "15) Переглянути лог Redis"
  echo "16) Запустити моніторинг"
  echo "17) Запустити health-звіт"
  echo "18) Запустити логування"
  echo "19) Запустити бекап"
  echo "20) Відновити з бекапу"
  echo "21) Переглянути бекап"
  echo "22) Переглянути config.json"
  echo "23) Редагувати config.json"
  echo "24) Переглянути налаштування API"
  echo "25) Переглянути налаштування Redis"
  echo "26) Переглянути налаштування моніторингу"
  echo "27) Переглянути налаштування бекапу"
  echo "28) Переглянути налаштування логування"
  echo "29) Переглянути налаштування audit"
  echo "30) Переглянути налаштування restore"
  echo "31) Переглянути налаштування collect"
  echo "32) Переглянути налаштування nano"
  echo "33) Переглянути налаштування ev.sh"
  echo "34) Переглянути налаштування hash_collector.py"
  echo "35) Переглянути налаштування monitor.py"
  echo "36) Переглянути налаштування logger.py"
  echo "37) Переглянути налаштування backup.py"
  echo "38) Переглянути налаштування audit_api.py"
  echo "39) Переглянути налаштування restore_api.py"
  echo "40) Переглянути налаштування collect_api.py"
  echo "41) Переглянути налаштування main.py"
  echo "42) Переглянути налаштування workers.py"
  echo "43) Переглянути налаштування api.py"
  echo "44) Переглянути налаштування redis.py"
  echo "45) Переглянути налаштування fastapi.py"
  echo "46) Переглянути налаштування uvicorn"
  echo "47) Переглянути налаштування systemd"
  echo "48) Переглянути налаштування docker"
  echo "49) Переглянути налаштування termux"
  echo "50) Переглянути налаштування bash"
  echo "51) Зібрати хеш із файлу"
  echo "52) Відновити файл за хешем"
  echo "53) Редагувати файл з авто-хешем"
  echo "54) Переглянути аудит через API"
  echo "55) Переглянути моніторинг"
  echo "56) Відновити файл через API"
  echo "57) Виклик API /audit (останні хеші)"
  echo "58) Виклик API /restore/{hash} (JSON‑контент файлу)"
  echo "59) Виклик API /collect (збір хешу для файлу)"
  echo "60) Відкрити nano для редагування гіт-папки"
  echo "61) Відкрити nano для редагування ev.sh (з git commit + push)"
  echo "62) Переглянути останні git-коміти"
  echo "63) Відкотити останній git-коміт (reset)"
  echo "64) Переглянути git-статус (зміни у файлах)"
  echo "65) Створити нову git-гілку"
  echo "66) Злити поточну гілку у main"
  echo "0) Вихід"
  read -p "Ваш вибір: " choice

  case $choice in
    1) uvicorn main:app --reload --port 8010;;
    2) pkill -f "uvicorn main:app";;
    3) pkill -f "uvicorn main:app"; uvicorn main:app --reload --port 8010;;
    4) redis-cli ping;;
    5) redis-cli flushall;;
    6) redis-cli keys "*";;
    7) redis-cli keys "cybra:patch:*";;
    8) redis-cli lrange cybra:audit 0 -1;;
    9) redis-cli lrange cybra:audit -1 -1;;
    10) echo $(redis-cli keys "cybra:patch:*" | wc -l);;
    11) redis-cli dbsize;;
    12) python3 $BASE_DIR/monitor.py;;
    13) curl -s http://localhost:8010/health | jq;;
    14) tail -n 50 $BASE_DIR/logs/api.log;;
    15) tail -n 50 $BASE_DIR/logs/redis.log;;
    16) python3 $BASE_DIR/monitor.py;;
    17) curl -s http://localhost:8010/health | jq;;
    18) python3 $BASE_DIR/logger.py;;
    19) python3 $BASE_DIR/backup.py;;
    20) python3 $BASE_DIR/backup.py restore;;
    21) cat $BASE_DIR/logs/backup.json | jq;;
    22) cat $BASE_DIR/config.json | jq;;
    23) nano $BASE_DIR/config.json;;
    24) cat $BASE_DIR/config.json | jq '.api';;
    25) cat $BASE_DIR/config.json | jq '.redis';;
    26) cat $BASE_DIR/config.json | jq '.monitor';;
    27) cat $BASE_DIR/config.json | jq '.backup';;
    28) cat $BASE_DIR/config.json | jq '.logger';;
    29) cat $BASE_DIR/config.json | jq '.audit';;
    30) cat $BASE_DIR/config.json | jq '.restore';;
    31) cat $BASE_DIR/config.json | jq '.collect';;
    32) nano $BASE_DIR/nano_collect.sh;;
    33) nano $BASE_DIR/ev.sh;;
    34) nano $BASE_DIR/hash_collector.py;;
    35) nano $BASE_DIR/monitor.py;;
    36) nano $BASE_DIR/logger.py;;
    37) nano $BASE_DIR/backup.py;;
    38) nano $BASE_DIR/audit_api.py;;
    39) nano $BASE_DIR/restore_api.py;;
    40) nano $BASE_DIR/collect_api.py;;
    41) nano $BASE_DIR/main.py;;
    42) nano $BASE_DIR/workers.py;;
    43) nano $BASE_DIR/api.py;;
    44) nano $BASE_DIR/redis.py;;
    45) nano $BASE_DIR/fastapi.py;;
    46) nano $BASE_DIR/uvicorn.sh;;
    47) nano $BASE_DIR/systemd.service;;
    48) nano $BASE_DIR/docker-compose.yml;;
    49) nano $BASE_DIR/termux.sh;;
    50) nano $BASE_DIR/bashrc;;
    51) read -p "Файл: " f; python3 $BASE_DIR/hash_collector.py collect $f;;
    52) read -p "Хеш: " h; read -p "Файл для відновлення: " t; python3 $BASE_DIR/hash_collector.py restore $h $t;;
    53) read -p "Файл: " f; nano $f; python3 $BASE_DIR/hash_collector.py collect $f;;
    54) curl -s http://localhost:8010/audit?limit=10 | jq;;
    55) python3 $BASE_DIR/monitor.py;;
    56) read -p "Хеш: " h; curl -s http://localhost:8010/restore/$h | jq;;
    57) curl -s http://localhost:8010/audit?limit=10 | jq;;
    58) read -p "Хеш: " h; curl -s http://localhost:8010/restore/$h | jq;;
    59) read -p "Файл: " f; curl -s -X POST "http://localhost:8010/collect?file=$f" | jq;;
    60) echo "✏️ Відкриття nano у папці Git"; \
        nano $BASE_DIR/ev.sh; \
        echo "📦 Додавання у git"; git add $BASE_DIR/ev.sh; \
        echo "💾 Коміт змін"; git commit -m "Виправлення ev.sh через пункт 60";;
    61) echo "✏️ Відкриття nano для редагування ev.sh"; \
        nano $BASE_DIR/ev.sh; \
        echo "📦 Додавання у git"; git add $BASE_DIR/ev.sh; \
        echo "💾 Коміт змін"; git commit -m "Виправлення ev.sh через пункт 60"; \
        echo "🚀 Відправка на GitHub"; git push origin main;;
    62) echo "📜 Останні git-коміти (10 рядків)"; \
        git log --oneline -n 10;;
    63) echo "⚠️ Відкат останнього коміту (git reset --hard HEAD~1)"; \
        git reset --hard HEAD~1;;

    64) echo "📊 Поточний git-статус"; \
        git status;;
    65) read -p "Назва нової гілки: " b; \
        echo "🌿 Створення та перехід на гілку $b"; \
        git checkout -b $b;;
    66) read -p "Назва гілки для злиття: " b; \
        echo "🔀 Перехід у main та злиття гілки $b"; \
        git checkout main; \
        git merge $b; \
        echo "🚀 Push у GitHub після злиття"; \
        git push origin main;;
    0) exit 0;;
    *) echo "❌ Невірний вибір";;
  esac
done


