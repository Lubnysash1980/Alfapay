import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo
} from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";

// ===== НАЛАШТУВАННЯ =====
const RPC_URL = "https://api.mainnet-beta.solana.com";

// СКІЛЬКИ ДОМІНТИТИ (49e15)
const AMOUNT = 49_000_000_000_000_000n; // raw (BigInt)

// ОТРИМУВАЧ
const RECEIVER = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv";

// ФАЙЛИ
const MINT_SECRET_FILE = "./mint_secret_base58.txt";
const MINT_ADDRESS_FILE = "./mint_address.txt";

// =======================

(async () => {
  try {
    console.log("🔑 Завантаження mint authority...");
    const secret = fs.readFileSync(MINT_SECRET_FILE, "utf8").trim();
    const mintAuthority = Keypair.fromSecretKey(bs58.decode(secret));

    const mintAddress = new PublicKey(
      fs.readFileSync(MINT_ADDRESS_FILE, "utf8").trim()
    );

    const connection = new Connection(RPC_URL, "confirmed");

    const sol = await connection.getBalance(mintAuthority.publicKey);
    console.log("💰 SOL баланс:", sol / 1e9);
    if (sol < 0.002 * 1e9) throw new Error("Недостатньо SOL");

    console.log("📦 Отримуємо / створюємо ATA...");
    const receiverPk = new PublicKey(RECEIVER);

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,   // payer
      mintAddress,     // mint
      receiverPk       // owner
    );

    console.log("✅ ATA:", ata.address.toBase58());

    console.log("🚀 Домінтимо токени...");
    const tx = await mintTo(
      connection,
      mintAuthority,
      mintAddress,
      ata.address,
      mintAuthority,
      AMOUNT
    );

    console.log("🎉 ГОТОВО!");
    console.log("🔗 Tx:", tx);
    console.log("🪙 Домінчено:", AMOUNT.toString());

  } catch (e) {
    console.error("❌ ПОМИЛКА:", e.message ?? e);
  }
})();
