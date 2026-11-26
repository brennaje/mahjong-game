const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
const start = source.indexOf("const CHARLESTON_DIRECTIONS =");
const end = source.indexOf("/** Draws for a player", start);
assert.ok(start >= 0 && end > start, "Charleston implementation not found");

function setup() {
  let id = 0;
  const players = Array.from({ length: 4 }, (_, index) => ({
    name: `Player ${index}`,
    hand: Array.from({ length: index === 0 ? 14 : 13 }, (_, tileIndex) => {
      const tileId = id++;
      return { id: tileId, type: tileIndex === 0 ? "joker" : "wind", sort: tileId };
    })
  }));
  const game = {
    players,
    phase: "charleston",
    current: 0,
    dealer: 0,
    charlestonStep: 0,
    charlestonSelection: []
  };
  const context = vm.createContext({
    game,
    speechAvailable: false,
    elements: { turnNarration: { textContent: "" } },
    tileKeepValue: (tile) => tile.id,
    render() {},
    narrateTurn() {},
    scheduleBotTurn() {}
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, game };
}

test("first pass moves three selected tiles right and keeps jokers", () => {
  const { context, game } = setup();
  const jokers = game.players.map((player) => player.hand[0].id);
  const selected = game.players[0].hand.slice(1, 4).map((tile) => tile.id);
  context.selectCharlestonTile(jokers[0]);
  selected.forEach((id) => context.selectCharlestonTile(id));
  assert.equal(game.charlestonSelection.length, 3);
  context.passCharleston();
  assert.ok(selected.every((id) => game.players[1].hand.some((tile) => tile.id === id)));
  assert.ok(jokers.every((id, index) => game.players[index].hand.some((tile) => tile.id === id)));
  assert.deepEqual(game.players.map((player) => player.hand.length), [14, 13, 13, 13]);
  assert.equal(game.charlestonStep, 1);
  assert.match(context.elements.turnNarration.textContent, /Pass right complete.*pass across/);
});

test("blind passes forward unseen tiles only on the final pass", () => {
  const { context, game } = setup();
  context.selectCharlestonTile(game.players[0].hand[1].id);
  context.passCharleston(true);
  assert.equal(game.charlestonStep, 0);

  game.charlestonStep = 2;
  const selected = game.charlestonSelection[0];
  const incoming = game.players[1].hand.filter((tile) => tile.type !== "joker").slice(0, 3);
  const allIds = game.players.flatMap((player) => player.hand.map((tile) => tile.id)).sort((a, b) => a - b);
  context.passCharleston(true);
  assert.equal(game.phase, "charleston-choice");
  assert.match(context.elements.turnNarration.textContent, /continue or finish/);
  assert.ok([selected, incoming[0].id, incoming[1].id].every((id) =>
    game.players[3].hand.some((tile) => tile.id === id)));
  assert.deepEqual(game.players.map((player) => player.hand.length), [14, 13, 13, 13]);
  assert.deepEqual(game.players.flatMap((player) => player.hand.map((tile) => tile.id)).sort((a, b) => a - b), allIds);
});

test("the optional second Charleston ends with East discarding", () => {
  const { context, game } = setup();
  game.charlestonStep = 3;
  for (let step = 3; step < 6; step += 1) {
    game.players[0].hand.filter((tile) => tile.type !== "joker").slice(0, 3)
      .forEach((tile) => context.selectCharlestonTile(tile.id));
    context.passCharleston();
  }
  assert.equal(game.phase, "discard");
  assert.equal(game.current, game.dealer);
  assert.deepEqual(game.players.map((player) => player.hand.length), [14, 13, 13, 13]);
});
