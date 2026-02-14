#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';
import crypto from 'crypto';
import { Connection, Keypair, Transaction, PublicKey } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, setAuthority, AuthorityType } from '@solana/spl-token';
import {
  createCreateMetadataAccountV3Instruction,
  createUpdateMetadataAccountV2Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID
} from '@metaplex-foundation/mpl-token-metadata';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const SECRET_FILE = './mint-authority.json';

const connection = new Connection(RPC_URL, 'confirmed');

if (!fs.existsSync(SECRET_FILE)) {
  console.error('[FATAL] mint-authority.json not found.');
  process.exit(1);
}

let payer;
try {
  const secretRaw = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf-8'));
  payer = Keypair.fromSecretKey(Uint8Array.from(secretRaw));
} catch (e) {
  console.error('[FATAL] Invalid keypair file:', e.message);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let processEvents = [];

function recordEvent(label, data = '') {
  processEvents.push(`${Date.now()}|${label}|${data}`);
}

function printProcessHash() {
  if (!processEvents.length) return;
  const hash = crypto.createHash('sha256').update(processEvents.join('\n')).digest('hex');
  console.log('\n[PROCESS HASH]', hash);
  processEvents = [];
}

function debugLog(msg) {
  console.log('[DEBUG]', msg);
  recordEvent('DEBUG', msg);
}

function hashLog(msg) {
  console.log('[HASH]', msg);
  recordEvent('HASH', msg);
}

async function createMetadataAccount(mint, name, symbol, uri) {
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );

    const tx = new Transaction().add(
  createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
      mint,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
      data: {
  name: name.substring(0, 32),
  symbol: symbol.substring(0, 10),
  uri: uri.substring(0, 200),
  sellerFeeBasisPoints: 0,
  creators: null,
  collection: null,
  uses: null,
},
        isMutable: true,
        collectionDetails: null,
      },
    }
  )
);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  return metadataPDA;
}

async function makeMetadataImmutable(metadataPDA) {
  const tx = new Transaction().add(
    createUpdateMetadataAccountV2Instruction(
      { metadata: metadataPDA, updateAuthority: payer.publicKey },
      { updateMetadataAccountArgsV2: {
  data: undefined,
  updateAuthority: undefined,
  primarySaleHappened: undefined,
  isMutable: false
}}
    )
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
}

async function createToken({ type, uri, supply, name, symbol }) {
  try {
    debugLog(`Mint start: ${type}`);

    const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0);
    hashLog(`Mint: ${mint.toBase58()}`);

    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
    hashLog(`ATA: ${ata.address.toBase58()}`);

    await mintTo(connection, payer, mint, ata.address, payer.publicKey, BigInt(supply));
    hashLog(`Supply minted: ${supply}`);

    const metadata = await createMetadataAccount(mint, name || type, symbol || type, uri);
    hashLog(`Metadata PDA: ${metadata.toBase58()}`);

    await setAuthority(connection, payer, mint, payer.publicKey, AuthorityType.MintTokens, null);
    await setAuthority(connection, payer, mint, payer.publicKey, AuthorityType.FreezeAccount, null);

    await makeMetadataImmutable(metadata);
    hashLog('Token fully immutable');

    printProcessHash();

    return { mint, ata, metadata };
  } catch (e) {
    console.error('[ERROR]', e.message);
    recordEvent('ERROR', e.message);
    printProcessHash();
  }
}

function showMenu() {
  console.log('\n==== SMMS-001 Menu ====');
  console.log('1. Mint NFT (Immutable)');
  console.log('2. Mint SFT (Immutable, 100 supply)');
  console.log('3. Exit');
}

function menuLoop() {
  showMenu();
  rl.question('Enter choice: ', async (choice) => {
    try {
      switch (choice.trim()) {
        case '1':
         await createToken({ type: 'NFT', uri: 'https://lubnysash1980.github.io/Alfapay/metadata.json', supply: 1, name: 'NFT', symbol: 'NFT' });
          break;
        case '2':
         await createToken({ type: 'NFT', uri: 'https://lubnysash1980.github.io/Alfapay/metadata.json', supply: 1, name: 'NFT', symbol: 'NFT' });
          break;
        case '3':
          printProcessHash();
          rl.close();
          return;
        default:
          console.log('Invalid option');
      }
    } catch (e) {
      console.error('[ERROR]', e.message);
      recordEvent('ERROR', e.message);
      printProcessHash();
    }
    menuLoop();
  });
}

(async () => {
  debugLog('Mainnet immutable mint module started');
  recordEvent('INIT', payer.publicKey.toBase58());
  menuLoop();
})();

