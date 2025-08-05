/*
https://www.reddit.com/r/netsec/comments/1vkuj6/new_openssh_key_format_and_bcrypt_pbkdf/
*/
import {Blowfish} from './blowfish.js'

const magicString = new TextEncoder().encode('OxychromaticBlowfishSwatDynamite')
reverseEndianness_32bit(magicString.buffer) // what a strange thing to do?!

function reverseEndianness_32bit(data) {
  data = new DataView(data)
  for (let i=0; i<data.byteLength; i+=4) { // reverse endianness of uint32 blocks
    data.setUint32(i, data.getUint32(i), true)
  }
  return data
}

async function getWebCrypto() {
  if (globalThis.crypto?.getRandomValues && globalThis.crypto?.subtle) {
    return globalThis.crypto
  } else if (globalThis.process?.versions?.node) { // if Node.js
    const crypto = await import('crypto')
    if (crypto?.webcrypto) return crypto.webcrypto
  }
  throw Error('Unable to load "Web Crypto API" getRandomValues and subtle.')
}
const webCrypto = await getWebCrypto()

// special version used only with bcrypt_pbkdf
export function bcrypt_hash(pass_sha512, salt_sha512) {
  const bf = new Blowfish(pass_sha512, salt_sha512)
  for (let i=0; i<64; i++) {
    bf.expandKey(salt_sha512)
    bf.expandKey(pass_sha512)
  }
  const hash = magicString.buffer.slice(0) // copy it
  for (let i=0; i<64; i++) {
    bf.raw_blowfish(hash, false, {littleEndianInput: true, inputAsOutput: true})
  }
  return hash
}

// Password-Based Key Derivation Function (custom PBKDF2 inspired code)
export async function bcrypt_pbkdf(pass, salt, rounds, keySize) {
  pass = dataToTypedArray(pass, Uint8Array, 'password')
  salt = dataToTypedArray(salt, Uint8Array, 'salt')
  salt = new DataView(new Uint8Array([...salt, 0, 0, 0, 0]).buffer)
  const key = new Uint8Array(keySize)
  const stride = Math.floor((key.byteLength-1 + 32)     / 32)
	let   amt    = Math.floor((key.byteLength-1 + stride) / stride)

  const pass_sha512 = await webCrypto.subtle.digest('SHA-512', pass)
  for (let count = 1, keylen = key.byteLength; keylen > 0; count++) {
    salt.setUint32(salt.byteLength-4, count) // make the salt unique
    const salt_sha512 = await webCrypto.subtle.digest('SHA-512', salt)
    const outHash = new Uint8Array(bcrypt_hash(pass_sha512, salt_sha512))
    let tempHash = outHash
    for (let round = 1; round < rounds; round++) {
      const salt_sha512 = await webCrypto.subtle.digest('SHA-512', tempHash)
      tempHash = new Uint8Array(bcrypt_hash(pass_sha512, salt_sha512))
      for (let i=0; i<outHash.byteLength; i++) {
        outHash[i] ^= tempHash[i]
      }
    }
		if (keylen < amt) amt = keylen
		for (let i = 0; i < amt; i++) {
      const offset = i * stride + (count - 1)
      key[offset] = outHash[i]
      if (offset >= key.byteLength) throw Error('out of bounds')
    }
		keylen -= amt
  }

  return key
}

function dataToTypedArray(data, TypedArray, inputTitle = 'data') {
  switch (typeof data) {
    case 'number': data += '' // convert to a string
    case 'string': return new TypedArray(new TextEncoder().encode(data).buffer)
    case 'object':
      if (data instanceof ArrayBuffer || Array.isArray(data)) {
        return new TypedArray(data)
      } else if (ArrayBuffer.isView(data)) { // DataView, TypedArray or Node.js Buffer
        return new TypedArray(data.buffer, data.byteOffset, (data.byteLength || data.length) / TypedArray.BYTES_PER_ELEMENT)
      }
  }
  throw Error('Invalid '+inputTitle+', it\'s not a BufferSource, String, Number or Array: '+data)
}
