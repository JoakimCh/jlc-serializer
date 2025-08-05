
import * as dgram from 'node:dgram'

import {BinaryTemplate, t, Serializer} from '../source/streamable-binary-serializer.js'

t.dnsString = Symbol('dnsString')

/** Extended with DNS string support. */
class BinarySerializerExt extends Serializer {
  #dnsStringCache = new Map()

  dnsString(string) {
    if (this.writing) {
      this.write_dnsString(string || '')
    } else {
      return this.read_dnsString()
    }
  }

  read_dnsString() {
    let string = ''
    do {
      const labelOffset = this.offset
      const byte = this.u8()
      if (byte == 0) break // end of string
      if (byte <= 0b0011_1111) { // if label follows
        const label = this.string(byte) // byte as length
        if (string.length) string += '.'
        string += label
        this.#dnsStringCache.set(labelOffset, label)
      } else { // if pointer follows (first two bits are set)
        let label, pointerTarget = this.u8() | (byte & 0b0011_1111) << 8
        this.#dnsStringCache.set(labelOffset, pointerTarget)
        while (label = this.#dnsStringCache.get(pointerTarget)) {
          if (typeof label == 'string') {
            if (string.length) string += '.'
            string += label
            pointerTarget += label.length + 1
          } else { // is a pointer
            pointerTarget = label
          }
        }
        break // following a pointer terminates the string
      }
    } while (true)
    return string
  }
  
  write_dnsString(string) {
    string = string.toLowerCase()
    const updateCache = (string, offset) => {
      if (!this.#dnsStringCache.has(string)) this.#dnsStringCache.set(string, offset)
    }
    const writeLabels = (labelArr, strArr) => {
      const tmpArr = [...labelArr] // copy it
      for (const label of labelArr) {
        updateCache([...tmpArr, ...strArr].join('.'), this.offset)
        tmpArr.shift()
        this.string(t.u8, label)
      }
    }
    const strArr = string.split('.'), labelArr = []
    const labelCount = strArr.length
    let i, labelOffset
    for (i=0; i<labelCount; i++) {
      labelOffset = this.#dnsStringCache.get(strArr.join('.'))
      if (labelOffset) break
      labelArr.push(strArr.shift())
    }
    if (labelOffset) { // if previously written
      if (i) writeLabels(labelArr, strArr) // but not the whole part
      this.u16(labelOffset | 0b1100_0000 << 8) // write pointer
    } else { // no parts previously written
      writeLabels(labelArr, strArr)
      this.u8(0) // then put a zero
    }
  }
}

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
  serializer: BinarySerializerExt
})

dgram.createSocket('udp4')
.once('connect', function() {
  console.log('Sending DNS query...')
  this.send(dnsPacket.toBytes({
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
})
.connect(53, '1.1.1.1') // (the Cloudflare DNS server)
