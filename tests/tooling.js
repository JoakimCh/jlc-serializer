
/** For testing equality. */
function JSON_Replacer(_key, value) {
  switch (typeof value) {
    case 'undefined': return 'undefined'
    case 'bigint': return value.toString()+'n'
    case 'symbol': return value.toString()
  }
  if (Number.isNaN(value)) return 'NaN'
  switch (value) {
    case Infinity: return 'Infinity'
    case -Infinity: return '-Infinity'
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...value, // + anything enumerable
      cause: value.cause,
    }
  }
  if (value instanceof DataView) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value instanceof RegExp) return value.source
  if (value instanceof Set) return [...value.values()]
  if (value instanceof Map) return [...value.entries()]
  return value
}

export function convertToDeepComparable(object) {
  return JSON.parse(JSON.stringify(object, JSON_Replacer))
}

const byteHexLookup = new Array(256)
for (let byte=0; byte<=0xFF; byte++) {
  byteHexLookup[byte] = byte.toString(16).toUpperCase().padStart(2, '0')
}

export function bytesToHex(bytes) {
  return bytes.reduce((hex, byte) => hex + byteHexLookup[byte], '')
}

export function hexToBytes(hex) {
  const uint8Array = new Uint8Array(hex.length / 2)
  for (let i=0, byteIndex=0; i<hex.length; i+=2) {
    uint8Array[byteIndex++] = parseInt(hex.slice(i, i+2), 16)
  }
  return uint8Array
}
