
function bitFieldCheckMisalignment(bitIndex) {
  let misalignment = bitIndex % 8
  if (misalignment) {
    misalignment = 8 - misalignment
    throw Error(`The total number of bits in a bit-field must be aligned with a byte boundary, we're missing ${misalignment} of the most significant (leftmost) bits. This can be fixed by adding a padding field, e.g. "reserved: ${misalignment}" at the start.`)
  }
}

function writeBitField(template, values) {
  if (typeof template != 'object') throw Error(`A bit-field's template must be an object.`)
  if (typeof values != 'object') throw Error(`A bit-field's values must be contained in an object.`)
  const templateArr = Object.entries(template)
  let bigInt = 0n, bitIndex = 0n
  for (let [key, bitWidth] of templateArr.reverse()) {
    if (typeof bitWidth != 'number') throw Error('The bit width must be a number.')
    const signed = bitWidth < 0 // (denotes a signed integer)
    if (signed) bitWidth = -bitWidth
    bitWidth = BigInt(bitWidth)
    const value = BigInt(values[key] ?? 0) // defaults to 0
    let overflow
    if (signed) { // then 1 bit is used as the two's complement sign bit
      if (value < 0n) {
        const min = - (2n ** (bitWidth-1n))
        overflow = value < min
      } else {
        const max = 2n ** (bitWidth-1n) - 1n
        overflow = value > max
      }
    } else {
      if (value < 0n) throw Error(`The bit-field declared an unsigned value at key "${key}", but ${value} attempted to be written.`)
      const max = (2n ** bitWidth) - 1n
      overflow = value > max
    }
    if (overflow) throw Error(`A value of ${value} would overflow the defined bit width of ${bitWidth} for ${signed ? 'a signed' : 'an unsigned'} value in the bit-field at key "${key}".`)
    if (signed) { // (avoids affecting the sign of the bigInt itself)
      bigInt |= BigInt.asUintN(Number(bitWidth), value) << bitIndex
    } else {
      bigInt |= value << bitIndex
    }
    bitIndex += bitWidth
  }
  bitFieldCheckMisalignment(Number(bitIndex))
  return bigInt
}

function readBitField(template, bigInt) {
  if (typeof template != 'object') throw Error(`A bit-field's template must be an object.`)
  const templateArr = Object.entries(template)
  const result = {...template} // (to copy key order)
  let bitIndex = 0
  for (let [key, bitWidth] of templateArr.reverse()) {
    if (typeof bitWidth != 'number') throw Error('The bit width must be a number.')
    const signed = bitWidth < 0 // (denotes a signed integer)
    if (signed) bitWidth = -bitWidth
    const value = signed ?
      BigInt.asIntN (bitWidth, bigInt >> BigInt(bitIndex)) :
      BigInt.asUintN(bitWidth, bigInt >> BigInt(bitIndex))
    // bitWidth = BigInt(bitWidth)
    // const mask = (2n ** bitWidth) - 1n
    // let value = (bigInt >> bitIndex) & mask
    // if (signed && value >> (bitWidth-1n) & 1n) {
    //   value = BigInt.asIntN(Number(bitWidth), value)
    //   // value = (-value - 1n) ^ mask // convert to negative number
    // }
    if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
      result[key] = value
    } else {
      result[key] = Number(value)
    }
    bitIndex += bitWidth
  }
  bitFieldCheckMisalignment(bitIndex)
  return result
}

function bytesNeeded(template) {
  const bitSize = Object.values(template).reduce((sum, bits) => sum + Math.abs(bits))
  return Math.ceil(bitSize / 8)
}

export {
  writeBitField,
  readBitField,
  writeBitField as write,
  readBitField as read,
  bytesNeeded
}

// const template = {
//   d: -2, e: -6, f: -16, // - denotes signed values
// }
// const bigInt = writeBitField(template, {
//   d: -2, e: 31, f: -32768
// })

// console.log(bigInt)
// console.log(readBitField(template, bigInt))
