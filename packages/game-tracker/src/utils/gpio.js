const fs = require("fs");
const path = require("path");

const SYSFS_GPIO = "/sys/class/gpio";

// Label of the Pi's main GPIO controller: pinctrl-bcm2835 (Zero/Zero W/1/2/3),
// pinctrl-bcm2711 (4), pinctrl-rp1 (5).
const PI_CONTROLLER = /^pinctrl-(bcm\d+|rp1)$/;

// The sysfs number of BCM GPIO 0. It's 0 on older kernels, but newer ones
// (6.6+) number the controller from a higher base such as 512, so BCM pin
// numbers passed straight to onoff fail with EINVAL. Off the Pi this is 0.
exports.gpioBase = (root = SYSFS_GPIO) => {
  if (process.env.GPIO_BASE !== undefined) return Number(process.env.GPIO_BASE);
  try {
    for (const chip of fs.readdirSync(root)) {
      if (!chip.startsWith("gpiochip")) continue;
      const read = (file) =>
        fs.readFileSync(path.join(root, chip, file), "utf8").trim();
      if (PI_CONTROLLER.test(read("label"))) return Number(read("base"));
    }
  } catch {
    // no sysfs GPIO here (not a Pi)
  }
  return 0;
};

let base;

// Converts a BCM GPIO number (what pin-mapping.txt uses) to the number onoff needs.
exports.pin = (bcm) => (base ??= exports.gpioBase()) + Number(bcm);
