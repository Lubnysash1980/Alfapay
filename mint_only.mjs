import {
  Connection,
  Keypair,
  PublicKey,
  Transaction
} from "@solana/web3.js";

import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

import fs from "fs";

// ====== НАЛАШТУВАННЯ ======
const RPC = "https://api.devnet.solana.com"; // або mainnet
const MINT = "ВСТАВ_MINT_ADDRESS";
const DECIMALS = 9;
const AMOUNT = 1n * 10n ** 9n; // 1 токен
// =========================

(async () => {
  console.log("🔑 Loading authority...");
  const secret = JSON.parse(fs.readFileSync("./mint-authority.json"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(secret));

  const connection = new Connection(RPC, "confirmed");
  const mint = new PublicKey(MINT);

  const balance = await connection.getBalance(authority.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL");
  if (balance < 0.005 * 1e9) throw "❌ Not enough SOL";

  const ata = await getAssociatedTokenAddress(
    mint,
    authority.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction();

  if (!(await connection.getAccountInfo(ata))) {
    console.log("➕ Creating ATA");
    tx.add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        ata,
        authority.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  console.log("🪙 Minting token...");
  tx.add(
    createMintToInstruction(
      mint,
      ata,
      authority.publicKey,
      AMOUNT,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log("🧪 Simulating...");
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    console.error("❌ SIMULATION ERROR");
    console.error(sim.value.logs);
    return;
  }

  const sig = await connection.sendTransaction(tx, [authority]);
  console.log("✅ MINT SUCCESS");
  console.log("🔗 TX:", sig);
  console.log("📦 ATA:", ata.toBase58());
})();
