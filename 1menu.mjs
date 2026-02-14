#!/usr/bin/env node
import inquirer from 'inquirer';
import fs from 'fs';
import bs58 from 'bs58';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

// ====== Налаштування ======
const RPC_URL = 'https://api.mainnet-beta.solana.com'; // mainnet
const SECRET_FILE = './mint-authority.json';
const RENT_BUFFER = 0.002 * LAMPORTS_PER_SOL; // для rent-exempt ATA

// ====== Функція очікування SOL ======
async function waitForSol(connection, authority, minBalance) {
  let balance = await connection.getBalance(authority.publicKey);
  while (balance < minBalance) {
    console.warn(`⚠️ Недостатньо SOL: ${(balance / LAMPORTS_PER_SOL).toFixed(6)}. Потрібно: ${(minBalance / LAMPORTS_PER_SOL).toFixed(6)}`);
    console.log('⏳ Очікуємо поповнення SOL... Перевірка кожні 10 секунд');
    await new Promise(r => setTimeout(r, 10000));
    balance = await connection.getBalance(authority.publicKey);
  }
  console.log('✅ Баланс достатній. Продовжуємо...');
}

// ====== Головна функція ======
(async () => {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Завантаження ключа
    const secretArray = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8'));
    const authority = Keypair.fromSecretKey(Uint8Array.from(secretArray));

    // Меню користувача
    const answers = await inquirer.prompt([
      { type: 'input', name: 'mint', message: 'Введіть адресу MINT:' },
      { type: 'input', name: 'receiver', message: 'Введіть адресу отримувача:' },
      { type: 'input', name: 'amount', message: 'Кількість токенів (bigint):', default: '1000000000' },
      { type: 'input', name: 'name', message: 'Назва токена:', default: 'IREN' },
      { type: 'input', name: 'symbol', message: 'Символ токена:', default: 'R' },
      { type: 'input', name: 'uri', message: 'URL метаданих JSON:', default: '' }
    ]);

    const mintPubkey = new PublicKey(answers.mint);
    const receiverPubkey = new PublicKey(answers.receiver);
    const amount = BigInt(answers.amount);

    console.log('🔑 Завантаження mint authority...');

    // Перевірка балансу
    await waitForSol(connection, authority, RENT_BUFFER);

    // Створюємо / перевіряємо ATA
    console.log('📦 Створюємо / перевіряємо ATA...');
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      mintPubkey,
      receiverPubkey,
      false,
      'confirmed',
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log('✅ ATA:', ata.address.toBase58());

    // Мінтимо токени
    console.log('🚀 Мінтимо токени...');
    const sig = await mintTo(
      connection,
      authority,
      mintPubkey,
      ata.address,
      authority,
      amount,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log('🎉 УСПІХ! Tx:', sig);

    // Баланс після мінту
    const bal = await connection.getTokenAccountBalance(ata.address, 'confirmed');
    console.log('📊 Баланс:', bal.value.uiAmountString);

    // Показати підключення метаданих
    if (answers.uri) {
      console.log('🌐 Metadata JSON URL:', answers.uri);
      console.log('   Не забудьте завантажити logo.png та metadata.json на GitHub Pages!');
    }

  } catch (e) {
    console.error('❌ ПОМИЛКА:', e);
    if (e.transactionLogs) {
      console.log('📝 Логи транзакції для діагностики:');
      console.log(e.transactionLogs.join('\n'));
    }
  }
})();
