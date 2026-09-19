import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomInt } from 'node:crypto';

import { qrSvg } from './lib/qr.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 7777;
const DATA_FILE = join(HERE, 'data.json');

// Rename these to match what you are actually pouring and slicing. The `id`
// is only ever stored; the `name` is what everyone sees.
const COLAS = [
  { id: 'coke', name: 'Coca-Cola', short: 'Coke' },
  { id: 'diet-coke', name: 'Diet Coke', short: 'Diet' },
  { id: 'coke-zero', name: 'Coke Zero', short: 'Zero' },
  { id: 'pepsi', name: 'Pepsi', short: 'Pepsi' },
  { id: 'diet-pepsi', name: 'Diet Pepsi', short: 'D.Pep' },
  { id: 'cherry-coke', name: 'Cherry Coke', short: 'Cherry' },
  { id: 'mexican-coke', name: 'Mexican Coke', short: 'Mex' },
  { id: 'olipop', name: 'Olipop', short: 'Olipop' },
];

const BREADS = [
  { id: 'gf', name: 'Gluten-free', short: 'GF' },
  { id: 'wf', name: 'Whole Foods', short: 'WF' },
  { id: 'farmers', name: "Farmers' market", short: 'Market' },
  { id: 'homemade', name: 'Homemade', short: 'Home' },
  { id: 'jalapeno', name: 'Jalapeño cheese sourdough', short: 'Jalapeño' },
];

const GLASS_LABELS = COLAS.map((_, i) => `Glass ${i + 1}`);
const SLICE_LABELS = BREADS.map((_, i) => `Slice ${String.fromCharCode(65 + i)}`);

const PHASES = ['lobby', 'tasting', 'locked', 'reveal', 'done'];
const MAX_PLAYERS = 60;
const MAX_BODY = 16 * 1024;

const ADMIN_PIN = process.env.ADMIN_PIN || String(randomInt(1000, 10000));

function emptyState() {
  return {
    phase: 'lobby',
    players: {},
    key: { cola: Array(COLAS.length).fill(null), bread: Array(BREADS.length).fill(null) },
    current: { kind: 'cola', index: 0 },
    reveal: { order: [], index: -1 },
  };
}

let state = emptyState();
const tokens = new Map();
let version = 0;

// ---------------------------------------------------------------- persistence

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await writeFile(
        DATA_FILE,
        JSON.stringify({ state, tokens: [...tokens] }, null, 2),
      );
    } catch (err) {
      console.error('could not save game data:', err.message);
    }
  }, 250);
}

async function load() {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    state = { ...emptyState(), ...raw.state };
    for (const [id, token] of raw.tokens ?? []) tokens.set(id, token);
    const count = Object.keys(state.players).length;
    if (count) console.log(`resumed an in-progress game: ${count} player(s), phase "${state.phase}"`);
  } catch {
    // no saved game yet
  }
}

// -------------------------------------------------------------------- scoring

function scoreOf(player) {
  let cola = 0;
  let bread = 0;
  for (let i = 0; i < COLAS.length; i++) {
    if (state.key.cola[i] && player.picks.cola[i] === state.key.cola[i]) cola++;
  }
  for (let i = 0; i < BREADS.length; i++) {
    if (state.key.bread[i] && player.picks.bread[i] === state.key.bread[i]) bread++;
  }
  return { cola, bread, total: cola + bread };
}

function keyIsSet() {
  return state.key.cola.every(Boolean) && state.key.bread.every(Boolean);
}

/** Everyone who is in the running, scored and ranked (1 = winner). */
function scoreboard() {
  const rows = Object.values(state.players)
    .filter((p) => p.submittedAt)
    .map((p) => ({ id: p.id, name: p.name, ...scoreOf(p) }))
    .sort((a, b) => b.total - a.total);

  let rank = 0;
  let previous = null;
  rows.forEach((row, i) => {
    if (previous === null || row.total !== previous) {
      rank = i + 1;
      previous = row.total;
    }
    row.rank = rank;
  });
  return rows;
}

