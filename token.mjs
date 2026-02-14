#!/usr/bin/env node
import inquirer from "inquirer";
import fs from "fs";
import { execSync } from "child_process";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, createMint } from "@solana/spl-token";

// ===== НАЛАШТУВАННЯ =====
const RPC_URL = "https://api.mainnet-beta.solana.com"; 
const SECRET_FILE = "./mint-authority.json"; 
const GITHUB_PAGES_DIR = "./Alfapay/"; // директорія з GitHub Pages

(async () => {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // 🔑 Завантаження mint authority
    if (!fs.existsSync(SECRET_FILE)) throw new Error(`Файл ${SECRET_FILE} не знайдено`);
    const secretArray = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
    const payer = Keypair.fromSecretKey(Uint8Array.from(secretArray));

    const balance = await connection.getBalance(payer.publicKey);
    console.log(`💰 Баланс: ${balance / 1e9} SOL`);
    if (balance < 0.05 * 1e9) throw new Error("Недостатньо SOL для комісій");

    // 📝 Меню для введення параметрів токена
    const answers = await inquirer.prompt([
      { type: "input", name: "mintAddress", message: "Введіть адресу MINT (залишити порожнім для створення нового):" },
      { type: "input", name: "receiver", message: "Адреса отримувача:" },
      { type: "input", name: "amount", message: "Кількість токенів (bigint, з decimals=9):" },
      { type: "input", name: "name", message: "Назва токена:" },
      { type: "input", name: "symbol", message: "Символ токена:" },
      { type: "input", name: "metadataUrl", message: "URL метаданих JSON:", default: "" }
    ]);

    // ⚡ Створення MINT, якщо не вказано
    let mintPubkey;
    if (!answers.mintAddress) {
      console.log("🚀 Створюємо новий MINT...");
      mintPubkey = await createMint(connection, payer, payer.publicKey, null, 9);
      console.log("✅ MINT створено:", mintPubkey.toBase58());
    } else {
      mintPubkey = new PublicKey(answers.mintAddress);
    }

    // 📦 Створення або перевірка ATA
    const receiverPubkey = new PublicKey(answers.receiver);
    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mintPubkey, receiverPubkey);
    console.log("✅ ATA:", ata.address.toBase58());

    // 🚀 Мінт токенів
    const sig = await mintTo(connection, payer, mintPubkey, ata.address, payer.publicKey, BigInt(answers.amount));
    console.log("🎉 УСПІХ! Tx:", sig);

    const bal = await connection.getTokenAccountBalance(ata.address);
    console.log("📊 Баланс отримувача:", bal.value.uiAmountString);

    // 🌐 Автофікс GitHub Pages
    const ghAnswers = await inquirer.prompt([
      { type: "confirm", name: "uploadLogo", message: "Завантажити logo.png на GitHub Pages?", default: true },
      { type: "confirm", name: "uploadMetadata", message: "Завантажити metadata.json на GitHub Pages?", default: true }
    ]);

    if (ghAnswers.uploadLogo) {
      const logoPath = `${GITHUB_PAGES_DIR}logo.png`;
      if (!fs.existsSync(logoPath)) console.warn("⚠️ logo.png не знайдено в Alfapay/");
      else {
        execSync(`git -C ${GITHUB_PAGES_DIR} add logo.png`);
        execSync(`git -C ${GITHUB_PAGES_DIR} commit -m "Update logo.png"`);
        execSync(`git -C ${GITHUB_PAGES_DIR} push`);
        console.log("✅ logo.png завантажено на GitHub Pages");
      }
    }

    if (ghAnswers.uploadMetadata) {
      const metadataPath = "metadata.json";
      if (!fs.existsSync(metadataPath)) console.warn("⚠️ metadata.json не знайдено");
      else {
        fs.copyFileSync(metadataPath, `${GITHUB_PAGES_DIR}metadata.json`);
        execSync(`git -C ${GITHUB_PAGES_DIR} add metadata.json`);
        execSync(`git -C ${GITHUB_PAGES_DIR} commit -m "Update metadata.json"`);
        execSync(`git -C ${GITHUB_PAGES_DIR} push`);
        console.log("✅ metadata.json завантажено на GitHub Pages");
      }
    }

    console.log("🎯 Все готово! Перевірте URL метаданих та logo.png на GitHub Pages.");

  } catch (e) {
    console.error("❌ ПОМИЛКА:", e.message || e);
  }
})();
