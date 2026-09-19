// Minimal QR encoder: byte mode, error correction level M, versions 1-10.
// That covers any LAN URL (version 10 holds 213 bytes) with no dependencies,
// so the party server works with no npm install and no internet.

// [ec codewords per block, [blockCount, dataCodewordsPerBlock], ...]
const EC_M = {
  1: { ec: 10, groups: [[1, 16]] },
  2: { ec: 16, groups: [[1, 28]] },
  3: { ec: 26, groups: [[1, 44]] },
  4: { ec: 18, groups: [[2, 32]] },
  5: { ec: 24, groups: [[2, 43]] },
  6: { ec: 16, groups: [[4, 27]] },
  7: { ec: 18, groups: [[4, 31]] },
  8: { ec: 22, groups: [[2, 38], [2, 39]] },
  9: { ec: 22, groups: [[3, 36], [2, 37]] },
  10: { ec: 26, groups: [[4, 43], [1, 44]] },
};

const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function genPoly(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

function eccBlock(data, n) {
  const g = genPoly(n);
  const res = new Array(data.length + n).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (factor === 0) continue;
    for (let j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], factor);
  }
  return res.slice(data.length);
}

function dataCapacity(version) {
  const spec = EC_M[version];
  return spec.groups.reduce((sum, [count, size]) => sum + count * size, 0);
}

function pickVersion(byteLength) {
  for (let v = 1; v <= 10; v++) {
    const countBits = v < 10 ? 8 : 16;
    const available = dataCapacity(v) * 8 - 4 - countBits;
    if (byteLength * 8 <= available) return v;
  }
  throw new Error(`QR payload too long: ${byteLength} bytes`);
}

function encodeData(bytes, version) {
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  const capacityBits = dataCapacity(version) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < dataCapacity(version)) {
    codewords.push(pads[padIndex++ % 2]);
  }
  return codewords;
}

function interleave(codewords, version) {
  const spec = EC_M[version];
  const blocks = [];
  let offset = 0;
  for (const [count, size] of spec.groups) {
    for (let i = 0; i < count; i++) {
      const data = codewords.slice(offset, offset + size);
      offset += size;
      blocks.push({ data, ec: eccBlock(data, spec.ec) });
    }
  }

  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of blocks) {
      if (i < block.data.length) out.push(block.data[i]);
    }
  }
  for (let i = 0; i < spec.ec; i++) {
    for (const block of blocks) out.push(block.ec[i]);
  }
  return out;
}

function blankGrid(size) {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function placeFunctionPatterns(grid, version) {
  const size = grid.length;
  const set = (r, c, v) => {
    if (r >= 0 && r < size && c >= 0 && c < size) grid[r][c] = v;
  };

  const finder = (top, left) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inRing &&
          (r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(top + r, left + c, dark ? 1 : 0);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0 ? 1 : 0;
    grid[6][i] = dark;
    grid[i][6] = dark;
  }

  const centers = ALIGN[version];
  for (const r of centers) {
    for (const c of centers) {
      const nearFinder =
        (r <= 8 && c <= 8) ||
        (r <= 8 && c >= size - 9) ||
        (r >= size - 9 && c <= 8);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const edge = Math.max(Math.abs(dr), Math.abs(dc));
          grid[r + dr][c + dc] = edge === 1 ? 0 : 1;
        }
      }
    }
  }

  grid[size - 8][8] = 1;

  // Reserve the format areas so data placement skips them.
  for (let i = 0; i < 9; i++) {
    if (grid[8][i] === null) grid[8][i] = 0;
    if (grid[i][8] === null) grid[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (grid[8][size - 1 - i] === null) grid[8][size - 1 - i] = 0;
    if (grid[size - 1 - i][8] === null) grid[size - 1 - i][8] = 0;
  }

  if (version >= 7) {
    let bits = version << 12;
    for (let i = 17; i >= 12; i--) {
      if ((bits >> i) & 1) bits ^= 0x1f25 << (i - 12);
    }
    bits |= version << 12;
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const r = Math.floor(i / 3);
      const c = i % 3;
      grid[size - 11 + c][r] = bit;
      grid[r][size - 11 + c] = bit;
    }
  }
}

