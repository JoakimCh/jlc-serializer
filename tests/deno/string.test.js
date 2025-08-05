
import * as assert from "std/assert/mod.ts"
import {BinaryTemplate, t, SerializerError} from 'streamable-binary-serializer'
import {bytesToHex, hexToBytes} from '../tooling.js'

Deno.test('strings', async (test) => {
  await test.step('encoding / decoding', () => {
    const template = new BinaryTemplate({
      a: t.string(5),
      b: t.string(t.zeroTerminated),
      c: t.string(t.u8),
      d: t.string(t.u16),
      e: t.string(t.u32),
    }, {littleEndian: false})
    const object = {
      a: 'hell\0',
      b: 'hello',
      c: 'hello \0 world',
      d: 'hello \0 world',
      e: 'hello \0 world',
    }
    const bytes = template.toBytes(object)
    assert.assertEquals(bytesToHex(bytes), '68656C6C0068656C6C6F000D68656C6C6F200020776F726C64000D68656C6C6F200020776F726C640000000D68656C6C6F200020776F726C64')
    const result = template.fromBytes(bytes)
    assert.assertEquals(object, result)
  })

  await test.step('writing zero terminated string with zero must throw', () => {
    assert.assertThrows(() => new BinaryTemplate(t.string()).toBytes('Must\0throw!'))
  })

  await test.step('writing different size than hardcoded must throw', () => {
    assert.assertThrows(() => new BinaryTemplate(t.string(5)).toBytes('123456'))
    assert.assertThrows(() => new BinaryTemplate(t.string(5)).toBytes('1234'))
  })

})
