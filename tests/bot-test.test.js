const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const AmericanCard = require("../american-card.js");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
const names = ["You", "Alex", "Jordan", "Morgan"];

function loadAvailability(context) {
  for (const [startMarker, endMarker] of [
    ["const SUITS =", "const PLAYER_NAMES ="],
    ["const VARIANTS =", "const elements ="],
    ["function createTiles(", "function shuffle("],
    ["function unseenAmericanCounts(", "function bestAmericanPattern("]
  ]) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start);
    vm.runInContext(source.slice(start, end), context);
  }
}

function planningContext(cardText) {
  const context = vm.createContext({
    AmericanCard, botTest: {},
    game: { card: AmericanCard.parse(cardText), players: [], discards: [] },
    activeTargetPattern: () => 1,
    americanKeyName: (key) => key,
    americanLineName: (line) => String(line.pattern),
    tileKeepValue: () => 0
  });
  loadAvailability(context);
  const start = source.indexOf("function rankAmericanLines(");
  const end = source.indexOf("const tileTotalsByVariant", start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  return context;
}

function setup(runs = 1) {
  const timers = new Map();
  let timerId = 0;
  const button = () => ({ textContent: "", setAttribute() {} });
  const context = vm.createContext({
    PLAYER_NAMES: names, BOT_TEST_STEP_MS: 250,
    botTest: null, botTimer: null, speechAvailable: false,
    document: { body: { classList: { add() {}, remove() {} } } },
    elements: {
      variantSelect: { value: "american" },
      botTest: button(),
      botTestRuns: {
        valueAsNumber: runs, disabled: false, error: "",
        setCustomValidity(message) { this.error = message; },
        reportValidity() { return !this.error; }
      },
      botTestResults: { hidden: true, textContent: "" },
      turnMessage: {}, turnNarration: {}
    },
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    newGame() {
      context.game = {
        winner: null, phase: "setup", handNumber: 1, current: 0,
        players: names.map((name) => ({ name, hand: [], melds: [] })),
        discards: [], wall: []
      };
    },
    nextHand() {
      const number = context.game.handNumber + 1;
      context.newGame();
      context.game.handNumber = number;
    },
    render() {}, scheduleBotTurn() {},
    dealAmericanTiles() { context.game.phase = "discard"; },
    runBotTurn() { context.game.discards.push({}); }
  });
  const start = source.indexOf("function startBotTest(");
  const end = source.indexOf("/** Chooses the preferred available English", start);
  vm.runInContext(source.slice(start, end), context);
  return {
    context, timers,
    step() {
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      callback();
    }
  };
}

test("a batch counts each bot's wins, completed runs and all hands, then retains results", () => {
  const { context, timers, step } = setup(4);
  context.startBotTest();
  assert.equal(context.elements.botTestRuns.disabled, true);
  assert.match(context.elements.botTestResults.textContent, /Runs completed: 0 \/ 4/);
  context.game.phase = "draw";
  step();
  assert.equal(context.botTest.totalHands, 2);

  for (const winner of [0, 1, 2, 3]) {
    context.game.winner = winner;
    step();
  }
  assert.equal(context.botTest, null);
  assert.equal(timers.size, 0);
  assert.equal(context.elements.botTestRuns.disabled, false);
  const results = context.elements.botTestResults;
  assert.equal(results.hidden, false);
  assert.match(results.textContent, /Complete.*Runs completed: 4 \/ 4.*Total hands played: 5/);
  assert.match(results.textContent, /Your seat's bot: 1.*Alex: 1.*Jordan: 1.*Morgan: 1/);

  context.startBotTest();
  assert.match(results.textContent, /Runs completed: 0 \/ 4.*Total hands played: 1/);
  assert.match(results.textContent, /Your seat's bot: 0.*Alex: 0.*Jordan: 0.*Morgan: 0/);
});

test("runs continue past twenty drawn hands until a winner completes the run", () => {
  const { context, step } = setup();
  context.startBotTest();
  for (let draw = 0; draw < 25; draw += 1) {
    context.game.phase = "draw";
    step();
  }
  assert.equal(context.botTest.totalHands, 26);
  assert.equal(context.botTest.completedRuns, 0);
  context.game.winner = 2;
  step();
  assert.equal(context.botTest, null);
  assert.match(context.elements.botTestResults.textContent, /Runs completed: 1 \/ 1.*Total hands played: 26/);
  assert.match(context.elements.botTestResults.textContent, /Jordan: 1/);
});

test("stopping cancels further steps and preserves partial results without counting an unfinished run", () => {
  const { context, timers, step } = setup(3);
  context.startBotTest();
  context.game.winner = 1;
  step();
  context.stopBotTest("Bot test stopped.");
  assert.equal(timers.size, 0);
  assert.equal(context.botTest, null);
  assert.equal(context.elements.botTestRuns.disabled, false);
  assert.match(context.elements.botTestResults.textContent, /Stopped.*Runs completed: 1 \/ 3.*Total hands played: 2/);
  assert.match(context.elements.botTestResults.textContent, /Alex: 1/);
});

test("run counts must be positive safe integers before a test can start", () => {
  for (const count of [NaN, 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const { context, timers } = setup(count);
    context.startBotTest();
    assert.equal(context.botTest, null);
    assert.equal(timers.size, 0);
    assert.match(context.elements.botTestRuns.error, /positive whole number/);
  }
});

test("all bot seats make the same card decisions regardless of the human target", () => {
  let id = 0;
  const copies = (type, value, count) => Array.from({ length: count }, () =>
    ({ id: id++, type, value, sort: id }));
  const hand = [
    ...copies("characters", 1, 2), ...copies("bamboo", 1, 2),
    ...copies("bamboo", 2, 2), ...copies("bamboo", 3, 3),
    ...copies("bamboo", 4, 3), ...copies("joker", 0, 1)
  ];
  const player = { hand, melds: [] };
  const discard = { id: id++, type: "bamboo", value: 2 };
  const card = AmericanCard.parse([
    "25 | X | regular | C1:2 C2:3 C3:3 C4:3 C5:3",
    "25 | X | regular | B1:2 B2:3 B3:3 B4:3 B5:3"
  ].join("\n"));
  const context = vm.createContext({
    AmericanCard, botTest: {}, game: { card, players: [], discards: [] },
    activeTargetPattern: () => 1,
    americanKeyName: (key) => key,
    americanLineName: (line) => String(line.pattern),
    tileKeepValue: () => 0
  });
  const start = source.indexOf("function rankAmericanLines(");
  const end = source.indexOf("const tileTotalsByVariant", start);
  vm.runInContext(source.slice(start, end), context);
  loadAvailability(context);
  const options = AmericanCard.claims(card, player, discard);
  assert.ok(options.some((option) => option.tiles.some((tile) => tile.type === "joker")));
  const decisions = [];
  for (let seat = 0; seat < 4; seat += 1) {
    context.game.players = names.map((_, index) => index === seat ? player : { hand: [], melds: [] });
    assert.equal(context.americanFocusFor(player), null);
    const choice = context.americanClaimChoice(player, options, discard);
    decisions.push({
      discard: context.recommendAmericanTiles(player, 1).tile.id,
      passes: Array.from(context.recommendAmericanTiles(player, 3).tiles, (tile) => tile.id),
      claim: choice.bestClaim.option,
      worth: choice.worth
    });
  }
  assert.equal(hand.find((tile) => tile.id === decisions[0].discard).type, "characters");
  assert.ok(decisions[0].worth, "the natural pung improves the closest card line");
  for (const decision of decisions.slice(1)) assert.deepEqual(decision, decisions[0]);

  context.game.players = [player, {}, {}, {}];
  context.botTest = null;
  assert.equal(context.americanFocusFor(player), 1, "stopping restores the human's chosen target");
  assert.equal(context.americanFocusFor(context.game.players[1]), null);
});

test("every test bot re-evaluates all card patterns as its hand changes and can win on any of them", () => {
  const card = AmericanCard.parse([
    "25 | X | regular | C1:2 C2:3 C3:3 C4:3 C5:3",
    "25 | X | regular | B1:2 B2:3 B3:3 B4:3 B5:3",
    "25 | X | regular | D1:2 D2:3 D3:3 D4:3 D5:3"
  ].join("\n"));
  const context = vm.createContext({
    AmericanCard, botTest: {}, game: { variantId: "american", card, players: [], discards: [] },
    activeTargetPattern: () => 1,
    americanKeyName: (key) => key,
    americanLineName: (line) => String(line.pattern),
    tileKeepValue: () => 0
  });
  const start = source.indexOf("function cardWinningLines(");
  const end = source.indexOf("const tileTotalsByVariant", start);
  vm.runInContext(source.slice(start, end), context);
  loadAvailability(context);
  const winStart = source.indexOf("function isWinningHand(");
  const winEnd = source.indexOf("function isWinningShape(", winStart);
  assert.ok(start >= 0 && end > start && winStart >= 0 && winEnd > winStart);
  vm.runInContext(source.slice(winStart, winEnd), context);

  let id = 0;
  for (let seat = 0; seat < 4; seat += 1) {
    const player = { hand: [], melds: [] };
    context.game.players = names.map((_, index) => index === seat ? player : { hand: [], melds: [] });
    for (const [type, pattern] of [["bamboo", 2], ["circles", 3], ["characters", 1]]) {
      player.hand = [2, 3, 3, 3, 2].flatMap((count, index) =>
        Array.from({ length: count }, () => ({ id: id++, type, value: index + 1, sort: id })));
      const unused = { id: id++, type: "wind", value: 0, sort: id };
      player.hand.push(unused);
      const advice = context.recommendAmericanTiles(player, 1);
      assert.equal(advice.best.line.pattern, pattern, `seat ${seat} must switch to pattern ${pattern}`);
      assert.equal(advice.tile.id, unused.id);
      assert.equal(context.isWinningHand(player.hand, 0, "american", player, "self-draw"), false);

      player.hand = player.hand.filter((tile) => tile.id !== unused.id);
      player.hand.push({ id: id++, type, value: 5, sort: id });
      assert.equal(context.isWinningHand(player.hand, 0, "american", player, "self-draw"), true);
      assert.equal(context.cardWinningLines(player.hand, player)[0].line.pattern, pattern);
    }
  }
});

test("bots favor available pairs over scarce or exhausted targets without reading hidden hands", () => {
  const context = planningContext([
    "50 | X | regular | C1:2 C2:3 C3:3 C4:3 C5:3",
    "25 | X | regular | B1:2 C2:3 C3:3 C4:3 C5:3"
  ].join("\n"));
  const supply = Array.from(context.createTiles("american"));
  const copies = (type, value, count) => supply.filter((tile) =>
    tile.type === type && tile.value === value).slice(0, count);
  const hand = [
    copies("characters", 1, 1)[0], copies("bamboo", 1, 1)[0],
    ...[2, 3, 4, 5].flatMap((value) => copies("characters", value, 3))
  ];
  const player = { hand, melds: [] };
  for (let seat = 0; seat < 4; seat += 1) {
    context.game.players = names.map((_, index) => index === seat ? player : { hand: [], melds: [] });
    context.game.discards = [];
    assert.equal(context.recommendAmericanTiles(player, 1).best.line.pattern, 1);
    for (const discardedCount of [2, 3]) {
      context.game.discards = copies("characters", 1, 4).slice(1, discardedCount + 1)
        .map((tile) => ({ tile, claimed: false }));
      const advice = context.recommendAmericanTiles(player, 1);
      assert.equal(advice.best.line.pattern, 2);
      assert.equal(advice.tile.id, hand[0].id, "give up the dead/rare pair rather than the live pair");
    }
    const opponent = context.game.players[(seat + 1) % 4];
    const before = context.recommendAmericanTiles(player, 1);
    opponent.hand = copies("bamboo", 1, 4).slice(1);
    assert.equal(context.recommendAmericanTiles(player, 1).best.effort, before.best.effort);
  }

  context.game.players = [player, { hand: [], melds: [] }];
  context.botTest = null;
  const pinned = context.recommendAmericanTiles(player, 1);
  assert.equal(pinned.best.line.pattern, 1, "human focus stays pinned even when blocked");
  assert.match(pinned.explanation, /cannot be completed from the remaining unseen tiles/);
});

test("visible exposures and claimed discards count once, and joker supply is shared across missing sets", () => {
  const context = planningContext("25 | X | regular | F:2 C1:3 C2:3 C3:3 C4:3");
  const supply = Array.from(context.createTiles("american"));
  const copies = (type, value, count) => supply.filter((tile) =>
    tile.type === type && tile.value === value).slice(0, count);
  const player = {
    hand: [
      ...supply.filter((tile) => tile.type === "flower").slice(0, 2),
      ...copies("characters", 1, 2), ...copies("characters", 2, 3),
      ...copies("characters", 3, 3), ...copies("characters", 4, 2)
    ], melds: []
  };
  const jokers = supply.filter((tile) => tile.type === "joker");
  const exposure = { tiles: [copies("characters", 4, 4)[2], ...jokers.slice(0, 2)] };
  context.game.players = [player, { hand: [], melds: [exposure] }];
  context.game.discards = [
    ...copies("characters", 1, 4).slice(2),
    copies("characters", 4, 4)[3], ...jokers.slice(2, 7)
  ].map((tile) => ({ tile, claimed: false }));
  context.game.discards.push({ tile: exposure.tiles[0], claimed: true });

  const unseen = context.unseenAmericanCounts(player);
  assert.equal(unseen.get("characters-4"), 0);
  assert.equal(unseen.get("joker"), 1);
  const blocked = context.recommendAmericanTiles(player, 1);
  assert.equal(blocked.best.effort, Infinity, "one unseen joker cannot fill two exhausted sets");
  assert.match(blocked.explanation, /cannot be completed/);

  context.game.discards.pop();
  context.game.discards = context.game.discards.filter((discard) => discard.tile.id !== jokers[6].id);
  const live = context.recommendAmericanTiles(player, 1);
  assert.ok(Number.isFinite(live.best.effort), "two unseen jokers can fill the two sets");
});

test("availability scoring can move a held joker from a live set to an exhausted set", () => {
  const context = planningContext("25 | X | regular | F:2 C1:3 C2:3 C3:3 C4:3");
  const supply = Array.from(context.createTiles("american"));
  const copies = (value, count) => supply.filter((tile) =>
    tile.type === "characters" && tile.value === value).slice(0, count);
  const jokers = supply.filter((tile) => tile.type === "joker");
  const player = {
    hand: [
      ...supply.filter((tile) => tile.type === "flower").slice(0, 2),
      ...copies(1, 2), ...copies(2, 3), ...copies(3, 3), ...copies(4, 2), jokers[0]
    ], melds: []
  };
  context.game.players = [player];
  context.game.discards = [...copies(4, 4).slice(2), ...jokers.slice(1)]
    .map((tile) => ({ tile, claimed: false }));
  assert.equal(AmericanCard.progress(context.game.card[0], player.hand, []).groups[1].tiles.at(-1), jokers[0]);
  assert.ok(Number.isFinite(context.recommendAmericanTiles(player, 1).best.effort));
});

test("claim decisions reject a closer dead pattern and can improve a live alternative", () => {
  const context = planningContext([
    "25 | X | regular | C1:2 C2:3 C3:3 C4:3 C5:3",
    "30 | X | regular | B1:2 C2:4 C3:4 C4:4"
  ].join("\n"));
  const supply = Array.from(context.createTiles("american"));
  const copies = (value, count) => supply.filter((tile) =>
    tile.type === "characters" && tile.value === value).slice(0, count);
  const player = {
    hand: [copies(1, 1)[0], ...[2, 3, 4, 5].flatMap((value) => copies(value, 3))],
    melds: []
  };
  const discard = copies(2, 4)[3];
  context.game.discards = [...copies(1, 4).slice(1), discard]
    .map((tile) => ({ tile, claimed: false }));
  for (let seat = 0; seat < 4; seat += 1) {
    context.game.players = names.map((_, index) => index === seat ? player : { hand: [], melds: [] });
    const options = AmericanCard.claims(context.game.card, player, discard);
    const choice = context.americanClaimChoice(player, options, discard);
    assert.equal(choice.bestClaim.option.type, "kong");
    assert.equal(choice.bestClaim.after.line.pattern, 2);
    assert.ok(choice.bestClaim.after.effort < choice.before.effort);
    assert.equal(choice.worth, true);
  }
});
