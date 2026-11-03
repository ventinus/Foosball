jest.mock('onoff', () => ({
  Gpio: jest.fn().mockImplementation((pin, direction) => ({
    pin,
    direction,
    writeSync: jest.fn(),
    unexport: jest.fn(),
  })),
}))

const { Gpio } = require('onoff')
const beep = require('./beep')
const { release, BEEP_MS } = beep

// the last value written to a buzzer
const level = (buzzer) => buzzer.writeSync.mock.calls.at(-1)?.[0]

describe('beep', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    process.env.GPIO_BASE = '0'
  })

  afterEach(() => {
    release()
    Gpio.mockClear()
    jest.useRealTimers()
    delete process.env.GPIO_BASE
  })

  it('reuses one Gpio per pin across beeps', () => {
    for (let i = 0; i < 50; i++) {
      beep()
      jest.advanceTimersByTime(BEEP_MS)
    }
    beep('27')

    expect(Gpio).toHaveBeenCalledTimes(2)
    expect(Gpio.mock.calls.map(([pin]) => pin)).toEqual([17, 27])
  })

  it('turns the buzzer off after BEEP_MS', () => {
    beep()
    const buzzer = Gpio.mock.results[0].value

    expect(level(buzzer)).toBe(1)
    jest.advanceTimersByTime(BEEP_MS - 1)
    expect(level(buzzer)).toBe(1)
    jest.advanceTimersByTime(1)
    expect(level(buzzer)).toBe(0)
  })

  it("doesn't let an earlier beep cut a later one short", () => {
    beep()
    const buzzer = Gpio.mock.results[0].value
    jest.advanceTimersByTime(BEEP_MS - 100)
    beep()

    jest.advanceTimersByTime(100)
    expect(level(buzzer)).toBe(1)
    jest.advanceTimersByTime(BEEP_MS - 100)
    expect(level(buzzer)).toBe(0)
  })

  it('stays on until stopped when forever is set', () => {
    const stop = beep('17', true)
    const buzzer = Gpio.mock.results[0].value

    jest.advanceTimersByTime(BEEP_MS * 10)
    expect(level(buzzer)).toBe(1)
    stop()
    expect(level(buzzer)).toBe(0)
  })

  it('turns off and unexports every pin on release', () => {
    beep('17', true)
    beep('27', true)
    const buzzers = Gpio.mock.results.map((result) => result.value)

    release()
    buzzers.forEach((buzzer) => {
      expect(level(buzzer)).toBe(0)
      expect(buzzer.unexport).toHaveBeenCalled()
    })

    // a beep after release opens the pin again
    beep()
    expect(Gpio).toHaveBeenCalledTimes(3)
  })
})
