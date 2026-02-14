// add-metadata.mjs
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction
} from "@solana/web3.js";

import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction
} from "@metaplex-foundation/mpl-token-metadata";

import fs from "fs";

// ===== НАЛАШТУВАННЯ =====
const RPC_URL = "https://api.mainnet-beta.solana.com"; // або devnet для тестів
const SECRET_FILE = "./mint-authority.json";           // твій ключ
const MINT_ADDRESS = "ТВОЯ_MINT_АДРЕСА";               // існуючий токен

// Метадані
const METADATA_URI = "https://lubnysash1980.github.io/Alfapay/metadata.json";
const NAME = "IREN";
const SYMBOL = "R";

(async () => {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // 🔑 Завантаження ключа
    const secretKeyArray = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
    const authority = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

    const mintPubkey = new PublicKey(MINT_ADDRESS);

    // 📌 Знаходимо PDA для Metadata
    const metadataPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintPubkey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )[0];

    // 📝 Інструкція створення Metadata
    const metadataIx = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mintPubkey,
        mintAuthority: authority.publicKey,
        payer: authority.publicKey,
        updateAuthority: authority.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: NAME,
            symbol: SYMBOL,
            uri: METADATA_URI,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
          },
          isMutable: true,
        },
      }
    );

    // 🚀 Відправляємо транзакцію
    const txMeta = new Transaction().add(metadataIx);
    const sigMeta = await connection.sendTransaction(txMeta, [authority]);

    console.log("✅ Metadata додано!");
    console.log(`Explorer: https://explorer.solana.com/tx/${sigMeta}?cluster=mainnet`);
  } catch (e) {
    console.error("❌ ПОМИЛКА:", e);
  }
})();
