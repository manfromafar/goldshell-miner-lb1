'use strict';

const ROUND_CONST = new Uint32Array([
  0x00000001, 0x00000000, 0x00008082, 0x00000000,
  0x0000808a, 0x80000000, 0x80008000, 0x80000000,
  0x0000808b, 0x00000000, 0x80000001, 0x00000000,
  0x80008081, 0x80000000, 0x00008009, 0x80000000,
  0x0000008a, 0x00000000, 0x00000088, 0x00000000,
  0x80008009, 0x00000000, 0x8000000a, 0x00000000,
  0x8000808b, 0x00000000, 0x0000008b, 0x80000000,
  0x00008089, 0x80000000, 0x00008003, 0x80000000,
  0x00008002, 0x80000000, 0x00000080, 0x80000000,
  0x0000800a, 0x00000000, 0x8000000a, 0x80000000,
  0x80008081, 0x80000000, 0x00008080, 0x80000000,
  0x80000001, 0x00000000, 0x80008008, 0x80000000
]);

function update(data, s) {
  const count = 34;

  for (let i = 0; i < count; i++)
    s[i] ^= data.readUInt32LE(i * 4);

  for (let n = 0; n < 48; n += 2) {
    const c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
    const c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
    const c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
    const c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
    const c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
    const c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
    const c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
    const c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
    const c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
    const c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

    const h0 = c8 ^ ((c2 << 1) | (c3 >>> 31));
    const l0 = c9 ^ ((c3 << 1) | (c2 >>> 31));
    const h1 = c0 ^ ((c4 << 1) | (c5 >>> 31));
    const l1 = c1 ^ ((c5 << 1) | (c4 >>> 31));
    const h2 = c2 ^ ((c6 << 1) | (c7 >>> 31));
    const l2 = c3 ^ ((c7 << 1) | (c6 >>> 31));
    const h3 = c4 ^ ((c8 << 1) | (c9 >>> 31));
    const l3 = c5 ^ ((c9 << 1) | (c8 >>> 31));
    const h4 = c6 ^ ((c0 << 1) | (c1 >>> 31));
    const l4 = c7 ^ ((c1 << 1) | (c0 >>> 31));

    s[0] ^= h0;
    s[1] ^= l0;
    s[10] ^= h0;
    s[11] ^= l0;
    s[20] ^= h0;
    s[21] ^= l0;
    s[30] ^= h0;
    s[31] ^= l0;
    s[40] ^= h0;
    s[41] ^= l0;

    s[2] ^= h1;
    s[3] ^= l1;
    s[12] ^= h1;
    s[13] ^= l1;
    s[22] ^= h1;
    s[23] ^= l1;
    s[32] ^= h1;
    s[33] ^= l1;
    s[42] ^= h1;
    s[43] ^= l1;

    s[4] ^= h2;
    s[5] ^= l2;
    s[14] ^= h2;
    s[15] ^= l2;
    s[24] ^= h2;
    s[25] ^= l2;
    s[34] ^= h2;
    s[35] ^= l2;
    s[44] ^= h2;
    s[45] ^= l2;

    s[6] ^= h3;
    s[7] ^= l3;
    s[16] ^= h3;
    s[17] ^= l3;
    s[26] ^= h3;
    s[27] ^= l3;
    s[36] ^= h3;
    s[37] ^= l3;
    s[46] ^= h3;
    s[47] ^= l3;

    s[8] ^= h4;
    s[9] ^= l4;
    s[18] ^= h4;
    s[19] ^= l4;
    s[28] ^= h4;
    s[29] ^= l4;
    s[38] ^= h4;
    s[39] ^= l4;
    s[48] ^= h4;
    s[49] ^= l4;

    const b0 = s[0];
    const b1 = s[1];
    const b32 = (s[11] << 4) | (s[10] >>> 28);
    const b33 = (s[10] << 4) | (s[11] >>> 28);
    const b14 = (s[20] << 3) | (s[21] >>> 29);
    const b15 = (s[21] << 3) | (s[20] >>> 29);
    const b46 = (s[31] << 9) | (s[30] >>> 23);
    const b47 = (s[30] << 9) | (s[31] >>> 23);
    const b28 = (s[40] << 18) | (s[41] >>> 14);
    const b29 = (s[41] << 18) | (s[40] >>> 14);
    const b20 = (s[2] << 1) | (s[3] >>> 31);
    const b21 = (s[3] << 1) | (s[2] >>> 31);
    const b2 = (s[13] << 12) | (s[12] >>> 20);
    const b3 = (s[12] << 12) | (s[13] >>> 20);
    const b34 = (s[22] << 10) | (s[23] >>> 22);
    const b35 = (s[23] << 10) | (s[22] >>> 22);
    const b16 = (s[33] << 13) | (s[32] >>> 19);
    const b17 = (s[32] << 13) | (s[33] >>> 19);
    const b48 = (s[42] << 2) | (s[43] >>> 30);
    const b49 = (s[43] << 2) | (s[42] >>> 30);
    const b40 = (s[5] << 30) | (s[4] >>> 2);
    const b41 = (s[4] << 30) | (s[5] >>> 2);
    const b22 = (s[14] << 6) | (s[15] >>> 26);
    const b23 = (s[15] << 6) | (s[14] >>> 26);
    const b4 = (s[25] << 11) | (s[24] >>> 21);
    const b5 = (s[24] << 11) | (s[25] >>> 21);
    const b36 = (s[34] << 15) | (s[35] >>> 17);
    const b37 = (s[35] << 15) | (s[34] >>> 17);
    const b18 = (s[45] << 29) | (s[44] >>> 3);
    const b19 = (s[44] << 29) | (s[45] >>> 3);
    const b10 = (s[6] << 28) | (s[7] >>> 4);
    const b11 = (s[7] << 28) | (s[6] >>> 4);
    const b42 = (s[17] << 23) | (s[16] >>> 9);
    const b43 = (s[16] << 23) | (s[17] >>> 9);
    const b24 = (s[26] << 25) | (s[27] >>> 7);
    const b25 = (s[27] << 25) | (s[26] >>> 7);
    const b6 = (s[36] << 21) | (s[37] >>> 11);
    const b7 = (s[37] << 21) | (s[36] >>> 11);
    const b38 = (s[47] << 24) | (s[46] >>> 8);
    const b39 = (s[46] << 24) | (s[47] >>> 8);
    const b30 = (s[8] << 27) | (s[9] >>> 5);
    const b31 = (s[9] << 27) | (s[8] >>> 5);
    const b12 = (s[18] << 20) | (s[19] >>> 12);
    const b13 = (s[19] << 20) | (s[18] >>> 12);
    const b44 = (s[29] << 7) | (s[28] >>> 25);
    const b45 = (s[28] << 7) | (s[29] >>> 25);
    const b26 = (s[38] << 8) | (s[39] >>> 24);
    const b27 = (s[39] << 8) | (s[38] >>> 24);
    const b8 = (s[48] << 14) | (s[49] >>> 18);
    const b9 = (s[49] << 14) | (s[48] >>> 18);

    s[0] = b0 ^ (~b2 & b4);
    s[1] = b1 ^ (~b3 & b5);
    s[10] = b10 ^ (~b12 & b14);
    s[11] = b11 ^ (~b13 & b15);
    s[20] = b20 ^ (~b22 & b24);
    s[21] = b21 ^ (~b23 & b25);
    s[30] = b30 ^ (~b32 & b34);
    s[31] = b31 ^ (~b33 & b35);
    s[40] = b40 ^ (~b42 & b44);
    s[41] = b41 ^ (~b43 & b45);
    s[2] = b2 ^ (~b4 & b6);
    s[3] = b3 ^ (~b5 & b7);
    s[12] = b12 ^ (~b14 & b16);
    s[13] = b13 ^ (~b15 & b17);
    s[22] = b22 ^ (~b24 & b26);
    s[23] = b23 ^ (~b25 & b27);
    s[32] = b32 ^ (~b34 & b36);
    s[33] = b33 ^ (~b35 & b37);
    s[42] = b42 ^ (~b44 & b46);
    s[43] = b43 ^ (~b45 & b47);
    s[4] = b4 ^ (~b6 & b8);
    s[5] = b5 ^ (~b7 & b9);
    s[14] = b14 ^ (~b16 & b18);
    s[15] = b15 ^ (~b17 & b19);
    s[24] = b24 ^ (~b26 & b28);
    s[25] = b25 ^ (~b27 & b29);
    s[34] = b34 ^ (~b36 & b38);
    s[35] = b35 ^ (~b37 & b39);
    s[44] = b44 ^ (~b46 & b48);
    s[45] = b45 ^ (~b47 & b49);
    s[6] = b6 ^ (~b8 & b0);
    s[7] = b7 ^ (~b9 & b1);
    s[16] = b16 ^ (~b18 & b10);
    s[17] = b17 ^ (~b19 & b11);
    s[26] = b26 ^ (~b28 & b20);
    s[27] = b27 ^ (~b29 & b21);
    s[36] = b36 ^ (~b38 & b30);
    s[37] = b37 ^ (~b39 & b31);
    s[46] = b46 ^ (~b48 & b40);
    s[47] = b47 ^ (~b49 & b41);
    s[8] = b8 ^ (~b0 & b2);
    s[9] = b9 ^ (~b1 & b3);
    s[18] = b18 ^ (~b10 & b12);
    s[19] = b19 ^ (~b11 & b13);
    s[28] = b28 ^ (~b20 & b22);
    s[29] = b29 ^ (~b21 & b23);
    s[38] = b38 ^ (~b30 & b32);
    s[39] = b39 ^ (~b31 & b33);
    s[48] = b48 ^ (~b40 & b42);
    s[49] = b49 ^ (~b41 & b43);

    s[0] ^= ROUND_CONST[n + 0];
    s[1] ^= ROUND_CONST[n + 1];

    //dump(s, `s:n=${n}`, 4)
  }
}
function sha3hns(data) {
  const state = new Uint32Array(50);

  update(data, state);

  const final = Buffer.alloc(136, 0);
  final[0] |= 6;
  final[135] |= 0x80;
  update(final, state);

  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i++)
    out[i] = state[i >> 2] >> (8 * (i & 3));

  return out;
}

module.exports = sha3hns;