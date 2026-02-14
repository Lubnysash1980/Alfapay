#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawnSync } from 'child_process';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';

// ================= CONFIG =================
const RPC_URL = clusterApiUrl('devnet');
const SECRET_FILE = './mint-authority.json';
const GITHUB_PAGES_DIR = './Alfapay/';
const DATA_QUEUE_DIR = './data/queue';

// ================= INIT =================
const connection = new Connection(RPC_URL, 'confirmed');

let payer;
if (fs.existsSync(SECRET_FILE)) {
  const secretArray = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf-8'));
  payer = Keypair.fromSecretKey(Uint8Array.from(secretArray));
} else {
  console.warn('[WARN] mint-authority.json not found, generating temporary keypair');
  payer = Keypair.generate();
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ================= LOG HELPERS =================
function debugLog(msg) {
  console.log('[DEBUG]', msg);
}

function hashLog(msg) {
  console.log('[HASH]', msg);
}

// ================= SAFE GIT =================
function safeGitCommit(repoPath, files = [], message = 'Update files') {
  debugLog(`Preparing Git commit in ${repoPath}`);

  const status = spawnSync('git', ['-C', repoPath, 'status', '--porcelain'], { encoding: 'utf-8' });
  if (!status.stdout || !status.stdout.trim()) {
    debugLog('No changes to commit.');
    return;
  }

  const add = spawnSync('git', ['-C', repoPath, 'add', ...files], { encoding: 'utf-8' });
  if (add.status !== 0) {
    console.error('[ERROR] Git add failed:', add.stderr);
    return;
  }

  const commit = spawnSync('git', ['-C', repoPath, 'commit', '-m', message], { encoding: 'utf-8' });
  if (commit.status !== 0) {
    console.error('[ERROR] Git commit failed:', commit.stderr);
    return;
  }

  const push = spawnSync('git', ['-C', repoPath, 'push', 'origin', 'main'], { encoding: 'utf-8' });
  if (push.status !== 0) {
    console.error('[ERROR] Git push failed:', push.stderr);
    return;
  }

  debugLog('Git commit & push successful');
}

// ================= TOKEN FACTORY =================
async function createToken(type, supply) {
  try {
    debugLog(`Starting mint process: type=${type}, supply=${supply}`);
    debugLog(`Using payer: ${payer.publicKey.toBase58()}`);

    const mint = await createMint(
      connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      0
    );

    hashLog(`Mint: ${mint.toBase58()}`);

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey
    );

    hashLog(`ATA: ${ata.address.toBase58()}`);

    const sig = await mintTo(
      connection,
      payer,
      mint,
      ata.address,
      payer,
      BigInt(supply)
    );

    hashLog(`Tx: ${sig}`);
    debugLog(`${type} mint completed`);
  } catch (err) {
    console.error('[ERROR] Mint failed:', err.message || err);
  }
}

// ================= QUEUE WATCHER =================
function processQueue() {
  if (!fs.existsSync(DATA_QUEUE_DIR)) {
    fs.mkdirSync(DATA_QUEUE_DIR, { recursive: true });
  }

  debugLog(`Watching queue dir: ${DATA_QUEUE_DIR}`);

  fs.watch(DATA_QUEUE_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.json')) return;

    const filePath = path.join(DATA_QUEUE_DIR, filename);

    try {
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      hashLog(JSON.stringify(payload).slice(0, 32));
      debugLog(`Processed queue file: ${filename}`);
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('[ERROR] Queue processing failed:', err.message);
    }
  });
}

// ================= MENU =================
function showMenu() {
  console.log('\n==== SMMS-001 Menu ====');
  console.log('1. Mint NFT (1 token)');
  console.log('2. Mint SFT (100 tokens)');
  console.log('3. Upload to GitHub Pages');
  console.log('4. Exit');
}

async function handleChoice(choice) {
  switch (choice) {
    case '1':
      await createToken('NFT', 1);
      break;
    case '2':
      await createToken('SFT', 100);
      break;
    case '3':
      safeGitCommit(GITHUB_PAGES_DIR, ['logo.png', 'metadata.json'], 'Auto-update');
      break;
    case '4':
      debugLog('Exiting...');
      rl.close();
      process.exit(0);
      break;
    default:
      debugLog('Invalid option');
  }

  showMenu();
  rl.question('Enter choice: ', handleChoice);
}

// ================= MAIN =================
(async () => {
  debugLog('Launching SMMS-001 Unified Module');
  hashLog(Date.now().toString());

  processQueue();
  showMenu();
  rl.question('Enter choice: ', handleChoice);
})();

