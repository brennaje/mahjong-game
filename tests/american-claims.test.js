const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const AmericanCard = require("../american-card.js");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

function implementation(startMarker, endMarker, context) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
}

test("an American kong claim is followed by a discard, not a replacement draw", () => {
  for (const variantId of ["american", "chinese-classical"]) {
    const tiles = Array.from({ length: 14 }, (_, id) => ({ id, sort: id }));
    const player = { hand: tiles.slice(0, 13), melds: [], drawnTileId: null, lastDrawnTileId: null };
    const discard = { tile: tiles[13], claimed: false };
    const game = {
      variantId, players: [player], pendingDiscard: discard,
      claimQueue: [{ player: 0 }], claimIndex: 0, phase: "claim"
    };
    let draws = 0;
    const context = vm.createContext({
      game,
      saveUndoState() {},
      narrateClaimAction() {},
      beginPlayerDraw() { draws += 1; },
      render() {},
      scheduleBotTurn() {}
    });
    implementation("function claimMeld(", "/** Completes a win by claiming", context);
    context.claimMeld({ type: "kong", tiles: tiles.slice(0, 3) });
    assert.equal(player.hand.length, 10);
    assert.equal(player.melds[0].tiles.length, 4);
    assert.equal(draws, variantId === "american" ? 0 : 1);
    if (variantId === "american") assert.equal(game.phase, "discard");
  }
});

test("American play does not declare a concealed kong for a replacement draw", () => {
  const game = { variantId: "american" };
  const context = vm.createContext({ game, tileKey: (tile) => tile.type });
  implementation("function findConcealedKong(", "/** Advances play after", context);
  const player = { hand: Array.from({ length: 4 }, () => ({ type: "wind" })) };
  assert.equal(context.findConcealedKong(player), null);
  game.variantId = "chinese-classical";
  assert.equal(context.findConcealedKong(player).length, 4);
});

test("kong claim narration describes the next action for each ruleset", () => {
  const game = { variantId: "american", players: [{ name: "You" }] };
  let message = "";
  const context = vm.createContext({
    game,
    getSkippedPlayers: () => [],
    tileDescription: () => "tile",
    narrateTurn: (text) => { message = text; }
  });
  implementation("function narrateClaimAction(", "/** Chooses and performs", context);
  const option = { type: "kong", tiles: [{ id: 1 }] };
  const discard = { player: 1, tile: { id: 2 } };
  context.narrateClaimAction(0, option, discard);
  assert.match(message, /discard next/);
  game.variantId = "chinese-classical";
  context.narrateClaimAction(0, option, discard);
  assert.match(message, /replacement tile/);
});

test("a natural tile can exchange an exposed joker only during its owner's turn", () => {
  const natural = { id: 1, type: "characters", value: 3 };
  const joker = { id: 2, type: "joker" };
  const meld = {
    type: "pung",
    tiles: [joker, { id: 3, type: "characters", value: 3 }, { id: 4, type: "characters", value: 3 }]
  };
  const game = {
    card: [{}], phase: "discard", current: 0,
    players: [{ name: "You", hand: [natural], melds: [] }, { name: "Alex", hand: [], melds: [meld] }]
  };
  const context = vm.createContext({
    game, AmericanCard, saveUndoState() {}, tileDescription: () => "3 Crak",
    narrateTurn() {}, render() {}, scheduleBotTurn() {}
  });
  implementation("function findAmericanJokerExchanges(", "/** Completes a win by claiming", context);
  const [exchange] = context.findAmericanJokerExchanges(0);
  assert.ok(exchange);
  game.phase = "claim";
  context.exchangeAmericanJoker(exchange);
  assert.equal(game.players[0].hand[0], natural);
  game.phase = "discard";
  context.exchangeAmericanJoker(exchange);
  assert.equal(game.players[0].hand[0], joker);
  assert.equal(meld.tiles[0], natural);
  assert.equal(context.findAmericanJokerExchanges(0).length, 0);
});

test("provided card scores accumulate the highest matching value without charging other players", () => {
  const scores = [10, 4, 7, 9];
  const game = {
    card: [{}], cardSource: "supplied", winner: null,
    players: [{ name: "You", hand: [], melds: [] }]
  };
  const context = vm.createContext({
    game, americanCardScores: scores, PLAYER_NAMES: ["You", "Alex", "Jordan", "Morgan"],
    AmericanCard: {
      winningLines: () => [
        { line: { value: 25 }, groups: [] },
        { line: { value: 45 }, groups: [] }
      ]
    },
    elements: { turnMessage: {} }, render() {}
  });
  context.cardWinningLines = () => context.AmericanCard.winningLines();
  implementation("function finishHand(", "/** Starts the next hand", context);
  context.finishHand(0, "wins", 1);
  assert.deepEqual(scores, [55, 4, 7, 9]);
  assert.match(game.scoreSummary, /\+45 points/);
});

test("the human hand remains visible and reorderable but cannot be discarded during another player's turn", () => {
  const hand = [{ id: 1, type: "characters", value: 3 }];
  const controls = [];
  const discarded = [];
  const game = {
    privacyRequired: false, current: 1, winner: null, phase: "discard",
    players: [{ hand }], charlestonSelection: []
  };
  const context = vm.createContext({
    game, elements: {
      hand: {
        style: { setProperty() {} },
        replaceChildren() { controls.length = 0; },
        append(button) { controls.push(button); }
      },
      handHelp: {}
    },
    document: { createElement: () => {
      const attributes = {};
      return {
        dataset: {}, classList: { add() {} }, attributes,
        setAttribute(name, value) { attributes[name] = value; },
        addEventListener(type, listener) { this[`on${type}`] = listener; }
      };
    } },
    orderedHumanHand: (tiles) => tiles,
    discardTile: (tileId) => discarded.push(tileId),
    tileClass: () => "characters", tileDescription: () => "3 Crak", renderTileFace() {}
  });
  implementation("function renderHand(", "/** Returns the human's hand", context);
  context.renderHand(null);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].disabled, undefined);
  assert.equal(controls[0].attributes["aria-disabled"], "true");
  controls[0].onclick();
  assert.deepEqual(discarded, []);
  game.current = 0;
  context.renderHand(null);
  assert.equal(controls[0].attributes["aria-disabled"], undefined);
  controls[0].onclick();
  assert.deepEqual(discarded, [1]);
});

test("any card line wins and only your seat focuses on the chosen target", () => {
  const target = { value: "7" };
  const context = vm.createContext({
    game: { card: [{ pattern: 3 }, { pattern: 7 }], players: [{}, {}] },
    elements: { americanCardTarget: target },
    AmericanCard: { winningLines: () => [{ line: { pattern: 3 } }, { line: { pattern: 7 } }] }
  });
  implementation("function chosenAmericanPattern(", "/** Ranks the active card's lines", context);
  implementation("function americanFocusFor(", "/** Picks the tiles least useful", context);
  assert.equal(context.cardWinningLines([], { melds: [] }).length, 2);
  assert.equal(context.americanFocusFor(context.game.players[0]), 7);
  assert.equal(context.americanFocusFor(context.game.players[1]), null);
  target.value = "";
  assert.equal(context.americanFocusFor(context.game.players[0]), null);
});