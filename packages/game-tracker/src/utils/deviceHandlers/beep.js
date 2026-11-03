const { Gpio } = require('onoff')
const { pin: gpio } = require('../gpio')

const BEEP_MS = 400

// One Gpio per pin for the life of the process. Creating one per beep leaked a
// file descriptor each time (readCard beeps every 500 ms while a card is on the
// reader), until the Pi failed with EMFILE.
const buzzers = new Map()

const buzzerFor = (pin) => {
  let buzzer = buzzers.get(pin)
  if (!buzzer) {
    buzzer = { gpio: new Gpio(gpio(pin), 'out'), timer: null }
    buzzers.set(pin, buzzer)
  }
  return buzzer
}

// Turns the buzzers off and frees their pins.
const release = () => {
  for (const { gpio: pin, timer } of buzzers.values()) {
    clearTimeout(timer)
    try {
      pin.writeSync(0)
      pin.unexport()
    } catch {
      // already released, or the pin is gone; nothing else to do on the way out
    }
  }
  buzzers.clear()
}

process.on('exit', release)

// Sounds the buzzer for BEEP_MS, or until the returned function is called when
// `forever` is set. A new beep restarts the timer, so an earlier beep can't cut
// it short.
const beep = (pin = '17', forever = false) => {
  const buzzer = buzzerFor(pin)
  clearTimeout(buzzer.timer)
  buzzer.timer = null
  buzzer.gpio.writeSync(1)

  if (!forever) {
    buzzer.timer = setTimeout(() => {
      buzzer.timer = null
      buzzer.gpio.writeSync(0)
    }, BEEP_MS)
  }

  return () => {
    clearTimeout(buzzer.timer)
    buzzer.timer = null
    buzzer.gpio.writeSync(0)
  }
}

module.exports = beep
module.exports.release = release
module.exports.BEEP_MS = BEEP_MS
