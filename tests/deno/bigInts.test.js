
import * as assert from "std/assert/mod.ts"
import {BinaryTemplate, t, SerializerError} from 'streamable-binary-serializer'
import {bytesToHex, hexToBytes} from '../tooling.js'

Deno.test('bigInts', async (test) => {

  await test.step('correct encoding', () => {
    const template = new BinaryTemplate({
      a: t.bigInt(),
      b: t.bigUint(),
    }, {littleEndian: false})
    const object = {
      a: -12345678901234567890n,
      b:  12345678901234567890n,
    }
    const bytes  = template.toBytes(object)
    // assert.assertEquals(bytesToHex(bytes), 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7F7FFF7FFFFFFF7FFFFFFFFFFFFFFF47F120403F8948B0F90591E6808000800000008000000000000000')
    const result = template.fromBytes(bytes)
    assert.assertEquals(object, result)
  })

  await test.step('only BigInt or number', () => {
    assert.assertThrows(() => new BinaryTemplate(t.u64).toBytes('1'))
  })

  await test.step('only unsigned BigInt', () => {
    assert.assertThrows(() => new BinaryTemplate(t.u64).toBytes(-1n))
  })

})
