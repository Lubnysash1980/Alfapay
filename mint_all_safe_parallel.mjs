#!/usr/bin/env node
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getAccount,
  createAssociatedTokenAccountInstruction,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";

// ==== Налаштування ====
const MINT_SECRET_FILE = "./mint_secret_base58.txt";
const MINT_ADDRESS_FILE = "./mint_address.txt";
const RECEIVERS_FILE = "./receivers.txt"; 
const TOKEN_AMOUNT = 4900000000000000;
const RPC_URL = "https://api.mainnet-beta.solana.com";
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const MAX_RETRIES = 3;
const PARALLEL_LIMIT = 5; // одночасних транзакцій

// ==== Підключення ====
async function connectWithRetry(url) {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const conn = new Connection(url, "confirmed");
      await conn.getEpochInfo();
      console.log(`✅ Підключено до RPC: ${url}`);
      return conn;
    } catch (err) {
      console.warn(`⚠️ Спроба ${i} підключення до RPC не вдалася: ${err.message}`);
      if (i < MAX_RETRIES) await new Promise(r => setTimeout(r, 5000));
      else throw new Error("Не вдалося підключитися після кількох спроб");
    }
  }
}

// ==== Перевірка SOL ====
async function checkSolBalance(wallet, connection) {
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 SOL баланс mint wallet: ${balance} (~${balance / 1e9} SOL)`);
  if (balance < 0.002 * 1e9) throw new Error("Недостатньо SOL (~0.002 SOL мінімум)");
}

// ==== Отримати або створити ATA ====
async function getOrCreateATA(connection, mintKeypair, mintPubkey, ownerPubkey) {
  const ataFile = `ata_${ownerPubkey.toBase58()}.txt`;
  let ataAddress;

  if (fs.existsSync(ataFile)) {
    ataAddress = new PublicKey(fs.readFileSync(ataFile, "utf-8").trim());
    try {
      await getAccount(connection, ataAddress, TOKEN_2022_PROGRAM_ID);
      return ataAddress;
    } catch {}
  }

  [ataAddress] = await PublicKey.findProgramAddress(
    [ownerPubkey.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  try {
    await getAccount(connection, ataAddress, TOKEN_2022_PROGRAM_ID);
    fs.writeFileSync(ataFile, ataAddress.toBase58());
    return ataAddress;
  } catch {}

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      mintKeypair.publicKey,
      ataAddress,
      ownerPubkey,
      mintPubkey,
      TOKEN_2022_PROGRAM_ID
    )
  );
  await sendAndConfirmTransaction(connection, tx, [mintKeypair]);
  fs.writeFileSync(ataFile, ataAddress.toBase58());
  return ataAddress;
}

// ==== Mint з retry ====
async function mintTokens(connection, mintKeypair, mintPubkey, ataAddress) {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await mintTo(connection, mintKeypair, mintPubkey, ataAddress, mintKeypair, TOKEN_AMOUNT, [], TOKEN_2022_PROGRAM_ID);
      return true;
    } catch (err) {
      console.warn(`⚠️ Mint спроба ${i}/${MAX_RETRIES} не вдалася: ${err.message}`);
      if (i < MAX_RETRIES) await new Promise(r => setTimeout(r, 3000));
      else return false;
    }
  }
}

// ==== Паралельний обробник ====
async function processReceiver(connection, mintKeypair, mintPublicKey, receiver) {
  try {
    const ownerPubkey = new PublicKey(receiver);
    console.log(`📦 Обробляємо отримувача: ${receiver}`);

    const ataAddress = await getOrCreateATA(connection, mintKeypair, mintPublicKey, ownerPubkey);
    console.log(`✅ ATA: ${ataAddress.toBase58()}`);

    const success = await mintTokens(connection, mintKeypair, mintPublicKey, ataAddress);
    if (success) {
      console.log(`🎉 УСПІХ! ${TOKEN_AMOUNT} токенів надіслано до ${receiver}`);
      const balance = await connection.getTokenAccountBalance(ataAddress);
      console.log(`📊 Баланс отримувача: ${balance.value.uiAmountString} токенів\n`);
    } else {
      console.error(`❌ Не вдалося надіслати токени після ${MAX_RETRIES} спроб: ${receiver}\n`);
    }
  } catch (err) {
    console.error(`❌ Помилка для ${receiver}: ${err.message}\n`);
  }
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

    const receivers = fs.readFileSync(RECEIVERS_FILE, "utf-8")
      .split("\n")
      .map(r => r.trim())
      .filter(r => r.length > 0);

    // Паралельна обробка з обмеженням PARALLEL_LIMIT
    for (let i = 0; i < receivers.length; i += PARALLEL_LIMIT) {
      const chunk = receivers.slice(i, i + PARALLEL_LIMIT);
      await Promise.all(chunk.map(r => processReceiver(connection, mintKeypair, mintPublicKey, r)));
    }

    console.log("✅ Всі одержувачі оброблені.");
  } catch (err) {
    console.error("❌ Глобальна помилка:", err.message);
  }
})();
