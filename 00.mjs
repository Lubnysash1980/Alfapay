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
  MINT_SIZE,
  getOrCreateAssociatedTokenAccount,
  mintTo
} from "@solana/spl-token";

import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction
} from "@metaplex-foundation/mpl-token-metadata";

import fs from "fs";

// ===== НАЛАШТУВАННЯ =====
const RPC_URL = "https://api.mainnet-beta.solana.com"; // mainnet
const SECRET_FILE = "./mint-authority.json";            // ключ для mint authority
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv";

// Метадані токена
const METADATA_URI = "https://lubnysash1980.github.io/Alfapay/metadata.json";
const NAME = "IREN";
const SYMBOL = "R";

// ⚠️ Мінімальна кількість токенів з decimals = 9
const DECIMALS = 9;
const AMOUNT = 1_000_000_000n; // 1 токен

(async () => {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // 🔑 Завантаження mint authority
    console.log("🔑 Loading authority...");
    const secretKeyArray = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
    const authority = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

    // Перевірка SOL балансу
    const balance = await connection.getBalance(authority.publicKey);
    console.log(`💰 SOL баланс: ${balance / 1e9}`);
    if (balance < 0.01 * 1e9) throw new Error("Недостатньо SOL для комісії.");

    // 🪙 Створюємо mint Token-2022
    console.log("🪙 Створюємо mint...");
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
        null,                // freeze authority
        TOKEN_2022_PROGRAM_ID
      )
    );

    const sigMint = await connection.sendTransaction(tx, [authority, mintKeypair]);
    console.log("✅ Mint створено!");
    console.log("🆔 Mint address:", mintKeypair.publicKey.toBase58());
    fs.writeFileSync("mint_address.txt", mintKeypair.publicKey.toBase58());
    console.log(`Explorer: https://explorer.solana.com/tx/${sigMint}?cluster=mainnet`);

    // 📦 Створюємо / перевіряємо ATA
    const receiverPubkey = new PublicKey(RECEIVER_WALLET);
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,           // payer
      mintKeypair.publicKey,
      receiverPubkey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("✅ ATA:", ata.address.toBase58());

    // 🚀 Мінт 1 токена
    const sigMintToken = await mintTo(
      connection,
      authority,            // payer
      mintKeypair.publicKey,
      ata.address,
      authority,            // mint authority
      AMOUNT,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("🎉 1 токен замінтовано!");
    console.log(`Explorer: https://explorer.solana.com/tx/${sigMintToken}?cluster=mainnet`);

    // 📊 Баланс токена
    const bal = await connection.getTokenAccountBalance(ata.address, "confirmed");
    console.log("📊 Баланс:", bal.value.uiAmountString);

    // 🖼 Додаємо Metadata для fungible токена
    console.log("📝 Додаємо Metadata...");

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
