const test = require("node:test");
const assert = require("node:assert/strict");
const HandPlanner = require("../hand-planner.js");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

test("human practice arrangement uses held planner slots without adding missing tiles or duplicating jokers", () => {
  const hand = ["characters-1", "characters-2", "characters-3", "flower-0", "flower-0", "wind-1", "wind-1", "joker-0"]
    .map((key, id) => {
      const [type, value] = key.split("-");
      return { id, type, value: Number(value) };
    });
  const plan = HandPlanner.plan({
    counts: counts(hand.filter((tile) => tile.type !== "joker").map((tile) => `${tile.type}-${tile.value}`)),
    sets: 2, sequences: false, jokers: 1, pairAllowed: (key) => key !== "flower-0"
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
  const context = vm.createContext({
    game: { players: [{ hand, melds: [] }] },
    planWinningHand: () => plan,
    tileKey: (tile) => `${tile.type}-${tile.value}`
  });
  vm.runInContext(source.slice(source.indexOf("function plannedHumanTiles("),
    source.indexOf("/** Saves the current human-hand")), context);
  const arranged = Array.from(context.plannedHumanTiles(hand), (tile) => tile.id);
  assert.deepEqual(arranged, [0, 7, 5, 6, 3, 4, 1, 2]);
  assert.equal(new Set(arranged).size, hand.length);
});
