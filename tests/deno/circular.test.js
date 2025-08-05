
import * as assert from "https://deno.land/std@0.203.0/assert/mod.ts"
import {BinaryTemplate, t} from 'streamable-binary-serializer'

Deno.test('circular references', () => {
  const a = {
    1: 'hello'
  }
  const b = {
    a,
    2: 'world'
  }
  a.b = b
  
  const template = new BinaryTemplate(t.any)
  const result = template.fromBytes(template.toBytes(a))

  assert.assertEquals(a, result)
})
