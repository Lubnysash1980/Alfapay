chmod +x android_toolkit.sh
./android_toolkit.sh#!/data/data/com.termux/files/usr/bin/bash

clear
echo "===================================="
echo " ANDROID DIAGNOSTIC & SECURITY MENU "
echo "===================================="
echo "1) System info (Android / kernel / SELinux)"
echo "2) Bluetooth diagnostics & reset"
echo "3) Developer options reset"
echo "4) Security status (bootloader / encryption / SELinux)"
echo "5) Hardware diagnostics (CPU / RAM / thermal / battery)"
echo "6) Network & radio status"
echo "7) Performance tuning (safe)"
echo "8) Logcat viewer"
echo "9) Exit"
echo "------------------------------------"
read -p "Select option: " opt

case $opt in

1)
  adb shell getprop | grep -E "ro.build|ro.product|ro.hardware|ro.boot"
  adb shell uname -a
  adb shell sestatus
  ;;

2)
  echo "[Bluetooth reset]"
  adb shell pm clear com.android.bluetooth
  adb shell pm clear com.android.bluetoothmidiservice
  adb reboot
  ;;

3)
  echo "[Reset Developer Options]"
  adb shell settings delete global development_settings_enabled
  adb reboot
  ;;

4)
  echo "[Security status]"
  adb shell getprop ro.boot.flash.locked
  adb shell getprop ro.boot.verifiedbootstate
  adb shell getprop ro.crypto.state
  adb shell sestatus
  ;;

5)
  echo "[Hardware diagnostics]"
  adb shell cat /proc/cpuinfo | head
  adb shell free -h
  adb shell dumpsys thermalservice
  adb shell dumpsys battery
  ;;

6)
  echo "[Network & radio]"
  adb shell dumpsys connectivity
  adb shell dumpsys telephony.registry
  adb shell dumpsys wifi
  ;;

7)
  echo "[Safe performance tuning]"
  adb shell settings put global animator_duration_scale 0.5
  adb shell settings put global transition_animation_scale 0.5
  adb shell settings put global window_animation_scale 0.5
  echo "Done (reversible)"
  ;;

8)
  adb logcat | head -n 200
  ;;

9)
  exit
  ;;

*)
  echo "Invalid option"
  ;;
esac
