import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction
} from "@solana/web3.js";

import {
  createInitializeMintInstruction,
  TOKEN_2022_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE
} from "@solana/spl-token";

import fs from "fs";
import bs58 from "bs58";

// ===== НАЛАШТУВАННЯ =====
const RPC_URL = "https://api.mainnet-beta.solana.com";
const DECIMALS = 9; // стандарт
const SECRET_FILE = "./mint_secret_base58.txt";

(async () => {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    console.log("🔑 Завантаження mint authority...");
    const secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
    const authority = Keypair.fromSecretKey(bs58.decode(secret));

    const balance = await connection.getBalance(authority.publicKey);
    console.log("💰 SOL баланс:", balance / 1e9);

    if (balance < 0.002 * 1e9) {
      throw new Error("Недостатньо SOL");
    }

    console.log("🪙 Створюємо MINT (Token-2022)...");
    const mintKeypair = Keypair.generate();

    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        DECIMALS,
        authority.publicKey, // mint authority
        null,                // freeze authority (null = immutable)
        TOKEN_2022_PROGRAM_ID
      )
    );

    const sig = await connection.sendTransaction(
      tx,
      [authority, mintKeypair],
      { skipPreflight: false }
    );

    console.log("✅ MINT СТВОРЕНО!");
    console.log("🆔 Mint address:", mintKeypair.publicKey.toBase58());
    console.log("🔗 Tx:", sig);

    fs.writeFileSync(
      "mint_address.txt",
      mintKeypair.publicKey.toBase58()
    );

    console.log("📄 Збережено у mint_address.txt");
  } catch (e) {
    console.error("❌ ПОМИЛКА:", e);
  }
})();
