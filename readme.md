
# jlc-serializer 
## A streamable binary serializer and deserializer! 🥳

## Generic note - Released as is

Since my life is pretty much over (serious chronic disease) I can't program anymore and I'll just release some of my stuff here even if it is somewhat incomplete. This is one such project, it might work well enough (or be close to working). Just test it...

```sh
npm i jlc-serializer
```

## Do you need? 😎
* A way to serialize a JavaScript object into a very compact binary format?
* The ability to parse it back into the same object?
* Compatibility with the standardized [Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)?
* Optional usage of a "binary template" to control exactly how it is stored?
* Optional constraints on values allowed to serialize?
* Compatibility with the browser, Node.js, Deno and Bun?

If you do then this package is for you! 📦

## And with it you can do some pretty cool stuff! ✨

E.g. converting an object (using the `t.any` type) to binary and applying compression (just for fun):
```js
import {BinaryTemplate, t} from 'jlc-serializer'

const object = {
  most: 'This is a string.'
  values: new Date('1999-10-30'),
  just: Infinity,
  magically: 989391711133391930183n,
  works: new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]),
}

const anyTemplate = new BinaryTemplate(t.any)
const compressedBytes = await readableToBytes(
  anyTemplate.getReadable(object)
  .pipeThrough(new CompressionStream('deflate'))
)
```
> Note: `t.any` can't serialize EVERY kind of value/object (just a lot), check the [documentation]() for more info.

Or instead just getting the bytes without applying any compression:
```js
const bytes = anyTemplate.getBytes(object)
```
And then reading them back into an identical object:
```js
const object = anyTemplate.fromBytes(bytes)
```
Or maybe you want to define your own custom binary file format to store the same object?
```js
const myFileFormat = new BinaryTemplate({
  most: t.string() // (its argument defaults to t.zeroTerminated)
  values: t.u64, // to store the epoch time as milliseconds
  just: t.string(), // to store values like Infinity as a string instead
  magically: t.bigInt(t.u8), // a BigInt where a u8 is used to store its byte length
  works: t.typedArray(Uint8Array), // a TypedArray which defaults to a u32 storing its length
})

fs.writeFileSync('test.mff', myFileFormat.toBytes(object))
```

## An example on constraints ⛓️

```js
const t_user = new BinaryTemplate({
  nick: t.string({min: 3, max: 20}),
  eMail: t.string({regExp: t.rxp_email}),
  age: t.number(t.u8, {min: 16, max: 120}),
  option: t.number(t.u8, {only: [1,2,3]}),
})
```

Here a template was defined with some constraints that I think are pretty much self explaining?

E.g. the only values allowed in the `option` property are 1, 2 or 3.

Attempting to write values outside of the constraints will throw an error (which you can catch and easily identify).

## A more advanced example ⚙️
> What we've demoed above is only scratching the surface of what you can do with the binary serializer. So here is a more advanced example on what you can do with it.

Here we will expand the serializer with functions for writing and reading strings of the "DNS string" format (which supports their arcane domain name compression method).

We will then send a custom DNS packet and parse the response!

```js
import * as dgram from 'node:dgram'
import {BinaryTemplate, extendSerializer} from 'jlc-serializer'
import dnsExtension from 'jlc-serializer-dnsString'

const {t, ExtendedSerializer} = extendSerializer(dnsExtension)
// multiple extensions can be loaded e.g.: 
// extendSerializer(extA, extB, extC)

// Here we define the binary template for the response records contained in a DNS packet:
const t_dnsResponseRecord = {
  name: t.dnsString,
  type: t.u16,
  class: t.u16,
  ttl: t.u32,
  dataSize: t.sizeOf('data', t.u16),
  data: function(valueToWrite) { // valueToWrite is undefined when reading
    switch (this.getValueFromPath('type')) {
      default: return this.value({other: t.bytes('../dataSize')}, valueToWrite)
      case 1: return this.value({IPv4: t.IPv4}, valueToWrite)
      case 2: return this.value({ns: t.dnsString}, valueToWrite)
      case 5: return this.value({cname: t.dnsString}, valueToWrite)
    }
  }
}

// Here we define the binary template for a DNS packet:
const t_dnsPacket = {
  transactionId: t.u16,
  flags: t.bitField({
    queryResponse: 1,
    opcode: 4,
    authoritativeAnswer: 1,
    trunCated: 1,
    recursionDesired: 1,
    recursionAvailable: 1,
    zero: 1,
    authenticData: 1,
    checkingDisabled: 1,
    responseCode: 4
  }),
  numQuestions: t.lengthOf('queries', t.u16),
  numAnswerRecords: t.lengthOf('answersRecords', t.u16),
  numAuthorityRecords: t.lengthOf('authorityRecords', t.u16),
  numAdditionalRecords: t.lengthOf('additionalRecords', t.u16),
  queries: t.array({
    name: t.dnsString,
    type: t.u16,
    class: t.u16
  }, 'numQuestions'),
  answersRecords: t.array(t_dnsResponseRecord, 'numAnswerRecords'),
  authorityRecords: t.array(t_dnsResponseRecord, 'numAuthorityRecords'),
  additionalRecords: t.array(t_dnsResponseRecord, 'numAdditionalRecords')
}

const dnsPacket = new BinaryTemplate(t_dnsPacket, {
  littleEndian: false, // (network protocols are usually big endian)
  serializer: ExtendedSerializer // use our extended version
})

dgram.createSocket('udp4')
.once('connect', function() {
  console.log('Sending DNS query...')
  this.send(dnsPacket.toBytes({
    // (we only need to specify the "non-empty" values)
    transactionId: 0x1234,
    flags: {
      recursionDesired: 1 // other flags defaults to 0
    },
    queries: [{
      name: 'vortex.data.microsoft.com',
      type: 1, class: 1
    }]
  }))
})
.on('message', function(data) {
  this.close()
  console.log('Response received:')
  console.dir(dnsPacket.fromBytes(data), {depth: Infinity})
  // And look at that; the packet is easily readable as a normal JavaScript object!
})
.connect(53, '1.1.1.1') // (the Cloudflare DNS server)
```

The code in the [DNS string extension module]():

```js
export default function({Serializer, t}) {
  return {
    newTypes: {
      dnsString: Symbol('dnsString')
    },
    
    extendedSerializer: class extends Serializer {
      #dnsStringCache = new Map()
  
      dnsString(string) {
        if (this.writing) {
          this.#write_dnsString(string || '')
        } else {
          return this.#read_dnsString()
        }
      }
  
      #read_dnsString() {
        // check the module source code for the complete code
        return string
      }
  
      #write_dnsString(string) {
        // check the module source code for the complete code
      }
    }
  }
}
```

## Documentation 📚

To fully understand how awesome my serializer is and to be able to fully utilize it head over to the [Documentation]() page and read up! 🤓🧐

>🚧 Currently the documentation might be a little lacking, but I will keep updating it until it has most of the needed details! 🚧

## Final words

> When you die your consciousness doesn't stop, instead it expands and you'll be more awake than you ever were during your human life.

If you like this project then please sponsor me since I'm completely jobbless and broke and suffers from chronic sickness and pain. And because the state (of Norway) is not offering me or my family (of 4) any help.

I'm writing open source software because my dream is to eventually become successful so I can give my kids the lives they deserve (where daddy is not poor)!
