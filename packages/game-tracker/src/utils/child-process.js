const path = require('path')
const { fork } = require('child_process')

// Wait before each restart of a crashed process; the last one repeats.
const RESTART_DELAYS_MS = [1000, 2000, 5000, 10000, 30000]
// A process that ran this long before exiting starts the delays over.
const STABLE_MS = 60000

// Forks a device handler from src/utils/deviceHandlers and keeps it running:
// if it exits on its own, it's logged and restarted after a delay. stop() ends
// it for good. Paths resolve against the cwd, so run the tracker from the
// package root.
//
// Returns a handle rather than the ChildProcess, since a restart replaces it.
module.exports = (
  filename,
  onMessage,
  onError,
  {
    forkProcess = fork,
    log = console.log,
    onRestart = () => {},
    restartDelays = RESTART_DELAYS_MS,
  } = {}
) => {
  const program = path.resolve(`src/utils/deviceHandlers/${filename}`)
  const options = {
    // The children log freely (readCard every 500 ms). Nothing reads their
    // stdout, and unread piped output piles up in the child's memory, so
    // discard it. stderr goes to the terminal so crashes are visible.
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  }
  const handleError = onError ?? ((err) => log(`${filename} error`, err))

  let child
  let stopped = false
  let restartTimer = null
  let restarts = 0
  let startedAt = 0

  const start = () => {
    restartTimer = null
    startedAt = Date.now()
    child = forkProcess(program, [], options)
    child.on('message', onMessage)
    child.on('error', handleError)
    child.on('exit', (code, signal) => {
      if (stopped) return
      if (Date.now() - startedAt >= STABLE_MS) restarts = 0
      const delay = restartDelays[Math.min(restarts, restartDelays.length - 1)]
      restarts += 1
      log(
        `${filename} exited (code ${code}, signal ${signal}), restarting in ${delay}ms`
      )
      restartTimer = setTimeout(() => {
        start()
        onRestart()
      }, delay)
    })
  }

  start()

  return {
    get connected() {
      return !stopped && Boolean(child?.connected)
    },
    send: (message) => {
      if (child?.connected) child.send(message)
    },
    stop: (signal = 'SIGTERM') => {
      stopped = true
      clearTimeout(restartTimer)
      if (child.exitCode === null && child.signalCode === null) child.kill(signal)
    },
  }
}
