const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const AmericanCard = require("../american-card.js");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

function element(tag) {
  const node = {
    tag,
    children: [],
    attributes: {},
    style: { setProperty() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; }
  };
  node.classList = {
    add(name) { node.className = `${node.className ?? ""} ${name}`.trim(); },
    contains(name) { return (node.className ?? "").split(/\s+/).includes(name); }
  };
  return node;
}

function targetContext() {
  const context = vm.createContext({
    AmericanCard,
    document: { createElement: element },
    VARIANTS: { american: { flowers: true, jokers: true } },
    SUITS: [
      { id: "characters", symbol: "C" }, { id: "circles", symbol: "D" }, { id: "bamboo", symbol: "B" }
    ],
    WINDS: ["East", "South", "West", "North"],
    DRAGONS: ["Red", "Green", "White"],
    makeTile(tile) {
      const face = element("span");
      face.className = "tile";
      face.tile = tile;
      face.setAttribute("data-tile-id", String(tile.id));
      return face;
    }
  });
  vm.runInContext(section("function createTiles(", "/** Shuffles"), context);
  vm.runInContext(section("function tileDescription(", "/** Builds the two-row legend"), context);
  vm.runInContext(section("function makeCardExample(", "/** Builds the default library:"), context);
  return context;
}

function shownGroups(example) {
  return example.children.at(-1).children;
}

test("target uses the hand's actual jokers and flowers, then refreshes after a tile changes", () => {
  const context = targetContext();
  const line = AmericanCard.parse("25 | X | regular | F:2 D2:3 D4:3 D6:3 D8:3")[0];
  const supply = Array.from(context.createTiles("american"));
  const flower = supply.find((tile) => tile.type === "flower" && tile.value === 6);
  const two = supply.find((tile) => tile.type === "circles" && tile.value === 2);
  const joker = supply.find((tile) => tile.type === "joker");
  const hand = [flower, two, joker];
  const render = () => shownGroups(context.makeCardExample(line, "",
    AmericanCard.progress(line, hand, [])));
  let groups = render();
  assert.equal(groups[0].children[0].tile, flower);
  assert.equal(groups[0].children[1].classList.contains("card-missing"), true);
  assert.equal(groups[1].children[0].tile, two);
  assert.equal(groups[1].children[1].tile, joker);
  assert.match(groups[1].children[1].attributes["aria-label"], /Joker substituting for 2 Dot/);
  assert.equal(groups.flatMap((group) => group.children).filter((tile) =>
    !tile.classList.contains("card-missing")).length, hand.length);
  assert.ok(groups.flatMap((group) => group.children).every((tile) =>
    !("data-tile-id" in tile.attributes)));
  hand.splice(2, 1, supply.find((tile) => tile.type === "circles" && tile.value === 4));
  groups = render();
  assert.equal(groups[1].children.filter((tile) => !tile.classList.contains("card-missing")).length, 1);
  assert.equal(groups[2].children[0].tile, hand[2]);
  assert.equal(groups.flatMap((group) => group.children).length, 14);
});

test("target shows actual exposed tiles and reserves held naturals for a repeated pair", () => {
  const context = targetContext();
  const line = AmericanCard.parse("30 | X | regular | C1:5 C1:2 C2:3 F:4")[0];
  const supply = Array.from(context.createTiles("american"));
  const ones = supply.filter((tile) => tile.type === "characters" && tile.value === 1);
  const jokers = supply.filter((tile) => tile.type === "joker");
  const joker = jokers[0];
  const flowers = supply.filter((tile) => tile.type === "flower").slice(4);
  const exposed = [...supply.filter((tile) => tile.type === "characters" && tile.value === 2).slice(0, 2), jokers[1]];
  const meld = { targetKey: "characters-2", tiles: exposed };
  const hand = [...ones.slice(0, 3), joker, ...flowers];
  const progress = AmericanCard.progress(line, hand, [meld]);
  const groups = shownGroups(context.makeCardExample(line, "", progress));
  assert.equal(groups[0].children[0].tile, ones[2]);
  assert.equal(groups[0].children[1].tile, joker);
  assert.ok(groups[0].children.slice(2).every((tile) => tile.classList.contains("card-missing")));
  assert.deepEqual(groups[1].children.map((tile) => tile.tile), ones.slice(0, 2));
  assert.deepEqual(groups[3].children.map((tile) => tile.tile), flowers);
  assert.deepEqual(groups[2].children.map((tile) => tile.tile), exposed);
  assert.ok(groups[2].children.every((tile) => !tile.classList.contains("card-missing")));
  assert.ok(groups[2].children.every((tile) => /Exposed/.test(tile.attributes["aria-label"])));
  const owned = groups.flatMap((group) => group.children)
    .filter((tile) => !tile.classList.contains("card-missing")).map((face) => face.tile.id);
  assert.equal(new Set(owned).size, hand.length + exposed.length);
  assert.deepEqual([...progress.keep].sort((a, b) => a - b), hand.map((tile) => tile.id).sort((a, b) => a - b));
  const preview = shownGroups(context.makeCardExample(line, "Example"));
  assert.ok(AmericanCard.matchLine(line, preview.flatMap((group) => group.children.map((face) => face.tile)), []));
});

