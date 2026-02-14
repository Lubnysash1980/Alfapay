import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction
} from "@solana/web3.js";

import {
  TOKEN_2022_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  mintTo,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";

import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction
} from "@metaplex-foundation/mpl-token-metadata";

import fs from "fs";

// ===== НАЛАШТУВАННЯ =====
const RPC_URL = "https://api.mainnet-beta.solana.com";
const SECRET_FILE = "./mint-authority.json"; // твій ключ
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv";

const NAME = "IREN";
const SYMBOL = "R";
const METADATA_URI = "https://lubnysash1980.github.io/Alfapay/metadata.json";

const DECIMALS = 9;
const AMOUNT = 1_000_000_000n; // 1 токен

(async () => {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // 🔑 Завантаження ключа
    const secretKeyArray = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
    const authority = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

    // 🪙 Створюємо mint
    const mintKeypair = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    const txMint = new Transaction().add(
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
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    const sigMint = await connection.sendTransaction(txMint, [authority, mintKeypair]);
    console.log("✅ Mint створено:", mintKeypair.publicKey.toBase58());
    console.log(`Explorer: https://explorer.solana.com/tx/${sigMint}?cluster=mainnet`);

    // 📦 Створюємо ATA вручну
    const receiverPubkey = new PublicKey(RECEIVER_WALLET);
    const ata = PublicKey.findProgramAddressSync(
      [
        receiverPubkey.toBuffer(),
        TOKEN_2022_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];

    const createAtaIx = createAssociatedTokenAccountInstruction(
      authority.publicKey,
      ata,
      receiverPubkey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    );

    const txAta = new Transaction().add(createAtaIx);
    const sigAta = await connection.sendTransaction(txAta, [authority]);
    console.log("✅ ATA створено:", ata.toBase58());
    console.log(`Explorer: https://explorer.solana.com/tx/${sigAta}?cluster=mainnet`);

    // 🚀 Мінтимо токени
    const sigMintToken = await mintTo(
      connection,
      authority,
      mintKeypair.publicKey,
      ata,
      authority,
      AMOUNT,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("🎉 Токени замінтовано!");
    console.log(`Explorer: https://explorer.solana.com/tx/${sigMintToken}?cluster=mainnet`);

    // 📝 Додаємо Metadata
    const metadataPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )[0];

    const metadataIx = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mintKeypair.publicKey,
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

    const txMeta = new Transaction().add(metadataIx);
    const sigMeta = await connection.sendTransaction(txMeta, [authority]);
    console.log("✅ Metadata додано!");
    console.log(`Explorer: https://explorer.solana.com/tx/${sigMeta}?cluster=mainnet`);

  } catch (e) {
    console.error("❌ ПОМИЛКА:", e);
  }
})();
