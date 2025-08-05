
import * as assert from "std/assert/mod.ts"

import {BinaryTemplate, t} from 'streamable-binary-serializer'
import {convertToDeepComparable} from '../tooling.js'

const buffer = new ArrayBuffer(16)
const uint8Array = new Uint8Array(buffer, 8, 8)
uint8Array[3] = 0xBE
uint8Array[7] = 0xEF

/** An object demonstrating every supported type using the any() serializer. */
const demo = {
  a: 'hello',
  b: 'world \0 😎', // zero and unicode support
  c:  123456, // integer
  d: -123456,
  e:  123456.123456, // float
  f: -123456.123456,
  g:  1234567890123456n, // BigInt
  h: -1234567890123456n,
  i: NaN,
  j: Infinity,
  k: -Infinity,
  l: true,
  m: false,
  n: null,
  o: undefined,
  p: new Date('1986-10-21'), // my birthday
  q: function bark(...args) {console.log('Wooof!', ...args)}, // even a function 😲
  r: TypeError(`You're not my type! 🤪`, {cause: Error('Because!')}), // and an error that points here
  rr: new DOMException(`We're very similar to errors!`, {cause: 'Whatever'}),

  s: new DataView(buffer, 8, 8),
  ss: buffer, // even the buffer itself

  t:     uint8Array,
  tt: new Uint8ClampedArray(buffer, 8, 8),
  u: new Uint16Array(buffer, 8, 4),
  v: new Uint32Array(buffer, 8, 2),
  w: new BigUint64Array(buffer, 8, 1),

  x: new Int8Array(buffer, 8, 8),
  y: new Int16Array(buffer, 8, 4),
  z: new Int32Array(buffer, 8, 2),
  aa: new BigInt64Array(buffer, 8, 1),

  ab: new Float32Array(buffer, 8, 2),
  ac: new Float64Array(buffer, 8, 1),

  ad: [1, null, 1.3, {dog: 'bird'}], // any array...
  ae: new Map([[{a: 'b'}, 'value'], ['key','value']]), // maps
  af: new Set([0, {a: 'b'}, Infinity, new Date()]), // and sets
  ag: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // even RegExp's
  ah: Symbol('Also symbols even if that will create a new unique one...'),
}

const template = new BinaryTemplate(t.any)
const result = template.fromBytes(template.toBytes(demo))

Deno.test('every "any" type', () => {
  /* This test would fail on some objects with different references and also because some minor details would differ (e.g. the DataView's internal buffer). So we "sanitize" them by converting them to JSON and back using my JSON_Replacer; to compare even values which are not compatible with JSON. */
  assert.assertEquals( // or assertObjectMatch
    convertToDeepComparable(demo), 
    convertToDeepComparable(result)
  )
})
