
// import * as msgpackr from 'msgpackr'

class PRNG {
  #state
  constructor(seed) {
    this.#state = seed | 0
  }
  uInt32() { // (mulberry32)
    let z = (this.#state = (this.#state + 0x6D2B79F5) | 0)
    z =  Math.imul(z ^ (z >>> 15), z |  1)
    z ^= Math.imul(z ^ (z >>>  7), z | 61) + z
    return (z ^ (z >>> 14)) >>> 0
  }
  integer(...range) {
    const min = range.length > 1 ? Math.round(Math.min(...range)) : 0
    const max = Math.round(Math.max(...range))
    const randomFloat = this.uInt32() / 0x1_0000_0000 // to emulate Math.random()
    return Math.floor(min + randomFloat * (max - min + 1))
  }
  float(...range) {  
    const randomFloat = (this.uInt32() + (this.uInt32() >>> 11) * 2 ** 32) * 2 ** -53 // 0 to 0.9999999999999999
    let min
    switch (range.length) {
      case 0: return randomFloat
      case 1: min = 0; break
      default: min = Math.min(...range)
    }
    return min + randomFloat * (Math.max(...range) - min)
  }
  * range(...range) {
    const from = range.length > 1 ? Math.round(Math.min(...range)) : 0
    const to = this.integer(...range)
    for (let i=from; i<=to; i++) {
      yield i
    }
  }
}

function randomHeavyObject(seed) {
  const random = new PRNG(seed)
  console.log(random.integer(0, 11))
  const object = {}
  for (const i of random.range(10)) {
    object[i] = i
  }
  return object
}

console.log(randomHeavyObject(11))

// msgpackr.pack()