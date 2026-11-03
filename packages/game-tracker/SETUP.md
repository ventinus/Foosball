# Setting up a table (Pi Zero W)

How to go from a blank SD card to a working table: the tracker reads the badge
reader and sensors, drives the LED scoreboard, and saves games to the API
(see the root `CLAUDE.md` for how the code works).

Written for the original **Pi Zero W** (ARMv6, 32-bit). Differences for a
Pi Zero 2 W or newer are noted where they matter.

## 1. Parts

| Part | Notes |
| --- | --- |
| Raspberry Pi Zero W + 8 GB+ microSD + 5V/2.5A micro-USB supply | A Zero 2 W fits the same wiring |
| MFRC522 RFID reader + 13.56 MHz badges | Wired to the SPI0 pins, driven in software |
| 3 break-beam (IR) sensors | Side A goal, side B goal, game start |
| Vibration sensor | Detects play; inactivity triggers the pause warning |
| Active buzzer | |
| 2× MAX7219 8×8 LED matrix modules (chained) | The scoreboard |
| USB keyboard + micro-USB OTG adapter | Answering prompts (y/n/return) and typing new players' names |
| Optional: RTC module (e.g. DS3231) | Keeps the clock right when it boots offline (step 9) |

Wire everything as listed in [`pin-mapping.txt`](pin-mapping.txt). The
MAX7219 runs at 5V but is driven with the Pi's 3.3V signals; this usually
works, and if the matrix flickers or shows garbage, add a level shifter on DIN,
CLK and CS.

## 2. Flash the SD card

