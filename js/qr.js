/* ===== Minimální QR generátor (byte mode, EC úroveň L, verze 1–13) =====
   Vlastní implementace podle ISO/IEC 18004, bez externích knihoven.
   Používá se jen pro přenos nastavení mezi zařízeními (Nastavení → QR).
   API: qrToCanvas(text, canvas, scale) → vykreslí QR, vrátí true/false. */
"use strict";

const QR = (() => {
  /* --- GF(256) aritmetika pro Reed–Solomon --- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gmul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

  /* generátorový polynom (koeficienty za vedoucí 1, od nejvyšší mocniny) */
  function genPoly(deg) {
    const result = new Uint8Array(deg);
    result[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) {
        result[j] = gmul(result[j], root);
        if (j + 1 < deg) result[j] ^= result[j + 1];
      }
      root = gmul(root, 2);
    }
    return result;
  }

  /* zbytek po dělení generátorem = ECC kódová slova bloku */
  function rsRemainder(data, ecLen) {
    const divisor = genPoly(ecLen);
    const result = new Uint8Array(ecLen);
    for (const b of data) {
      const factor = b ^ result[0];
      result.copyWithin(0, 1);
      result[ecLen - 1] = 0;
      for (let j = 0; j < ecLen; j++) result[j] ^= gmul(divisor[j], factor);
    }
    return result;
  }

  /* --- tabulky pro EC úroveň L, verze 1–13 ---
     [ecPerBlock, [[početBloků, datovýchCW], …]] */
  const BLOCKS = {
    1: [7, [[1, 19]]], 2: [10, [[1, 34]]], 3: [15, [[1, 55]]],
    4: [20, [[1, 80]]], 5: [26, [[1, 108]]], 6: [18, [[2, 68]]],
    7: [20, [[2, 78]]], 8: [24, [[2, 97]]], 9: [30, [[2, 116]]],
    10: [18, [[2, 68], [2, 69]]], 11: [20, [[4, 81]]],
    12: [24, [[2, 92], [2, 93]]], 13: [26, [[4, 107]]]
  };
  const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62]
  };

  function dataCapacity(v) {
    return BLOCKS[v][1].reduce((s, [n, len]) => s + n * len, 0);
  }

  function buildCodewords(bytes, v) {
    const capBits = dataCapacity(v) * 8;
    const cntBits = v <= 9 ? 8 : 16;
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);                 // byte mode
    push(bytes.length, cntBits);
    for (const b of bytes) push(b, 8);
    // terminátor + zarovnání na bajt
    push(0, Math.min(4, capBits - bits.length));
    while (bits.length % 8) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    const pads = [0xEC, 0x11];
    let p = 0;
    while (cw.length < dataCapacity(v)) cw.push(pads[p++ % 2]);
    return cw;
  }

  function interleave(cw, v) {
    const [ecLen, groups] = BLOCKS[v];
    const dataBlocks = [];
    let off = 0;
    for (const [count, len] of groups) {
      for (let i = 0; i < count; i++) {
        dataBlocks.push(cw.slice(off, off + len));
        off += len;
      }
    }
    const eccBlocks = dataBlocks.map(b => rsRemainder(Uint8Array.from(b), ecLen));
    const out = [];
    const maxData = Math.max(...dataBlocks.map(b => b.length));
    for (let i = 0; i < maxData; i++) {
      for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
    }
    for (let i = 0; i < ecLen; i++) {
      for (const b of eccBlocks) out.push(b[i]);
    }
    return out;
  }

  function matrix(text) {
    const bytes = new TextEncoder().encode(text);
    let v = 0;
    for (let i = 1; i <= 13; i++) {
      const cnt = i <= 9 ? 8 : 16;
      if (4 + cnt + bytes.length * 8 <= dataCapacity(i) * 8) { v = i; break; }
    }
    if (!v) return null; // moc dlouhé
    const size = 17 + 4 * v;
    const m = Array.from({ length: size }, () => new Uint8Array(size));
    const fn = Array.from({ length: size }, () => new Uint8Array(size));
    const set = (col, row, val) => { m[row][col] = val ? 1 : 0; fn[row][col] = 1; };

    // vyhledávací vzory + oddělovače
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    // časovací linky
    for (let i = 0; i < size; i++) {
      if (!fn[6][i]) set(i, 6, i % 2 === 0);
      if (!fn[i][6]) set(6, i, i % 2 === 0);
    }
    // zarovnávací vzory — vynechávají se jen 3 rohové kolize s vyhledávacími
    const ap = ALIGN[v];
    const lastIdx = ap.length - 1;
    for (let yi = 0; yi < ap.length; yi++) {
      for (let xi = 0; xi < ap.length; xi++) {
        if ((yi === 0 && xi === 0) || (yi === 0 && xi === lastIdx) || (yi === lastIdx && xi === 0)) continue;
        const cy = ap[yi], cx = ap[xi];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
    // rezervace formátových polí (přepíšou se níže)
    for (let i = 0; i < 9; i++) { fn[8][i] = 1; fn[i][8] = 1; }
    for (let i = 0; i < 8; i++) { fn[8][size - 1 - i] = 1; fn[size - 1 - i][8] = 1; }
    // informace o verzi (v ≥ 7)
    if (v >= 7) {
      let rem = v;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (v << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = (bits >>> i) & 1;
        const a = size - 11 + (i % 3), b = Math.floor(i / 3);
        set(a, b, bit);
        set(b, a, bit);
      }
    }
    // datové bity — cik-cak zprava, zatím bez masky
    const codewords = interleave(buildCodewords(bytes, v), v);
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (fn[y][x]) continue;
          let bit = 0;
          if (bitIdx < totalBits) {
            bit = (codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          m[y][x] = bit;
        }
      }
    }

    /* výběr masky podle penalizace (ISO 18004 N1–N4) */
    const MASKS = [
      (r, c) => (r + c) % 2 === 0,
      (r, c) => r % 2 === 0,
      (r, c) => c % 3 === 0,
      (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
      (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
      (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
      (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0
    ];

    const drawFormat = (mm, mask) => {
      const fdata = (1 << 3) | mask; // EC L = 1
      let frem = fdata;
      for (let i = 0; i < 10; i++) frem = (frem << 1) ^ ((frem >>> 9) * 0x537);
      const fbits = ((fdata << 10) | frem) ^ 0x5412;
      const gb = i => (fbits >>> i) & 1;
      const put = (col, row, val) => { mm[row][col] = val ? 1 : 0; };
      for (let i = 0; i <= 5; i++) put(8, i, gb(i));
      put(8, 7, gb(6)); put(8, 8, gb(7)); put(7, 8, gb(8));
      for (let i = 9; i < 15; i++) put(14 - i, 8, gb(i));
      for (let i = 0; i < 8; i++) put(size - 1 - i, 8, gb(i));
      for (let i = 8; i < 15; i++) put(8, size - 15 + i, gb(i));
      put(8, size - 8, 1); // tmavý modul
    };

    const penalty = mm => {
      let score = 0;
      const runScore = get => {
        let s = 0;
        for (let a = 0; a < size; a++) {
          let color = get(a, 0), run = 1;
          for (let b = 1; b < size; b++) {
            if (get(a, b) === color) run++;
            else { if (run >= 5) s += 3 + run - 5; color = get(a, b); run = 1; }
          }
          if (run >= 5) s += 3 + run - 5;
        }
        return s;
      };
      score += runScore((r, c) => mm[r][c]);           // N1 řádky
      score += runScore((c, r) => mm[r][c]);           // N1 sloupce
      for (let r = 0; r < size - 1; r++) {             // N2 bloky 2×2
        for (let c = 0; c < size - 1; c++) {
          const t = mm[r][c];
          if (t === mm[r][c + 1] && t === mm[r + 1][c] && t === mm[r + 1][c + 1]) score += 3;
        }
      }
      const finderPat = (get, a, b) => {               // N3 vzor 1011101 + 4 světlé
        const w = [];
        for (let k = 0; k < 11; k++) w.push(get(a, b + k));
        const core = [1, 0, 1, 1, 1, 0, 1];
        const eq = (arr, off, ref) => ref.every((x, k) => arr[off + k] === x);
        return (eq(w, 4, core) && w[0] + w[1] + w[2] + w[3] === 0)
            || (eq(w, 0, core) && w[7] + w[8] + w[9] + w[10] === 0);
      };
      for (let a = 0; a < size; a++) {
        for (let b = 0; b + 11 <= size; b++) {
          if (finderPat((x, y) => mm[x][y], a, b)) score += 40;
          if (finderPat((x, y) => mm[y][x], a, b)) score += 40;
        }
      }
      let dark = 0;                                    // N4 podíl tmavých
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += mm[r][c];
      score += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
      return score;
    };

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const mm = m.map(row => Uint8Array.from(row));
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!fn[r][c] && MASKS[mask](r, c)) mm[r][c] ^= 1;
        }
      }
      drawFormat(mm, mask);
      const s = penalty(mm);
      if (s < bestScore) { bestScore = s; best = mm; }
    }
    return best;
  }

  function toCanvas(text, canvas, scale = 6) {
    const m = matrix(text);
    if (!m) return false;
    const size = m.length, quiet = 4;
    const px = (size + quiet * 2) * scale;
    canvas.width = px; canvas.height = px;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = "#000";
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (m[y][x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
    return true;
  }

  return { toCanvas };
})();

function qrToCanvas(text, canvas, scale) { return QR.toCanvas(text, canvas, scale); }
