import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";

import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";

import fs from "fs";
import bs58 from "bs58";

// === Налаштування ===
const MINT_SECRET_FILE = "./mint_secret_base58.txt"; // Base58 секрет mint authority
const MINT_ADDRESS_FILE = "./mint_address.txt"; // збережений mint
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv"; // гаманець отримувача
const TOTAL_MINT = 4900000000000000n; // кількість токенів для домінту
const RPC_URL = "https://api.mainnet-beta.solana.com";

// === Підключення до RPC ===
const connection = new Connection(RPC_URL, "confirmed");

(async () => {
  try {
    console.log("🔑 Завантаження mint authority...");
    const mintSecret = fs.readFileSync(MINT_SECRET_FILE, "utf-8").trim();
    const mintKeypair = Keypair.fromSecretKey(bs58.decode(mintSecret));

    // Завантаження mint з файлу
    if (!fs.existsSync(MINT_ADDRESS_FILE)) throw new Error("Файл mint_address.txt не знайдено!");
    const mintAddress = fs.readFileSync(MINT_ADDRESS_FILE, "utf-8").trim();
    const mintPublicKey = new PublicKey(mintAddress);

    // Перевірка SOL
    const solBalance = await connection.getBalance(mintKeypair.publicKey);
    console.log(`💰 SOL баланс: ${solBalance / 1e9} SOL`);
    if (solBalance < 0.002 * 1e9) throw new Error("Недостатньо SOL для транзакцій");

    console.log("📦 Отримуємо / створюємо ATA...");
    const receiverPubkey = new PublicKey(RECEIVER_WALLET);
    let receiverTokenAccount;
    try {
      receiverTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        mintKeypair,
        mintPublicKey,
        receiverPubkey,
        false,
        "confirmed",
        undefined,
        TOKEN_2022_PROGRAM_ID // ⚠️ Token-2022
      );
      console.log("✅ ATA готовий:", receiverTokenAccount.address.toBase58());
    } catch (err) {
      // Створення ATA вручну
      console.log("🆕 ATA не існує — створюємо вручну...");
      const [ataAddress] = await PublicKey.findProgramAddress(
        [
          receiverPubkey.toBuffer(),
          TOKEN_2022_PROGRAM_ID.toBuffer(),
          mintPublicKey.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          mintKeypair.publicKey,
          ataAddress,
          receiverPubkey,
          mintPublicKey,
          TOKEN_2022_PROGRAM_ID
        )
      );

      await sendAndConfirmTransaction(connection, tx, [mintKeypair]);
      receiverTokenAccount = { address: ataAddress };
      console.log("✅ ATA створено вручну:", ataAddress.toBase58());
    }

    console.log(`🚀 Домінт ${TOTAL_MINT} токенів...`);
    const tx = await mintTo(
      connection,
      mintKeypair,
      mintPublicKey,
      receiverTokenAccount.address,
      mintKeypair,
      TOTAL_MINT,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    console.log("🎉 УСПІХ! Tx:", tx);

    const balance = await connection.getTokenAccountBalance(receiverTokenAccount.address);
    console.log("📊 Баланс отримувача:", balance.value.uiAmountString, "токенів");

  } catch (error) {
    console.error("❌ ПОМИЛКА:", error);
  }
})();
