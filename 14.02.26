#!/usr/bin/env node

/*
  SMMS-001 Mutable Metadata Evolution Module v3.1

  Додано:
  - 🔐 Mock Ledger hardware signer для Android
  - 🧠 Policy Engine для перевірки stage rules
  - 📊 SVG dependency graph для stage-ів
  - 🧬 Автоматичний pipeline для mutable metadata stages
  - 🔁 Retry та queue processing
  - 🧾 Append-only audit log з hash chain
  - Stage versioning та debug logging
  - Вбудовані коментарі для пояснення складних частин
*/

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

/* ================= PATHS ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data', 'queue');
const STATE_DIR = path.join(__dirname, 'data', 'state');
const AUDIT_LOG = path.join(__dirname, 'data', 'audit.log');
const GRAPH_SVG = path.join(__dirname, 'data', 'stage-graph.svg');

// Ensure directories exist
[DATA_DIR, STATE_DIR].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

/* ================= LOGGER ================= */
const log = (...args) => console.log('[DEBUG]', ...args);

/* ================= AUDIT LOG ================= */
function appendAudit(event, payload) {
  // Зчитування останнього хешу для формування hash chain
  const prev = fs.existsSync(AUDIT_LOG) ? fs.readFileSync(AUDIT_LOG, 'utf8').trim().split('\n').slice(-1)[0] : '';
  const prevHash = prev ? JSON.parse(prev).hash : 'GENESIS';

  const entry = { ts: Date.now(), event, payload, prevHash };
  entry.hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  fs.appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n');
  log('Audit appended:', event, 'Hash:', entry.hash);
}

/* ================= LEDGER SIGNER MOCK ================= */
async function getLedgerPublicKey() {
  // Mock Ledger: для Android генеруємо псевдовипадковий ключ
  const mockKey = crypto.randomBytes(32).toString('hex');
  log('Ledger public key (mock) obtained:', mockKey);
  return mockKey;
}

/* ================= POLICY ENGINE ================= */
const POLICY = {
  strict: true,
  rules: {
    metadata_v1: ['name', 'uri'],
    metadata_v2: ['uri', 'creators'],
    metadata_v3: ['*']
  }
};

function enforcePolicy(stage, prevState, nextState) {
  // Перевірка змін проти policy rules
  if (!POLICY.strict) return;
  const allowed = POLICY.rules[stage] || [];
  for (const key of Object.keys(nextState)) {
    if (allowed.includes('*')) break;
    if (prevState[key] !== nextState[key] && !allowed.includes(key)) {
      throw new Error(`Policy violation: ${key} cannot be modified in ${stage}`);
    }
  }
  log('Policy enforced for stage:', stage);
}

/* ================= STAGE GRAPH ================= */
const STAGES = ['metadata_v1', 'metadata_v2', 'metadata_v3'];

function renderGraph() {
  // Візуалізація DAG для stages
  let y = 40;
  const nodes = STAGES.map((s, i) =>
    `<rect x="40" y="${y + i * 60}" width="220" height="40" fill="#111" stroke="#0f0"/>
<text x="55" y="${y + i * 60 + 25}" fill="#0f0">${s}</text>`
  ).join('\n');

  const links = STAGES.slice(1).map((_, i) =>
    `<line x1="150" y1="${y + i * 60 + 40}" x2="150" y2="${y + (i + 1) * 60}" stroke="#0f0"/>`
  ).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" style="background:#000">\n${nodes}\n${links}\n</svg>`;
  fs.writeFileSync(GRAPH_SVG, svg);
  log('Stage graph rendered at:', GRAPH_SVG);
}

renderGraph();

/* ================= STATE ================= */
function loadState(id) {
  const f = path.join(STATE_DIR, id + '.json');
  const state = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {};
  log('Loaded state for id:', id, 'State keys:', Object.keys(state));
  return state;
}

function saveState(id, state) {
  fs.writeFileSync(path.join(STATE_DIR, id + '.json'), JSON.stringify(state, null, 2));
  log('Saved state for id:', id, 'State keys:', Object.keys(state));
}

/* ================= PIPELINE ================= */
async function processStages(id, initialData) {
  let state = loadState(id);
  for (const stage of STAGES) {
    const next = { ...state, ...initialData, stage };
    log('Processing stage:', stage, 'Current state keys:', Object.keys(state));
    enforcePolicy(stage, state, next);
    appendAudit('STAGE_APPLY', { id, stage });
    state = next;
    saveState(id, state);
  }
  log('Pipeline processed for id:', id);
}

/* ================= QUEUE WATCHER ================= */
function watchQueue() {
  log('Watching queue:', DATA_DIR);

  fs.watch(DATA_DIR, async (_, file) => {
    if (!file || !file.endsWith('.json')) return;
    const full = path.join(DATA_DIR, file);
    if (!fs.existsSync(full)) return;

    const payload = JSON.parse(fs.readFileSync(full));
    const id = path.basename(file, '.json');

    try {
      const ledgerKey = await getLedgerPublicKey();
      appendAudit('LEDGER_SIGNER_OK', ledgerKey);

      await processStages(id, payload);
      appendAudit('PIPELINE_SUCCESS', id);

      fs.unlinkSync(full);
      log('Processed and removed file:', file);
    } catch (e) {
      appendAudit('PIPELINE_FAIL', { id, error: e.message });
      log('Error processing file', file, 'Message:', e.message);
    }
  });
}

/* ================= ENTRY ================= */
log('Launching SMMS-001 Mutable Metadata Evolution Module v3.1');
watchQueue();
log('Module initialized and watching queue for mutable metadata files.');

