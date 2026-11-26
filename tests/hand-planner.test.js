const test = require("node:test");
const assert = require("node:assert/strict");
const HandPlanner = require("../hand-planner.js");

const counts = (keys) => keys.reduce((map, key) => map.set(key, (map.get(key) ?? 0) + 1), new Map());

test("a complete standard hand needs nothing", () => {
  const hand = counts([
    "characters-1", "characters-2", "characters-3", "circles-5", "circles-5", "circles-5",
    "bamboo-7", "bamboo-8", "bamboo-9", "wind-0", "wind-0", "wind-0", "dragon-0", "dragon-0"
  ]);
  const result = HandPlanner.plan({ counts: hand, sets: 4 });
  assert.equal(result.need, 0);
  assert.deepEqual(result.groups.map((group) => group.kind).sort(), ["chow", "chow", "pair", "pung", "pung"]);
});

test("one-away hands need one tile and skip waits that are no longer available", () => {
  const hand = counts([
    "characters-1", "characters-2", "circles-5", "circles-5", "circles-5",
    "bamboo-7", "bamboo-8", "bamboo-9", "wind-0", "wind-0", "wind-0", "dragon-0", "dragon-0"
  ]);
  assert.equal(HandPlanner.plan({ counts: hand, sets: 4 }).need, 1);
  const available = new Map(HandPlanner.kinds.map((key) => [key, key === "characters-3" ? 0 : 4]));
  assert.equal(HandPlanner.plan({ counts: hand, sets: 4, available }).need, 2);
});

test("American practice uses jokers for sets but not the pair, and no runs", () => {
  const hand = counts(["characters-1", "characters-2", "characters-3", "flower-0", "flower-0", "wind-1", "wind-1"]);
  const runs = HandPlanner.plan({ counts: hand, sets: 2, sequences: false, jokers: 1, pairAllowed: (key) => key !== "flower-0" });
  // Best: flowers + joker (0), wind pair (0), and one 1-2-3 tile seeds a pung needing 2.
  assert.equal(runs.need, 2);
  assert.ok(runs.groups.every((group) => group.kind !== "chow"));
  assert.ok(runs.groups.find((group) => group.kind === "pair").tiles.every((tile) => tile.key === "wind-1" && !tile.joker));
});
