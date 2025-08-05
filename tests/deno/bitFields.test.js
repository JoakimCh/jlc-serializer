
import * as assert from "std/assert/mod.ts"
import {BinaryTemplate, t, SerializerError} from 'streamable-binary-serializer'
import {bytesToHex, hexToBytes} from '../tooling.js'

Deno.test('bitFields', async (test) => {

  await test.step('byte order and correct values', () => {
    const template = new BinaryTemplate(t.bitField({
      a:  2, b:  6, c:  16,
      d: -2, e: -6, f: -16, // - denotes signed values
    }))
    const value = {
      a: 0b11, b: 0b00_1111, c: 0b0000_0000_1111_1111,
      d: -2, e: -32, f: -32768
    }
    const bytes = template.toBytes(value)
    const result = template.fromBytes(bytes)
    assert.assertEquals(value, result)
  })

  await test.step('throw on overflow', () => {
    assert.assertThrows(() => {
      const template = new BinaryTemplate(t.bitField({
        a: 2, b:6, c: 16
      }))
      const value = {
        a: 0b11, b: 0b00_1111, c: -0b0000_0000_1111_1111
      }
      template.toBytes(value)
    }, SerializerError)
  })

  await test.step('throw on type mismatch', () => {
    assert.assertThrows(() => {
      new BinaryTemplate(t.bitField({a: 2})).toBytes(1)
    })
  })

})
