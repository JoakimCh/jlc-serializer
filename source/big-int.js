
// export function intToBytes(bigInt, littleEndian, fixedSize) {
//   if (typeof bigInt != 'bigint') throw TypeError('Expected a BigInt!')
//   const negative = bigInt < 0n
//   let bitString = (negative ? -bigInt-1n : bigInt).toString(2)
//   // if leftmost bit is set then another bit is needed for the sign bit
//   const bitLength = bitString.length + 1//(bitString[0] === '1' ? 1 : 0)
//   const neededBytes = Math.ceil(bitLength / 8)
//   if (fixedSize && neededBytes > fixedSize) throw Error(`The BigInt needs more bytes than the suggested fixedSize of ${fixedSize}.`)
//   const neededBits = (fixedSize || neededBytes) * 8 // round up to nearest byte boundary
//   if (negative) { // then toString(2) doesn't give the correct output unless we remove the sign bit
//     const mask = (2n ** BigInt(neededBits)) - 1n // mask all but the sign bit
//     bitString = (bigInt & mask).toString(2) // extract the bits
//     // this automatically sets the sign bit (since any negative two's complement number is padded with set bits)
//   } else {
//     bitString = bitString.padStart(neededBits, '0')
//     // the zero padding here ensures that the sign bit is 0
//   }
//   return bitStringToBytes(bitString, littleEndian, fixedSize || neededBytes)
// }

// export function uintToBytes(bigInt, littleEndian, fixedSize) {
//   if (typeof bigInt != 'bigint') throw TypeError('Expected a BigInt!')
//   if (bigInt < 0n) throw Error(`bigUintToBytes can't write a negative integer`)
//   let bitString = bigInt.toString(2) // extract the bits (and find out how many)
//   const neededBytes = Math.ceil(bitString.length / 8)
//   const neededBits = (fixedSize || neededBytes) * 8 // round up to nearest byte boundary
//   if (fixedSize && neededBytes > fixedSize) throw Error(`The BigInt needs more bytes than the suggested fixedSize of ${fixedSize}.`)
//   bitString = bitString.padStart(neededBits, '0')
//   return bitStringToBytes(bitString, littleEndian, fixedSize || neededBytes)
// }

export function uintToBytes(bigInt, littleEndian = true, fixedSize = false, noOverflow = true) {
  if (typeof bigInt != 'bigint') throw TypeError('Expected a BigInt.')
  if (bigInt < 0n) throw Error(`Expected an unsigned (positive) BigInt, not ${bigInt}.`)
  let numBytes
  if (fixedSize) {
    numBytes = fixedSize
    if (noOverflow) {
      const max = 2n ** BigInt(fixedSize * 8) - 1n
      if (bigInt > max) throw Error(`The BigInt ${bigInt} will not fit in the fixedSize of ${fixedSize} bytes.`)
    }
  } else {
    const neededBits = countBits(bigInt)
    numBytes = Math.ceil(neededBits / 8)
  }
  const bytes = new Uint8Array(numBytes)
  const numBits = numBytes * 8 // round up to nearest byte boundary
  let byteIndex = (littleEndian ? numBytes-1 : 0)
  for (let bitIndex=numBits-8; bitIndex>=0; bitIndex-=8) {
    const byte = Number(bigInt >> BigInt(bitIndex) & 0xFFn)
    bytes[byteIndex] = byte
    littleEndian ? byteIndex-- : byteIndex++
  }
  return bytes
}

export function intToBytes(bigInt, littleEndian = true, fixedSize = false, noOverflow = true) {
  if (typeof bigInt != 'bigint') throw TypeError('Expected a BigInt.')
  const negative = bigInt < 0n
  let numBytes
  if (fixedSize) {
    numBytes = fixedSize
    if (noOverflow) {
      let overflow
      if (negative) {
        const min = - (2n ** BigInt(fixedSize * 8 - 1))
        overflow = bigInt < min
      } else {
        const max = 2n ** BigInt(fixedSize * 8 - 1) - 1n
        overflow = bigInt > max
      }
      if (overflow) throw Error(`The signed BigInt ${bigInt} will not fit in the fixedSize of ${fixedSize} bytes.`)
    }
  } else {
    const neededBits = countBits(bigInt, true)
    numBytes = Math.ceil(neededBits / 8)
  }
  const bytes = new Uint8Array(numBytes)
  const numBits = numBytes * 8 // round up to nearest byte boundary
  let byteIndex = (littleEndian ? numBytes-1 : 0)
  for (let bitIndex=numBits-8; bitIndex>=0; bitIndex-=8) {
    const byte = Number(bigInt >> BigInt(bitIndex) & 0xFFn)
    bytes[byteIndex] = byte
    littleEndian ? byteIndex-- : byteIndex++
  }
  return bytes
}

export function uintFromBytes(bytes, littleEndian = true) {
  const lastIndex = BigInt(bytes.length-1)
  let bigInt = 0n
  for (let i=lastIndex; i>=0; i--) {
    bigInt |= BigInt(bytes[littleEndian ? i : lastIndex-i]) << 8n * i
  }
  return bigInt
}

/** Read a "two's complement" BigInt (meaning it supports signed numbers) from an array of bytes. */
export function intFromBytes(bytes, littleEndian = true) {
  const bigInt = uintFromBytes(bytes, littleEndian)
  // const numBits = BigInt(bytes.length * 8)
  return BigInt.asIntN(bytes.length * 8, bigInt)
  // if (bigInt >> bitSize - 1n) { // check the sign bit
  //   const mask = (2n ** bitSize) - 1n // mask all but the sign bit
  //   return (-bigInt - 1n) ^ mask // convert to negative number
  // }
  // return bigInt
}

/** Count the bits of a BigInt. If a signed number then enable `includeSignBit` for the correct count. */
function countBits(bigInt, includeSignBit) {
  const negative = bigInt < 0n
  let v = negative ? -bigInt-1n : bigInt
  // a negative bigInt as the inverted two's complement (so we can easily count the bits excluding the sign bit)
  if (bigInt === -1n) return 1
  // console.log(v.toString(2))
  let count = 0
  for (; v > 0n; v >>= 1n) count ++
  if (includeSignBit) count ++
  return count
}

// function bitStringToBytes(bitString, littleEndian, neededBytes = Math.ceil(bitString.length / 8)) {
//   const neededBits = neededBytes * 8
//   const bytes = new Uint8Array(neededBytes)
//   let byteIndex = (littleEndian ? 0 : bytes.length-1)
//   for (let bitIndex=neededBits; bitIndex>=0; bitIndex-=8) {
//     const byteBin = bitString.substring(bitIndex-8, bitIndex)
//     bytes[byteIndex] = parseInt(byteBin, 2)
//     littleEndian ? byteIndex++ : byteIndex--
//   }
//   return bytes
// }

// const littleEndian = 1
// const b = intToBytes(0b1111_1111_1111_1111n, littleEndian)
// console.log(b.length, [...b])
// console.log(intFromBytes(b, littleEndian))
