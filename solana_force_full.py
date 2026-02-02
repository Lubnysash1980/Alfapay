#!/usr/bin/env python3
# ==========================================================
# SOLANA FORCE — FULL ONE-FILE PYTHON (REAL FULL)
# ==========================================================

import os, json, time, subprocess, curses, hashlib, base64, sys

# ---------------- PATHS ----------------
BASE = ".secure_env"
LOCAL = f"{BASE}/local"
ENV = f"{BASE}/env"
KEYPAIR = "keys/admin.json"

STATE_FILE = "state.enc"
SWITCH_FILE = "switches.enc"
LOG_FILE = "actions.log"

SECRET_LOCAL = b"termux-force-secret-v1"
SECRET_ENV = b"env-backend-secret-v1"

for p in (LOCAL, ENV, "keys"):
    os.makedirs(p, exist_ok=True)

# ---------------- DEFAULTS ----------------
STATE_DEFAULT = {
    "owner": "",
    "mint": "",
    "decimals": 9,
    "max_supply": 4900000000000000,
    "minted_total": 0,
    "transfers_paused": False,
    "lp_locked": False,
    "timelock_until": 0
}

SWITCH_DEFAULT = {
    "create_token": True,
    "mint": True,
    "burn": True,
    "freeze": True,
    "transfer": True,
    "raydium": False,
    "emergency": False,
    "timelock": False
}

# ---------------- CRYPTO ----------------
def _key(secret): return hashlib.sha256(secret).digest()

def enc(data: bytes, secret: bytes) -> bytes:
    k = _key(secret)
    return base64.b64encode(bytes(b ^ k[i % len(k)] for i, b in enumerate(data)))

def dec(data: bytes, secret: bytes) -> bytes:
    raw = base64.b64decode(data)
    k = _key(secret)
    return bytes(b ^ k[i % len(k)] for i, b in enumerate(raw))

def save(path, name, obj, secret):
    with open(f"{path}/{name}", "wb") as f:
        f.write(enc(json.dumps(obj).encode(), secret))

def load(path, name, default, secret):
    fp = f"{path}/{name}"
    if not os.path.exists(fp):
        save(path, name, default, secret)
        return default.copy()
    return json.loads(dec(open(fp, "rb").read(), secret))

# ---------------- SYSTEM ----------------
def sh(cmd):
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return p.stdout.strip()

def log(msg):
    with open(f"{LOCAL}/{LOG_FILE}", "a") as f:
        f.write(f"{time.ctime()} | {msg}\n")

# ---------------- LOAD ----------------
state = load(LOCAL, STATE_FILE, STATE_DEFAULT, SECRET_LOCAL)
switches = load(LOCAL, SWITCH_FILE, SWITCH_DEFAULT, SECRET_LOCAL)

# ---------------- GUARD ----------------
def check(action):
    if switches["emergency"]:
        raise Exception("EMERGENCY ACTIVE")
    if switches["timelock"] and state["timelock_until"] > time.time():
        raise Exception("TIMELOCK ACTIVE")
    if not switches.get(action, False):
        raise Exception(f"BLOCKED: {action}")

# ---------------- FORCE CORE ----------------
def force_environment():
    if not state["owner"]:
        state["owner"] = sh(f"solana address -k {KEYPAIR}")

    if not state["mint"]:
        out = sh(f"spl-token create-token --decimals {state['decimals']} --owner {KEYPAIR}")
        state["mint"] = out.split()[-1]
        log("MINT CREATED")

    accs = sh(f"spl-token accounts --owner {KEYPAIR}")
    if state["mint"] not in accs:
        sh(f"spl-token create-account {state['mint']} --owner {KEYPAIR}")
        log("ATA CREATED")

    auth = sh(f"spl-token mint-authority {state['mint']}")
    if state["owner"] not in auth:
        raise Exception("YOU ARE NOT MINT AUTHORITY")

    supply = sh(f"spl-token supply {state['mint']}")
    supply = int(supply) if supply.isdigit() else 0
    state["minted_total"] = supply

    if supply == 0:
        sh(f"spl-token mint {state['mint']} 1000 --owner {KEYPAIR}")
        state["minted_total"] = 100
        log("FORCE MINT 100")

    persist()

def persist():
    save(LOCAL, STATE_FILE, state, SECRET_LOCAL)
    save(LOCAL, SWITCH_FILE, switches, SECRET_LOCAL)

# ---------------- ACTIONS ----------------
def mint(amount):
    check("mint")
    if state["minted_total"] + amount > state["max_supply"]:
        raise Exception("MAX SUPPLY")
    sh(f"spl-token mint {state['mint']} {amount} --owner {KEYPAIR}")
    state["minted_total"] += amount
    persist()

def burn(amount):
    check("burn")
    sh(f"spl-token burn {state['mint']} {amount}")
    state["minted_total"] -= amount
    persist()

def transfer(dest, amount):
    check("transfer")
    sh(f"spl-token transfer {state['mint']} {amount} {dest} --owner {KEYPAIR}")

def freeze(acc):
    check("freeze")
    sh(f"spl-token freeze {state['mint']} {acc}")

def unfreeze(acc):
    check("freeze")
    sh(f"spl-token thaw {state['mint']} {acc}")

def timelock(sec):
    switches["timelock"] = True
    state["timelock_until"] = time.time() + sec
    persist()

def emergency():
    switches["emergency"] = not switches["emergency"]
    persist()

def sync_env():
    save(ENV, STATE_FILE, state, SECRET_ENV)
    save(ENV, SWITCH_FILE, switches, SECRET_ENV)
    log("SYNC TO ENV")

# ---------------- MENU ----------------
MENU = [
    ("Force Environment", force_environment),
    ("Mint 100", lambda: mint(100)),
    ("Burn 50", lambda: burn(50)),
    ("Transfer", lambda: transfer(input("DEST: "), int(input("AMOUNT: ")))),
    ("Freeze Account", lambda: freeze(input("ACCOUNT: "))),
    ("Unfreeze Account", lambda: unfreeze(input("ACCOUNT: "))),
    ("Activate Timelock (1h)", lambda: timelock(3600)),
    ("Toggle Emergency", emergency),
    ("Sync ENV Backend", sync_env),
    ("Exit", None)
]

def ui(stdscr):
    curses.curs_set(0)
    idx = 0
    while True:
        stdscr.clear()
        stdscr.addstr(0, 2, "SOLANA FORCE — REAL FULL")
        for i, (t, _) in enumerate(MENU):
            attr = curses.A_REVERSE if i == idx else curses.A_NORMAL
            stdscr.addstr(2 + i, 2, t, attr)

        y = 2 + len(MENU) + 1
        for k, v in state.items():
            stdscr.addstr(y, 2, f"{k}: {v}")
            y += 1

        key = stdscr.getch()
        if key == curses.KEY_UP and idx > 0: idx -= 1
        elif key == curses.KEY_DOWN and idx < len(MENU)-1: idx += 1
        elif key in (10, 13):
            if MENU[idx][1] is None:
                break
            try:
                MENU[idx][1]()
            except Exception as e:
                stdscr.addstr(y+1, 2, f"ERROR: {e}")
                stdscr.getch()

if __name__ == "__main__":
    curses.wrapper(ui)
