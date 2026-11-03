const { Gpio } = require('onoff')
const { pin } = require('../gpio')

const sensors = ['4', '5', '6'].map((bcm) => new Gpio(pin(bcm), 'in', 'both'))

const trackingValues = [0, 0]

const handleChange = (index) => (err, value) => {
  if (err) {
    process.send(`POINT ERROR: ${err}`)
    return
  }

  if (trackingValues[index] !== value && value === 1) {
    process.send(index)
  }

  trackingValues[index] = value
}

sensors.forEach((sensor, i) => sensor.watch(handleChange(i)))
