import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mainPath = resolve(appRoot, "main.js");
const source = await readFile(mainPath, "utf8");
const sandbox = {
  clearInterval,
  clearTimeout,
  console,
  setInterval,
  setTimeout,
  Tapp: {
    lifecycle: { onDestroy() {} },
    widgets: {},
  },
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: mainPath });
sandbox.worldClockParts = () => ({
  year: "2026",
  month: "8",
  day: "5",
  hour: "15",
  minute: "04",
  second: "05",
});
sandbox.worldClockOffsetMinutes = () => 480;
sandbox.worldClockRelativeLabel = () => "same time";
sandbox.worldClockOffsetLabel = () => "UTC +8:00";
sandbox.worldClockZoneName = () => "CST";

const selectors = [
  "[data-clock-date]",
  "[data-clock-zone]",
  "[data-clock-hour]",
  "[data-clock-minute]",
  "[data-clock-second]",
  "[data-clock-period]",
  "[data-clock-relative]",
  "[data-clock-offset]",
  "[data-clock-hour-hand]",
  "[data-clock-minute-hand]",
  "[data-clock-second-hand]",
];
const nodes = new Map(selectors.map((selector) => [selector, {
  hidden: false,
  style: { setProperty() {} },
  textContent: "",
}]));
const attributes = new Map();
const shell = {
  querySelector(selector) { return nodes.get(selector) || null; },
  setAttribute(name, value) { attributes.set(name, value); },
};
const config = {
  hourCycle: "12",
  showSeconds: true,
  timeZone: "Asia/Shanghai",
  zoneLabel: "CST",
};

sandbox.worldClockPaint(shell, config);
assert.equal(nodes.get("[data-clock-hour]").textContent, "03");
assert.equal(nodes.get("[data-clock-period]").textContent, "PM");
assert.equal(nodes.get("[data-clock-period]").hidden, false);
assert.match(attributes.get("aria-label"), /03:04:05 PM$/);

config.hourCycle = "24";
sandbox.worldClockPaint(shell, config);
assert.equal(nodes.get("[data-clock-hour]").textContent, "15");
assert.equal(nodes.get("[data-clock-period]").hidden, true);
assert.doesNotMatch(attributes.get("aria-label"), / (?:AM|PM)$/);

console.log("World clock 12/24-hour smoke checks passed");
