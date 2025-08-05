/*
  https://github.com/JoakimCh/streamable-binary-serializer
  MIT License (see license.txt)
  Created by Joakim L. Christiansen
*/

import * as big from './big-int.js'
import * as bitField from './bit-field.js'
import {writeAny, readAny} from './any.js'

/** Platform endianness. */
const IS_LITTLE_ENDIAN = isLittleEndian()

/** The different types usable in a template. */
export const t = {
  /** Use a zero byte to mark the end of the string. */
  zeroTerminated: Symbol('zeroTerminated'),

  /** Unsigned 8-bit integer (0 to 255) */
  u8: Symbol( 'u8'), // (the description is the function inside of Template to use)
  /** Unsigned 16-bit integer (0 to 65535) */
  u16: Symbol('u16'),
  /** Unsigned 32-bit integer (0 to 4294967295) */
  u32: Symbol('u32'),
  /** Unsigned 64-bit integer (BigInt) */
  u64: Symbol('u64'),

  /** Signed 8-bit integer (-128 to 127) */
  i8: Symbol( 'i8'),
  /** Signed 16-bit integer (-32768 to 32767) */
  i16: Symbol('i16'),
  /** Signed 32-bit integer (-2147483648 to 2147483647) */
  i32: Symbol('i32'),
  /** Signed 64-bit integer (BigInt) */
  i64: Symbol('i64'),

  /** A 32-bit precision floating point number */
  f32: Symbol('f32'),
  /** A 64-bit precision floating point number */
  f64: Symbol('f64'),

  /** Can encode most JavaScript values or objects. */
  any: Symbol('any'),

  /** An IPv4 address. */
  IPv4: Symbol('IPv4'),

  /** A RegEx to check for a valid formatted e-mail address. */
  rxp_email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  /** A UTF-8 encoded string, zero-terminated unless a hardcoded length is specified or an integer type to store the length in (which would then precede the string). A string can optionally be passed some constraints `{min, max, regExp}` it must pass before writing. */
  string: function (...args) {
    if (args.length > 2) throw new SerializerError('Use no more than two arguments for the string() definition.')
    let lengthDefinition = t.zeroTerminated, constraints
    if (typeof args[0] == 'object') {
      if (typeof args[1] != 'undefined') throw new SerializerError('Pass the length definition before the constraints definition.')
      constraints = args[0]
    } else if (typeof args[0] != 'undefined') {
      lengthDefinition = args[0]
      if (typeof args[1] != 'undefined') {
        if (typeof args[1] != 'object') throw new SerializerError('The constraints definition must be an object.')
        constraints = args[1]
      }
    }
    if (constraints) {
      for (const key in constraints) {
        if (!['min', 'max', 'regExp'].includes(key)) throw new SerializerError(`The string constraints contained a constraint "${key}" that is not currently implemented.`)
      }
    }
    return function string(string) {
      if (this.writing) {
        if (typeof string != 'string') {
          string = string.toString()
        }
        if (constraints) {
          let {min, max, regExp} = constraints
          if (min || max) {
            const stringLength = [...string].length // (to correctly count unicode chars)
            if (stringLength < min) throw RangeError(`This string must be a minimum of ${min} characters, counted only ${stringLength} in "${string}".`)
            if (stringLength > max) throw RangeError(`This string must be a maximum of ${max} characters, counted ${stringLength} in "${string}".`)
          }
          if (regExp) {
            if (!Array.isArray(regExp)) regExp = [regExp]
            for (const rxp of regExp) {
              if (!(rxp instanceof RegExp)) throw Error('regExp must be a regular expression (an instance of RegExp).')
              if (!rxp.test(string)) throw Error(`This string failed a RegExp test (${rxp.title || rxp}): ${string}.`)
            }
          }
        }
      }
      return this.string(lengthDefinition, string)
    }
  },

  /** A number of the specified type which can optionally be passed some constraints `{min, max, only: [these]}` it must pass before writing. */
  number: function (type, constraints) {
    // todo: allow template function as type?
    switch (type) {
      case t.u8: case t.u16: case t.u32: case t.u64:
      case t.i8: case t.i16: case t.i32: case t.i64: 
      case t.f32: case t.f64: break
      default: throw new SerializerError(`"${type.toString()}" can't be used to define a number type.`)
    }
    if (constraints) {
      for (const key in constraints) {
        if (!['min', 'max', 'only'].includes(key)) throw new SerializerError(`The number constraints contained a constraint (${key}) that is not currently implemented.`)
      }
    }
    return function number(value) {
      if (this.writing && constraints) {
        let {min, max, only} = constraints
        if (only) {
          if (!Array.isArray(only)) only = [only]
          if (!only.includes(value)) throw Error(`This number isn't allowed to be ${value}.`)
        }
        if (min || max) {
          if (value < min) throw RangeError(`This number must be a minimum of ${min}, not ${value}.`)
          if (value > max) throw RangeError(`This number must be a maximum of ${max}, not ${value}.`)
        }
      }
      return this[type.description](value)
    }
  },

  /** Any generic binary content. Can write any ArrayBufferView, but reads it back into an Uint8Array. If the byte length is not specified it is instead preceded by an integer indicating the length. */
  bytes: function (length = t.u32) {
    return function bytes(bytes) {
      return this.bytes(length, bytes)
    }
  },//; 

  /** Any TypedArray (respecting the endianness used in the template). If the length is not specified it is instead preceded by an integer indicating the length of the array. */
  typedArray: function (type, length = t.u32) {
    let dvFunc
    switch (type) {
      default: throw new SerializerError(`Type must be a TypedArray class, e.g. Uint8Array, not ${type.toString()}.`)
      case Int8Array:  dvFunc = 'Int8'; break
      case Int16Array: dvFunc = 'Int16'; break
      case Int32Array: dvFunc = 'Int32'; break
      case Uint8Array:  dvFunc = 'Uint8'; break
      case Uint16Array: dvFunc = 'Uint16'; break
      case Uint32Array: dvFunc = 'Uint32'; break
      case Float32Array: dvFunc = 'Float32'; break
      case Float64Array: dvFunc = 'Float64'; break
      case BigInt64Array: dvFunc = 'BigInt64'; break
      case BigUint64Array: dvFunc = 'BigUint64'; break
      case Uint8ClampedArray: dvFunc = 'Uint8'; break
    }
    return function typedArray(typedArray) {
      if (this.writing) {
        if (type != typedArray.constructor) throw TypeError(`The array to write must match the type defined in the template (${type.name}).`)
      }
      return this.typedArray(type, dvFunc, length, typedArray)
    }
  },

  /** A signed BigInt. If the byte length is not specified it is instead preceded by an integer indicating the byte length of the value. */
  bigInt: function (byteLength = t.u32) {
    return function bigInt(value) {
      return this.bigInt({byteLength}, value)
    }
  },

  /** An unsigned BigInt. If the byte length is not specified it is instead preceded by an integer indicating the byte length of the value. */
  bigUint: function (byteLength = t.u32) {
    return function bigUint(value) {
      return this.bigUint({byteLength}, value)
    }
  },

  /** An array of the value defined in its template. */
  array: function (template, length = t.u32) {
    if (typeof template == 'string') throw Error(`The array() template must not be a string ("${template}"). Did you put a path before the template by mistake?`)
    return function array(array) {
      return this.array(template, length, array)
    }
  },

  integer: function({byteLength, signed, littleEndian} = {}) {
    if (typeof byteLength != 'number' || byteLength < 1) throw Error(`You must specify the {byteLength} of the integer.`)
    return function integer(value) {
      return this.integer({byteLength, signed, littleEndian}, value)
    }
  },

  /** A field of bits split into different values, e.g. values less than 8 bits and 1-bit flags. Its template specifies the values, order and their bit-lengths. */
  bitField: function (template) {
    return function bitField(values) {
      return this.bitField(template, values)
    }
  },

  /** Write the length of a string, array or ArrayBufferView at a path in the same object. */
  lengthOf: function (path, type = t.u32) {
    return function lengthOf(valueGiven) {
      if (this.writing) {
        if (valueGiven != undefined) throw Error(`lengthOf() keys must not be manually written.`)
        if (this.currentObject === null) throw Error(`We are not within any object, lengthOf() only works on keys or sub-keys within the same object.`)
        const value = valueFromPath(path, this.currentObject.object)
        switch (typeof value) {
          case 'undefined': // since an undefined array is allowed
            return this.writeLength(type, 0)
          case 'string': {
            const encoded = new TextEncoder().encode(value)
            return this.writeLength(type, encoded.byteLength)
          }
          case 'object': {
            if (Array.isArray(value) || (ArrayBuffer.isView(value) && value.BYTES_PER_ELEMENT)) {
              return this.writeLength(type, value.length)
            } else if (ArrayBuffer.isView(value)) {
              return this.writeLength(type, value.byteLength)
            }
          }
        }
        throw Error(`lengthOf() is not supported for the value at "${path}". It's only supported for strings, arrays and ArrayBufferViews. Consider using sizeOf() instead.`)
      } else {
        return this.readLength(type)
      }
    }
  },

  /** Write back the byte-size of any serialized data. If there is no future write at the given key path then it will fail. */
  sizeOf: function (templatePath, type = t.u32) {
    // console.log(path)
    return function sizeOf(valueGiven) {
      if (this.writing) {
        if (valueGiven != undefined) throw Error(`sizeOf keys must not be manually written.`)
        const dataView = this.writeLength(type, 0, {deferredWrite: true})
        // minus current key to get keyPath of parent object
        const path = pathResolve(templatePath, this.keyPath.slice(0,-1), true)
        // console.log(path)
        this.sizeBackWrite.set(path, {dataView, type})
      } else {
        return this.readLength(type)
      }
    }
  }
}
t.rxp_email.title = 'rxp_email'