function placeData(grid, reserved, codewords) {
  const size = grid.length;
  const bits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  }

  let index = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (reserved[r][c]) continue;
        grid[r][c] = index < bits.length ? bits[index] : 0;
        index++;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function penalty(grid) {
  const size = grid.length;
  let score = 0;

  const runScore = (line) => {
    let total = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run++;
      } else {
        if (run >= 5) total += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) total += 3 + (run - 5);
    return total;
  };

  const FINDERS = [
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
  ];
  const patternScore = (line) => {
    let total = 0;
    for (let i = 0; i + 11 <= line.length; i++) {
      for (const pattern of FINDERS) {
        let match = true;
        for (let j = 0; j < 11; j++) {
          if (line[i + j] !== pattern[j]) {
            match = false;
            break;
          }
        }
        if (match) total += 40;
      }
    }
    return total;
  };

  for (let i = 0; i < size; i++) {
    const row = grid[i];
    const col = grid.map((r) => r[i]);
    score += runScore(row) + runScore(col);
    score += patternScore(row) + patternScore(col);
  }

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  let dark = 0;
  for (const row of grid) for (const v of row) dark += v;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

function applyFormat(grid, mask) {
  const size = grid.length;
  const format = (0b00 << 3) | mask; // level M
  let rem = format << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  const bits = ((format << 10) | rem) ^ 0x5412;

  for (let i = 0; i < 15; i++) {
    // i counts from the most significant format bit, which is placed first.
    const bit = (bits >> (14 - i)) & 1;
    if (i < 6) grid[8][i] = bit;
    else if (i < 8) grid[8][i + 1] = bit;
    else if (i === 8) grid[7][8] = bit;
    else grid[14 - i][8] = bit;

    // Seven modules up the left column, then eight along row 8 — the dark
    // module at (size-8, 8) sits between them and is not format data.
    if (i < 7) grid[size - 1 - i][8] = bit;
    else grid[8][size - 15 + i] = bit;
  }
}

/**
 * Encode `text` as a QR matrix: a 2D array of 0/1, no quiet zone.
 * `forceMask` pins the mask pattern instead of scoring all eight; it exists so
 * the encoder can be diffed against a reference implementation mask by mask.
 */
export function qrMatrix(text, { forceMask = null } = {}) {
  const bytes = Array.from(Buffer.from(String(text), 'utf8'));
  const version = pickVersion(bytes.length);
  const size = 17 + version * 4;

  const base = blankGrid(size);
  placeFunctionPatterns(base, version);
  const reserved = base.map((row) => row.map((v) => v !== null));

  const codewords = interleave(encodeData(bytes, version), version);
  placeData(base, reserved, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== null && mask !== forceMask) continue;
    const candidate = base.map((row) => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && MASKS[mask](r, c)) candidate[r][c] ^= 1;
      }
    }
    applyFormat(candidate, mask);
    const score = penalty(candidate);
    if (!best || score < best.score) best = { score, grid: candidate };
  }
  return best.grid;
}

/** Render `text` as a standalone SVG string sized to `size` CSS pixels. */
export function qrSvg(text, { size = 320, quiet = 3, dark = '#10100C', light = '#F4EDDC' } = {}) {
  const matrix = qrMatrix(text);
  const modules = matrix.length + quiet * 2;
  const path = [];
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (matrix[r][c]) path.push(`M${c + quiet} ${r + quiet}h1v1h-1z`);
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} ${modules}"`,
    ` width="${size}" height="${size}" shape-rendering="crispEdges" role="img"`,
    ` aria-label="QR code linking to ${escapeXml(String(text))}">`,
    `<rect width="${modules}" height="${modules}" fill="${light}"/>`,
    `<path fill="${dark}" d="${path.join('')}"/>`,
    `</svg>`,
  ].join('');
}

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (ch) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]
  ));
}
