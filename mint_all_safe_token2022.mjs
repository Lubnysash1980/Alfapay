#!/usr/bin/env node
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";

// ==== Налаштування ====
const MINT_SECRET_FILE = "./mint_secret_base58.txt"; // Base58 секрет mint authority
const MINT_ADDRESS_FILE = "./mint_address.txt";      // Файл з адресою MINT
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv"; // куди домінтити токени
const TOKEN_AMOUNT = 4900000000000000n;              // скільки токенів домінтити
const RPC_URL = "https://api.mainnet-beta.solana.com";
const RPC_RETRIES = 5;
const RPC_DELAY = 5000; // мс

// ==== Підключення з retry ====
async function connectWithRetry(url) {
  for (let i = 1; i <= RPC_RETRIES; i++) {
    try {
      const conn = new Connection(url, "confirmed");
      await conn.getEpochInfo();
      console.log(`✅ Підключено до RPC: ${url}`);
      return conn;
    } catch (err) {
      console.warn(`⚠️ Не вдалося підключитись до RPC (спроба ${i}/${RPC_RETRIES}): ${err.message}`);
      if (i < RPC_RETRIES) await new Promise(r => setTimeout(r, RPC_DELAY));
      else throw new Error("Не вдалося підключитися до RPC після кількох спроб");
    }
  }
}

// ==== Перевірка SOL балансу ====
async function checkSolBalance(wallet, connection) {
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 SOL баланс mint wallet: ${balance} (~${balance / 1e9} SOL)`);
  if (balance < 0.002 * 1e9) throw new Error("Недостатньо SOL для транзакцій (~0.002 SOL мінімум)");
}

// ==== Основна логіка ====
(async () => {
  try {
    const connection = await connectWithRetry(RPC_URL);

    console.log("🔑 Завантаження mint authority...");
    const mintSecretBase58 = fs.readFileSync(MINT_SECRET_FILE, "utf-8").trim();
    const mintKeypair = Keypair.fromSecretKey(bs58.decode(mintSecretBase58));
    const mintPublicKey = new PublicKey(fs.readFileSync(MINT_ADDRESS_FILE, "utf-8").trim());

    await checkSolBalance(mintKeypair, connection);

    console.log("📦 Отримуємо / створюємо ATA для Token-2022...");
    const receiverPublicKey = new PublicKey(RECEIVER_WALLET);

    let receiverTokenAccount;
    try {
      // Спроба отримати ATA автоматично
      receiverTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintKeypair,
        mintPublicKey,
        receiverPublicKey,
        false,
        "confirmed",
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      console.log("✅ ATA знайдено/створено:", receiverTokenAccount.address.toBase58());
    } catch (err) {
      console.warn("⚠️ Не вдалося автоматично створити ATA. Спробуємо вручну...");

      const [ataAddress] = await PublicKey.findProgramAddress(
        [receiverPublicKey.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mintPublicKey.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          mintKeypair.publicKey, // payer
          ataAddress,            // new account
          receiverPublicKey,     // owner
          mintPublicKey,         // mint
          TOKEN_2022_PROGRAM_ID
        )
      );

      await sendAndConfirmTransaction(connection, tx, [mintKeypair], { skipPreflight: false, preflightCommitment: "confirmed" });
      receiverTokenAccount = { address: ataAddress };
      console.log("✅ ATA створено вручну:", ataAddress.toBase58());
    }

    console.log(`🚀 Домінт ${TOKEN_AMOUNT} токенів...`);
    const txMint = await mintTo(
      connection,
      mintKeypair,
      mintPublicKey,
      receiverTokenAccount.address,
      mintKeypair,
      TOKEN_AMOUNT,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    console.log("🎉 УСПІХ! Tx:", txMint);

    const balance = await connection.getTokenAccountBalance(receiverTokenAccount.address);
    console.log("📊 Баланс отримувача:", balance.value.uiAmountString, "токенів");
  } catch (error) {
    console.error("❌ Сталася помилка:", error);
  }
})();
