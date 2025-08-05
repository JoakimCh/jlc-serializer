
import * as big from './big-int.js'

const MSG_INVALID = 'Invalid any binary format.'

export function writeAny(value) {
  const offsetAfterTypeAndSize = (size) => {
    if (size <= 0xFF) return this.offset + 2
    else if (size <= 0xFFFF) return this.offset + 3
    else if (size <= 0xFFFF_FFFF) return this.offset + 5
    else return this.offset + 9
  }
  const writeTypeAndSize = (type, size) => {
    let lType
    if (size <= 0xFF) lType = 0
    else if (size <= 0xFFFF) lType = 1
    else if (size <= 0xFFFF_FFFF) lType = 2
    else if (size <= Number.MAX_SAFE_INTEGER) lType = 3
    else throw new BinarySerializerError('What the bloody fuck man?!')
    this.u8(type | (lType << 6)) // write data type
    switch (lType) {             // write data size
      case 0: this.u8(size); break
      case 1: this.u16(size); break
      case 2: this.u32(size); break
      case 3: this.u64(BigInt(size)); break
    }
  }
  const writeType = (type, subType = 0, subTypeFromSize = false) => {
    if (subTypeFromSize) {
      if (subType <= 0xFF) subType = 0
      else if (subType <= 0xFFFF) subType = 1
      else if (subType <= 0xFFFF_FFFF) subType = 2
      else if (subType <= Number.MAX_SAFE_INTEGER) subType = 3
      else throw new BinarySerializerError('What the bloody fuck man?!')
    }
    this.u8(type | (subType << 6))
  }
  const writeString = (string) => {
    const bytes = new TextEncoder().encode(string)
    writeTypeAndSize(type, bytes.byteLength)
    this.pushBytes(bytes)
  }
  let type // 0-63 (6 bits)
  // let lType // 0-3 (2 bits)
  switch (typeof value) {
    case 'object': {
      if (value == null) {
        writeType(28, 1)
        return
      }
      const previousOffset = this.objectsOffsetMap.get(value)
      if (previousOffset != undefined) {    type = 63 // has been written before
        writeTypeAndSize(type, previousOffset)
        break // do not write it again
      } else {
        this.objectsOffsetMap.set(value, this.offset) // keep track of the offset
      }
      if (value instanceof ArrayBuffer) {   type = 0
        writeTypeAndSize(type, value.byteLength) // write data size
        this.pushBytes(new Uint8Array(value))
      } else if (ArrayBuffer.isView(value)) { // type 1 to 12
        if (value instanceof DataView) type = 1
        else if (value instanceof Uint8ClampedArray) type = 2
        //
        else if (value instanceof Uint8Array) type = 3
        else if (value instanceof Uint16Array) type = 4
        else if (value instanceof Uint32Array) type = 5
        else if (value instanceof BigUint64Array) type = 6
        //
        else if (value instanceof Int8Array) type = 7
        else if (value instanceof Int16Array) type = 8
        else if (value instanceof Int32Array) type = 9
        else if (value instanceof BigInt64Array) type = 10
        //
        else if (value instanceof Float32Array) type = 11
        else if (value instanceof Float64Array) type = 12
        else {
          throw new BinarySerializerError('Unsupported ArrayBufferView type: '+value)
        }
        if (this.typedArrayAlignment && value.BYTES_PER_ELEMENT) {
          let misalignment = offsetAfterTypeAndSize(value.byteLength) % value.BYTES_PER_ELEMENT
          if (misalignment) {
            misalignment = value.BYTES_PER_ELEMENT - misalignment
            writeType(29, misalignment > 1)
            if (misalignment > 1) {
              this.u8(misalignment-2) // might be zero for zero extra bytes
              if (misalignment-2) { // if not zero
                this.pushBytes(new Uint8Array(misalignment-2))
              }
            }
          }
        }
        writeTypeAndSize(type, value.byteLength)
        this.pushBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      } else if (value instanceof Array) {  type = 13
        const array = value
        writeTypeAndSize(type, array.length)
        for (const value of array) {
          this.writeAny(value)
        }
      } else if (value instanceof Map) {    type = 14
        const map = value
        writeTypeAndSize(type, map.size)
        for (const [key, value] of map) {
          this.writeAny(key)
          this.writeAny(value)
        }
      } else if (value instanceof Set) {    type = 15
        const set = value
        writeTypeAndSize(type, set.size)
        for (const value of set) {
          this.writeAny(value)
        }
      // } else if (value instanceof Blob) { // would have to be async
      } else if (value instanceof RegExp) { type = 16
        writeString(value.source)
      } else if (value instanceof Error || value instanceof DOMException) { type = 17
        writeType(type, value instanceof DOMException)
        const error = value
        const errorProps = { 
          name:    error.name,
          message: error.message,
          stack:   error.stack,
          ...error
        }
        if ('cause' in error) errorProps.cause = error.cause
        this.writeAny(errorProps)
      } else if (value instanceof Date) {   type = 18
        writeType(type)
        this.u64(BigInt(value.getTime()))
      } else { /* any other object */       type = 19
        let numKeys = 0
        for (const key in value) numKeys++
        writeTypeAndSize(type, numKeys)
        for (const key in value) {
          this.writeAny(key)
          this.writeAny(value[key])
        }
      }
    } break
    case 'bigint': { type = 20
      const bytes = big.intToBytes(value, this.littleEndian)
      writeTypeAndSize(type, bytes.byteLength)
      this.pushBytes(bytes)
    } break
    case 'boolean': { type = 21
      writeType(type, value ? 1 : 0)
    } break
    case 'function': { type = 22
      writeString(value.toString())
    } break
    case 'number': { // type 23-25
      if (Number.isFinite(value)) {
        if (Number.isInteger(value)) {
          // we use bigIntToBytes to easily write any integer in minimal amount of bytes
          const bytes = big.intToBytes(BigInt(value), this.littleEndian)
          writeTypeAndSize(23, bytes.byteLength)
          this.pushBytes(bytes)
        } else { // a float then
          type = 24
          writeType(type, this.lowPrecisionFloats)
          if (this.lowPrecisionFloats) {
            this.f32(value)
          } else {
            this.f64(value)
          }
        }
      } else { type = 25
        let lType
        if (Number.isNaN(value)) {
          lType = 0
        } else {
          switch (value) {
            case Infinity: lType = 1; break
            case -Infinity: lType = 2; break
            default: throw Error('Unknown type: '+value)
          }
        }
        writeType(type, lType)
      }
    } break
    case 'string': { type = 26
      writeString(value)
    } break
    case 'symbol': { type = 27
      writeString(value.description)
    } break
    case 'undefined': { type = 28
      writeType(type, 0) // subType 1 is null
    } break
  }
}

