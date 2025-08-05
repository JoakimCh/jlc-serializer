
# Documentation for jlc-serializer

## The different types allowed in a template

```
{}           - Nested objects with their own templates.
any          - Can store most JavaScript objects including nested objects.
u8 to u64    - Unsigned integers of different sizes.
i8 to i64    - Signed integers of different sizes.
f32 and f64  - "low" and "high" precision floating point numbers.
string()     - UTF-8 encoded strings.
bytes()      - Any ArrayBufferView (is read back as Uint8Array).
array()      - Arrays with their own templates.
typedArray() - Any TypedArray (respects the chosen endianness).
bigUint()    - Unsigned BigInt.
bigInt()     - Signed BigInt.
bitField()   - A special template for values of mixed bit lengths.
```

Any types that are function calls accepts 1 or more parameters. Usually a "length type" parameter which defines the type of the integer that precedes the data with the data-length (which is needed for decoding).

With strings though it defaults to `zeroTerminated` which instead just marks the end of the string with a zero (`0x00`) byte.

### typedArray()

```js
typedArray(TypedArray, [lengthType = u16])
```

Where `TypedArray` must be a constructor like e.g. `Uint8Array` (or any of the other ones).

And `lengthType` defaults to `u16` which works for up to 65535 elements. For more elements you can use a `u32` instead.

### bitField()

```js
bitField(template, values)
```

A field of bits split into different (unsigned) values. Its template is an object specifying their order (going from [MSB](https://en.wiktionary.org/wiki/most_significant_byte) to LSB) and their bit-lengths. Any bit-lengths resulting in numbers above `Number.MAX_SAFE_INTEGER` will return a BigInt.

The byte order of a bit field is the "network byte order" which is more commonly known as the "big-endian" byte order. This is the only byte order which makes sense for bit fields and can not be changed (it ignores the littleEndian setting of the template).

E.g. the template `{a: 2, b: 6}` with values `{a: 0b11, b: 0b00_1111}` will result in `0b1100_1111` being written.

And the template `{a: 16}` with value `{a: 0b0000_0000_1111_1111}` will result in `0b0000_0000_1111_1111` being written.

In other words it is written exactly the same way as it was laid out. And this makes it easy to follow most network protocol documentation to implement the encoding / decoding correctly.

Here is a [DNS header](http://www.tcpipguide.com/free/t_DNSMessageHeaderandQuestionSectionFormat.htm#:~:text=Figure%20248%3A%20DNS%20Message%20Header%20Format) template example:
```js
const dnsHeaderTemplate = {
  id: 16, // request or response ID
  isResponse: 1, // a 1 bit flag
  opcode: 4,
  authoritativeAnswer: 1, 
  truncated: 1, 
  recursionDesired: 1, 
  recursionAvailable: 1, 
  reserved: 3, // not in use
  responseCode: 4,
  questionCount: 16,
  answerCount: 16,
  nameserverCount: 16,
  additionalRecordCount: 16
}
```

In conclusion it's a very convenient way to work with binary headers (which often use values of less than 8 bits or mix different sized integers across byte boundaries).



## Weaknesses

* The serializer is synchronous, meaning you can't implement a serializer function that does anything asynchronously (e.g. "on the fly" encryption / decryption using crypto.subtle).



```js
import * as d from 'jlc-serializer'

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

const template = new BinaryTemplate(binaryTemplate)
const readable = objectToBinary_readable(object)

const compressedBytes = await readableToBytes(
  readable.pipeThrough(new CompressionStream('deflate'))
)
// There you go it doesn't get more compact than this! Or easier?
// And this works everywhere! In the browser, Node.js, Deno, Bun...
```

## Why is it awesome?

Because of how easy, powerful and useful it is!
* Use `any()` to serialize "any" JavaScript value (including objects) without having to write a binary template.
* Fine tune the binary format to save every byte possible! E.g. by defining that an array should store its size as a u8 instead of a u32.
* Validate user input by defining constraints directly in the template.
* Don't like streams? Then use `objectToBinary` and `binaryToObject` instead.
* Handles circular references without a hitch.

