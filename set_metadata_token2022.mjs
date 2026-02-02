import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction
} from "@solana/web3.js";

import {
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

import {
  createInitializeInstruction,
  createUpdateInstruction
} from "@solana/spl-token-metadata";

import fs from "fs";

const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);

const MINT = new PublicKey(
  "tNKTSniyrizhKQSQNzQWE2vnrnGtUEYnh4LNrMCg8xA"
);

const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("mint-authority.json")))
);

// 🔗 URL на metadata.json (ОБОВʼЯЗКОВО ПРЯМИЙ)
const METADATA_URI =
  "PASTE_METADATA_JSON_URL_HERE";

(async () => {
  console.log("🔑 Authority:", payer.publicKey.toBase58());

  const tx = new Transaction().add(
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: MINT,
      updateAuthority: payer.publicKey,
      mint: MINT,
      mintAuthority: payer.publicKey,
      name: "Dii",
      symbol: "D",
      uri: METADATA_URI
    })
  );

  const sig = await sendAndConfirmTransaction(
    connection,
    tx,
    [payer]
  );

  console.log("✅ Metadata привʼязано");
  console.log("🔗 Tx:", sig);
})();
