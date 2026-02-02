#!/usr/bin/env node
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAccount, mintTo } from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";

// ==== Налаштування ====
const MINT_SECRET_FILE = "./mint_secret_base58.txt"; // Base58 секрет mint authority
const MINT_ADDRESS_FILE = "./mint_address.txt";      // Файл з mint address
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEb"; // Твій wallet
const TOKEN_AMOUNT = 4900000000000000n; // кількість токенів для домінту
const RPC_URL = "https://api.mainnet-beta.solana.com";
const RPC_RETRIES = 5;
const RPC_DELAY = 5000;

// ==== Token-2022 programId ====
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// ==== Підключення до RPC з retry ====
async function connectWithRetry(url) {
  for (let i = 1; i <= RPC_RETRIES; i++) {
    try {
      const conn = new Connection(url, "confirmed");
      await conn.getEpochInfo();
      console.log(`✅ Підключено до RPC: ${url}`);
      return conn;
    } catch (err) {
      console.warn(`⚠️ Спроба ${i} не вдалася: ${err.message}`);
      if (i < RPC_RETRIES) await new Promise(r => setTimeout(r, RPC_DELAY));
      else throw new Error("Не вдалося підключитися до RPC");
    }
  }
}

// ==== Завантаження mint authority ====
function loadMintAuthority() {
  const secretBase58 = fs.readFileSync(MINT_SECRET_FILE, "utf-8").trim();
  return Keypair.fromSecretKey(bs58.decode(secretBase58));
}

// ==== Чек SOL баланс ====
async function checkSolBalance(wallet, connection) {
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 SOL баланс: ${balance / 1e9} SOL`);
  if (balance < 0.002 * 1e9) throw new Error("Недостатньо SOL для створення ATA та транзакцій (~0.002 SOL)");
}

// ==== Створення або отримання ATA Token-2022 ====
async function getOrCreateToken2022Account(connection, mintPubkey, ownerPubkey, payer) {
  // Обчислюємо ATA
  const [ataAddress] = await PublicKey.findProgramAddress(
    [ownerPubkey.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  try {
    const account = await getAccount(connection, ataAddress, "confirmed", TOKEN_2022_PROGRAM_ID);
    console.log("✅ ATA вже існує:", ataAddress.toBase58());
    return account;
  } catch {
    console.log("🆕 ATA не існує — створюємо...");
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ataAddress,
        ownerPubkey,
        mintPubkey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log("✅ ATA створено:", ataAddress.toBase58());
    return { address: ataAddress };
  }
}

// ==== Домінт токенів ====
async function mintTokens(connection, mintPubkey, tokenAccountAddress, mintAuthority, amount) {
  const signature = await mintTo(
    connection,
    mintAuthority,
    mintPubkey,
    tokenAccountAddress,
    mintAuthority,
    amount,
    [],
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`🚀 Домінт успішний, tx: ${signature}`);
}

// ==== Main ====
(async () => {
  try {
    const connection = await connectWithRetry(RPC_URL);
    const mintAuthority = loadMintAuthority();
    await checkSolBalance(mintAuthority, connection);

    // Завантажуємо Mint
    if (!fs.existsSync(MINT_ADDRESS_FILE)) throw new Error("Файл mint_address.txt не знайдено!");
    const mintAddress = fs.readFileSync(MINT_ADDRESS_FILE, "utf-8").trim();
    const mintPubkey = new PublicKey(mintAddress);

    // Створюємо / отримуємо ATA
    const receiverPubkey = new PublicKey(RECEIVER_WALLET);
    const tokenAccount = await getOrCreateToken2022Account(connection, mintPubkey, receiverPubkey, mintAuthority);

    // Домінт
    console.log(`🚀 Домінтим ${TOKEN_AMOUNT} токенів...`);
    await mintTokens(connection, mintPubkey, tokenAccount.address, mintAuthority, TOKEN_AMOUNT);

    console.log("🎉 Домінт завершено!");
  } catch (err) {
    console.error("❌ Сталася помилка:", err);
  }
})();
