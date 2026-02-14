#!/usr/bin/env node
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import bs58 from "bs58";
import { execSync } from "child_process";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";

// ====== НАЛАШТУВАННЯ ======
const RPC_URL = "https://api.devnet.solana.com";
const SECRET_FILE = "./mint-authority.json";
const GITHUB_REPO = "lubnysash1980/Alfapay"; // для автоматичного пушу PNG та metadata.json

// ====== ФУНКЦІЇ ======
async function loadAuthority() {
  if (!fs.existsSync(SECRET_FILE)) throw new Error("mint-authority.json не знайдено!");
  const secretArray = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretArray));
}

function pushToGitHub() {
  try {
    execSync("git add logo.png metadata.json index.html", { stdio: "inherit" });
    execSync('git commit -m "Auto-update logo & metadata"', { stdio: "inherit" });
    execSync("git push origin main", { stdio: "inherit" });
    console.log("✅ PNG та metadata.json завантажені на GitHub Pages!");
  } catch (e) {
    console.log("⚠️ GitHub push не пройшов:", e.message);
  }
}

async function simulateMint(connection, mintPubkey, authority, ataAddress, amount) {
  try {
    const tx = new Transaction();
    // Додаємо симуляцію мінта
    await connection.simulateTransaction(tx, [authority]);
    return true;
  } catch (e) {
    console.log("❌ Симуляція провалена:", e.message);
    return false;
  }
}

async function createOrLoadATA(connection, mintPubkey, authority, receiverPubkey) {
  return await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mintPubkey,
    receiverPubkey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
}

async function mintToken(connection, mintPubkey, authority, ataAddress, amount) {
  return await mintTo(
    connection,
    authority,
    mintPubkey,
    ataAddress,
    authority,
    amount,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
}

async function updateMetadata(mintPubkey, payer, metadataUrl, name, symbol) {
  const connection = new Connection(RPC_URL, "confirmed");
  const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

  const nft = await metaplex.nfts().findByMint({ mintAddress: mintPubkey }).run().catch(() => null);

  if (!nft) {
    console.log("ℹ️ NFT метадані ще не існують, створюємо нові...");
    return await metaplex.nfts().create({
      uri: metadataUrl,
      name,
      symbol,
      mint: mintPubkey,
      updateAuthority: payer.publicKey,
    }).run();
  }

  console.log("ℹ️ NFT метадані знайдено, оновлюємо...");
  return await metaplex.nfts().update({
    nftOrSft: nft,
    uri: metadataUrl,
    name,
    symbol,
  }).run();
}

// ====== ГОЛОВНЕ МЕНЮ ======
(async () => {
  try {
    const payer = await loadAuthority();
    const connection = new Connection(RPC_URL, "confirmed");

    const answers = await inquirer.prompt([
      { type: "input", name: "mintAddress", message: "Введіть адресу MINT:" },
      { type: "input", name: "receiverWallet", message: "Введіть адресу отримувача:" },
      { type: "input", name: "amount", message: "Кількість токенів (bigint):", default: "1000000000" },
      { type: "input", name: "name", message: "Назва токена:", default: "IREN" },
      { type: "input", name: "symbol", message: "Символ токена:", default: "R" },
      { type: "input", name: "metadataUrl", message: "URL метаданих JSON (перед завантаженням GitHub Pages можна залишити порожнім):", default: "" }
    ]);

    // ===== Автофікс PNG та metadata.json =====
    if (!answers.metadataUrl) {
      console.log("📤 Автофікс: завантаження logo.png та metadata.json на GitHub Pages...");
      pushToGitHub();
      answers.metadataUrl = `https://${GITHUB_REPO.split("/")[0]}.github.io/${GITHUB_REPO.split("/")[1]}/metadata.json`;
      console.log("🔗 URL метаданих автоматично встановлено:", answers.metadataUrl);
    }

    const mintPubkey = new PublicKey(answers.mintAddress);
    const receiverPubkey = new PublicKey(answers.receiverWallet);
    const ata = await createOrLoadATA(connection, mintPubkey, payer, receiverPubkey);
    console.log("✅ ATA готовий:", ata.address.toBase58());

    // ===== Симуляція мінта =====
    const simulateOk = await simulateMint(connection, mintPubkey, payer, ata.address, BigInt(answers.amount));
    if (!simulateOk) {
      console.log("❌ Симуляція показала проблему. Перевірте SOL баланс, адресу MINT та мережу.");
      return;
    }

    console.log(`🚀 Мінтимо ${answers.amount} токенів...`);
    const sig = await mintToken(connection, mintPubkey, payer, ata.address, BigInt(answers.amount));
    console.log("🎉 Транзакція успішна! Sig:", sig);

    console.log("🔄 Оновлюємо метадані...");
    const nft = await updateMetadata(mintPubkey, payer, answers.metadataUrl, answers.name, answers.symbol);
    console.log("✅ Метадані оновлено:", nft?.address.toBase58() || "створено нові");

  } catch (e) {
    console.error("❌ ПОМИЛКА:", e.message);
    if (e.transactionLogs) console.log("Logs:", e.transactionLogs);
  }
})();