test("target refreshes the closest permitted run without changing the selected pattern", () => {
  const context = targetContext();
  const card = AmericanCard.parse([
    "Consecutive: FFF 1111 234 5555 | 25 | X | regular | F:3 xn:4 xn+1:1 xn+2:1 xn+3:1 xn+4:4",
    "Other | 25 | X | regular | B9:3 F:2 C1:3 C2:3 C3:3"
  ].join("\n"));
  const supply = Array.from(context.createTiles("american"));
  const player = { hand: [], melds: [] };
  context.game = { variantId: "american", card, players: [player], winner: null, current: 0 };
  context.elements = {
    americanCardTarget: { value: "1" },
    americanCardTargetExample: element("div"),
    targetSuggestion: element("div"),
    cardTargetBanner: { closest() { return null; } }
  };
  context.AUTO_TARGET = "*best*";
  context.CONCEALED_BONUS = 10;
  context.activeTargetPattern = () => 1;
  context.americanLineName = (line) => line.name;
  vm.runInContext(section("function rankAmericanLines(", "/** Lists the tiles still missing"), context);
  vm.runInContext(section("function renderAmericanCardTarget(", "/** Rebuilds the target menu"), context);
  const render = () => {
    context.renderAmericanCardTarget();
    return context.elements.americanCardTargetExample.children;
  };
  const threeBam = supply.find((tile) => tile.type === "bamboo" && tile.value === 3);
  player.hand = [threeBam];
  const [, , partial] = render();
  const matched = shownGroups(partial).flatMap((group) => group.children)
    .filter((face) => !face.classList.contains("card-missing"));
  assert.deepEqual(matched.map((face) => face.tile), [threeBam],
    "a 3 Bam must count even when the initial example uses another suit");
  assert.match(partial.children[0].textContent, /1\/14 tiles/);
  for (const [key, missing] of [["bamboo-5", 1], ["circles-1", 0]]) {
    const line = card.find((line) => line.pattern === 1 && line.groups[1].key === key);
    player.hand = AmericanCard.exampleGroups(line, supply).flat().slice(missing);
    const [, definition, example] = render();
    assert.match(definition.textContent, /Consecutive: FFF 1111 234 5555/);
    assert.match(example.children[0].textContent, new RegExp(`Best valid fit: ${14 - missing}/14`));
    const groups = shownGroups(example);
    assert.deepEqual(groups.map((group) => AmericanCard.key(group.children[0].tile)),
      line.groups.map((group) => group.key));
    assert.equal(groups.flatMap((group) => group.children)
      .filter((face) => face.classList.contains("card-missing")).length, missing);
  }
  player.melds = [{ targetKey: "bamboo-9",
    tiles: supply.filter((tile) => tile.type === "bamboo" && tile.value === 9).slice(0, 3) }];
  const [, definition, example] = render();
  assert.match(definition.textContent, /Consecutive/);
  assert.match(example.children[0].textContent, /exposed groups do not fit this target.*Example only/i);
  assert.equal(context.elements.americanCardTarget.value, "1");
});

