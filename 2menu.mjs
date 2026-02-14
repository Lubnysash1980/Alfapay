#!/usr/bin/env node
import fs from "fs";
import { execSync } from "child_process";
import inquirer from "inquirer";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

// ===== Налаштування =====
const RPC_URL = "https://api.mainnet-beta.solana.com";
const SECRET_FILE = "./mint-authority.json";
const ALFAPAY_DIR = "./Alfapay/";

(async () => {
  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const secret = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
    const authority = Keypair.fromSecretKey(Uint8Array.from(secret));

    const balance = await connection.getBalance(authority.publicKey);
    console.log(`💰 Баланс: ${balance / 1e9} SOL`);
    if (balance < 0.01 * 1e9) throw new Error("Недостатньо SOL для комісій");

    // ===== Меню вводу =====
    const answers = await inquirer.prompt([
      { type: "input", name: "mint", message: "Введіть адресу MINT (залишити порожнім для створення нового):" },
      { type: "input", name: "receiver", message: "Адреса отримувача:" },
      { type: "input", name: "amount", message: "Кількість токенів (bigint, з decimals=9):" },
      { type: "input", name: "name", message: "Назва токена:" },
      { type: "input", name: "symbol", message: "Символ токена:" },
      { type: "input", name: "jsonURL", message: "URL метаданих JSON:" },
      { type: "confirm", name: "uploadLogo", message: "Завантажити logo.png на GitHub Pages?", default: true },
      { type: "confirm", name: "uploadMetadata", message: "Завантажити metadata.json на GitHub Pages?", default: true }
    ]);

    let mintPubkey;
    if (!answers.mint) {
      console.log("🚀 Створюємо новий MINT...");
      mintPubkey = await createMint(connection, authority, authority.publicKey, null, 9, TOKEN_2022_PROGRAM_ID);
if (mintPubkey instanceof PublicKey) {
  console.log("✅ MINT створено:", mintPubkey.toBase58());
} else {
  console.log("✅ MINT створено:", mintPubkey);
  mintPubkey = new PublicKey(mintPubkey); // щоб далі використовувати як PublicKey
}
    } else {
      mintPubkey = new PublicKey(answers.mint);
    }

    // ===== ATA =====
    const receiverPubkey = new PublicKey(answers.receiver);
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      mintPubkey,
      receiverPubkey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("✅ ATA:", ata.address.toBase58());

    // ===== Mint токенів =====
    const sig = await mintTo(connection, authority, mintPubkey, ata.address, authority, BigInt(answers.amount), [], undefined, TOKEN_2022_PROGRAM_ID);
    console.log("🎉 УСПІХ! Tx:", sig);

    const bal = await connection.getTokenAccountBalance(ata.address, "confirmed");
    console.log("📊 Баланс отримувача:", bal.value.uiAmountString);

    // ===== GitHub Pages =====
    if (answers.uploadLogo || answers.uploadMetadata) {
      if (!fs.existsSync(ALFAPAY_DIR)) fs.mkdirSync(ALFAPAY_DIR);

      try {
        if (!fs.existsSync(ALFAPAY_DIR + ".git")) {
          execSync("git init", { cwd: ALFAPAY_DIR });
          execSync("git branch -M main", { cwd: ALFAPAY_DIR });
          console.log("✅ Git репозиторій створено!");
        }

        try {
          execSync("git remote get-url origin", { cwd: ALFAPAY_DIR });
        } catch {
          const originURL = await inquirer.prompt([{ type: "input", name: "url", message: "Введіть GitHub репозиторій URL (origin):" }]);
          execSync(`git remote add origin ${originURL.url}`, { cwd: ALFAPAY_DIR });
          console.log("✅ Додано origin:", originURL.url);
        }

        if (answers.uploadLogo) execSync("git add logo.png", { cwd: ALFAPAY_DIR });
        if (answers.uploadMetadata) execSync("git add metadata.json", { cwd: ALFAPAY_DIR });

        execSync('git commit -m "Update logo and metadata"', { cwd: ALFAPAY_DIR, stdio: "ignore" });
        execSync("git push -u origin main", { cwd: ALFAPAY_DIR, stdio: "inherit" });

        console.log("✅ GitHub Pages оновлено!");
      } catch (e) {
        console.log("⚠️ Git commit/push не виконано:", e.message);
      }
    }

  } catch (e) {
    console.error("❌ ПОМИЛКА:", e.message);
  }
})();
