
import {BinaryTemplate, t} from '../source/streamable-binary-serializer.js'

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
  age: t.u8,
  name: t.string(),
  eMail: t.string({regExp: t.rxp_email}),
  subObject: {
    binarySecret: t.bytes(10),
    favoriteAnimals: t.array(t.string()),
    ownedAnimals: t.array({
      type: t.string(),
      name: t.string(),
    })
  }
}

const {getReadable, getWritable} = new BinaryTemplate(binaryTemplate)
const readable = getReadable(object) // encode object
const writable = getWritable()       // decode object

// For fun compress and decompress first:
await readable.pipeThrough(new   CompressionStream('deflate'))
              .pipeThrough(new DecompressionStream('deflate'))
              .pipeTo(writable)

console.log(await writable.result)

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