In [Raspberry Pi Imager](https://www.raspberrypi.com/software/):

1. Device: **Raspberry Pi Zero**. OS: **Raspberry Pi OS Lite (32-bit)**. The
   Zero W can't run the 64-bit OS.
2. Edit the settings (OS customisation):
   - Hostname: `foosball-1` (unique per table)
   - Username and password: e.g. `pi`
   - Wireless LAN: a network you can reach **now** (office Wi-Fi or a phone
     hotspot). It's only needed to install things; Comitup handles Wi-Fi
     after that.
   - Locale and time zone
   - Services: enable SSH
3. Write the card, put it in the Pi, power it on and give it a few minutes.
   Then `ssh pi@foosball-1.local`.

Update the OS and install the build tools (the GPIO packages compile during
`npm install`):

```sh
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git build-essential python3
```

## 3. Comitup (Wi-Fi setup from a phone)

[Comitup](https://davesteele.github.io/comitup/) makes the Pi broadcast a
setup hotspot whenever it can't join a known network. You join it from a phone
and pick the Wi-Fi network on a web page.

```sh
sudo apt install -y comitup
```

Name the hotspot after the table in `/etc/comitup.conf`:

```
ap_name: foosball-1
```

Then `sudo reboot`. Check the [Comitup docs](https://davesteele.github.io/comitup/)
for anything specific to your OS release; it needs NetworkManager, which
current Raspberry Pi OS uses.

**Changing Wi-Fi later** (new office, new password): power the Pi up where it
can't reach its old network, join the `foosball-1` Wi-Fi from a phone, and the
setup page opens (if not, go to `http://10.41.0.1/`). Pick the network and
enter the password. The Zero W has one Wi-Fi chip, so the hotspot disappears
once it connects; that's expected. The page's "Locate" button blinks the
Pi's green LED, which helps when setting up several tables.

Games keep working while the Pi is offline; they sync when it reconnects.

## 4. Node.js 22

Official Node.js builds no longer support the Zero W's ARMv6 chip. The
community [unofficial builds](https://unofficial-builds.nodejs.org/download/release/)
still provide Node 22 for it (there's no Node 24 build). Check that page for
the newest `v22.x` that has a `linux-armv6l` file:

```sh
NODE_VERSION=v22.23.4
FILE=node-$NODE_VERSION-linux-armv6l.tar.xz
cd /tmp
curl -fsSLO https://unofficial-builds.nodejs.org/download/release/$NODE_VERSION/$FILE
curl -fsSL https://unofficial-builds.nodejs.org/download/release/$NODE_VERSION/SHASUMS256.txt | grep " $FILE\$" | sha256sum -c -
sudo tar -xJf $FILE -C /usr/local --strip-components=1
node -v   # v22.x
```

Node 22 gets security fixes until April 2027, and the unofficial ARMv6
builds could stop before then. Replacing the Pi with a **Zero 2 W** (same
wiring) lets it run official Node 24; on a Zero 2 W, install Node 24 from
[nodejs.org](https://nodejs.org/en/download) instead of this step.

## 5. Install the tracker

```sh
cd ~
git clone https://github.com/ventinus/Foosball.git   # or SSH with a deploy key
cd Foosball/packages/game-tracker
npm ci --omit=dev   # skips the test tools; compiling takes a while on a Zero W
```

Copy the Amplify config from a computer that has it. It's gitignored, and
`amplify pull` in `packages/game-app` generates it:

```sh
# on your computer, from the repo root
scp packages/game-app/src/aws-exports.js pi@foosball-1.local:~/Foosball/packages/game-tracker/src/
```

The tracker keeps its offline state (known players, games not yet sent) in
`packages/game-tracker/data/`. It's created on first run and survives
`git pull`.

## 6. Check the hardware

From `~/Foosball/packages/game-tracker`:

1. **Scoreboard:** `npm run scoreboard:test` should show `1` on the left and
   an underlined `2` on the right. If it's rotated, mirrored or the two
   modules are swapped, try different values until it's right, e.g.
   `SCOREBOARD_ORIENTATION=0 npm run scoreboard:test` (0, 90, 180 or 270),
   `SCOREBOARD_MIRROR=1` and `SCOREBOARD_REVERSE=1`. `SCOREBOARD_INTENSITY`
   sets brightness (0–15, default 1). Note the values for step 7.
2. **Everything else:** run `npm start` with the USB keyboard attached (or
   over SSH):
   - Scan a badge: it beeps and prints "Please wait while I look you up...".
     An unknown badge asks for a name.
   - Break each beam: the log shows `break beam 0` (side A), `1` (side B) and
     `2` (game start).
   - Start a game with two players, score on each side and watch the
     scoreboard.
   - Stop with Ctrl-C.

If GPIO setup fails with `EINVAL`, check `cat /sys/class/gpio/gpiochip*/label`
and `.../base`. `src/utils/gpio.js` finds the base of the `pinctrl-bcm2835`
controller automatically, and `GPIO_BASE=<n>` overrides it.

## 7. Start on boot

The tracker reads the keyboard, so it has to run on the Pi's console (tty1)
rather than as a background service. Log in to the console automatically:

```sh
sudo raspi-config nonint do_boot_behaviour B2   # console autologin
```

Then add this to the end of `~/.bash_profile` (create it if needed), using
your scoreboard values from step 6:

```sh
# Run the foosball tracker on the console, restarting it if it exits.
if [ "$(tty)" = "/dev/tty1" ]; then
  export SCOREBOARD_ORIENTATION=90
  cd ~/Foosball/packages/game-tracker
  while true; do
    node src
    echo "Tracker stopped; restarting in 5 seconds (Ctrl-C to stay in the shell)"
    sleep 5
  done
fi
```

`sudo reboot` and the tracker should start by itself. SSH logins aren't on
tty1, so they get a normal shell.

## 8. Updating

```sh
ssh pi@foosball-1.local
cd ~/Foosball && git pull
cd packages/game-tracker && npm ci --omit=dev
sudo reboot
```

## 9. The clock

The Zero W has no battery-backed clock. Raspberry Pi OS sets the time from
the internet at boot and restores the last saved time otherwise, so a Pi that
reboots while offline can be behind until it reconnects, and games played in
that window get wrong start and end times. Check with `timedatectl`. If the
table is often offline, add an RTC module (e.g. a DS3231 on the I2C pins,
enabled with `dtoverlay=i2c-rtc,ds3231` in `/boot/firmware/config.txt`).

## Setting up several tables

Set up one card fully, then copy it (e.g. with Imager or `dd`). On each copy,
**before its first game**:

- Give it its own hostname: `sudo raspi-config nonint do_hostname foosball-2`
- Give it its own hotspot name in `/etc/comitup.conf`
- Delete `packages/game-tracker/data/` if it exists. Otherwise each copy would
  re-send the original's unsent games and players.