test("numbered targets choose the best legal suits without combining suits inside a set", () => {
  const context = targetContext();
  const card = AmericanCard.parse("Even | 25 | X | regular | x2:3 y4:3 z6:4 v8:4 | suits 1-2");
  context.game = { card };
  vm.runInContext(section("function rankAmericanLines(", "/** Lists the tiles still missing"), context);
  const supply = Array.from(context.createTiles("american"));
  const take = (type, value, count = 1) =>
    supply.filter((tile) => tile.type === type && tile.value === value).slice(0, count);
  const hand = [
    ...take("circles", 2), ...take("bamboo", 2), ...take("circles", 4, 2),
    ...take("circles", 6), ...take("bamboo", 6), ...take("bamboo", 8), ...take("joker", 0),
    ...take("bamboo", 1, 2), ...take("bamboo", 7), ...take("bamboo", 9), ...take("dragon", 1)
  ];
  const best = (hand) => context.rankAmericanLines(hand, [], 1)[0];
  assert.equal(best(hand).need, 8, "one 2 and one 6 of each suit are alternatives, not mixed-suit sets");
  hand.splice(hand.findIndex((tile) => tile.type === "circles" && tile.value === 6), 1,
    take("bamboo", 6, 2)[1]);
  const improved = best(hand);
  assert.equal(improved.need, 7);
  assert.equal(improved.groups[2].key, "bamboo-6");
  assert.equal(improved.groups[2].tiles.length, 2);

  for (const first of ["characters", "circles", "bamboo"]) {
    for (const second of ["characters", "circles", "bamboo"]) {
      const complete = [
        ...take(first, 2, 3), ...take(second, 4, 3), ...take(first, 6, 4), ...take(second, 8, 4)
      ];
      assert.equal(best(complete).need, 0, `${first}/${second} must complete the target`);
      assert.ok(AmericanCard.winningLines(card, complete, []).length,
        `${first}/${second} must also be recognized as a winning hand`);
    }
  }
  const threeSuits = [
    ...take("characters", 2, 3), ...take("circles", 4, 3),
    ...take("bamboo", 6, 4), ...take("characters", 8, 4)
  ];
  assert.ok(best(threeSuits).need > 0, "the card's 1-2 suit restriction still applies");
  assert.deepEqual(AmericanCard.winningLines(card, threeSuits, []), []);
});

test("American guide includes each suit, its dragon and the neutral tiles", () => {
  const chart = element("div");
  const context = vm.createContext({
    document: { createElement: element },
    elements: { americanSymbolGuide: chart },
    game: { variantId: "american" },
    VARIANTS: { american: { flowers: true, jokers: true } },
    SUITS: [
      { id: "characters", label: "Characters", symbol: "萬" },
      { id: "circles", label: "Circles", symbol: "筒" },
      { id: "bamboo", label: "Bamboo", symbol: "索" }
    ],
    WINDS: ["East", "South", "West", "North"],
    DRAGONS: ["Red", "Green", "White"],
    tileClass: (tile) => tile.type,
    renderTileFace() {}
  });
  vm.runInContext(section("function createTiles(", "/** Shuffles"), context);
  vm.runInContext(section("function tileDescription(", "/** Builds the two-row legend"), context);
  vm.runInContext(section("function renderAmericanSymbolGuide(", "/** Keeps the example tiles"), context);
  context.renderAmericanSymbolGuide();

  const suitRows = chart.children.slice(0, 3);
  const names = ["Crak", "Dot", "Bam"];
  const dragons = ["Red dragon", "White dragon (Soap)", "Green dragon"];
  suitRows.forEach((row, index) => {
    const faces = row.children[1].children;
    assert.equal(faces.length, 10);
    for (let value = 1; value <= 9; value += 1) {
      assert.equal(faces[value - 1].attributes["aria-label"], `${value} ${names[index]}`);
    }
    assert.equal(faces[9].attributes["aria-label"], dragons[index]);
  });
  const groups = chart.children[3].children[1].children;
  assert.deepEqual(groups.map((group) => group.children[0].textContent),
    ["Winds", "Flowers", "Jokers", "Blank spares"]);
  assert.deepEqual(groups.map((group) => group.children[2].children.length), [4, 8, 1, 1]);
  assert.match(groups[3].children[1].textContent, /Not used/);
});
