const Mfrc522 = require('mfrc522-rpi')
const SoftSPI = require('rpi-softspi')
const { beep } = require('../helpers')

//# This loop keeps checking for chips and reports the UID of any that is near
console.log({ message: 'scanning...' })
console.log({ message: 'Please put chip or keycard in the antenna inductive zone!' })
console.log({ message: 'Press Ctrl-C to stop.' })

const softSPI = new SoftSPI({
  clock: 23, // pin number of SCLK
  mosi: 19, // pin number of MOSI
  miso: 21, // pin number of MISO
  client: 24, // pin number of CS
})

// GPIO 24 can be used for buzzer bin (PIN 18), Reset pin is (PIN 22).
// I believe that channing pattern is better for configuring pins which are optional methods to use.
const mfrc522 = new Mfrc522(softSPI).setResetPin(22)

setInterval(function() {
  //# reset card
  mfrc522.reset()

  //# Scan for cards
  let response = mfrc522.findCard()
  if (!response.status) {
    console.log({ message: 'No Card' })
    return
  }

  console.log({ message: `Card detected, CardType: ${response.bitSize}` })
  beep()

  //# Get the UID of the card
  console.log({ message: 'before response' })
  response = mfrc522.getUid()
  if (!response.status) {
    console.log({ message: 'UID Scan Error' })
    return
  }
  //# If we have the UID, continue
  const uid = response.data
  let cardId = 0
  for (let i = 0; i < uid.length; i++) {
    cardId = cardId * 256 + uid[i]
  }
  console.log({ message: cardId })

  // The UID is all the tracker needs. Don't authenticate or read a data block:
  // some badges use a non-default key, and failing that check used to drop
  // the scan after the beep.
  process.send({ id: cardId })
}, 500)

// Exit when the tracker goes away, so this process doesn't keep the pins.
process.on('disconnect', () => process.exit(0))
