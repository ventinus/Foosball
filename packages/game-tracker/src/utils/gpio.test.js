const fs = require("fs");
const os = require("os");
const path = require("path");
const { gpioBase } = require("./gpio");

describe("gpioBase", () => {
  let root;
  const chip = (name, label, base) => {
    fs.mkdirSync(path.join(root, name));
    fs.writeFileSync(path.join(root, name, "label"), `${label}\n`);
    fs.writeFileSync(path.join(root, name, "base"), `${base}\n`);
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "gpio-"));
    fs.writeFileSync(path.join(root, "export"), "");
    delete process.env.GPIO_BASE;
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env.GPIO_BASE;
  });

  it("finds the Pi controller's base among other GPIO chips", () => {
    chip("gpiochip504", "raspberrypi-exp-gpio", 504);
    chip("gpiochip512", "pinctrl-bcm2835", 512);
    expect(gpioBase(root)).toBe(512);
  });

  it("is 0 on kernels that number from 0", () => {
    chip("gpiochip0", "pinctrl-bcm2711", 0);
    expect(gpioBase(root)).toBe(0);
  });

  it("is 0 off the Pi", () => {
    expect(gpioBase(path.join(root, "missing"))).toBe(0);
  });

  it("can be overridden with GPIO_BASE", () => {
    chip("gpiochip512", "pinctrl-bcm2835", 512);
    process.env.GPIO_BASE = "0";
    expect(gpioBase(root)).toBe(0);
  });
});
