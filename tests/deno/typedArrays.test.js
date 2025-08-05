
import * as assert from "std/assert/mod.ts"
import {BinaryTemplate, t, SerializerError} from 'streamable-binary-serializer'
import {bytesToHex, hexToBytes} from '../tooling.js'

Deno.test('typedArrays', async (test) => {

  await test.step('every type', () => {
    const template = new BinaryTemplate({
      a: t.typedArray(Uint8ClampedArray),
      b: t.typedArray(Uint8Array),
      c: t.typedArray(Uint16Array),
      d: t.typedArray(Uint32Array),
      e: t.typedArray(BigUint64Array),
      f: t.typedArray(Int8Array),
      g: t.typedArray(Int16Array),
      h: t.typedArray(Int32Array),
      i: t.typedArray(BigInt64Array),
      j: t.typedArray(Float32Array),
      k: t.typedArray(Float64Array),
    })
    const object = {
      a: new Uint8ClampedArray([1,2,3,4]),
      b: new Uint8Array([1,2,3,4]),
      c: new Uint16Array([1,2,3,4]),
      d: new Uint32Array([1,2,3,4]),
      e: new BigUint64Array([1n,2n,3n,4n]),
      f: new Int8Array([1,2,3,4]),
      g: new Int16Array([1,2,3,4]),
      h: new Int32Array([1,2,3,4]),
      i: new BigInt64Array([1n,2n,3n,4n]),
      j: new Float32Array([1,2,3,4]),
      k: new Float64Array([1,2,3,4]),
    }
    const bytes  = template.toBytes(object)
    const result = template.fromBytes(bytes)
    assert.assertEquals(object, result)
  })

  await test.step('throw on invalid types', () => {
    assert.assertThrows(() => {
      new BinaryTemplate(t.typedArray(Uint8Array, 4)).toBytes([1,2,3])
    })
  })

  await test.step('throw on size mismatch', () => {
    assert.assertThrows(() => {
      new BinaryTemplate(t.typedArray(Uint8Array, 4)).toBytes(new Uint8Array([1,2,3]))
    })
  })

})
