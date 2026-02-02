#!/bin/bash

# ==== Налаштування ====
MINT_WALLET="6UfuPitEsgrfC28EskXkrrqnKt5JTp8rMNd7SYAUfvrd"
MINT_SECRET="$HOME/mint_secret_base58.txt"   # шлях до Base58 секрету mint authority
MINT_TOKEN="3JAPdR6DWQS2dgRzTeLESLXdRPy3rEfETRCa1UpLCNLSaEiCU4c8GHrhuwWKi2at6oTqBj1GiKbKHRPxLJfKeQaM"
RECEIVER="EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv"
TOKEN_AMOUNT=4900000000000000  # кількість токенів для mint

# ==== Перевірка встановлення CLI ====
if ! command -v solana &> /dev/null || ! command -v spl-token &> /dev/null; then
  echo "❌ Solana CLI або spl-token не встановлені."
  echo "Встановіть їх через: https://docs.solana.com/cli/install-solana-cli-tools"
  exit 1
fi

# ==== Перевірка балансу SOL ====
SOL_BALANCE=$(solana balance "$MINT_WALLET" | awk '{print $1}')
echo "💰 SOL баланс mint wallet: $SOL_BALANCE SOL"
if (( $(echo "$SOL_BALANCE < 0.005" | bc -l) )); then
  echo "⚠️ На рахунку мало SOL для комісій. Поповніть мінімум 0.005 SOL."
  exit 1
fi

# ==== Створення або перевірка ATA ====
echo "⏳ Перевірка / створення token account отримувача..."
RECEIVER_ATA=$(spl-token accounts --owner "$RECEIVER" | grep "$MINT_TOKEN" | awk '{print $1}')

if [ -z "$RECEIVER_ATA" ]; then
  echo "⚠️ Token account не знайдено. Створюємо ATA..."
  RECEIVER_ATA=$(spl-token create-account "$MINT_TOKEN" --owner "$RECEIVER" | awk '{print $NF}')
  echo "✅ ATA створено: $RECEIVER_ATA"
else
  echo "✅ ATA вже існує: $RECEIVER_ATA"
fi

# ==== Мінт токенів ====
echo "🚀 Мінт $TOKEN_AMOUNT токенів на $RECEIVER_ATA..."
spl-token mint "$MINT_TOKEN" "$TOKEN_AMOUNT" --owner "$MINT_SECRET" --fund-recipient "$RECEIVER_ATA"

echo "🎉 Мінт завершено!"
spl-token balance "$RECEIVER_ATA"
