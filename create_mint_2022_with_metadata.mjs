import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction
} from "@solana/web3.js";

import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeInstruction as createInitializeMetadataInstruction
} from "@solana/spl-token";

import fs from "fs";
import bs58 from "bs58";

// ===== CONFIG =====
const RPC_URL = "https://api.mainnet-beta.solana.com";
const DECIMALS = 9;
const SECRET_FILE = "./mint_secret_base58.txt";

// METADATA
const NAME = "IREN";
const SYMBOL = "R";
const URI = "https://lubnysash1980.github.io/Alfapay/metadata.json";

(async () => {
  const connection = new Connection(RPC_URL, "confirmed");

  console.log("🔑 Loading authority...");
  const secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
  const authority = Keypair.fromSecretKey(bs58.decode(secret));

  const mint = Keypair.generate();

  // extensions
  const extensions = [
    ExtensionType.MetadataPointer
  ];

  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  console.log("🪙 Creating mint with metadata...");

  const tx = new Transaction().add(
    // create mint account
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID
    }),

    // init metadata pointer
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      authority.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),

    // init mint
    createInitializeMintInstruction(
      mint.publicKey,
      DECIMALS,
      authority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    ),

    // init metadata
    createInitializeMetadataInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint.publicKey,
      updateAuthority: authority.publicKey,
      mint: mint.publicKey,
      mintAuthority: authority.publicKey,
      name: NAME,
      symbol: SYMBOL,
      uri: URI
    })
  );

  const sig = await connection.sendTransaction(
    tx,
    [authority, mint],
    { skipPreflight: false }
  );

  console.log("✅ SUCCESS");
  console.log("🆔 Mint:", mint.publicKey.toBase58());
  console.log("🔗 Tx:", sig);

  fs.writeFileSync("mint_address.txt", mint.publicKey.toBase58());
})();
