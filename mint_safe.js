#!/bin/bash

# ==== Налаштування ====
WORKDIR=~/solana_mint
MINT_SECRET_FILE="$WORKDIR/mint_secret_base58.txt"

echo "⏳ Оновлюємо Termux..."
pkg update -y && pkg upgrade -y

echo "⏳ Встановлюємо Node.js, git, wget..."
pkg install -y nodejs git wget

echo "⏳ Створюємо робочу папку $WORKDIR..."
mkdir -p "$WORKDIR"
cd "$WORKDIR" || exit

echo "⏳ Ініціалізуємо Node.js проект..."
npm init -y

# Додаємо type: "module" у package.json
sed -i 's/"version": "1.0.0"/"version": "1.0.0",\n  "type": "module"/' package.json

echo "⏳ Встановлюємо npm пакети..."
npm install @solana/web3.js @solana/spl-token bs58

echo "⏳ Створюємо скрипт mint_safe.js..."
cat > mint_safe.js <<'EOF'
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, mintTo } from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";

// ==== Налаштування ====
const MINT_SECRET_FILE = "./mint_secret_base58.txt";
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv";
const MINT_ADDRESS = "3JAPdR6DWQS2dgRzTeLESLXdRPy3rEfETRCa1UpLCNLSaEiCU4c8GHrhuwWKi2at6oTqBj1GiKbKHRPxLJfKeQaM";
const TOKEN_AMOUNT = 4900000000000000n;

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

(async () => {
  try {
    if (!fs.existsSync(MINT_SECRET_FILE)) {
      console.error("❌ Не знайдено mint_secret_base58.txt! Додайте файл і запустіть знову.");
      process.exit(1);
    }

    const mintSecretBase58 = fs.readFileSync(MINT_SECRET_FILE, "utf-8").trim();
    const mintAuthority = Keypair.fromSecretKey(bs58.decode(mintSecretBase58));
    const mintPublicKey = new PublicKey(MINT_ADDRESS);
    const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

    console.log("⏳ Перевірка SOL балансу mint wallet...");
    const solBalance = await connection.getBalance(mintAuthority.publicKey);
    console.log("💰 SOL баланс:", solBalance / 1e9, "SOL");

    console.log("⏳ Перевірка / створення token account отримувача...");
    const receiverTokenAccount = await getAssociatedTokenAddress(mintPublicKey, receiverPublicKey);

    const accountInfo = await connection.getAccountInfo(receiverTokenAccount);
    if (!accountInfo) {
      console.log("⚠️ Token account не знайдено, створюємо вручну...");
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          mintAuthority.publicKey,
          receiverTokenAccount,
          receiverPublicKey,
          mintPublicKey
        )
      );
      await connection.sendTransaction(tx, [mintAuthority], { skipPreflight: false, preflightCommitment: "confirmed" });
      console.log("✅ Token account створено:", receiverTokenAccount.toBase58());
    } else {
      console.log("✅ Token account вже існує:", receiverTokenAccount.toBase58());
    }

    console.log(`🚀 Мінт ${TOKEN_AMOUNT} токенів...`);
    const txMint = await mintTo(
      connection,
      mintAuthority,
      mintPublicKey,
      receiverTokenAccount,
      mintAuthority,
      TOKEN_AMOUNT
    );

    console.log("✅ Мінт успішний, tx:", txMint);

    const balanceInfo = await connection.getTokenAccountBalance(receiverTokenAccount);
    console.log("📊 Баланс отримувача:", balanceInfo.value.uiAmountString, "токенів");

    console.log("🎉 Готово! Токен мінт завершено.");
  } catch (error) {
    console.error("❌ Сталася помилка:", error);
  }
})();
EOF

echo "✅ Скрипт створено!"
echo "📌 Тепер додай файл mint_secret_base58.txt у $WORKDIR з Base58 ключем."
echo "🔹 Після цього скрипт автоматично запустить мінт, якщо файл існує:"
echo "cd $WORKDIR && node mint_safe.js"
