
import * as d from '../streamable-binary-serializer.js'

const object = {
  age: 37,
  name: 'Joakim L. Christiansen',
  eMail: 'not@gonna.happen',
  subObject: {
    binarySecret: crypto.getRandomValues(new Uint8Array(10)),
    favoriteAnimals: ['duck', 'cat', 'monkey'],
    ownedAnimals: [
      {type: 'cat', name: 'Pussy'},
      {type: 'dog', name: 'Doggy'},
    ]
  }
}

const binaryTemplate = {
  age: d.u8,
  name: d.string(),
  eMail: d.string({regExp: d.rxp_email}),
  subObject: {
    binarySecret: d.bytes(10),
    favoriteAnimals: d.array(d.string()),
    ownedAnimals: d.array({
      type: d.string(),
      name: d.string(),
    })
  }
}

const {objectToBinary_readable, binaryToObject_writable} = d.template(binaryTemplate)
const readable = objectToBinary_readable(object) // encode object
const writable = binaryToObject_writable()       // decode object

// For fun compress and decompress first:
await readable.pipeThrough(new   CompressionStream('deflate'))
              .pipeThrough(new DecompressionStream('deflate'))
              .pipeTo(writable)

console.log(writable.result) // todo: let writeable have a done promise which returns result

async function readableToBytes(readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(chunk)
  }
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
