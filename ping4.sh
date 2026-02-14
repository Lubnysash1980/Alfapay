#!/bin/bash
# ANDROID LIVE SECURITY DASHBOARD v3 - PRO
# Termux, Safe, No Root, No ADB
# Features: Live dashboard, Auto-Freeze, GitHub hash alert, Whitelist, Event queue, Flashing new events

LOGDIR="$HOME/android_guard"
LOGFILE="$LOGDIR/security.log"
HASHFILE="$LOGDIR/github_hash.txt"
mkdir -p "$LOGDIR"
touch "$LOGFILE"
touch "$HASHFILE"

PING_INTERVAL=60
MAX_LINES=15
FROZEN=false
declare -a MEMORY_EVENTS
declare -a WAIT_QUEUE
declare -a WHITELIST=("PING" "INFO SELinux: ENFORCING")
LAST_HASH=""

# Colors
RED="\e[31m"
YELLOW="\e[33m"
GREEN="\e[32m"
CYAN="\e[36m"
BLINK="\e[5m"
RESET="\e[0m"

# -----------------------------
# Functions
# -----------------------------

getenforce_safe() {
    [ -r /sys/fs/selinux/enforce ] && val=$(cat /sys/fs/selinux/enforce 2>/dev/null) && [ "$val" = "1" ] && echo "ENFORCING" || echo "PERMISSIVE" || echo "UNKNOWN"
}

add_to_memory() {
    MEMORY_EVENTS+=("$1")
    if [ ${#MEMORY_EVENTS[@]} -gt $MAX_LINES ]; then
        MEMORY_EVENTS=("${MEMORY_EVENTS[@]:1}")
    fi
}

check_anomaly() {
    local evt="$1"
    local is_whitelisted=false
    for w in "${WHITELIST[@]}"; do
        [[ "$evt" == *"$w"* ]] && is_whitelisted=true && break
    done
    $is_whitelisted || FROZEN=true
}

system_ping() {
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    evt="$timestamp [PING]"
    echo "$evt" >> "$LOGFILE"
    ps -A -o USER,PID,NAME,%MEM,%CPU --sort=-%mem | head -n 5 >> "$LOGFILE"
    if $FROZEN; then
        WAIT_QUEUE+=("$evt")
    else
        add_to_memory "$evt"
        check_anomaly "$evt"
        flash_event "$evt"
    fi
}

system_info_event() {
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    selinux_status=$(getenforce_safe)
    evt="$timestamp [INFO] SELinux: $selinux_status"
    echo "$evt" >> "$LOGFILE"
    if $FROZEN; then
        WAIT_QUEUE+=("$evt")
    else
        add_to_memory "$evt"
        check_anomaly "$evt"
        flash_event "$evt"
    fi
}

manual_log_event() {
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    evt="$timestamp [MANUAL] User triggered event"
    echo "$evt" >> "$LOGFILE"
    if $FROZEN; then
        WAIT_QUEUE+=("$evt")
    else
        add_to_memory "$evt"
        check_anomaly "$evt"
        flash_event "$evt"
    fi
}

update_github_hash() {
    if command -v git >/dev/null 2>&1; then
        hash=$(git hash-object "$LOGFILE")
    else
        hash=$(md5sum "$LOGFILE" | awk '{print $1}')
    fi

    if [ "$hash" != "$LAST_HASH" ]; then
        echo -e "${BLINK}${RED}!!! GitHub hash changed !!!${RESET}"
        LAST_HASH="$hash"
        echo "$hash" > "$HASHFILE"
    fi
}

export_logs() {
    export_file="$LOGDIR/security_$(date +%Y%m%d_%H%M%S)_$(cat $HASHFILE).txt"
    cp "$LOGFILE" "$export_file"
    echo -e "${GREEN}Logs exported to $export_file${RESET}"
}

unfreeze_system() {
    FROZEN=false
    for evt in "${WAIT_QUEUE[@]}"; do
        add_to_memory "$evt"
        check_anomaly "$evt"
        flash_event "$evt"
    done
    WAIT_QUEUE=()
    echo -e "${CYAN}System unfrozen. All queued events processed.${RESET}"
}

flash_event() {
    # коротке миготіння нової події
    echo -ne "${BLINK}${YELLOW}$1${RESET}\r"
    sleep 0.3
    echo -ne "\033[K"
}

# -----------------------------
# Background monitor
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
# Live Dashboard + Menu
# -----------------------------
while true; do
    clear
    echo -e "${GREEN}=== ANDROID LIVE SECURITY DASHBOARD v3 ===${RESET}"
    echo -e "${CYAN}Frozen: $FROZEN${RESET}"
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
    if $FROZEN && [ ${#WAIT_QUEUE[@]} -gt 0 ]; then
        echo -e "${CYAN}--- Wait queue (Frozen) ---${RESET}"
        for evt in "${WAIT_QUEUE[@]}"; do
            echo -e "${BLINK}${CYAN}$evt${RESET}"
        done
    fi
    echo "------------------------------"
    echo "1) Manual system ping"
    echo "2) Manual log event"
    echo "3) Export logs"
    echo "4) Show full log"
    echo "5) Unfreeze system"
    echo "6) Exit"
    echo "------------------------------"
    printf "Select option: "
    read -t 5 opt

    case "$opt" in
        1) system_ping ;;
        2) manual_log_event ;;
        3) export_logs ;;
        4) less "$LOGFILE" ;;
        5) unfreeze_system ;;
        6) kill $BG_PID 2>/dev/null; exit 0 ;;
        *) : ;; # нічого при таймауті
    esac
done