function buildRevealOrder() {
  const rows = scoreboard();
  // Lowest first, and shuffle within each tied group so the running order
  // is not just whoever happened to join first.
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.total)) groups.set(row.total, []);
    groups.get(row.total).push(row.id);
  }
  const order = [];
  for (const total of [...groups.keys()].sort((a, b) => a - b)) {
    const group = groups.get(total);
    for (let i = group.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [group[i], group[j]] = [group[j], group[i]];
    }
    order.push(...group);
  }
  return order;
}

// ------------------------------------------------------------- state for wire

function publicState() {
  const revealed = state.phase === 'reveal' || state.phase === 'done';
  const board = revealed ? scoreboard() : [];
  const byId = new Map(board.map((r) => [r.id, r]));

  // Everyone has already handed their card in by the time a reveal starts, so
  // showing a revealed player's answers (and the key) gives nothing away.
  const shown = revealed
    ? state.reveal.order
        .slice(0, state.reveal.index + 1)
        .map((id) => (byId.has(id) ? { ...byId.get(id), picks: state.players[id].picks } : null))
        .filter(Boolean)
    : [];

  return {
    version,
    phase: state.phase,
    current: state.current,
    colas: COLAS,
    breads: BREADS,
    glassLabels: GLASS_LABELS,
    sliceLabels: SLICE_LABELS,
    joinUrl: joinUrl(),
    keyIsSet: keyIsSet(),
    players: Object.values(state.players)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        submitted: Boolean(p.submittedAt),
        answered: countAnswered(p),
      })),
    total: COLAS.length + BREADS.length,
    reveal: {
      index: state.reveal.index,
      count: state.reveal.order.length,
      // Only the people already revealed, in the order they were revealed.
      shown,
      key: revealed ? state.key : null,
    },
  };
}

function countAnswered(player) {
  return (
    player.picks.cola.filter(Boolean).length + player.picks.bread.filter(Boolean).length
  );
}

function adminState() {
  return {
    ...publicState(),
    pin: undefined,
    key: state.key,
    scores: keyIsSet() ? scoreboard() : [],
    picks: Object.values(state.players)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ id: p.id, name: p.name, picks: p.picks, submitted: Boolean(p.submittedAt) })),
  };
}

// ------------------------------------------------------------------- realtime

const clients = new Set();