export function readAny(mustBe) {
  const readSize = (sizeType) => {
    switch (sizeType) {
      case 0: return this.u8()
      case 1: return this.u16()
      case 2: return this.u32()
      case 3: return Number(this.u64())
      default: throw Error(MSG_INVALID)
    }
  }
  const readTypedArray = (TypedArray) => {
    const size = readSize(subType)
    const bytes = this.getBytes(size)
    if (bytes.byteOffset % TypedArray.BYTES_PER_ELEMENT) {
      const alignedBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      return new TypedArray(alignedBuffer)
    } else {
      return new TypedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength / TypedArray.BYTES_PER_ELEMENT)
    }
  }
  const readString = () => {
    const size = readSize(subType)
    const bytes = this.getBytes(size)
    return new TextDecoder().decode(bytes)
  }
  const typeByte = this.u8()
  const type = typeByte & 0b0011_1111
  const subType = typeByte >> 6
  if (mustBe != undefined && type != mustBe) throw Error(MSG_INVALID)
  switch (type) {
    case 63: { // previous object offset
      const offset = readSize(subType)
      const previousObject = this.objectsOffsetMap.get(offset)
      if (!previousObject) throw Error(MSG_INVALID)
      return previousObject
    }
    case 0: { // ArrayBuffer
      const size = readSize(subType)
      const bytes = this.getBytes(size)
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    }
    case 1: { // DataView
      const size = readSize(subType)
      const bytes = this.getBytes(size)
      return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    }
    case 2: return readTypedArray(Uint8ClampedArray)

    case 3: return readTypedArray(Uint8Array)
    case 4: return readTypedArray(Uint16Array)
    case 5: return readTypedArray(Uint32Array)
    case 6: return readTypedArray(BigUint64Array)

    case 7: return readTypedArray(Int8Array)
    case 8: return readTypedArray(Int16Array)
    case 9: return readTypedArray(Int32Array)
    case 10: return readTypedArray(BigInt64Array)

    case 11: return readTypedArray(Float32Array)
    case 12: return readTypedArray(Float64Array)

    case 13: { // Array
      const array = []
      const size = readSize(subType)
      for (let i=0; i<size; i++) {
        array[i] = this.readAny()
      }
      return array
    }
    case 14: { // Map
      const map = new Map()
      const size = readSize(subType)
      for (let i=0; i<size; i++) {
        map.set(this.readAny(), this.readAny())
      }
      return map
    }
    case 15: { // Set
      const set = new Set()
      const size = readSize(subType)
      for (let i=0; i<size; i++) {
        set.add(this.readAny())
      }
      return set
    }
    case 16: return RegExp(readString())
    case 17: { // Error or DOMException
      const isDomExeption = subType
      const obj = this.readAny(19)
      let error
      if (isDomExeption) {
        error = new DOMException(obj.message, {cause: obj.cause, name: obj.name})
      } else {
        const args = [obj.message]
        if ('cause' in obj) args.push({cause: obj.cause})
        switch (obj.name) {
          case 'Error': error = new Error(...args); break
          case 'EvalError': error = new EvalError(...args); break
          case 'RangeError': error = new RangeError(...args); break
          case 'ReferenceError': error = new ReferenceError(...args); break
          case 'SyntaxError': error = new SyntaxError(...args); break
          case 'TypeError': error = new TypeError(...args); break
          case 'URIError': error = new URIError(...args); break
          default:
            error = new Error(...args)
            error.name = obj.name
          break
        }
      }
      for (const key in obj) {
        if (['name', 'message', 'cause'].includes(key)) continue
        error[key] = obj[key]
      }
      return error
    }
    case 18: { // Date
      return new Date(Number(this.u64()))
    }
    case 19: { // object
      const object = {}
      this.objectsOffsetMap.set(this.offset-1, object)
      const size = readSize(subType)
      for (let i=0; i<size; i++) {
        const key = this.readAny(26) // keys are only strings (symbols can't be iterated)
        const value = this.readAny()
        object[key] = value
      }
      return object
    }
    case 20: { // BigInt
      const size = readSize(subType)
      const bytes = this.getBytes(size)
      return big.intFromBytes(bytes, this.littleEndian)
    }
    case 21: { // Boolean
      return !!subType
    }
    case 22: { // Function
      return eval(`(${readString()})`)
    }
    case 23: { // Integer
      const size = readSize(subType)
      const bytes = this.getBytes(size)
      const bigInt = big.intFromBytes(bytes, this.littleEndian)
      return Number(bigInt)
    }
    case 24: { // Float
      return subType ? this.f32() : this.f64()
    }
    case 25: { // NaN, Infinity, -Infinity
      switch (subType) {
        case 0: return NaN
        case 1: return Infinity
        case 2: return -Infinity
      }
    }
    case 26: { // string
      return readString()
    }
    case 27: { // Symbol
      return Symbol(readString())
    }
    case 28: { // undefined or null
      return subType ? null : undefined
    }
    case 29: { // padding (alignment bytes)
      if (subType) { // if more than 1 alignment bytes
        const paddingSize = this.u8()
        if (paddingSize) this.getBytes(paddingSize)
      }
      return this.readAny() // then read the padded value
    }
  }
}
