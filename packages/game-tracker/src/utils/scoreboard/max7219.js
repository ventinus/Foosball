// Drives a chain of MAX7219 LED matrix modules by bit-banging three GPIO pins
// (the RFID reader does the same with rpi-softspi), so no SPI overlay is needed.

const REG = {
  decodeMode: 0x09,
  intensity: 0x0a,
  scanLimit: 0x0b,
  shutdown: 0x0c,
  displayTest: 0x0f,
};

// `Gpio` is onoff's class, passed in so this can be tested off the Pi.
exports.createMax7219 = ({ Gpio, pins, modules = 2, intensity = 1 }) => {
  const din = new Gpio(pins.din, "out");
  const clk = new Gpio(pins.clk, "out");
  const cs = new Gpio(pins.cs, "out");
  cs.writeSync(1);
  clk.writeSync(0);

  // Data is clocked in MSB first on each rising clock edge.
  const shift16 = (word) => {
    for (let bit = 15; bit >= 0; bit--) {
      din.writeSync((word >> bit) & 1);
      clk.writeSync(1);
      clk.writeSync(0);
    }
  };

  // words[i] is for the i-th module from DIN. Words shift through the chain,
  // so the farthest module's goes first; raising CS latches them all.
  const send = (words) => {
    cs.writeSync(0);
    [...words].reverse().forEach(shift16);
    cs.writeSync(1);
  };

  const sendAll = (register, data) =>
    send(Array(modules).fill((register << 8) | data));

  const init = () => {
    sendAll(REG.displayTest, 0);
    sendAll(REG.decodeMode, 0); // raw pixels, not 7-segment digits
    sendAll(REG.scanLimit, 7); // all 8 rows
    sendAll(REG.intensity, intensity & 0x0f);
    sendAll(REG.shutdown, 1); // wake up
  };

  // moduleRows[i] holds the 8 row bytes for the i-th module from DIN.
  // Re-initializes every time, since MAX7219s can glitch from electrical noise.
  const writeRows = (moduleRows) => {
    init();
    for (let row = 0; row < 8; row++) {
      send(moduleRows.map((rows) => ((row + 1) << 8) | rows[row]));
    }
  };

  // Blanks the modules and releases the pins.
  const close = () => {
    sendAll(REG.shutdown, 0);
    [din, clk, cs].forEach((pin) => pin.unexport());
  };

  return { writeRows, close };
};
