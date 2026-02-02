#!/data/data/com.termux/files/usr/bin/bash

# Перевірка аргументів
if [ $# -lt 1 ]; then
  echo "Використання: $0 <image.png>"
  exit 1
fi

# Зчитування QR-коду
zbarimg --raw "$1"
