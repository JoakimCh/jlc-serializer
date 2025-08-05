
import * as fs from 'node:fs'
import * as util from 'node:util'
import {bcrypt_pbkdf} from './bcrypt.js'
import {BinaryTemplate, t} from '../../source/streamable-binary-serializer.js'
// import {fileURLToPath} from 'node:url'
// import {dirname, sep as pathSep} from 'node:path'
// const scriptDirectory = dirname(fileURLToPath(import.meta.url))+pathSep
const log = console.log

const t_keyFile = {
  authMagic: t.string(),
  cipherName: t.string(t.u32),
  kdfName: t.string(t.u32),
  kdfOptionsSize: t.sizeOf('kdfOptions', t.u32),
  kdfOptions: function(valueToWrite) {
    switch (this.getValueFromPath('kdfName')) {
      default: return this.value(t.bytes('kdfOptionsSize'), valueToWrite)
      case 'bcrypt': return this.value({
        salt: t.bytes(t.u32),
        rounds: t.u32
      }, valueToWrite)
    }
  },
  numKeys: t.lengthOf('publicKeys', t.u32), // (length of the array)
  publicKeySectionSize: t.sizeOf('publicKeys', t.u32), // (binary size of the array)
  publicKeys: t.array({
    type: t.string(t.u32),
    data: t.bytes(t.u32)
  }, 'numKeys'),
  privateKeySectionSize: t.sizeOf('privateKeySection', t.u32),
  privateKeySection: function(valueToWrite) {
    switch (this.getValueFromPath('cipherName')) {
      default: return this.value(t.bytes('privateKeySectionSize'), valueToWrite)
      case 'none': return this.value(t_privateKeySection, valueToWrite)
    }
  }
}

const t_privateKeySection = {
  checkInt1: t.u32, // random value identical with the one below
  checkInt2: t.u32, // (used to verify decryption)
  keyPairs: t.array({
    type: t.string(t.u32),
    public: t.bytes(t.u32),
    private: t.bytes(t.u32),
    comment: t.string(t.u32)
  }, '../numKeys'),
  //padding
}

const sshKey = new BinaryTemplate(t_keyFile, {littleEndian: false})
const keyFile = sshKey.fromBytes(fs.readFileSync('edPrivKey.enc.bin'))

// Apply decryption if needed (can't be done in a template function since it's async):
switch (keyFile.kdfName) {
  default: throw Error('Unknown kdfName: '+keyFile.kdfName)
  case 'none': break
  case 'bcrypt': {
    const keyLen = 32, ivLen = 16, pass = 'test'
    const keyAndIvData = await bcrypt_pbkdf(pass, keyFile.kdfOptions.salt, keyFile.kdfOptions.rounds, keyLen + ivLen)
    const keyData = keyAndIvData.buffer.slice(0,keyLen)
    const ivData = keyAndIvData.buffer.slice(keyLen)
    const key = await crypto.subtle.importKey(
      'raw', keyData, 'AES-CTR', true, ['encrypt', 'decrypt']
    )
    const decryptedKeyList = await crypto.subtle.decrypt({
      name: 'AES-CTR',
      counter: ivData,
      length: 64
    }, key, keyFile.privateKeySection)

    keyFile.privateKeySection = new BinaryTemplate(t_privateKeySection, {
      littleEndian: false,
      context: {parent: keyFile, ourLocation: 'privateKeySection'} // so "path strings" in the template works correctly
    }).fromBytes(decryptedKeyList)
  } break
}

log(util.inspect(keyFile, false, Infinity, true))
