#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawnSync } from 'child_process';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';

console.log('[BOOT] Starting application');

// === Конфігурація mainnet ===
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const SECRET_FILE = './mint-authority.json';
const GITHUB_PAGES_DIR = './Alfapay/';
const DATA_QUEUE_DIR = './data/queue';
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY;
const SOLSCAN_BASE = 'https://pro-api.solscan.io/v2.0';

console.log('[CONFIG] RPC_URL:', RPC_URL);
console.log('[CONFIG] SECRET_FILE:', SECRET_FILE);
console.log('[CONFIG] DATA_QUEUE_DIR:', DATA_QUEUE_DIR);

// Підключення fetch, якщо він не визначений
if (typeof fetch === 'undefined') {
  console.log('[INIT] Loading node-fetch polyfill');
  global.fetch = (await import('node-fetch')).default;
}

const connection = new Connection(RPC_URL, 'confirmed');
console.log('[INIT] Solana connection established');

// Завантаження ключа плательщика
if (!fs.existsSync(SECRET_FILE)) {
  console.error('[FATAL] mint-authority.json not found');
  process.exit(1);
}

let payer;
try {
  console.log('[INIT] Loading payer keypair');
  const secretContent = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
  if (secretContent.startsWith('[')) {
    // JSON-масив чисел
    payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretContent)));
  } else {
    // base58 рядок
    import bs58 from 'bs58';
    payer = Keypair.fromSecretKey(bs58.decode(secretContent));
  }
  console.log('[INIT] Payer loaded:', payer.publicKey.toBase58());
} catch (e) {
  console.error('[FATAL] Invalid secret key file:', e.message);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function apiHeaders() {
  if (!SOLSCAN_API_KEY) throw new Error('SOLSCAN_API_KEY not set');
  console.log('[API] Using headers for Solscan');
  return { token: SOLSCAN_API_KEY, Accept: 'application/json' };
}

// === Виправлений solscanGet з retry + backoff ===
async function solscanGet(endpoint, retries = 3, delay = 1000) {
  console.log('[API] GET', endpoint);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${SOLSCAN_BASE}${endpoint}`, {
        method: 'GET',
        headers: apiHeaders(),
      });

      console.log('[API] Status:', res.status);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();

      if (!json || json.success !== true) throw new Error('Solscan API error');

      console.log('[API] Data received');
      return json.data;

    } catch (e) {
      console.error(`[API ERROR] Attempt ${attempt}:`, e.message);

      if (attempt < retries) {
        console.log(`[API] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // експоненційний backoff
      } else {
        throw e; // після останньої спроби кидаємо помилку
      }
    }
  }
}

// Функція для нормалізації суми токенів
function normalizeAmount(amount, decimals) {
  try {
    const divisor = BigInt(10) ** BigInt(decimals);
    const normalized = BigInt(amount) / divisor;
    console.log('[UTIL] Normalized amount:', normalized.toString());
    return normalized.toString();
  } catch (e) {
    console.error('[UTIL ERROR]', e.message);
    return "0";
  }
}

async function fetchTokenMetadata(address) {
  console.log('[TOKEN] Fetch metadata for:', address);
  new PublicKey(address); // перевірка валідності адреси
  const data = await solscanGet(`/account/metadata?address=${address}`);
  console.log('[TOKEN] Metadata:', data.name, data.symbol, data.supply);
  return data;
}

async function fetchTokenHolders(address, limit = 10) {
  const data = await solscanGet(`/token/holders?address=${address}&limit=${limit}`);
  const items = data?.items || [];
  items.forEach((h) => console.log('[HOLDER]', h.rank, h.owner, normalizeAmount(h.amount, h.decimals)));
  return items;
}

async function fetchTokenTransfers(address, limit = 10) {
  const data = await solscanGet(`/account/transfer?address=${address}&limit=${limit}`);
  if (!Array.isArray(data)) return [];
  data.forEach((t) => {
    if (t.activity_type === 'ACTIVITY_SPL_TRANSFER') {
      const amount = normalizeAmount(t.amount, t.token_decimals);
      console.log('[TRANSFER]', t.from_address, '->', t.to_address, amount);
    }
  });
  return data;
}

async function fetchTokenSwaps(address, limit = 10) {
  const data = await solscanGet(`/account/defi/activities?address=${address}&limit=${limit}`);
  if (!Array.isArray(data)) return [];
  data.forEach((s) => {
    const r = s.routers || s.amount_info;
    if (!r) return;
    const amount1 = normalizeAmount(r.amount1, r.token1_decimals);
    const amount2 = normalizeAmount(r.amount2, r.token2_decimals);
    console.log('[SWAP]', amount1, '->', amount2);
  });
  return data;
}

async function fetchAccountTransactions(address, limit = 5) {
  const data = await solscanGet(`/account/transactions?address=${address}&limit=${limit}`);
  const txs = data?.transactions || [];
  txs.forEach((tx) => console.log('[TX]', tx.tx_hash, tx.status, tx.fee));
  return txs;
}

// Мінт токена
async function createToken({ decimals = 0, supply }) {
  console.log('[MINT] Creating token with supply:', supply);
  if (!Number.isInteger(supply) && typeof supply !== 'bigint') throw new Error('Supply must be integer');
  const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, decimals);
  console.log('[MINT] Mint address:', mint.toBase58());
  const tokenAccount = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
  console.log('[MINT] Associated token account:', tokenAccount.address.toBase58());
  await mintTo(connection, payer, mint, tokenAccount.address, payer, BigInt(supply));
  console.log('[MINT] Minted tokens');
  return mint.toBase58();
}

function safeGitCommit(repoPath, files = [], message = 'Update files') {
  if (!fs.existsSync(repoPath)) return;
  console.log('[GIT] Checking status');
  const status = spawnSync('git', ['-C', repoPath, 'status', '--porcelain'], { encoding: 'utf-8' });
  if (!status?.stdout?.trim()) {
    console.log('[GIT] No changes to commit');
    return;
  }
  console.log('[GIT] Adding and committing files');
  spawnSync('git', ['-C', repoPath, 'add', ...files]);
  spawnSync('git', ['-C', repoPath, 'commit', '-m', message]);
  spawnSync('git', ['-C', repoPath, 'push', 'origin', 'main']);
  console.log('[GIT] Commit and push executed');
}

function processQueue() {
  if (!fs.existsSync(DATA_QUEUE_DIR)) fs.mkdirSync(DATA_QUEUE_DIR, { recursive: true });
  fs.watch(DATA_QUEUE_DIR, async (event, filename) => {
    if (!filename || !filename.endsWith('.json')) return;
    const filePath = path.join(DATA_QUEUE_DIR, filename);
    try {
      console.log('[QUEUE] Processing', filename);
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (payload?.type === 'metadata') await fetchTokenMetadata(payload.address);
      if (payload?.type === 'holders') await fetchTokenHolders(payload.address);
      if (payload?.type === 'transfers') await fetchTokenTransfers(payload.address);
      if (payload?.type === 'swaps') await fetchTokenSwaps(payload.address);
      if (payload?.type === 'transactions') await fetchAccountTransactions(payload.address);
      fs.unlinkSync(filePath);
      console.log('[QUEUE] Processed', filename);
    } catch (e) {
      console.error('[QUEUE ERROR]', e.message);
    }
  });
}

function ask(question) {
  console.log('[INPUT] Asking:', question);
  return new Promise((resolve) => rl.question(question
