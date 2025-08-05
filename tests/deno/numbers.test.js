
import * as assert from "std/assert/mod.ts"
import {BinaryTemplate, t, SerializerError} from 'streamable-binary-serializer'
import {bytesToHex, hexToBytes} from '../tooling.js'

Deno.test('numbers', async (test) => {

  await test.step('encoding / decoding', () => {
    const template = new BinaryTemplate({
      a: t.u8,
      b: t.u16,
      c: t.u32,
      d: t.u64,
  
      e: t.i8,
      f: t.i16,
      g: t.i32,
      h: t.i64,
  
      i: t.f32,
      j: t.f64,
  
      k: t.i8,
      l: t.i16,
      m: t.i32,
      n: t.i64,
    }, {littleEndian: false})
    const object = {
      a: 0xFF,
      b: 0xFFFF,
      c: 0xFFFF_FFFF,
      d: 0xFFFF_FFFF_FFFF_FFFFn,
      e: 0x7F,
      f: 0x7FFF,
      g: 0x7FFF_FFFF,
      h: 0x7FFF_FFFF_FFFF_FFFFn,
      i: 123456.5,
      j: 0.01234567890123456789,
      k: -0x80, // -(0x7F + 1)
      l: -0x8000,
      m: -0x8000_0000,
      n: -0x8000_0000_0000_0000n,
    }
    const bytes  = template.toBytes(object)
    assert.assertEquals(bytesToHex(bytes), 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7F7FFF7FFFFFFF7FFFFFFFFFFFFFFF47F120403F8948B0F90591E6808000800000008000000000000000')
    const result = template.fromBytes(bytes)
    assert.assertEquals(object, result)
  })

  await test.step('overflow must throw', () => {
    const table = [
      [ 'u8', 0xFF, 0],
      ['u16', 0xFFFF, 0],
      ['u32', 0xFFFF_FFFF, 0],
      [ 'i8', 0x7F, -0x80],
      ['i16', 0x7FFF, -0x8000],
      ['i32', 0x7FFF_FFFF, -0x8000_0000],
      ['u64', 0xFFFF_FFFF_FFFF_FFFFn, 0n],
      ['i64', 0x7FFF_FFFF_FFFF_FFFFn, -0x8000_0000_0000_0000n],
    ]
    let error
    for (const [type, max, min] of table) {
      error = assert.assertThrows(() => {
        const template = new BinaryTemplate(t[type])
        template.toBytes(typeof max == 'bigint' ? max + 1n : max + 1)
      }, SerializerError, 'overflow')
      error = assert.assertThrows(() => {
        const template = new BinaryTemplate(t[type])
        template.toBytes(typeof min == 'bigint' ? min - 1n : min - 1)
      }, SerializerError, 'overflow')
    }
  })

  await test.step('only numbers', () => {
    assert.assertThrows(() => new BinaryTemplate(t.u8).toBytes('1'))
  })

  await test.step('integer not float', () => {
    assert.assertThrows(() => new BinaryTemplate(t.u8).toBytes(0.1))
  })

})
