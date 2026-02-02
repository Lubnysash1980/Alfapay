import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";

// ==== Налаштування ====
const MINT_SECRET_FILE = "./mint_secret_base58.txt"; // Base58 секрет mint authority
const MINT_ADDRESS_FILE = "./mint_address.txt"; // Адреса твоїх токенів
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv";
const TOKEN_AMOUNT = 4900000000000000n; // 49e15 токенів
const RPC_URL = "https://api.mainnet-beta.solana.com";

// ==== Підключення до RPC ====
async function connectRpc() {
  const connection = new Connection(RPC_URL, "confirmed");
  await connection.getEpochInfo();
  console.log("✅ Підключено до RPC");
  return connection;
}

// ==== Завантаження ключа mint authority ====
function loadMintKeypair() {
  const base58 = fs.readFileSync(MINT_SECRET_FILE, "utf-8").trim();
  const keypair = Keypair.fromSecretKey(bs58.decode(base58));
  console.log("🔑 Mint authority завантажено");
  return keypair;
}

// ==== Отримання адреси MINT ====
function loadMintAddress() {
  const addr = fs.readFileSync(MINT_ADDRESS_FILE, "utf-8").trim();
  return new PublicKey(addr);
}

// ==== Перевірка SOL ====
async function checkSolBalance(wallet, connection) {
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 SOL баланс: ${balance / 1e9} SOL`);
  if (balance < 0.002 * 1e9) throw new Error("Недостатньо SOL для транзакцій");
}

// ==== Головна функція ====
(async () => {
  try {
    const connection = await connectRpc();
    const mintKeypair = loadMintKeypair();
    const mintPubkey = loadMintAddress();
    await checkSolBalance(mintKeypair, connection);

    console.log("📦 Отримуємо / створюємо ATA...");
    const receiverPubkey = new PublicKey(RECEIVER_WALLET);

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      mintKeypair,       // payer
      mintPubkey,        // mint
      receiverPubkey,    // owner
      false,             // allowOwnerOffCurve
      "confirmed",
      undefined,
      TOKEN_PROGRAM_ID   // Використовуємо правильний program id
    );

    console.log("✅ ATA готовий:", ata.address.toBase58());

    console.log(`🚀 Домінтимо ${TOKEN_AMOUNT} токенів...`);
    const tx = await mintTo(
      connection,
      mintKeypair,
      mintPubkey,
      ata.address,
      mintKeypair,
      TOKEN_AMOUNT
    );

    console.log("🎉 Успіх! Транзакція:", tx);
    const balance = await connection.getTokenAccountBalance(ata.address);
    console.log("📊 Баланс отримувача:", balance.value.uiAmountString);
  } catch (err) {
    console.error("❌ ПОМИЛКА:", err);
  }
})();
