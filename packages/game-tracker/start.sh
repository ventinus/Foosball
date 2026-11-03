#!/usr/bin/env bash
# Runs the tracker, restarting it whenever it exits. setup.sh calls this from
# ~/.bash_profile on the console (tty1). Settings come from tracker.env.

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

while [ ! -s src/aws-exports.js ]; do
  echo "Waiting for $PWD/src/aws-exports.js (it isn't in git). From your computer:"
  echo "  scp packages/game-app/src/aws-exports.js $(whoami)@$(hostname).local:$PWD/src/"
  echo "Checking again in 30 seconds (Ctrl-C for a shell)..."
  sleep 30
done

while true; do
  if [ -f tracker.env ]; then
    set -a
    . ./tracker.env
    set +a
  fi
  node src
  echo "Tracker stopped; restarting in 5 seconds (Ctrl-C to stay in the shell)"
  sleep 5
done
