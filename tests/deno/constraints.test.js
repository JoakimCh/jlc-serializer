
import * as assert from "https://deno.land/std@0.203.0/assert/mod.ts"
import {BinaryTemplate, t} from 'streamable-binary-serializer'

Deno.test('constraints', async (test) => {
  await test.step('string', () => {
    new BinaryTemplate(t.string({min: 2})).toBytes('ab')
    new BinaryTemplate(t.string({max: 2})).toBytes('ab')
    new BinaryTemplate(t.string({min: 2, max: 2})).toBytes('ab')
    new BinaryTemplate(t.string({min: 2, max: 4})).toBytes('abc')
    assert.assertThrows(() => new BinaryTemplate(t.string({min: 3})).toBytes('ab'))
    assert.assertThrows(() => new BinaryTemplate(t.string({max: 3})).toBytes('abcd'))
    assert.assertThrows(() => new BinaryTemplate(t.string({min: 2, max: 3})).toBytes('abcd'))
    assert.assertThrows(() => new BinaryTemplate(t.string({min: 2, max: 3})).toBytes('a'))
    assert.assertThrows(() => new BinaryTemplate(t.string({regExp: t.rxp_email})).toBytes('abc'))
    assert.assertThrows(() => new BinaryTemplate(t.string({regExp: [t.rxp_email]})).toBytes('abc'))
  })

  await test.step('number', () => {
    new BinaryTemplate(t.number(t.u8, {min: 2})).toBytes(2)
    new BinaryTemplate(t.number(t.u8, {max: 2})).toBytes(2)
    new BinaryTemplate(t.number(t.u8, {only: 2})).toBytes(2)
    new BinaryTemplate(t.number(t.u8, {only: [2,3]})).toBytes(2)
    assert.assertThrows(() => new BinaryTemplate(t.number(t.u8, {min: 2})).toBytes(1))
    assert.assertThrows(() => new BinaryTemplate(t.number(t.u8, {max: 2})).toBytes(3))
    assert.assertThrows(() => new BinaryTemplate(t.number(t.u8, {only: 2})).toBytes(1))
    assert.assertThrows(() => new BinaryTemplate(t.number(t.u8, {only: [2,3]})).toBytes(1))
  })
})
