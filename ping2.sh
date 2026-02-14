#!/bin/bash
# ANDROID LIVE DASHBOARD TOOLKIT (Termux, SAFE, NO ROOT, NO ADB)
# Повна інтеграція з GitHub hash модулем та моніторингом всіх подій

# -----------------------------
# Налаштування
# -----------------------------
LOGDIR="$HOME/android_guard"
LOGFILE="$LOGDIR/security.log"
HASHFILE="$LOGDIR/github_hash.txt"
mkdir -p "$LOGDIR"
touch "$LOGFILE"
touch "$HASHFILE"

PING_INTERVAL=60     # секунд між автопінгами
MAX_LINES=15         # останні N подій у пам'яті для dashboard

# Кольори
RED="\e[31m"
YELLOW="\e[33m"
GREEN="\e[32m"
RESET="\e[0m"

# -----------------------------
# Функції
# -----------------------------

# SELinux статус
getenforce_safe() {
    if [ -r /sys/fs/selinux/enforce ]; then
        val=$(cat /sys/fs/selinux/enforce 2>/dev/null)
        [ "$val" = "1" ] && echo "ENFORCING" || echo "PERMISSIVE"
    else
        echo "UNKNOWN"
    fi
}

# Автопінг системи та процесів
system_ping() {
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "$timestamp [PING]" >> "$LOGFILE"
    ps -A -o USER,PID,NAME,%MEM,%CPU --sort=-%mem | head -n 5 >> "$LOGFILE"
    add_to_memory "$timestamp [PING]"
}

# Інформаційна подія
system_info_event() {
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    selinux_status=$(getenforce_safe)
    echo "$timestamp [INFO] SELinux: $selinux_status" >> "$LOGFILE"
    add_to_memory "$timestamp [INFO] SELinux: $selinux_status"
}

# Ручне логування
manual_log_event() {
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "$timestamp [MANUAL] User triggered event" >> "$LOGFILE"
    add_to_memory "$timestamp [MANUAL] User triggered event"
}

# GitHub hash контроль
update_github_hash() {
    if command -v git >/dev/null 2>&1; then
        hash=$(git hash-object "$LOGFILE")
        echo "$hash" > "$HASHFILE"
    else
        # простий контроль хешу через md5sum, якщо git немає
        hash=$(md5sum "$LOGFILE" | awk '{print $1}')
        echo "$hash" > "$HASHFILE"
    fi
}

# Збереження останніх N подій у пам'яті
declare -a MEMORY_EVENTS
add_to_memory() {
    MEMORY_EVENTS+=("$1")
    if [ ${#MEMORY_EVENTS[@]} -gt $MAX_LINES ]; then
        MEMORY_EVENTS=("${MEMORY_EVENTS[@]:1}")  # видаляємо найстарішу
    fi
}

# Показ логів з файлу
show_log() {
    if [ -s "$LOGFILE" ]; then
        less "$LOGFILE"
    else
        echo -e "${YELLOW}No logs yet.${RESET}"
    fi
}

# Експорт логів
export_logs() {
    export_file="$LOGDIR/security_$(date +%Y%m%d_%H%M%S)_$(cat $HASHFILE).txt"
    cp "$LOGFILE" "$export_file"
    echo -e "${GREEN}Logs exported to $export_file${RESET}"
}

# -----------------------------
# Фоновий моніторинг
# -----------------------------
background_monitor() {
    while true; do
        system_ping
        system_info_event
        update_github_hash
        sleep $PING_INTERVAL
    done
}

background_monitor &
BG_PID=$!

# -----------------------------
# Live Dashboard + Меню
# -----------------------------
while true; do
    clear
    echo -e "${GREEN}=== ANDROID LIVE DASHBOARD ===${RESET}"
    echo -e "${YELLOW}GitHub hash: $(cat $HASHFILE)${RESET}"
    echo "------------------------------"
    for evt in "${MEMORY_EVENTS[@]}"; do
        case "$evt" in
            *PING*) echo -e "${YELLOW}$evt${RESET}" ;;
            *INFO*) echo -e "${GREEN}$evt${RESET}" ;;
            *MANUAL*) echo -e "${RED}$evt${RESET}" ;;
            *) echo "$evt" ;;
        esac
    done
    echo "------------------------------"
    echo "1) Manual system ping"
    echo "2) Manual log event"
    echo "3) Export logs"
    echo "4) Show full log"
    echo "5) Exit"
    echo "------------------------------"
    printf "Select option: "
    read -t 5 opt  # таймаут 5 секунд, щоб dashboard оновлювався

    case "$opt" in
        1) system_ping ;;
        2) manual_log_event ;;
        3) export_logs ;;
        4) show_log ;;
        5) kill $BG_PID 2>/dev/null; exit 0 ;;
        *) : ;; # нічого не робимо при таймауті
    esac
done
