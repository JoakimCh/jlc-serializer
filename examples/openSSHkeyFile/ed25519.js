/*
A translation of https://ed25519.cr.yp.to/python/ed25519.py
*/

import * as crypto from 'crypto'
const BASE_FIELD = 2n**255n - 19n // Base field
const GROUP_ORDER = 2n**252n + 27742317777372353535851937790883648493n //Group order
const CURVE_CONSTANT = -121665n * inv(121666n) //Curve constant
const const_i = expmod(2n, (BASE_FIELD-1n)/4n, BASE_FIELD)
const const_by = 4n * inv(5n)
const const_bx = xRecover(const_by)
function modulo(value, divisor) { // like % in Python
  return ((value % divisor) + divisor) % divisor
}
const BASE_POINT = [modulo(const_bx, BASE_FIELD), modulo(const_by, BASE_FIELD)]

// function expmod(base, exp, mod) {
//   if (exp == 0n) return 1n
//   const t = modulo(expmod(base, exp / 2n, mod) ** 2n, mod)
//   if (exp & 1n) return modulo(t * base, mod) 
//   return t
// }

// function expmod(base, exp, mod) {
//   if (exp == 0n) return 1n
//   if (exp & 1n) return modulo(expmod(base, exp / 2n, mod) ** 2n, mod)
//   return (base * modulo(expmod(base, exp - 1n, mod), mod)
// }

function expmod(base, exponent, modulus) { // see: https://en.wikipedia.org/wiki/Modular_exponentiation#Pseudocode
  if (modulus == 1n) return 0n // optional?
  let result = 1n
  base = modulo(base, modulus) // optional?
  while (exponent > 0n) {
    if (exponent & 1n) result = modulo(result * base, modulus)
    base = modulo(base * base, modulus)
    exponent >>= 1n // exponent /= 2n
  }
  return result
} 

function inv(x) {
  const r = expmod(x, BASE_FIELD - 2n, BASE_FIELD)
  return r
}

function xRecover(y) {
  const xx = (y*y-1n) * inv(CURVE_CONSTANT*y*y+1n)
  let x = expmod(xx, (BASE_FIELD+3n) / 8n, BASE_FIELD)
  if (modulo(x*x - xx, BASE_FIELD) != 0n) x = modulo(x*const_i, BASE_FIELD)
  if (x & 1n) x = BASE_FIELD-x // if (modulo(x, 2n) != 0n) x = BASE_FIELD-x
  return x
}

function edwards(point, Q) {
  const [x1, y1] = point
  const [x2, y2] = Q
  const x3 = (x1*y2 + x2*y1) * inv(1n+CURVE_CONSTANT*x1*x2*y1*y2)
  const y3 = (y1*y2 + x1*x2) * inv(1n-CURVE_CONSTANT*x1*x2*y1*y2)
  return [modulo(x3, BASE_FIELD), modulo(y3, BASE_FIELD)]
}

function scalarmult(point, e) {
  if (e == 0n) return [0n, 1n]
  let Q = scalarmult(point, e/2n)
  Q = edwards(Q, Q)
  if (e & 1n) Q = edwards(Q, point)
  return Q
}

function encodeint(y) {
  return Buffer.from(bytesFromBigInt(y, 32))
}

/** Point to buffer */
function encodepoint(P) {
  const x = P[0]; let y = P[1]
  // copy LSB of X into MSB of Y
  y &= ~(1n << 255n) // clear it
  if (x & 1n) y |= 1n << 255n // set it
  return Buffer.from(bytesFromBigInt(y, 32))
}

/** Convert left part (32 bytes) of byte-array to BigInt and clamp it. */
function leftClamped(key) {
  key[ 0] &= 0b1111_1000 // clear first 3 bits
  key[31] &= 0b0111_1111 // clear last bit
  key[31] |= 0b0100_0000 // set second last bit
  return bigIntFromBytes(key.subarray(0,32))
}

export function publicKey(extendedSeed) {
  const p = scalarmult(BASE_POINT, leftClamped(extendedSeed))
  return encodepoint(p)
}

function bytesFromBigInt(bigInt, bytesToGet, littleEndian=true) {
  if (typeof bigInt != 'bigint') throw Error('Number must be a standard BigInt.')
  if (!bytesToGet) throw Error('Please specify amount of bytes to get.')
  const bytes = new Uint8Array(bytesToGet)
  let startIndex = BigInt(bytesToGet - 1)
  for (let i=startIndex; i>=0; i--) {
    bytes[littleEndian ? i : startIndex-i] = Number((bigInt >> 8n * i) & 0xFFn)
  }
  return bytes
}

function bigIntFromBytes(bytes, littleEndian=true) {
  let bigInt = 0n, startIndex = BigInt(bytes.length-1)
  for (let i=startIndex; i>=0; i--) {
    bigInt |= BigInt(bytes[littleEndian ? i : startIndex-i]) << 8n * i
  }
  return bigInt
}

function hashToInt(data) {
  const bytes = crypto.createHash('sha512').update(data).digest()
  return bigIntFromBytes(bytes)
}

// clamped secret scalar as input
export function signature(msg, sk, publicKey) {
  const h = sk // hash already applied
  const a = leftClamped(sk)
  const r = hashToInt(Buffer.concat([h.subarray(32,64), msg]))
  const R = scalarmult(BASE_POINT, r)
  const S = modulo(
    r + hashToInt(Buffer.concat([encodepoint(R), publicKey, msg])) * a,
    GROUP_ORDER
  )
  return Buffer.concat([encodepoint(R), encodeint(S)])
}

function isoncurve(P) {
  const [x,y] = P
  return modulo(-x*x + y*y - 1n - CURVE_CONSTANT*x*x*y*y, BASE_FIELD) == 0n
}
function decodeint(bytes) {
  return bigIntFromBytes(bytes)
}
function decodepoint(bytes) {
  let y = bigIntFromBytes(bytes)
  const xLsb = y >> 255n & 1n
  y &= ~(1n << 255n) // clear MSB
  let x = xRecover(y)
  if ((x & 1n) != xLsb) x = BASE_FIELD - x
  const P = [x,y]
  if (!isoncurve(P)) throw Error("decoding point that is not on curve")
  return P
}
export function checkvalid(signature, message, publicKey) {
  // if len(s) != b/4: raise Exception("signature length is wrong")
  // if len(pk) != b/8: raise Exception("public-key length is wrong")
  const R = decodepoint(signature.subarray( 0,32))
  const S = decodeint  (signature.subarray(32,64))
  const A = decodepoint(publicKey)
  const h = hashToInt(Buffer.concat([signature.subarray(0,32), publicKey, message]))
  const res = scalarmult(BASE_POINT, S)
  const exp = edwards(R, scalarmult(A,h))
  // console.log(res)
  // console.log(exp)
  return res[0] == exp[0] && res[1] == exp[1]
  // if (res != exp) throw Error("signature does not pass verification")
}