/*
  SMMS-001 Mutable Metadata Module vQueue Auto v1.5
  - Automatic processing of new JSON files in a queue
  - Ensures metadata is mutable
  - Freeze/unfreeze placeholder logic included
  - Debug logging for tracing
  - Handles multiple files arriving at once
*/

import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { programs } from '@metaplex/js';
import fs from 'fs';
import path from 'path';

const { metadata: { Metadata } } = programs;

// ==== CONFIGURATION ====
const config = {
  connection: new Connection(clusterApiUrl('devnet'), 'confirmed'),
  payer: Keypair.generate(),
  dataDir: path.resolve('./smms_data') // Папка з JSON файлами
};

// ==== LOGGER ====
const log = (...args) => console.log('[DEBUG]', ...args);

// ==== ENVIRONMENT CHECK ====
function checkEnvironment() {
  log('Checking environment and folders...');
  if (!fs.existsSync(config.dataDir)) {
    log('Data directory missing, creating:', config.dataDir);
    fs.mkdirSync(config.dataDir, { recursive: true });
  } else {
    log('Data directory exists:', config.dataDir);
  }
}

// ==== AUTHORITY ====
async function getAuthority() {
  const authority = Keypair.generate();
  log('Authority generated:', authority.publicKey.toBase58());
  return authority;
}

// ==== FREEZE PLACEHOLDER ====
async function unfreezeIfNeeded(metadataPDA) {
  log('Ensuring metadata is mutable for PDA:', metadataPDA.toBase58());
}

// ==== MUTABLE METADATA CREATION ====
async function createMetadataForFile(fileName) {
  try {
    const uri = `file://${path.join(config.dataDir, fileName)}`;
    log('Processing file for mutable metadata:', fileName);

    const authority = await getAuthority();
    const dummyMint = Keypair.generate().publicKey; // Dummy mint for PDA
    const metadataPDA = await Metadata.getPDA(dummyMint);

    await unfreezeIfNeeded(metadataPDA);

    const metadataData = new Metadata({
      name: fileName.replace('.json', ''),
      symbol: 'SMMS',
      uri,
      sellerFeeBasisPoints: 0,
      creators: [{ address: authority.publicKey.toBase58(), verified: true, share: 100 }],
      collection: null,
      uses: null,
      isMutable: true
    });

    log('Mutable metadata object created:', metadataData);

    const txConfig = {
      metadata: metadataPDA,
      mint: dummyMint,
      mintAuthority: authority.publicKey,
      updateAuthority: authority.publicKey,
      payer: config.payer.publicKey
    };

    const tx = await Metadata.create(config.connection, config.payer, txConfig, metadataData);
    await config.connection.confirmTransaction(tx, 'confirmed');

    log('Mutable metadata confirmed on-chain for file:', fileName);
  } catch (err) {
    log('Error processing file:', fileName, err);
  }
}

// ==== QUEUE HANDLER ====
const fileQueue = [];
let processing = false;

async function processQueue() {
  if (processing || fileQueue.length === 0) return;
  processing = true;

  while (fileQueue.length > 0) {
    const fileName = fileQueue.shift();
    await createMetadataForFile(fileName);
  }

  processing = false;
}

// ==== REAL-TIME DIRECTORY WATCHER ====
function watchDataDirectory() {
  checkEnvironment();
  log('Watching data directory for new JSON files:', config.dataDir);

  fs.watch(config.dataDir, (eventType, filename) => {
    if (filename && filename.endsWith('.json') && eventType === 'rename') {
      const fullPath = path.join(config.dataDir, filename);
      if (fs.existsSync(fullPath)) {
        log('New JSON detected, adding to queue:', filename);
        fileQueue.push(filename);
        processQueue();
      }
    }
  });
}

// ==== ENTRY POINT ====
(async () => {
  log('Launching SMMS-001 Mutable Metadata Auto Module with Queue');
  watchDataDirectory();
})();
