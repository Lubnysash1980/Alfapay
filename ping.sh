#!/bin/bash

LOGDIR="$HOME/android_guard"
LOGFILE="$LOGDIR/security.log"
STATEFILE="$LOGDIR/state.flag"
KNOWNACCESS="$LOGDIR/known_access.txt"
mkdir -p "$LOGDIR"
touch "$LOGFILE" "$KNOWNACCESS"

PING_INTERVAL=60  # сек

# Кольори для терміналу
RED="\e[31m"
YELLOW="\e[33m"
GREEN="\e[32m"
RESET="\e[0m"

# SELinux status
getenforce_safe() {
    if [ -r /sys/fs/selinux/enforce ]; then
        val=$(cat /sys/fs/selinux/enforce 2>/dev/null)
        [ "$val" = "1" ] && echo "ENFORCING" || echo "PERMISSIVE"
    else
        echo "UNKNOWN"
    fi
}

# System ping (heartbeat)
system_ping() {
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${YELLOW}[PING] $timestamp${RESET}"
    echo "$timestamp [PING]" >> "$LOGFILE"
}

# Freeze / unfreeze monitor
freeze_monitor() {
    echo "FROZEN" > "$STATEFILE"
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${GREEN}[INFO] Monitoring frozen at $timestamp${RESET}"
    echo "$timestamp [INFO] Monitoring frozen" >> "$LOGFILE"
}
unfreeze_monitor() {
    rm -f "$STATEFILE"
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${GREEN}[INFO] Monitoring unfrozen at $timestamp${RESET}"
    echo "$timestamp [INFO] Monitoring unfrozen" >> "$LOGFILE"
}

# Check accessibility with auto alert
check_accessibility() {
    pkgs=$(pm list packages -3 | cut -d: -f2)
    for pkg in $pkgs; do
        acc=$(dumpsys accessibility | grep -i "$pkg" 2>/dev/null)
        overlay=$(dumpsys overlay | grep -i "$pkg" 2>/dev/null)
        devadm=$(dumpsys device_policy | grep -i "$pkg" 2>/dev/null)
        if [ -n "$acc$overlay$devadm" ]; then
            if ! grep -q "$pkg" "$KNOWNACCESS"; then
                timestamp=$(date +"%Y-%m-%d %H:%M:%S")
                echo -e "${RED}[ALERT] $timestamp New access: $pkg${RESET}"
                echo "$timestamp [NEW_ACCESS] $pkg" >> "$LOGFILE"
                echo "$pkg" >> "$KNOWNACCESS"
            fi
        fi
    done
}

# Samsung hidden services
check_samsung_services() {
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    services=$(dumpsys activity services | grep -iE "bluetooth|audio|media|com.samsung" 2>/dev/null | head -n 20)
    echo -e "${GREEN}[SVC_SCAN] $timestamp${RESET}"
    echo "$timestamp [SVC_SCAN]" >> "$LOGFILE"
}

# Export logs
export_logs() {
    cp "$LOGFILE" "$LOGDIR/security_$(date +%Y%m%d_%H%M%S).txt"
    echo -e "${GREEN}Logs exported.${RESET}"
}

# Background monitor for live timeline
background_monitor() {
    while true; do
        if [ ! -f "$STATEFILE" ]; then
            system_ping
            check_accessibility
            check_samsung_services
        fi
        sleep $PING_INTERVAL
    done
}

# Start background monitor
background_monitor &

# Main menu loop
while true; do
    echo -e "\n${GREEN}=== ANDROID LIVE SECURITY TIMELINE ===${RESET}"
    echo "1) SELinux status"
    echo "2) Freeze monitor"
    echo "3) Unfreeze monitor"
    echo "4) Manual system ping"
    echo "5) Show full log"
    echo "6) Export logs"
    echo "7) Exit"
    echo "--------------------------------------"
    printf "Select option: "
    read opt

    case "$opt" in
        1)
            echo -e "${GREEN}SELinux: $(getenforce_safe)${RESET}"
            ;;
        2)
            freeze_monitor
            ;;
        3)
            unfreeze_monitor
            ;;
        4)
            system_ping
            ;;
        5)
            less "$LOGFILE"
            ;;
        6)
            export_logs
            ;;
        7)
            kill %1 2>/dev/null
            exit 0
            ;;
        *)
            echo "Invalid option"
            ;;
    esac
done
