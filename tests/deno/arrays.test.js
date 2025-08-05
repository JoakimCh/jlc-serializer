
import * as assert from "std/assert/mod.ts"
import {BinaryTemplate, t, SerializerError} from 'streamable-binary-serializer'
import {bytesToHex, hexToBytes} from '../tooling.js'

Deno.test('arrays', async (test) => {

  await test.step('u8', () => {
    const template = new BinaryTemplate(t.array(t.u8))
    const value = [1,2,3]
    const bytes = template.toBytes(value)
    const result = template.fromBytes(bytes)
    assert.assertEquals(value, result)
  })

  await test.step('string', () => {
    const template = new BinaryTemplate(t.array(t.string()))
    const value = ['1','2','3']
    const bytes = template.toBytes(value)
    const result = template.fromBytes(bytes)
    assert.assertEquals(value, result)
  })

  await test.step('object', () => {
    const template = new BinaryTemplate(t.array({a: t.u8, b: t.string()}))
    const value = [
      {a: 11, b: 'whatever'},
      {a: 22, b: 'rofl'}
    ]
    const bytes = template.toBytes(value)
    const result = template.fromBytes(bytes)
    assert.assertEquals(value, result)
  })

  // await test.step('throw on type mismatch', () => {
  //   assert.assertThrows(() => {
  //     new BinaryTemplate(t.bitField({a: 2})).toBytes(1)
  //   })
  // })

})
