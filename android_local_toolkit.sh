#!/data/data/com.termux/files/usr/bin/bash

clear
echo "======================================"
echo " ANDROID LOCAL DIAGNOSTIC TOOLKIT "
echo " (SAFE, NO ROOT, NO ADB) "
echo "======================================"
echo "1) System & build info"
echo "2) Security status"
echo "3) Hardware & thermal"
echo "4) Battery health"
echo "5) Network & radio"
echo "6) Audio / Bluetooth status"
echo "7) Logs (filtered)"
echo "8) Exit"
echo "--------------------------------------"
read -p "Select option: " opt

case $opt in

1)
  echo "--- System info ---"
  getprop | grep -E "ro.build|ro.product|ro.hardware|ro.boot"
  uname -a
  ;;

2)
  echo "--- Security status ---"
  echo "SELinux enforcing (cannot access directly on non-rooted device)"
  getprop ro.boot.verifiedbootstate
  getprop ro.boot.flash.locked
  getprop ro.crypto.state
  ;;

3)
  echo "--- Hardware & thermal ---"
  cat /proc/cpuinfo | head
  free -h
  dumpsys thermalservice 2>/dev/null | head
  ;;

4)
  echo "--- Battery health ---"
  dumpsys battery
  ;;

5)
  echo "--- Network & radio ---"
  dumpsys connectivity | head
  dumpsys wifi | head
  dumpsys telephony.registry | head
  ;;

6)
  echo "--- Audio / Bluetooth ---"
  dumpsys bluetooth_manager 2>/dev/null | head
  dumpsys audio | grep -i a2dp | head
  ;;

7)
  echo "--- Logs (last 50 lines, filtered) ---"
  logcat -d | grep -iE "audio|bluetooth|thermal|selinux" | tail -n 50
  ;;

8)
  echo "Exiting..."
  exit
  ;;

*)
  echo "Invalid option"
  ;;
esac
