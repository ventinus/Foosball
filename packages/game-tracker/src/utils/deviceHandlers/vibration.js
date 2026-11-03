const { Gpio } = require('onoff')
const { pin } = require('../gpio')

// TODO: determine correct pin usage
const sensor = new Gpio(pin(18), 'in', 'both')

const emit = (err, value) => {
  if (err) {
    process.send(`VIBRATION ERROR: ${err}`)
    return
  }

  process.send(value)
}

sensor.watch(emit)
