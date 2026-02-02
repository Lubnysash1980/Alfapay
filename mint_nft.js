import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";
import path from "path";

// === Налаштування ===
const MINT_SECRET_FILE = "./mint_secret_base58.txt"; // Base58 ключ mint authority
const MINT_ADDRESS_FILE = "./mint_address.txt";      // Адреса MINT
const RECEIVER_WALLET = "EPEhVVhY7AXzWqcJeidWNuBqNbGDjJF35JzPVFXEbYxv";
const TOKEN_AMOUNT = 49000000000000000n; // Домінт всі токени
const RPC_URL = "https://api.mainnet-beta.solana.com";
const PNG_PATH = "./nft_image.png"; // Шлях до PNG для NFT

// === Підключення ===
const connection = new Connection(RPC_URL, "confirmed");

// === Завантаження ключів ===
const mintSecretBase58 = fs.readFileSync(MINT_SECRET_FILE, "utf-8").trim();
const mintKeypair = Keypair.fromSecretKey(bs58.decode(mintSecretBase58));
const mintAddress = fs.readFileSync(MINT_ADDRESS_FILE, "utf-8").trim();
const mintPublicKey = new PublicKey(mintAddress);

// === Папка для JSON метаданих ===
const metadataDir = "./metadata";
if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir);

// === Основна функція ===
async function main() {
  try {
    // Перевірка SOL балансу
    const solBalance = await connection.getBalance(mintKeypair.publicKey);
    console.log("💰 SOL баланс mint wallet:", solBalance / 1e9, "SOL");
    if (solBalance < 0.05 * 1e9) {
      throw new Error("Недостатньо SOL для домінту (~0.05 SOL мінімум)");
    }

    // Створення/отримання ATA
    console.log("📦 Отримуємо / створюємо ATA...");
    const receiverPublicKey = new PublicKey(RECEIVER_WALLET);
    const receiverTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      mintKeypair,
      mintPublicKey,
      receiverPublicKey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("✅ ATA готовий:", receiverTokenAccount.address.toBase58());

    // Домінт
    console.log(`🚀 Домінт ${TOKEN_AMOUNT} токенів...`);
    const txMint = await mintTo(
      connection,
      mintKeypair,
      mintPublicKey,
      receiverTokenAccount.address,
      mintKeypair,
      TOKEN_AMOUNT,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    console.log("🎉 Домінт успішний, tx:", txMint);

    // Генерація JSON метаданих для NFT
    console.log("📄 Генеруємо метадані для NFT...");
    const nftMetadata = {
      name: "My Token NFT",
      symbol: "MTKN",
      description: "NFT, пов’язаний з домінтом токенів на Solana",
      image: path.basename(PNG_PATH),
      attributes: [
        { trait_type: "Mint", value: mintAddress },
        { trait_type: "Amount", value: TOKEN_AMOUNT.toString() }
      ]
    };

    const jsonFile = path.join(metadataDir, "metadata.json");
    fs.writeFileSync(jsonFile, JSON.stringify(nftMetadata, null, 2));
    console.log("✅ Метадані збережено:", jsonFile);

    console.log("✅ Усі токени домінчені та JSON підготовлено для сайту і PNG!");
  } catch (error) {
    console.error("❌ ПОМИЛКА:", error);
  }
}

main();
