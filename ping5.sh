#!/data/data/com.termux/files/usr/bin/bash

### ==== CONFIG ====
BASE_DIR="$HOME/sentinel"
LOG_FILE="$BASE_DIR/events.log"
STATE_FILE="$BASE_DIR/state.env"
WHITELIST="$BASE_DIR/whitelist.txt"
QUEUE_FILE="$BASE_DIR/queue.tmp"
MEMORY_LIMIT=200
PING_INTERVAL=60

mkdir -p "$BASE_DIR"
touch "$LOG_FILE" "$WHITELIST" "$QUEUE_FILE"

### ==== LOAD STATE ====
if [[ -f "$STATE_FILE" ]]; then
  source "$STATE_FILE"
else
  FROZEN=0
  LAST_HASH="GENESIS"
fi

### ==== UTILS ====
now() { date "+%Y-%m-%d %H:%M:%S"; }

hash_line() {
  printf "%s" "$1" | sha256sum | awk '{print $1}'
}

save_state() {
  echo "FROZEN=$FROZEN" > "$STATE_FILE"
  echo "LAST_HASH=$LAST_HASH" >> "$STATE_FILE"
}

is_whitelisted() {
  grep -q "$1" "$WHITELIST"
}

log_event() {
  local TYPE="$1"
  local DATA="$2"
  local TS
  TS="$(now)"

  local RAW="$TS [$TYPE] $DATA | PREV=$LAST_HASH"
  local HASH
  HASH="$(hash_line "$RAW")"

  if is_whitelisted "$TYPE"; then
    :
  else
    if [[ "$TYPE" == "ANOMALY" ]]; then
      FROZEN=1
      save_state
    fi
  fi

  if [[ "$FROZEN" -eq 1 && "$TYPE" != "CONTROL" ]]; then
    echo "$RAW | HASH=$HASH" >> "$QUEUE_FILE"
    return
  fi

  echo "$RAW | HASH=$HASH" >> "$LOG_FILE"
  LAST_HASH="$HASH"

  tail -n "$MEMORY_LIMIT" "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  save_state
}

flush_queue() {
  while read -r line; do
    echo "$line" >> "$LOG_FILE"
  done < "$QUEUE_FILE"
  > "$QUEUE_FILE"
}

### ==== MONITORS ====
system_ping() {
  log_event "PING" "uptime=$(uptime | sed 's/,//g')"
}

svc_scan() {
  local PROC_COUNT
  PROC_COUNT="$(ps -A | wc -l)"
  log_event "SVC_SCAN" "processes=$PROC_COUNT"
}

selinux_check() {
  if [[ -r /sys/fs/selinux/enforce ]]; then
    local S
    S="$(cat /sys/fs/selinux/enforce 2>/dev/null)"
    [[ "$S" == "1" ]] && log_event "INFO" "SELinux=ENFORCING" || log_event "INFO" "SELinux=PERMISSIVE"
  else
    log_event "INFO" "SELinux=UNKNOWN"
  fi
}

### ==== ANOMALY RULES ====
detect_anomaly() {
  local LAST_PROC
  LAST_PROC="$(tail -n 5 "$LOG_FILE" | grep SVC_SCAN | tail -n1 | grep -o '[0-9]\+')"

  if [[ -n "$LAST_PROC" && "$LAST_PROC" -gt 500 ]]; then
    log_event "ANOMALY" "High process count: $LAST_PROC"
  fi
}

### ==== MENU ====
menu() {
  clear
  echo "HASH: $LAST_HASH"
  echo "--------------------------------"
  echo "1) Manual system ping"
  echo "2) Manual log event"
  echo "3) Export logs"
  echo "4) Show full log"
  echo "5) Unfreeze system"
  echo "6) Exit"
  echo "--------------------------------"
  read -p "Select option: " C

  case "$C" in
    1) system_ping ;;
    2) log_event "MANUAL" "User triggered event" ;;
    3)
       OUT="$BASE_DIR/export_$(date +%Y%m%d_%H%M%S)_$LAST_HASH.txt"
       cp "$LOG_FILE" "$OUT"
       echo "Exported to $OUT"
       sleep 2
       ;;
    4) less "$LOG_FILE" ;;
    5)
       FROZEN=0
       flush_queue
       save_state
       log_event "CONTROL" "System unfrozen"
       ;;
    6) exit 0 ;;
  esac
}

### ==== LOOP ====
while true; do
  system_ping
  svc_scan
  selinux_check
  detect_anomaly
  menu
  sleep "$PING_INTERVAL"
done