function broadcast() {
  version++;
  save();
  const payload = `data: ${JSON.stringify(publicState())}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

// --------------------------------------------------------------- http helpers

function send(res, status, body, type = 'application/json') {
  const data = type === 'application/json' ? JSON.stringify(body) : body;
  res.writeHead(status, {
    'content-type': `${type}; charset=utf-8`,
    'cache-control': 'no-store',
  });
  res.end(data);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function authed(req) {
  return (req.headers['x-pin'] ?? '') === ADMIN_PIN;
}

function cleanName(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

// --------------------------------------------------------------------- routes

const STATIC = {
  '/': ['views/player.html', 'text/html'],
  '/tv': ['views/tv.html', 'text/html'],
  '/admin': ['views/admin.html', 'text/html'],
  '/app.css': ['views/app.css', 'text/css'],
  '/app.js': ['views/app.js', 'text/javascript'],
};

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (STATIC[path]) {
    const [file, type] = STATIC[path];
    const body = await readFile(join(HERE, file), 'utf8');
    return send(res, 200, body, type);
  }

  if (path === '/favicon.svg' || path === '/favicon.ico') {
    const cap =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<circle cx="16" cy="16" r="15" fill="#e8a33d"/>' +
      '<circle cx="16" cy="16" r="10" fill="#b23a2e"/>' +
      '</svg>';
    return send(res, 200, cap, 'image/svg+xml');
  }

  if (path === '/qr.svg') {
    const target = url.searchParams.get('u') || joinUrl();
    return send(res, 200, qrSvg(target, { size: 520 }), 'image/svg+xml');
  }

  if (path === '/api/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify(publicState())}\n\n`);
    clients.add(res);
    const beat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* dropped below */
      }
    }, 20000);
    req.on('close', () => {
      clearInterval(beat);
      clients.delete(res);
    });
    return undefined;
  }

  if (path === '/api/state') return send(res, 200, publicState());

  if (path === '/api/me') {
    const player = state.players[url.searchParams.get('id')];
    if (!player || tokens.get(player.id) !== url.searchParams.get('token')) {
      return send(res, 404, { error: 'not joined' });
    }
    const revealedIds = state.reveal.order.slice(0, state.reveal.index + 1);
    const mine = scoreboard().find((r) => r.id === player.id);
    return send(res, 200, {
      name: player.name,
      picks: player.picks,
      submitted: Boolean(player.submittedAt),
      score: revealedIds.includes(player.id) ? mine : null,
    });
  }

  if (path === '/api/admin/state') {
    if (!authed(req)) return send(res, 401, { error: 'Wrong PIN.' });
    return send(res, 200, adminState());
  }

  if (req.method !== 'POST') return send(res, 404, { error: 'not found' });

  const body = await readBody(req);

  if (path === '/api/join') {
    const name = cleanName(body.name);
    if (!name) return send(res, 400, { error: 'Enter your name to join.' });
    if (state.phase !== 'lobby' && state.phase !== 'tasting') {
      return send(res, 409, { error: 'Voting has closed for this round.' });
    }
    const existing = Object.values(state.players).find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      return send(res, 409, { error: `${existing.name} is already playing — pick another name.` });
    }
    if (Object.keys(state.players).length >= MAX_PLAYERS) {
      return send(res, 409, { error: 'This game is full.' });
    }
    const id = randomUUID();
    const token = randomUUID();
    state.players[id] = {
      id,
      name,
      joinedAt: Date.now(),
      picks: { cola: Array(COLAS.length).fill(null), bread: Array(BREADS.length).fill(null) },
      submittedAt: null,
    };
    tokens.set(id, token);
    broadcast();
    return send(res, 200, { id, token, name });
  }

  if (path === '/api/pick' || path === '/api/submit') {
    const player = state.players[body.id];
    if (!player || tokens.get(player.id) !== body.token) {
      return send(res, 403, { error: 'You are not in this game any more — rejoin to keep playing.' });
    }
    if (state.phase !== 'lobby' && state.phase !== 'tasting') {
      return send(res, 409, { error: 'Voting has closed.' });
    }

    if (path === '/api/submit') {
      player.submittedAt = Date.now();
      broadcast();
      return send(res, 200, { ok: true });
    }

    const list = body.kind === 'cola' ? COLAS : body.kind === 'bread' ? BREADS : null;
    const index = Number(body.index);
    if (!list || !Number.isInteger(index) || index < 0 || index >= list.length) {
      return send(res, 400, { error: 'bad pick' });
    }
    const value = body.value === null ? null : String(body.value);
    if (value !== null && !list.some((item) => item.id === value)) {
      return send(res, 400, { error: 'bad pick' });
    }
    player.picks[body.kind][index] = value;
    broadcast();
    return send(res, 200, { ok: true });
  }

  // ------------------------------------------------------------------- admin
  if (path.startsWith('/api/admin/')) {
    if (!authed(req)) return send(res, 401, { error: 'Wrong PIN.' });
    const action = path.slice('/api/admin/'.length);

    if (action === 'key') {
      for (const kind of ['cola', 'bread']) {
        const list = kind === 'cola' ? COLAS : BREADS;
        const incoming = body[kind];
        if (!Array.isArray(incoming) || incoming.length !== list.length) continue;
        state.key[kind] = incoming.map((value) =>
          list.some((item) => item.id === value) ? value : null,
        );
      }
      broadcast();
      return send(res, 200, adminState());
    }

    if (action === 'shuffle') {
      for (const kind of ['cola', 'bread']) {
        const ids = (kind === 'cola' ? COLAS : BREADS).map((item) => item.id);
        for (let i = ids.length - 1; i > 0; i--) {
          const j = randomInt(0, i + 1);
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        state.key[kind] = ids;
      }
      broadcast();
      return send(res, 200, adminState());
    }

    if (action === 'phase') {
      const next = String(body.phase);
      if (!PHASES.includes(next)) return send(res, 400, { error: 'bad phase' });

      if (next === 'locked' || next === 'reveal') {
        // Nobody misses out because they forgot to press submit.
        for (const player of Object.values(state.players)) {
          if (!player.submittedAt && countAnswered(player) > 0) player.submittedAt = Date.now();
        }
      }
      if (next === 'reveal') {
        if (!keyIsSet()) {
          return send(res, 409, { error: 'Set the answer key first — every glass and slice needs a real answer.' });
        }
        state.reveal = { order: buildRevealOrder(), index: -1 };
        if (!state.reveal.order.length) {
          return send(res, 409, { error: 'Nobody has submitted a card yet.' });
        }
      }
      state.phase = next;
      broadcast();
      return send(res, 200, adminState());
    }

    if (action === 'current') {
      const kind = body.kind === 'bread' ? 'bread' : 'cola';
      const list = kind === 'cola' ? COLAS : BREADS;
      const index = Math.max(0, Math.min(list.length - 1, Number(body.index) || 0));
      state.current = { kind, index };
      broadcast();
      return send(res, 200, adminState());
    }

    if (action === 'reveal') {
      const last = state.reveal.order.length - 1;
      if (body.step === 'back') state.reveal.index = Math.max(-1, state.reveal.index - 1);
      else state.reveal.index = Math.min(last, state.reveal.index + 1);
      broadcast();
      return send(res, 200, adminState());
    }

    if (action === 'remove') {
      delete state.players[String(body.id)];
      tokens.delete(String(body.id));
      broadcast();
      return send(res, 200, adminState());
    }

    if (action === 'reset') {
      const keepPlayers = state.players;
      state = emptyState();
      if (body.keepPlayers) {
        for (const player of Object.values(keepPlayers)) {
          state.players[player.id] = {
            ...player,
            submittedAt: null,
            picks: {
              cola: Array(COLAS.length).fill(null),
              bread: Array(BREADS.length).fill(null),
            },
          };
        }
      } else {
        tokens.clear();
      }
      broadcast();
      return send(res, 200, adminState());
    }
  }

  return send(res, 404, { error: 'not found' });
}

