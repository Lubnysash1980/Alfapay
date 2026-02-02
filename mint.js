import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";

// ===== НАЛАШТУВАННЯ =====
const RPC_URL = "https://api.mainnet-beta.solana.com";
const MINT_SECRET_FILE = "./mint_secret_base58.txt";
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv";
const TOKEN_AMOUNT = 4900000000000000n; // BigInt обовʼязково для Token-2022

// =======================

const connection = new Connection(RPC_URL, "confirmed");

(async () => {
  try {
    console.log("⏳ Завантаження mint authority...");
    const secret = fs.readFileSync(MINT_SECRET_FILE, "utf8").trim();
    const mintAuthority = Keypair.fromSecretKey(bs58.decode(secret));
    const mintPubkey = mintAuthority.publicKey;

    const sol = await connection.getBalance(mintAuthority.publicKey);
    console.log(`💰 SOL баланс: ${sol / 1e9} SOL`);
    if (sol < 2_000_000) throw new Error("Недостатньо SOL");

    const owner = new PublicKey(RECEIVER_WALLET);

    console.log("⏳ Обчислюємо ATA (Token-2022)...");
    const ata = getAssociatedTokenAddressSync(
      mintPubkey,
      owner,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const info = await connection.getAccountInfo(ata);
    if (!info) {
      console.log("🆕 ATA не існує — створюємо...");
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          mintAuthority.publicKey,
          ata,
          owner,
          mintPubkey,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
      await connection.sendTransaction(tx, [mintAuthority]);
      console.log("✅ ATA створено:", ata.toBase58());
    } else {
      console.log("✅ ATA вже існує:", ata.toBase58());
    }

    console.log("🚀 Мінтимо токени...");
    const sig = await mintTo(
      connection,
      mintAuthority,
      mintPubkey,
      ata,
      mintAuthority,
      TOKEN_AMOUNT,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.log("✅ Мінт успішний!");
    console.log("🔗 TX:", sig);

  } catch (e) {
    console.error("❌ ПОМИЛКА:", e);
  }
})();
