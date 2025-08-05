
import {BinaryTemplate, t} from '../source/streamable-binary-serializer.js'

function test1() {
  const template = new BinaryTemplate({
    listLength: t.lengthOf('arr', t.u8),
    arr: t.array({
      listLength: t.lengthOf('sub/list', t.u8),
      sub: {
        list: t.array(t.u8, '../listLength')
      }
    }, 'listLength')
  })
  
  const bytes = template.toBytes({arr: [
    {sub: {list: [1,2,3]}},
    {sub: {list: [1,2,3,4]}},
  ]})
  
  console.log(bytes)
  console.log(template.fromBytes(bytes))
}


function test2() { // relative template
  const template = new BinaryTemplate(t.array({
    version: t.u8,
    test: function(value) { // RW function
      switch (this.getValueFromPath('/version')) {
        case 0: return this.value({
          a: t.u8,
          b: t.u8,
        }, value)
        case 1: return this.value({
          c: t.u16,
          d: t.u16,
        }, value)
      }
    }
  }))

  const bytes = template.toBytes([
    {
      version: 0,
      test: {a: 1, b: 2},
    },
    {
      version: 1,
      test: {c: 3, d: 4},
    },
  ])

  console.log(template.fromBytes(bytes))

}

test2()

