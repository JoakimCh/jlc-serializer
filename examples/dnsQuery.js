
import * as dgram from 'node:dgram'
import {BinaryTemplate, extendSerializer} from '../source/streamable-binary-serializer.js'
import dnsExtension from './dnsStringExt.js'

const {t, ExtendedSerializer} = extendSerializer(dnsExtension)

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
  this.send(dnsPacket.toBytes({ // (we only need to specify the "non-empty" values)
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
