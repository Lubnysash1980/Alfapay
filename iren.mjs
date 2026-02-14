#!/usr/bin/env node
import inquirer from 'inquirer';
import fs from 'fs';
import bs58 from 'bs58';
import { execSync } from 'child_process';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo, createMint } from '@solana/spl-token';

const RPC_URL = 'https://api.mainnet-beta.solana.com'; // або devnet для тесту
const DECIMALS = 9;

// Завантажуємо ключ payer
const secret = fs.readFileSync('./mint-authority.json', 'utf8');
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));

const connection = new Connection(RPC_URL, 'confirmed');

(async () => {
  try {
    // 1️⃣ Збираємо дані через меню
    const answers = await inquirer.prompt([
      { type: 'input', name: 'mint', message: 'Введіть адресу MINT (залишити порожнім для створення нового):' },
      { type: 'input', name: 'receiver', message: 'Адреса отримувача:' },
      { type: 'input', name: 'amount', message: `Кількість токенів (bigint, з decimals=${DECIMALS}):` },
      { type: 'input', name: 'name', message: 'Назва токена:' },
      { type: 'input', name: 'symbol', message: 'Символ токена:' },
      { type: 'input', name: 'metadata', message: 'URL метаданих JSON:' },
      { type: 'confirm', name: 'uploadLogo', message: 'Завантажити logo.png на GitHub Pages?' },
      { type: 'confirm', name: 'uploadMetadata', message: 'Завантажити metadata.json на GitHub Pages?' }
    ]);

    // 2️⃣ Створюємо або використовуємо MINT
    let mintPubkey;
    if (!answers.mint) {
      console.log('🚀 Створюємо новий MINT...');
      mintPubkey = await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        DECIMALS
      );
      if (!(mintPubkey instanceof PublicKey)) mintPubkey = new PublicKey(mintPubkey);
      console.log('✅ MINT створено:', mintPubkey.toBase58());
    } else {
      mintPubkey = new PublicKey(answers.mint);
      console.log('✅ Використовуємо існуючий MINT:', mintPubkey.toBase58());
    }

    const receiverPubkey = new PublicKey(answers.receiver);

    // 3️⃣ Створюємо або отримуємо ATA
    console.log('📦 Створюємо / перевіряємо ATA...');
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mintPubkey,
      receiverPubkey
    );
    console.log('✅ ATA:', ata.address.toBase58());

    // 4️⃣ Мінтимо токени
    console.log('🚀 Мінтимо токени...');
    const sig = await mintTo(
      connection,
      payer,
      mintPubkey,
      ata.address,
      payer,
      BigInt(answers.amount)
    );
    console.log('🎉 УСПІХ! Tx:', sig);

    const bal = await connection.getTokenAccountBalance(ata.address, 'confirmed');
    console.log('📊 Баланс отримувача:', bal.value.uiAmountString);

    // 5️⃣ Метадані
    console.log('🌐 Metadata JSON URL:', answers.metadata);

    // 6️⃣ GitHub Pages
    const ghFolder = './Alfapay';
    if (!fs.existsSync(ghFolder)) fs.mkdirSync(ghFolder);

    if (answers.uploadLogo) fs.copyFileSync('./logo.png', `${ghFolder}/logo.png`);
    if (answers.uploadMetadata) fs.copyFileSync('./metadata.json', `${ghFolder}/metadata.json`);

    // 7️⃣ Автоматичний git commit & push
    if (answers.uploadLogo || answers.uploadMetadata) {
      try {
        execSync(`git -C ${ghFolder} add .`);
        execSync(`git -C ${ghFolder} commit -m "Update logo and metadata"`);
        execSync(`git -C ${ghFolder} push origin main`);
        console.log('✅ GitHub оновлено успішно!');
      } catch (gitErr) {
        console.error('❌ ПОМИЛКА при оновленні GitHub:', gitErr.message);
        console.log('   Перевірте, чи налаштовано remote та чи є права доступу.');
      }
    }

  } catch (e) {
    console.error('❌ ПОМИЛКА:', e.message);
  }
})();
