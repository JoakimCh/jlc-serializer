 
import {BinaryTemplate, t} from '../source/streamable-binary-serializer.js'

const bf_typeId = t.bitField({
  type: 8,
  id:  24 // LSB
})

const t_pro = {
  // pro: {
  //   type: t.integer({byteLength: 1, signed: false}),
  //   id:   t.integer({byteLength: 3, signed: false}),
  // },
  proId: bf_typeId,
  msgId: bf_typeId,
  frmId: bf_typeId,
  lightRadius: t.u32,
  lightStrength: t.u32,
  flags: t.flags(4, {
    flat:         0x00000008, // (rendered first, just after tiles)
    noBlock:      0x00000010, // (doesn't block the tile)
    multiHex:     0x00000800, 
    noHighlight:  0x00001000, // (doesn't highlight the border; used for containers) 
    transRed:     0x00004000,
    transNone:    0x00008000, // (opaque)
    transWall:    0x00010000,
    transGlass:   0x00020000,
    transSteam:   0x00040000,
    transEnergy:  0x00080000,
    wallTransEnd: 0x10000000, // (changes transparency egg logic. Set for walls with 1144 - 1155 pid)
    lightThru:    0x20000000,
    shootThru:    0x80000000,
  }),
  specific: function(value) {
    
  }
}

const t_item = {
  flags: t.flags(3, {
    // first byte (LSB)
    bigGun:           0b0000_0001,
    twoHanded:        0b0000_0010,
    canUse:           0b0000_1000,
    canUseOnAnything: 0b0001_0000,
    canPickUp:        0b1000_0000,
    // third byte
    hiddenItem: 0x80000,
  }),
  attackModes: t.bitField()
  // (() => {
  //   const attackModes = [
  //     'none',
  //     'punch',
  //     'kick',
  //     'swing',
  //     'thrust',
  //     'throw',
  //     'fireSingle',
  //     'fireBurst',
  //     'flame',
  //   ]
  //   const byte = data.u8()
  //   return {
  //     primary: attackModes[byte & 0x0F],
  //     secondary: attackModes[byte >> 4]
  //   }
  // })(),
  scriptId: data.i32(),
  typeId: data.i32(),
  material: data.i32(),
  size: data.i32(),
  weight: data.i32(),
  cost: data.i32(),
  invFrmId: data.i32(),
  soundId: data.u8(),
  specific: function(value) {

  }
}