// --------------------------------------------------------------------- network

function lanAddresses() {
  const found = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) found.push({ name, address: addr.address });
    }
  }
  const rank = ({ address }) => {
    if (address.startsWith('192.168.')) return 0;
    if (address.startsWith('10.')) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
    return 3;
  };
  return found.sort((a, b) => rank(a) - rank(b));
}

function joinUrl() {
  if (process.env.JOIN_URL) return process.env.JOIN_URL.replace(/\/+$/, '');
  const best = lanAddresses()[0];
  return `http://${best ? best.address : 'localhost'}:${PORT}`;
}

// ------------------------------------------------------------------ start up

await mkdir(HERE, { recursive: true });
await load();

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'server error' });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const addresses = lanAddresses();
  const join = joinUrl();
  const line = '─'.repeat(52);
  console.log(`\n${line}`);
  console.log('  COLA & CRUMB — blind tasting');
  console.log(line);
  console.log(`  Guests   ${join}`);
  console.log(`  TV       ${join}/tv`);
  console.log(`  You      ${join}/admin     PIN ${ADMIN_PIN}`);
  console.log(line);
  if (addresses.length > 1) {
    console.log('  Other addresses on this machine:');
    for (const a of addresses.slice(1)) console.log(`    ${a.name}: http://${a.address}:${PORT}`);
    console.log('  If guests cannot connect, re-run with JOIN_URL set to one of these.');
    console.log(line);
  }
  console.log('  Open the TV page on the big screen. Guests scan the QR there.');
  console.log(`  Ctrl+C to stop. Progress is saved to ${DATA_FILE.replace(HERE, 'game')}.\n`);
});
