
import * as assert from "std/assert/mod.ts"
import {BinaryTemplate, t, SerializerError} from 'streamable-binary-serializer'
import {bytesToHex, hexToBytes} from '../tooling.js'

Deno.test('integer()', async (test) => {

  await test.step('encoding / decoding', () => {
    const template = new BinaryTemplate({
      a: t.integer({byteLength: 1, signed: false}),
      b: t.integer({byteLength: 1, signed: true}),

      c: t.integer({byteLength: 2, signed: false, littleEndian: true}),
      d: t.integer({byteLength: 2, signed: false, littleEndian: false}),
      e: t.integer({byteLength: 2, signed: true,  littleEndian: true}),
      f: t.integer({byteLength: 2, signed: true,  littleEndian: false}),

      g: t.integer({byteLength: 3, signed: false, littleEndian: true}),
      h: t.integer({byteLength: 3, signed: false, littleEndian: false}),
      i: t.integer({byteLength: 3, signed: true,  littleEndian: true}),
      j: t.integer({byteLength: 3, signed: true,  littleEndian: false}),

      k: t.integer({byteLength: 4, signed: false, littleEndian: true}),
      l: t.integer({byteLength: 4, signed: false, littleEndian: false}),
      m: t.integer({byteLength: 4, signed: true,  littleEndian: true}),
      n: t.integer({byteLength: 4, signed: true,  littleEndian: false}),

      o: t.integer({byteLength: 5, signed: false, littleEndian: true}),
      p: t.integer({byteLength: 5, signed: false, littleEndian: false}),
      q: t.integer({byteLength: 5, signed: true,  littleEndian: true}),
      r: t.integer({byteLength: 5, signed: true,  littleEndian: false}),

      s: t.integer({byteLength: 9, signed: false, littleEndian: true}),
      t: t.integer({byteLength: 9, signed: false, littleEndian: false}),
      u: t.integer({byteLength: 9, signed: true,  littleEndian: true}),
      w: t.integer({byteLength: 9, signed: true,  littleEndian: false}),
    })

    const object = {
      a: 0xFF,
      b: -128,

      c: 0xDEAD,
      d: 0xDEAD,
      e: -32768,
      f: -32768,

      g: 0xFF_DEAD,
      h: 0xFF_DEAD,
      i: -8388608,
      j: -8388608,

      k: 0xDEAD_BEEF,
      l: 0xDEAD_BEEF,
      m: -2147483648,
      n: -2147483648,

      o: 0xFF_DEAD_BEEF,
      p: 0xFF_DEAD_BEEF,
      q: -549755813888,
      r: -549755813888,

      s: 0xFF_DEAD_CAFE_BABE_B00Bn,
      t: 0xFF_DEAD_CAFE_BABE_B00Bn,
      u: -2361183241434822606848n,
      w: -2361183241434822606848n,
    }

    const bytes  = template.toBytes(object)
    // assert.assertEquals(bytesToHex(bytes), 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7F7FFF7FFFFFFF7FFFFFFFFFFFFFFF47F120403F8948B0F90591E6808000800000008000000000000000')
    const result = template.fromBytes(bytes)
    assert.assertEquals(object, result)
  })

  // await test.step('overflow must throw', () => {
  //   const table = [
  //     [ 'u8', 0xFF, 0],
  //     ['u16', 0xFFFF, 0],
  //     ['u32', 0xFFFF_FFFF, 0],
  //     [ 'i8', 0x7F, -0x80],
  //     ['i16', 0x7FFF, -0x8000],
  //     ['i32', 0x7FFF_FFFF, -0x8000_0000],
  //     ['u64', 0xFFFF_FFFF_FFFF_FFFFn, 0n],
  //     ['i64', 0x7FFF_FFFF_FFFF_FFFFn, -0x8000_0000_0000_0000n],
  //   ]
  //   let error
  //   for (const [type, max, min] of table) {
  //     error = assert.assertThrows(() => {
  //       const template = new BinaryTemplate(t[type])
  //       template.toBytes(typeof max == 'bigint' ? max + 1n : max + 1)
  //     }, SerializerError, 'overflow')
  //     error = assert.assertThrows(() => {
  //       const template = new BinaryTemplate(t[type])
  //       template.toBytes(typeof min == 'bigint' ? min - 1n : min - 1)
  //     }, SerializerError, 'overflow')
  //   }
  // })

  // await test.step('only numbers', () => {
  //   assert.assertThrows(() => new BinaryTemplate(t.u8).toBytes('1'))
  // })

  // await test.step('integer not float', () => {
  //   assert.assertThrows(() => new BinaryTemplate(t.u8).toBytes(0.1))
  // })

})
