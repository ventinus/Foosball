// Who stands where at the table. `sides[0]` is side A (goal sensor 0) and
// `sides[1]` is side B; each side has two slots holding a player or null.
// Teams come from the sides, not from the order badges were scanned.

const SIDES = 2;
const SLOTS = 2;

const emptySides = () => [
  [null, null],
  [null, null],
];

const playersOf = (sides) => sides.flat().filter(Boolean);

const sameId = (a, b) => String(a) === String(b);

const find = (sides, id) => {
  for (let side = 0; side < SIDES; side++) {
    const slot = sides[side].findIndex((player) => player && sameId(player.id, id));
    if (slot !== -1) return { side, slot };
  }
  return null;
};

const isSeated = (sides, id) => find(sides, id) !== null;

const isFull = (sides) => playersOf(sides).length === SIDES * SLOTS;

// Each side needs at least one player: 1v1, 1v2/2v1 or 2v2.
const canStart = (sides) => sides.every((side) => side.some(Boolean));

const count = (side) => side.filter(Boolean).length;

// Seats a player in the first open slot of the emptier side (side A on a tie),
// so scans fill A, B, A, B. Returns the sides unchanged when the table is full.
const seatPlayer = (sides, player) => {
  if (isFull(sides)) return sides;
  const side = count(sides[0]) <= count(sides[1]) ? 0 : 1;
  const slot = sides[side].indexOf(null);
  return sides.map((slots, s) =>
    s === side ? slots.map((p, i) => (i === slot ? player : p)) : slots
  );
};

const isSlot = (side, slot) =>
  Number.isInteger(side) &&
  Number.isInteger(slot) &&
  side >= 0 &&
  side < SIDES &&
  slot >= 0 &&
  slot < SLOTS;

// Moves a seated player to a slot, swapping with whoever is in it. Unknown
// players and slots leave the sides unchanged.
const movePlayer = (sides, id, side, slot) => {
  const from = find(sides, id);
  if (!from || !isSlot(side, slot)) return sides;
  const next = sides.map((slots) => [...slots]);
  const moving = next[from.side][from.slot];
  next[from.side][from.slot] = next[side][slot];
  next[side][slot] = moving;
  return next;
};

const removePlayer = (sides, id) =>
  sides.map((slots) =>
    slots.map((player) => (player && sameId(player.id, id) ? null : player))
  );

// Moves each team to the other end of the table.
const swapSides = (sides) => [sides[1], sides[0]];

// A side's team id: its fobIds sorted and joined with "::".
const teamOf = (side) =>
  side
    .filter(Boolean)
    .map(({ id }) => `${id}`)
    .sort()
    .join("::");

// [sideA, sideB] team ids.
const teamsOf = (sides) => sides.map(teamOf);

module.exports = {
  emptySides,
  playersOf,
  isSeated,
  isFull,
  canStart,
  seatPlayer,
  movePlayer,
  removePlayer,
  swapSides,
  teamOf,
  teamsOf,
};
