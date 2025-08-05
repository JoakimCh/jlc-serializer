/*
The {t, BinaryTemplate, BinarySerializer} from streamable-binary-serializer and their prototypes are all frozen using Object.freeze(). Hence to extend the BinarySerializer we can't modify its prototype, instead we must write a new class that extends it.

Here is how that should be done with a function that both takes and returns a {BinarySerializer, t} object. Every extension compatible with this format can easily be applied by nesting these function calls, e.g.:
const {BinarySerializer, t} = extendWithB( extendWithA( SBS ) ).
*/
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
  
      #write_dnsString(string) {
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
  }
}
