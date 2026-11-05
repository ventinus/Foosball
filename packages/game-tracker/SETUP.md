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
| USB keyboard + micro-USB OTG adapter, or a Bluetooth keyboard | Answering prompts (y/n/return) and typing new players' names. Bluetooth pairing is in step 10 |
| Optional: RTC module (e.g. DS3231) | Keeps the clock right when it boots offline (step 9) |

Wire everything as listed in [`pin-mapping.txt`](pin-mapping.txt). The
MAX7219 runs at 5V but is driven with the Pi's 3.3V signals; this usually
works, and if the matrix flickers or shows garbage, add a level shifter on DIN,
CLK and CS.

## 2. Flash the SD card

In [Raspberry Pi Imager](https://www.raspberrypi.com/software/):

1. Device: **Raspberry Pi Zero**. OS: Raspberry Pi OS (other) →
   **Raspberry Pi OS (Legacy) Lite 32-bit**, which is Bookworm. The Zero W
   can't run the 64-bit OS. Don't use the newer Trixie image yet:
   - Comitup has a reported failure on Trixie: dnsmasq can't bind port 53 and
     `wlan0` isn't found
     ([davesteele/comitup#269](https://github.com/davesteele/comitup/issues/269),
     no fix as of November 2026). Without Comitup the table can't join Wi-Fi.
   - This setup (sysfs GPIO for `onoff`, the `rpio` build, `raspi-config
     nonint`) has only been written against Bookworm.
   - Trixie gains nothing here: the tracker brings its own Node 22, and
     Bookworm gets Debian LTS security updates until mid-2028.

   `setup.sh` stops on Trixie unless you run it with `ALLOW_TRIXIE=1`. Try
   Trixie again once that Comitup issue is fixed.
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

## Quick setup: run `setup.sh`

On the Pi, clone the repo and run the setup script:

```sh
git clone https://github.com/ventinus/Foosball.git
Foosball/packages/game-tracker/setup.sh
```

If `git` isn't installed, this one command clones the repo too:

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/ventinus/Foosball/mainline/packages/game-tracker/setup.sh)
```

The script first asks you to paste in the Amplify config (`aws-exports.js`,
see step 5). After that it runs without input: it updates the OS, installs
Node 22 (step 4), the tracker (step 5), autostart on the console (step 7) and
Comitup (step 3), then reboots into the tracker. It takes a long time on a
Zero W. It's safe to run again, for example after a failed step.

Afterwards, check the hardware (step 6) and correct the scoreboard in
`packages/game-tracker/tracker.env` if needed. Steps 3 to 5 and 7 describe
what the script does, for doing it by hand.

## 3. Comitup (Wi-Fi setup from a phone)

[Comitup](https://davesteele.github.io/comitup/) makes the Pi broadcast a
setup hotspot whenever it can't join a known network. You join it from a phone
and pick the Wi-Fi network on a web page.

```sh
curl -fsSLO https://davesteele.github.io/comitup/deb/davesteele-comitup-apt-source_1.3_all.deb
sudo dpkg -i davesteele-comitup-apt-source_1.3_all.deb
sudo apt update
sudo apt install -y comitup python3-networkmanager
```

Install it from the maintainer's repository as shown, not Debian's
`apt install comitup` alone. Bookworm's own comitup (1.38) crash-loops with
`KeyError: dbus.UInt32(32)`: its `python3-networkmanager` 2.2-2 doesn't know
the loopback device that NetworkManager 1.42 lists. The repository's 2.2-3
fixes that. The first package only adds the apt source and the maintainer's
signing key.

Name the hotspot after the table in `/etc/comitup.conf` (`setup.sh` uses the hostname):

```
ap_name: foosball-1
```

Use the table's hostname. Then `sudo reboot`. Check the [Comitup docs](https://davesteele.github.io/comitup/)
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
2. **Everything else:** run `npm start` with the keyboard connected (or
   over SSH):
   - Scan a badge: it beeps and prints "Please wait while I look you up...".
     An unknown badge asks for a name.
   - Break each beam: the log shows `break beam 0` (side A), `1` (side B) and
     `2` (game start).
   - Start a game with two players, score on each side and watch the
     scoreboard.
   - Stop with Ctrl-C.

Keyboard controls while the tracker runs (outside of typing a name):

| Key | Does |
| --- | --- |
| `y` / Return | Yes: resume a game, keep playing after the inactivity warning |
| `n` | No: start the score over instead of resuming, or end the game after the inactivity warning |
| `u` | Undo the latest goal (also the winning goal, for 10 seconds after it) |
| `r` | Rematch: after a game, start another with the same lineup |
| `s` | Swap sides: before a game, or during one until the first goal |
| `x` | Abandon the game (it can be resumed later) |

Once it's set up, the tracker reads the scoreboard values from
`tracker.env` (created by `setup.sh`, not in git). Edit it and reboot to
apply them.

If GPIO setup fails with `EINVAL`, check `cat /sys/class/gpio/gpiochip*/label`
and `.../base`. `src/utils/gpio.js` finds the base of the `pinctrl-bcm2835`
controller automatically, and `GPIO_BASE=<n>` overrides it.

## 7. Start on boot

The tracker reads the keyboard, so it has to run on the Pi's console (tty1)
rather than as a background service. Log in to the console automatically:

```sh
sudo raspi-config nonint do_boot_behaviour B2   # console autologin
```

Then add this to the end of `~/.bash_profile` (create it if needed).
`start.sh` loads the settings in `tracker.env` and restarts the tracker
whenever it exits; until `src/aws-exports.js` exists it waits and says how to
copy it over.

```sh
# Run the foosball tracker on the console.
if [ "$(tty)" = "/dev/tty1" ]; then
  ~/Foosball/packages/game-tracker/start.sh
fi
```

Put your scoreboard values from step 6 in
`~/Foosball/packages/game-tracker/tracker.env`, e.g. `SCOREBOARD_ORIENTATION=90`.

`sudo reboot` and the tracker should start by itself. SSH logins aren't on
tty1, so they get a normal shell.

## 8. Updating

```sh
ssh pi@foosball-1.local
cd ~/Foosball && git pull
packages/game-tracker/setup.sh   # or: cd packages/game-tracker && npm ci --omit=dev && sudo reboot
```

## 9. The clock

The Zero W has no battery-backed clock. Raspberry Pi OS sets the time from
the internet at boot and restores the last saved time otherwise, so a Pi that
reboots while offline can be behind until it reconnects, and games played in
that window get wrong start and end times. Check with `timedatectl`. If the
table is often offline, add an RTC module (e.g. a DS3231 on the I2C pins,
enabled with `dtoverlay=i2c-rtc,ds3231` in `/boot/firmware/config.txt`).

## 10. Bluetooth keyboard (optional)

The Zero W has Bluetooth built in, and Raspberry Pi OS Lite comes with BlueZ,
so nothing needs installing. A paired keyboard is an ordinary input device,
so its keys reach the tracker on tty1 just like a USB keyboard's.

Over SSH, put the keyboard in pairing mode and run `bluetoothctl`, then:

```
agent on
default-agent
scan on                  # wait for the keyboard to appear, note its address
pair AA:BB:CC:DD:EE:FF   # if it prints "PIN code: NNNNNN" or "Passkey: NNNNNN",
                         # type that on the Bluetooth keyboard and press Enter
trust AA:BB:CC:DD:EE:FF  # so it reconnects by itself after a reboot or sleep
connect AA:BB:CC:DD:EE:FF
scan off
quit
```

- Stay in the same `bluetoothctl` session from `scan on` to `pair`. Devices
  found by a scan are forgotten shortly after it stops, and `pair` then says
  "not available".
- `remove <address>` (e.g. before pairing again) also clears the trust, so run
  `trust` again afterwards.
- Most keyboards sleep when idle. The first key pressed after that wakes the
  keyboard and is often lost while it reconnects, so press a key and wait a
  moment before answering a prompt.
- Wi-Fi and Bluetooth share one radio on the Zero W. If Wi-Fi becomes
  unreliable or keys lag, a USB keyboard avoids it.

## 11. The table screen (iPad)

The tracker serves the table's screen on port 8080 (`TRACKER_UI_PORT` in
`tracker.env` changes it). It shows who's at the table and on which side, the
score, prompts (new player, resume, still playing?) and the final result with
Rematch and Undo, and players use it to move people between sides.

1. Put the iPad on the same Wi-Fi as the Pi and open
   `http://foosball-1.local:8080` in Safari (use the table's hostname). The
   tracker prints the address when it starts.
2. Share → **Add to Home Screen**, then open it from there so it runs full
   screen.
3. Keep the screen on: Settings → Display & Brightness → Auto-Lock → Never,
   or lock the iPad to the page with Guided Access (Settings → Accessibility
   → Guided Access, then triple-click the side or home button on the page).

New players type their name with the iPad's on-screen keyboard; the Pi's
keyboard still works too (see the key list in step 6). The page reconnects by
itself when the Pi restarts or the iPad wakes up.

There's no login: anyone on the same network can open the page and tap its
buttons.

**Trying it without the table:** on a computer, `npm run simulate` runs the
tracker with no sensors and adds buttons to the page that stand in for them
(scan a badge, goal A/B, coin, go idle). Open `http://localhost:8080`. The
simulator never talks to the API, so its games aren't saved online; it keeps
its players and games in `data/simulator`.

## Setting up several tables

Set up one card fully, then copy it (e.g. with Imager or `dd`). On each copy,
**before its first game**:

- Give it its own hostname: `sudo raspi-config nonint do_hostname foosball-2`
- Give it its own hotspot name in `/etc/comitup.conf`
- Delete `packages/game-tracker/data/` if it exists. Otherwise each copy would
  re-send the original's unsent games and players.
