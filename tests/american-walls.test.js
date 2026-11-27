const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

function implementation(startMarker, endMarker, context) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, "American setup implementation not found");
  vm.runInContext(source.slice(start, end), context);
}

function rollWithDice(dice) {
  const context = vm.createContext({ PLAYER_NAMES: ["You", "Alex", "Jordan", "Morgan"] });
  implementation("function rollForEast(", "/** Resets the table", context);
  let index = 0;
  const result = context.rollForEast(() => {
    assert.ok(index < dice.length, "Unexpected extra die roll");
    return (dice[index++] - 0.5) / 6;
  });
  assert.equal(index, dice.length);
  return result;
}

test("the highest initial roll selects East", () => {
  const result = rollWithDice([1, 2, 6, 5, 2, 4, 3, 3]);
  assert.equal(result.dealer, 1);
  assert.equal(result.rounds.length, 1);
});

test("only tied highest players reroll until the tie is broken", () => {
  const result = rollWithDice([6, 4, 2, 3, 5, 5, 1, 1, 2, 3, 3, 2, 6, 4, 1, 3]);
  assert.equal(result.dealer, 0);
  assert.deepEqual(Array.from(result.rounds, (round) => Array.from(round, (roll) => roll.player)),
    [[0, 1, 2, 3], [0, 2], [0, 2]]);
});

test("the break roll determines the draw order through all four walls", () => {
  const context = vm.createContext({});
  implementation("function rollWallBreak(", "/** Resets the table", context);
  const dice = [2, 6];
  const roll = context.rollWallBreak(() => (dice.shift() - 0.5) / 6);
  assert.equal(roll.total, 8);
  const tiles = Array.from({ length: 152 }, (_, id) => ({ id }));
  const layout = Array.from({ length: 4 }, (_, side) =>
    tiles.slice(side * 38, (side + 1) * 38).map((tile) => tile.id));
  const wall = context.orderAmericanWall(tiles, layout, roll.total);
  const drawIds = Array.from(wall, (tile) => tile.id).reverse();
  assert.deepEqual(drawIds.slice(0, 4), [134, 135, 132, 133]);
  assert.deepEqual(drawIds.slice(22, 26), [36, 37, 34, 35]);
  assert.equal(new Set(drawIds).size, 152);
  assert.deepEqual(drawIds.slice(-2), [136, 137]);
});

test("East's wall and its break rotate to the dealer's fixed seat", () => {
  const context = vm.createContext({});
  implementation("function wallPosition(", "/** Resets the table", context);
  const eastPositions = ["east", "south", "west", "north"];
  const breakStacks = [14, 4, 4, 14];
  for (let dealer = 0; dealer < 4; dealer += 1) {
    const east = context.wallPosition(3, dealer, 14);
    assert.equal(east.position, eastPositions[dealer]);
    assert.equal(east.stack, breakStacks[dealer]);
    assert.equal(new Set([0, 1, 2, 3].map((side) =>
      context.wallPosition(side, dealer, 0).position)).size, 4);
  }
});

test("dealing leaves 99 wall tiles and gives East the extra tile", () => {
  for (const dealer of [0, 2]) {
    const game = {
      variantId: "american",
      phase: "setup",
      dealer,
      players: Array.from({ length: 4 }, () => ({ hand: [] })),
      wall: Array.from({ length: 152 }, (_, id) => ({ id }))
    };
    const messages = [];
    let automaticSelections = 0;
    const context = vm.createContext({
      game,
      pendingTileAnimations: [],
      drawFor: (player) => {
        const tile = game.wall.pop();
        game.players[player].hand.push(tile);
        game.players[player].drawnTileId = tile.id;
        game.players[player].lastDrawnTileId = tile.id;
      },
      render() {},
      announceCharleston: (message) => messages.push(message),
      pickAutoTarget() {},
      selectAutomaticAmericanTarget() { automaticSelections += 1; }
    });
    implementation("function dealAmericanTiles()", "const CHARLESTON_DIRECTIONS", context);
    context.dealAmericanTiles();
    assert.deepEqual(game.players.map((player) => player.hand.length),
      game.players.map((_, index) => index === dealer ? 14 : 13));
    assert.equal(game.players[dealer].hand[0].id, 151);
    assert.deepEqual(game.players[dealer].hand.slice(0, 4).map((tile) => tile.id), [151, 150, 149, 148]);
    assert.deepEqual(game.players[(dealer + 1) % 4].hand.slice(0, 4).map((tile) => tile.id), [147, 146, 145, 144]);
    assert.deepEqual(game.players[dealer].hand.slice(-2).map((tile) => tile.id), [103, 99]);
    assert.equal(game.players[dealer].drawnTileId, null);
    assert.equal(game.players[dealer].lastDrawnTileId, null);
    assert.equal(game.wall.length, 99);
    assert.equal(game.phase, "charleston");
    assert.equal(game.current, 0);
    assert.match(messages[0], /pass to the right/);
    assert.equal(automaticSelections, 1);
    context.dealAmericanTiles();
    assert.equal(game.wall.length, 99);
    assert.equal(automaticSelections, 1);
  }
});