/** Define a template used for binary serialization. The endianness (byte order) defaults to the platform endianness (usually little-endian), but `config.littleEndian` can be set to `true` or `false` to override it. */
export class BinaryTemplate {
  #template; #config; #Serializer

  /** 
   * @param {any} template The template definition.
   * @param {object} [config] Optional configuration.
   * @param {boolean} [config.littleEndian] Whether to use the little-endian byte order for multibyte values. If unset it defaults to the endianness of the platform.
   * @param {boolean} [config.lowPrecisionFloats] Whether to store floating point numbers with low precision when using the `t.any` type.
   * @param {boolean} [config.typedArrayAlignment] Whether to align TypedArrays (inserting padding bytes where needed) when using the `t.any` type for more performant decoding.
   * @param {any} [config.serializer] The binary serializer to use, it defaults to our `Serializer` but can be specified in case anyone wants to use an extended or custom version of it.
  */
  constructor(template, {
    littleEndian = IS_LITTLE_ENDIAN,
    lowPrecisionFloats = false,
    typedArrayAlignment = false,
    context,
    serializer = Serializer
  } = {}) {
    this.#template = template
    this.#Serializer = serializer
    this.#config = {
      littleEndian, lowPrecisionFloats, typedArrayAlignment, context
    }
  }

  /** Serialize the value into its binary form. */
  toBytes = (value) => {
    const s = new this.#Serializer(this.#config)
    try {
      s.write(this.#template, value)
      // s.pushBytes() // flush the scratch buffer
      s.finish()
      return concatenateChunks(s.chunks)
    } catch (error) {
      throw s.wrapError(error)
    } finally {
      s.cleanup()
    }
  }
  
  /** Deserialize the binary data into its value. */
  fromBytes = (bytes) => {
    if (bytes instanceof ArrayBuffer) {
      bytes = new Uint8Array(bytes)
    } else if (!ArrayBuffer.isView(bytes)) throw new SerializerError('fromBytes() must be given an ArrayBufferView passing ArrayBuffer.isView().')
    const s = new this.#Serializer({...this.#config, chunks: [bytes]})
    try {
      return s.read(this.#template)
    } catch (error) {
      throw s.wrapError(error)
    } finally {
      s.cleanup()
    }
  }

  /** Reads binary data from a readable and returns the result (according to the template). */
  async fromReadable(readable) {
    if (!(readable instanceof ReadableStream)) 
      throw new SerializerError('readable must be an instance of ReadableStream.')
    const chunks = []
    for await (const chunk of readable) {
      chunks.push(chunk)
    }
    const s = new this.#Serializer({...this.#config, chunks})
    try {
      return s.read(this.#template)
    } finally {
      s.cleanup()
    }
  }

  /** Writes the binary serialized value into the writable (according to the template). */
  async intoWritable(value, writable) {
    if (!(writable instanceof WritableStream)) 
      throw new SerializerError('writable must be an instance of WritableStream.')
    const s = new this.#Serializer(this.#config)
    try {
      s.write(template, value)
      // s.pushBytes() // flush the scratch buffer
      s.finish()
      const writer = writable.getWriter()
      for (const chunk of s.chunks) {
        await writer.ready
        await writer.write(chunk)
      }
      await writer.ready
      await writer.close()
    } finally {
      s.cleanup()
    }
  }

  /** Returns a readable stream which can be used to read the binary serialized value. */
  getReadable(value) {
    const s = new this.#Serializer(this.#config)
    try {        
      s.write(template, value)
      s.finish()
      // s.pushBytes() // flush the scratch buffer
    } catch (error) {
      s.cleanup()
      throw error
    }
    const iterator = s.chunks.values() // s.chunks[Symbol.iterator]()
    return new ReadableStream({
      pull(controller) {
        const {value, done} = iterator.next()
        if (done) {
          controller.close()
          s.cleanup()
        } else {
          controller.enqueue(value)
        }
      },
      cancel(reason) {
        s.cleanup()
      }
    })
  }

  /** Returns a writable stream which can be used to deserialize binary data. The writable.result is a promise which will resolve with the result when done or reject on an error. */
  getWritable() {
    let resolve, reject
    const resultPromise = new Promise((resolve_, reject_) => {
      resolve = resolve_
      reject = reject_
    })
    const chunks = []
    const writable = new WritableStream({
      write(chunk) {
        chunks.push(chunk)
      },
      abort(reason) {
        reject(reason)
      },
      close: () => {
        try {
          const s = new this.#Serializer({...this.#config, chunks})
          resolve(s.read(this.#template))
        } catch (error) {
          reject(error)
        }
        s.cleanup()
      }
    })
    writable.result = resultPromise
    return writable
  }
}

/** You're not supposed to use this directly, but you can extend it with more functions and specify to use the extended version in any `BinaryTemplate`. */
export class Serializer {
  #scratchSize = 1024; #scratchBytes; #scratchOffset

  writing; littleEndian; lowPrecisionFloats; typedArrayAlignment
  chunks; chunksTotalSize
  offset = 0 // to keep track of object offsets
  objectsOffsetMap = new Map()
  /** Our current object location as an array of nested keys. */
  keyPath = [];
  /** Our current object location as a path string. */
  keyPathS;
  /** Allows us to lookup {object, template} at any path string. */
  objAtPath = new Map()
  /** Allows lengthOf() to check length of sub values. */
  currentObject = null
  /** E.g. to know what caused an error. */
  currentTemplate
  sizeBackWrite = new Map()
  u8; u16; u32; u64
  i8; i16; i32; i64
  f32; f64
  // /** These are the different types usable in a binary template. We keep this reference to them so that any extensions can easily access them. */
  // t = t

  constructor({chunks, littleEndian, lowPrecisionFloats, typedArrayAlignment, context} = {}) {
    this.readAny = readAny
    this.writeAny = writeAny
    // Object.seal(this) // to minimize mistakes
    this.littleEndian = littleEndian
    this.lowPrecisionFloats = lowPrecisionFloats
    this.typedArrayAlignment = typedArrayAlignment
    if (!chunks) {
      this.writing = true
      this.chunks = []
      this.#scratchBytes = new Uint8Array(this.#scratchSize)
      this.#scratchOffset = 0
    } else {
      this.writing = false
      this.chunks = chunks
      this.chunksTotalSize = this.chunks.reduce(
        (sum, e) => sum + e.byteLength, 0
      )
    }
    this.#createNumberFunctions()
    if (context) {
      for (const key in context) {
        if (!['parent', 'ourLocation'].includes(key)) throw new SerializerError(`The context contained an unsupported property "${key}".`)
      }
      if (typeof context.parent != 'object') throw new SerializerError(`The context must have a "parent" property (an object) specifying the values of the parent object.`)
      if (typeof context.ourLocation != 'string') throw new SerializerError(`The context must have a "ourLocation" property (a string) specifying our location (path) in the parent object.`)
      this.loadContext(context.parent)
      this.keyPathS = context.ourLocation
      this.keyPath = context.ourLocation.split('/')
    }
  }

  /** Create the read/write functions for u8, i32, f64, etc... */
  #createNumberFunctions() {
    const table = [
      [ 'u8', 'getUint8',     'setUint8',     1, 0, 0xFF, 0],
      ['u16', 'getUint16',    'setUint16',    2, 0, 0xFFFF, 0],
      ['u32', 'getUint32',    'setUint32',    4, 0, 0xFFFF_FFFF, 0],
      [ 'i8', 'getInt8',      'setInt8',      1, 1, 0x7F, -0x80],
      ['i16', 'getInt16',     'setInt16',     2, 1, 0x7FFF, -0x8000],
      ['i32', 'getInt32',     'setInt32',     4, 1, 0x7FFF_FFFF, -0x8000_0000],
      ['f32', 'getFloat32',   'setFloat32',   4, 2, Infinity, -Infinity],
      ['f64', 'getFloat64',   'setFloat64',   8, 2, Infinity, -Infinity],
      ['u64', 'getBigUint64', 'setBigUint64', 8, 3, 0xFFFF_FFFF_FFFF_FFFFn, 0n],
      ['i64', 'getBigInt64',  'setBigInt64',  8, 4, 0x7FFF_FFFF_FFFF_FFFFn, -0x8000_0000_0000_0000n],
    ]
    for (const [title, getTitle, setTitle, byteWidth, type, max, min] of table) {
      this[title] = function(value = 0, {deferredWrite, dataView, littleEndian = this.littleEndian} = {}) {
        if (this.writing) {
          if (type >= 3) {
            switch (typeof value) {
              default: throw TypeError(`Value must be a number or a BigInt, not: ${value}.`)
              case 'bigint': break
              // case 'undefined': value = 0n; break
              case 'number':
                if (!Number.isSafeInteger(value)) {
                  throw TypeError(`When using a number instead of BigInt it must pass Number.isSafeInteger().`)
                }
                value = BigInt(value)
            }
            if (typeof value != 'bigint') {
              throw TypeError(`Value must be a BigInt, received ${value}.`)
            }
          // } else if (typeof value == 'undefined') {
          //   value = 0
          } else if (typeof value != 'number') {
            throw TypeError(`Value must be a number, not: ${value}.`)
          } else if (type != 2 && !Number.isInteger(value)) {
            throw TypeError(`Value must not be a floating point number, received ${value}.`)
          }
          if ((value > max || value < min)) throw RangeError(`${title} value overflow (${min} to ${max}), value: ${value}.`)
          if (!dataView) dataView = this.getScratch(byteWidth, true)
          if (deferredWrite) return dataView
          dataView[setTitle](0, value, littleEndian)
        } else {
          const dataView = this.getBytes(byteWidth, true)
          return dataView[getTitle](0, littleEndian)
        }
      }
    }
  }

  // /** Relatively (from current key) resolve a path to another key in the template. */

  getValueFromPath(path) {
    // minus current key to get keyPath of parent object
    const {objectPath, objectKey} = pathResolve(path, this.keyPath.slice(0,-1))
    // console.log(objectPath)
    const {object} = this.objAtPath.get(objectPath) ?? {}
    if (!object) throw Error(`No object found at path "${objectPath}".`)
    if (!(objectKey in object)) throw Error(`No such key ("${objectKey}") found in the object with keys ${JSON.stringify(Object.keys(object))}.`)
    return object[objectKey]
  }
  // getObjectFromPath(path) {
  //   const {objectPath, objectKey} = this.resolvePathFromCurrent(path)
  //   const {template, object} = this.objAtPath.get() ?? {}
  //   if (!object) throw Error(`No object found at path "${objectPath}".`)
  //   return object
  // }  

  /** Clear any internal buffers, probably not needed. */
  cleanup() {
    this.objectsOffsetMap.clear()
    this.chunks.length = 0
    this.#scratchBytes = null
    this.objAtPath.clear()
    this.keyPath.length = 0
    this.sizeBackWrite.clear()
  }

  /** Commit any bytes in the scratch buffer and push a Uint8Array into the buffer (if given). */
  pushBytes(view) {
    if (this.#scratchOffset) { // if stuff written to scratch buffer
      this.chunks.push(this.#scratchBytes.subarray(0, this.#scratchOffset))
      this.#scratchBytes = new Uint8Array(this.#scratchSize)
      this.#scratchOffset = 0
    }
    if (view) {
      if (!(view instanceof Uint8Array)) throw Error(`Don't use pushBytes with anything other than a Uint8Array!`)
      this.chunks.push(view)
      this.offset += view.byteLength
    }
  }

  /** Get a scratch buffer for smaller writes (<= #scratchSize) */
  getScratch(bytesNeeded, asDataView) {
    if (bytesNeeded > this.#scratchSize) throw Error('This should not happen.')
    if (this.#scratchOffset + bytesNeeded > this.#scratchSize) {
      this.pushBytes() // push scratch and create new
    }
    // get a restricted view
    const uint8Array = this.#scratchBytes.subarray(this.#scratchOffset, this.#scratchOffset + bytesNeeded)
    this.#scratchOffset += bytesNeeded
    this.offset += bytesNeeded
    if (asDataView) {
      return new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength)
    } else {
      return uint8Array
    }
  }

  wrapError(error) {
    const template = this.currentTemplate
    const title = typeof template == 'function' ? template.name+'()' : template.description || template.toString()
    const action = this.writing ? 'writing' : 'reading'
    if (this.keyPath.length) {
      return new SerializerError(`Error ${action} "${title}" at position "${this.keyPath.join('/')}" of the binary template; ${error.message}`, {cause: error})
    } else {
      return new SerializerError(`Error ${action} binary template "${title}"; ${error.message}`, {cause: error})
    }
  }

  /** Read or write any value based on the given template. */
  value(template, value) {
    if (this.writing) this.write(template, value)
    else return this.read(template)
  }
  
  /** Read something. */
  read(template) {
    this.currentTemplate = template
    switch (typeof template) {
      case 'function':
        return template.call(this)
      case 'object':
        return this.object(template, {})
      case 'symbol':
        if (template.description in this) {
          return this[template.description]()
        }
      break
    }
    throw Error(`Unknown template type: ${template.toString()}.`)
  }

  /** Write something. */
  write(template, value) {
    if (value instanceof Promise) throw Error('Tried to write a Promise, but they are not supported (since the serializer is not asynchronous).')
    const offsetWas = this.offset
    this.currentTemplate = template
    switch (typeof template) {
      default: throw Error(`Unknown template type: ${template}.`)
      case 'function':
        if (t[template.name] === template) throw Error(`"${template.name}" is a "template function" (meaning it can be customized with one or more parameters) and must be used in the template with () at the end, like this "${template.name}()" instead of just "${template.name}".`)
        template.call(this, value)
      break
      case 'object':
        this.object(template, value)
      break
      case 'symbol':
        if (template.description in this) {
          this[template.description](value)
        } else throw Error(`Unknown template type: ${template.toString()}.`)
      break
    }
    // console.log(this.keyPathS)
    const {dataView, type} = this.sizeBackWrite.get(this.keyPathS) ?? {}
    if (dataView) {
      this.sizeBackWrite.delete(this.keyPathS)
      const size = this.offset - offsetWas
      this.writeLength(type, size, {dataView})
    }
  }

  finish() {
    if (this.writing) {
      this.pushBytes() // flush the scratch buffer
      if (this.sizeBackWrite.size) {
        throw Error('Some sizeOf keys were never written: '+JSON.stringify([...this.sizeBackWrite.entries()], null, 2))
      }
    }
  }

  /** Read the length of something. */
  readLength(type) {
    switch (typeof type) {
      default: 
        switch (type) {
          case t.u8: case t.u16: case t.u32: 
          case t.i8: case t.i16: case t.i32:
            return this[type.description]()
          case t.u64: case t.i64:
            return Number(this[type.description]())
          default: throw TypeError(`${type.toString()} can't be used to store the length.`)
        } break
      case 'number': return type // a hardcoded length
      case 'string': { // read length from other key
        return this.getValueFromPath(type)
      }
    }
  }

  /** Write the length of something. */
  writeLength(type, length, {deferredWrite, dataView} = {}) {
    if (typeof length != 'number') throw TypeError(`The length must be a number, not: ${typeof length}.`)
    if (length < 0) throw RangeError(`A negative length is not allowed.`)
    switch (typeof type) {
      default: 
        switch (type) {
          case t.u8: case t.u16: case t.u32: case t.u64:
          case t.i8: case t.i16: case t.i32: case t.i64: break
          default: throw Error(`${type.toString()} can't be used to store the length.`)
        }
        try {
          return this[type.description](length, {deferredWrite, dataView})
        } catch (error) {
          if (error instanceof RangeError) throw RangeError(`${type.description} is too small to store a length of ${length}.`)
          throw error
        }
      break
      case 'number': // a hardcoded length
        if (type != length) throw RangeError(`The hardcoded length (${type}) differs from the length to write (${length}).`)
      break
      case 'string': // path to other value that has it
      break // then write nothing
    }
  }

  /** Consume `bytesNeeded` from the specified chunks and put back any leftovers. */
  consumeAndPutBackLeftover(chunks, bytesNeeded, leftovers = chunks) {
    if (bytesNeeded == chunks[0].byteLength) {
      return chunks.shift()
    } else if (bytesNeeded < chunks[0].byteLength) {
      const chunk = chunks[0]
      const uint8Array = chunk.subarray(0, bytesNeeded)
      const leftover   = chunk.subarray(bytesNeeded)
      if (chunks == leftovers) {
        chunks[0] = leftover
      } else {
        chunks.shift()
        leftovers.unshift(leftover)
      }
      return uint8Array
    }
    // else we must concatenate multiple chunks:
    const uint8Array = new Uint8Array(bytesNeeded)
    let offset = 0
    do {
      const chunk = chunks.shift()
      const overflowSize = (offset + chunk.byteLength) - bytesNeeded
      if (overflowSize > 0) {//offset + chunk.byteLength > bytesNeeded) {
        const chunkSizeNeeded = chunk.byteLength - overflowSize
        uint8Array.set(chunk.subarray(0, chunkSizeNeeded), offset)
        offset += chunkSizeNeeded
        if (offset != bytesNeeded) throw Error('Should not happen')
        const leftover = chunk.subarray(chunkSizeNeeded)
        leftovers.unshift(leftover)
      } else {
        uint8Array.set(chunk, offset)
        offset += chunk.byteLength
      }
    } while(offset < bytesNeeded)
    return uint8Array
  }

  /** Fetch `bytesNeeded` bytes from the buffer. */
  getBytes(bytesNeeded, asDataView = false) {
    if (this.chunksTotalSize < bytesNeeded) throw Error(`Invalid binary format (trying to read past the end of the available data).`)
    const uint8Array = this.consumeAndPutBackLeftover(this.chunks, bytesNeeded)
    this.chunksTotalSize -= bytesNeeded
    this.offset += bytesNeeded
    if (asDataView) {
      return new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength)
    } else {
      return uint8Array
    }
  }

  /** Fetch bytes from the buffer until a zero is reached. */
  getBytesUntilZero(discardZero = true) {
    const consumedChunks = []
    let indexOfZero, sizeOfPreviousChunks = 0
    out: while (true) {
      const chunk = this.chunks.shift()
      consumedChunks.push(chunk)
      for (indexOfZero=0; indexOfZero<chunk.byteLength; indexOfZero++) {
        if (chunk[indexOfZero] == 0x00) {
          break out
        }
      }
      sizeOfPreviousChunks += chunk.byteLength
    }
    const uint8Array = this.consumeAndPutBackLeftover(
      consumedChunks, sizeOfPreviousChunks + indexOfZero+1, this.chunks
    )
    this.offset += uint8Array.byteLength
    this.chunksTotalSize -= uint8Array.byteLength
    return discardZero ? uint8Array.subarray(0, uint8Array.byteLength-1) : uint8Array
  }

  /** Read/Write any. */
  any(value) {
    if (this.writing) {
      this.writeAny(value)
    } else {
      return this.readAny()
    }
  }

  /** Read/Write objects. */
  object(template, object = {}) {
    if (typeof object != 'object') throw Error(`Expected an object, but received a ${typeof object}.`)
    this.currentObject = {object, template}
    const keyPath = this.keyPath.join('/') // root object == empty string
    this.keyPathS = keyPath
    this.objAtPath.set(keyPath, {template, object})
    for (const key in template) {
      this.keyPath.push(key)
      if (this.writing) {
        this.write(template[key], object[key])
      } else {
        object[key] = this.read(template[key])
      }
      this.keyPath.pop()
    }
    this.keyPathS = null
    this.currentObject = null
    this.objAtPath.delete(keyPath)
    return object
  }

  /** Load context from an object so getValueFromPath can get it. */
  loadContext(object) {
    if (typeof object != 'object') throw Error(`Expected an object, but received a ${typeof object}.`)
    const keyPath = this.keyPath.join('/')
    this.objAtPath.set(keyPath, {object})
    for (const key in object) {
      const value = object[key]
      if (typeof value == 'object') {
        if (ArrayBuffer.isView(value)) continue // skip those
        this.keyPath.push(key)
        this.loadContext(value)
        this.keyPath.pop()
      }
    }
    return object
  }

  /** Read/Write bytes. */
  bytes(length, bytes) {
    if (this.writing) {
      if (bytes == undefined) {
        bytes = new Uint8Array(0)
      } else {
        if (bytes instanceof ArrayBuffer) {
          throw TypeError(`bytes() can't be passed an ArrayBuffer directly. This restriction is made to avoid memory leaks, since mindlessly passing "value.buffer" can easily expose memory not related to the value (since the value is often just a "view" into an area of the underlying buffer).`)
        } else if (!ArrayBuffer.isView(bytes)) {
          throw TypeError(`bytes must be ArrayBufferView.`)
        } else if (!(bytes instanceof Uint8Array)) {
          bytes = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        }
      }
      this.writeLength(length, bytes.byteLength)
      this.pushBytes(bytes)
    } else {
      length = this.readLength(length)
      return this.getBytes(length)
    }
  }

  /** Read/Write arrays. */
  array(template, length, array = []) {
    if (this.writing) {
      if (!Array.isArray(array)) throw Error(`Was not given an array, but was given a value of type ${typeof array}.`)
      this.writeLength(length, array.length)
      for (let i=0; i<array.length; i++) {
        this.write(template, array[i])
      }
    } else {
      array = Array(this.readLength(length))
      for (let i=0; i<array.length; i++) {
        array[i] = this.read(template)
      }
      return array
    }
  }

  /** Read/Write typedArrays. */
  typedArray(TypedArray, dvFunc, lengthType, array) {
    if (this.writing) {
      if (array == undefined) array = new TypedArray(0)
      this.writeLength(lengthType, array.length) // (not byteLength)
      if (IS_LITTLE_ENDIAN == this.littleEndian || TypedArray.BYTES_PER_ELEMENT == 1) {
        // no endianness conversion is needed, store as is
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
        this.pushBytes(bytes)
      } else {
        const dataView = new DataView(array.buffer, array.byteOffset, array.byteLength)
        for (let i=0, offset=0; i<array.length; i++) {
          dataView['set'+dvFunc](offset, array[i], this.littleEndian)
          offset += TypedArray.BYTES_PER_ELEMENT
        }
      }
    } else {
      const length = this.readLength(lengthType)
      const bytes = this.getBytes(length * TypedArray.BYTES_PER_ELEMENT)
      if (IS_LITTLE_ENDIAN == this.littleEndian || TypedArray.BYTES_PER_ELEMENT == 1) {
        // no endianness conversion is needed, read as is
        if (bytes.byteOffset % TypedArray.BYTES_PER_ELEMENT) {
          const alignedBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          return new TypedArray(alignedBuffer)
        } else {
          return new TypedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength / TypedArray.BYTES_PER_ELEMENT)
        }
      } else {
        const array = new TypedArray(bytes.byteLength / TypedArray.BYTES_PER_ELEMENT)
        const dataView = new DataView(array.buffer, array.byteOffset, array.byteLength)
        for (let i=0, offset=0; i<array.length; i++) {
          array[i] = dataView['get'+dvFunc](offset, this.littleEndian)
          offset += TypedArray.BYTES_PER_ELEMENT
        }
        return array
      }
    }
  }

  IPv4(address) {
    if (this.writing) {
      switch (typeof address) {
        case 'number': return this.u32(address)
        case 'string': {
          const parts = address.split('.')
          if (parts.length != 4) throw Error(`Invalid IPv4 address: ${address}.`)
          for (const number of parts) {
            if (number > 255 || number < 0) throw Error(`Invalid IPv4 address: ${address}.`)
          }
          if (this.littleEndian) parts.reverse()
          return this.bytes(4, new Uint8Array(parts))
        }
      }
      throw Error(`Unknown data type for IPv4 address: ${typeof address}.`)
    } else {
      const bytes = this.bytes(4)
      if (this.littleEndian) bytes.reverse()
      return bytes.join('.')
    }
  }

  /** Read/Write BigInts. */
  bigInt({byteLength, littleEndian = this.littleEndian}, value) {
    if (this.writing) {
      const bytes = big.intToBytes(value ?? 0n, littleEndian, (typeof byteLength == 'number') ? byteLength : undefined)
      console.log(bytes)
      this.writeLength(byteLength, bytes.byteLength)
      this.pushBytes(bytes)
    } else {
      byteLength = this.readLength(byteLength)
      const bytes = this.getBytes(byteLength)
      value = big.intFromBytes(bytes, littleEndian)
      return value
    }
  }

  /** Read/Write unsigned BigInts. */
  bigUint({byteLength, littleEndian = this.littleEndian}, value) {
    if (this.writing) {
      if (value < 0) throw RangeError(`Can't write a negative unsigned integer.`)
      const bytes = big.uintToBytes(value ?? 0n, littleEndian, (typeof byteLength == 'number') ? byteLength : undefined)
      this.writeLength(byteLength, bytes.byteLength)
      this.pushBytes(bytes)
    } else {
      byteLength = this.readLength(byteLength)
      const bytes = this.getBytes(byteLength)
      value = big.uintFromBytes(bytes, littleEndian)
      return value
    }
  }

  // /** Read/Write BigInts with control over sign and endianness. */
  // bigNumber(byteSize, signed = false, littleEndian = this.littleEndian, value) {
  //   if (signed) {
  //     return this.bigInt(byteSize, littleEndian, value)
  //   } else {
  //     return this.bigUint(byteSize, littleEndian, value)
  //   }
  // }

  /** Read/Write custom integers with control over sign, endianness and byte-size. */
  integer({byteLength, signed = false, littleEndian = this.littleEndian}, value) {
    if (signed) {
      switch (byteLength) {
        case 1: return this.i8(value)
        case 2: return this.i16(value, {littleEndian})
        case 4: return this.i32(value, {littleEndian})
        case 8: return this.i64(value, {littleEndian})
      }
    } else {
      switch (byteLength) {
        case 1: return this.u8(value)
        case 2: return this.u16(value, {littleEndian})
        case 4: return this.u32(value, {littleEndian})
        case 8: return this.u64(value, {littleEndian})
      }
    }
    // else just read/write X bytes using BigInt
    if (this.writing && typeof value != 'bigint') {
      if (!Number.isSafeInteger(value)) throw Error(`Tried to write a value using integer() which failed Number.isSafeInteger(). Use a BigInt instead!`)
      value = BigInt(value)
    }
    const result = signed ?
      this.bigInt({byteLength, littleEndian}, value) :
      this.bigUint({byteLength, littleEndian}, value)
    if (this.writing) return
    if (byteLength >= 7) { // (>= Number.MAX_SAFE_INTEGER)
      return result // as BigInt
    } else {
      return Number(result)
    }
  }

  /** Read/Write bitFields. */
  bitField(template, values) {
    if (this.writing) {
      const bigInt = bitField.write(template, values ?? {})
      const bytes = big.uintToBytes(bigInt, false)
      this.pushBytes(bytes)
    } else {
      const bytesNeeded = bitField.bytesNeeded(template)
      const bytes = this.getBytes(bytesNeeded)
      const bigInt = big.uintFromBytes(bytes, false)
      return bitField.read(template, bigInt)
    }
  }

  flags(bytes, template, values) {
    if (this.writing) {

    } else {

    }
  }

  /** Read/Write strings. */
  string(length, string = '') {
    if (this.writing) {
      const encoded = new TextEncoder().encode(string)
      if (length == t.zeroTerminated) {
        if (string.includes('\0')) throw Error(`Can't zero-terminate a string which already contains a zero: ${string}.`)
      } else {
        this.writeLength(length, encoded.byteLength)
      }
      this.pushBytes(encoded)
      if (length == t.zeroTerminated) {
        this.u8(0)
      }
    } else {
      let bytes
      if (length == t.zeroTerminated) {
        bytes = this.getBytesUntilZero()
      } else {
        const size = this.readLength(length)
        bytes = this.getBytes(size)
      }
      return new TextDecoder().decode(bytes)
    }
  }

}

// stop other imports from being able to tamper with these:
Object.freeze(t)
Object.freeze(BinaryTemplate.prototype)
Object.freeze(Serializer.prototype)
Object.freeze(BinaryTemplate)
Object.freeze(Serializer)

export function extendSerializer(...extensions) {
  const types = {...t} // copy over default types
  let serializer = Serializer
  for (const extend of extensions) {
    const {newTypes, extendedSerializer} = extend({Serializer: serializer, t})
    serializer = extendedSerializer // so the next will extend it further
    for (const key in newTypes) {
      types[key] = newTypes[key]
    }
  }
  return {t: types, ExtendedSerializer: serializer}
}

export class SerializerError extends Error {
  constructor(message, {code, cause} = {}) {
    super(message, {cause})
    this.name = this.constructor.name
    if (code) this.code = code
  }
}

/** Check platform endianness. */
function isLittleEndian() {
  const b = new ArrayBuffer(2)
  new Uint16Array(b)[0] = 0x00FF
  return new Uint8Array(b)[0]
}

/** Concatenate a bunch of Uint8Arrays. */
function concatenateChunks(chunks) {
  const size = chunks.reduce((sum, e) => sum + e.byteLength, 0)
  const uint8Array = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    uint8Array.set(chunk, offset)
    offset += chunk.byteLength
  }
  return uint8Array
}

/** Get a value from a path within an object. */
function valueFromPath(path, object) {
  let target = object
  for (const key of path.split('/')) {
    target = target[key]
  }
  return target
}

/** Resolve a path relative to the current path. */
function pathResolve(path, currentPath = [], asString) {
  let resolved
  if (path.endsWith('/')) throw Error('Path must not end with "/."')
  if (path.startsWith('./')) throw Error('Path must not start with "./".')
  if (path.startsWith('/')) {
    resolved = path.slice(1).split('/')
  } else if (path.startsWith('../')) { // up
    let up
    const parts = path.split('/')
    for (up = 1; up < parts.length; up++) {
      if (parts[up] == '..') continue
      break
    }
    if (up > currentPath.length) throw Error(`Tried to walk up the path (${path}) beyond the current path (${currentPath.join('/')}). There I saw the end of the matrix and my CPU was blown!`)
    const slicedPath = currentPath.slice(0, currentPath.length - up)
    if (slicedPath.length) {
      resolved = [...slicedPath, ...parts.slice(up)]
    } else {
      resolved = parts.slice(up)
    }
  } else if (currentPath.length) {
    resolved = [...currentPath, ...path.split('/')]
  } else {
    resolved = path.split('/')
  }
  if (asString) return resolved.join('/')
  return {
    objectKey: resolved.pop(),
    objectPath: resolved.join('/')
  }
}
