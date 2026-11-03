const { EventEmitter } = require('events')
const childProcess = require('./child-process')

// A stand-in for the ChildProcess that fork() returns.
const fakeChild = () => {
  const child = new EventEmitter()
  child.connected = true
  child.exitCode = null
  child.signalCode = null
  child.send = jest.fn()
  child.kill = jest.fn((signal) => child.exit(null, signal))
  child.exit = (code, signal) => {
    child.connected = false
    child.exitCode = code
    child.signalCode = signal ?? null
    child.emit('exit', code, signal ?? null)
  }
  return child
}

describe('childProcess', () => {
  let children
  let forkProcess
  let log
  const latest = () => children.at(-1)

  const supervise = (options = {}) =>
    childProcess('sensor.js', jest.fn(), jest.fn(), {
      forkProcess,
      log,
      restartDelays: [100, 200, 500],
      ...options,
    })

  beforeEach(() => {
    jest.useFakeTimers()
    children = []
    forkProcess = jest.fn(() => {
      const child = fakeChild()
      children.push(child)
      return child
    })
    log = jest.fn()
  })

  afterEach(() => jest.useRealTimers())

  it('forks the handler with stdout discarded and IPC open', () => {
    supervise()

    const [program, args, options] = forkProcess.mock.calls[0]
    expect(program).toMatch(/src\/utils\/deviceHandlers\/sensor\.js$/)
    expect(args).toEqual([])
    expect(options.stdio).toEqual(['ignore', 'ignore', 'inherit', 'ipc'])
  })

  it('passes messages and errors to the handlers, also after a restart', () => {
    const onMessage = jest.fn()
    const onError = jest.fn()
    childProcess('sensor.js', onMessage, onError, { forkProcess, log })

    latest().emit('message', 1)
    const err = new Error('spawn failed')
    latest().emit('error', err)

    expect(onMessage).toHaveBeenCalledWith(1)
    expect(onError).toHaveBeenCalledWith(err)

    latest().exit(1)
    jest.runOnlyPendingTimers()
    latest().emit('message', 0)
    expect(onMessage).toHaveBeenLastCalledWith(0)
  })

  it('logs and restarts a process that exits, backing off each time', () => {
    const onRestart = jest.fn()
    const handle = supervise({ onRestart })
    const first = latest()

    first.exit(1)
    expect(log).toHaveBeenCalledWith(
      'sensor.js exited (code 1, signal null), restarting in 100ms'
    )
    expect(handle.connected).toBe(false)

    jest.advanceTimersByTime(99)
    expect(forkProcess).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(1)
    expect(forkProcess).toHaveBeenCalledTimes(2)
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(handle.connected).toBe(true)


    latest().exit(null, 'SIGSEGV')
    jest.advanceTimersByTime(199)
    expect(forkProcess).toHaveBeenCalledTimes(2)
    jest.advanceTimersByTime(1)
    expect(forkProcess).toHaveBeenCalledTimes(3)

    // the last delay repeats
    latest().exit(1)
    jest.advanceTimersByTime(500)
    latest().exit(1)
    jest.advanceTimersByTime(500)
    expect(forkProcess).toHaveBeenCalledTimes(5)
  })

  it('starts the delays over after a process ran for a while', () => {
    supervise()
    latest().exit(1)
    jest.advanceTimersByTime(100)
    latest().exit(1)
    jest.advanceTimersByTime(200)

    jest.advanceTimersByTime(60000)
    latest().exit(1)
    jest.advanceTimersByTime(100)
    expect(forkProcess).toHaveBeenCalledTimes(4)
  })

  it('sends to the current process only while connected', () => {
    const handle = supervise()
    handle.send({ view: null })
    expect(latest().send).toHaveBeenCalledWith({ view: null })

    const first = latest()
    first.exit(1)
    handle.send({ view: 'lost' })
    expect(first.send).toHaveBeenCalledTimes(1)
  })

  it("stops the process and doesn't restart it", () => {
    const handle = supervise()
    handle.stop()

    expect(latest().kill).toHaveBeenCalledWith('SIGTERM')
    jest.advanceTimersByTime(60000)
    expect(forkProcess).toHaveBeenCalledTimes(1)
    expect(handle.connected).toBe(false)
    expect(log).not.toHaveBeenCalled()
  })

  it('cancels a pending restart when stopped', () => {
    const handle = supervise()
    latest().exit(1)
    handle.stop()

    jest.advanceTimersByTime(60000)
    expect(forkProcess).toHaveBeenCalledTimes(1)
  })
})
