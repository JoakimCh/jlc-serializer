
import * as assert from "std/assert/mod.ts"
import {BinaryTemplate, t, SerializerError} from 'streamable-binary-serializer'
import {bytesToHex, hexToBytes} from '../tooling.js'

Deno.test('bytes', async (test) => {

  await test.step('different ArrayBufferViews', () => {
    const arrayBuffer = new ArrayBuffer(0xFF)
    const dataView = new DataView(arrayBuffer)
    dataView.setInt8(0x00, 0xFF)
    dataView.setInt8(0xFE, 0xFF)
  
    const template = new BinaryTemplate({
      a: t.bytes(3),
  
      b: t.bytes(t.u8),
      c: t.bytes(t.u16),
      d: t.bytes(t.u32),
      e: t.bytes(t.u64),
  
      f: t.bytes(t.i8),
      g: t.bytes(t.i16),
      h: t.bytes(t.i32),
      i: t.bytes(t.i64),
  
      j: t.bytes(t.u8),
      k: t.bytes(t.u8),
  
      l: t.bytes(t.u8),
    }, {littleEndian: false})
    const object = {
      a: new Uint8Array([1,2,3]),
      
      b: new Int8Array([-1,2,3]),
      c: new Int16Array([-1,2,3]),
      d: new Int32Array([-1,2,3]),
      e: new BigInt64Array([-1n,2n,3n]),
  
      f: new Uint8Array([1,2,3]),
      g: new Uint16Array([1,2,3]),
      h: new Uint32Array([1,2,3]),
      i: new BigUint64Array([1n,2n,3n]),
  
      j: new Float32Array([1.1, 2.2, 3.3]),
      k: new Float64Array([1.1, 2.2, 3.3]),
  
      l: dataView
    }
    const bytes  = template.toBytes(object)
    const result = template.fromBytes(bytes)
    for (const key in object) {
      const v = object[key]
      const uint8Array = new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
      assert.assertEquals(uint8Array, result[key])
    }
  })

  await test.step('throw if we forget to call the template function', () => {
    assert.assertThrows(() => {
      new BinaryTemplate(t.bytes).toBytes(new Uint8Array([1,2,3]))
    })
  })

  await test.step('throw if trying to write an ArrayBuffer directly', () => {
    assert.assertThrows(() => {
      new BinaryTemplate(t.bytes()).toBytes(new ArrayBuffer(8))
    })
  })

  await test.step('throw on invalid types', () => {
    assert.assertThrows(() => {
      new BinaryTemplate(t.bytes()).toBytes([1,2,3])
    })
  })

})
