const assert = require("node:assert/strict");
const test = require("node:test");
const card = require("../american-card.js");

let id = 0;
const tile = (type, value = 0) => ({ id: id++, type, value });
const tiles = (type, value, count) => Array.from({ length: count }, () => tile(type, value));
const pattern = "25 | X | regular | F:2 C1:3 C2:3 C3:3 C4:3";
const line = () => card.parse(pattern)[0];

test("card entries validate groups and preserve concealed and scoring flags", () => {
  const parsed = card.parse(`${pattern}\n50 | C | singles | E:2 S:2 W:2 N:2 R:2 G:2 0:2`);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].concealed, true);
  assert.equal(parsed[1].singles, true);
  assert.throws(() => card.parse("25 | X | regular | C1:3"), /14 tiles/);
  assert.throws(() => card.parse("25 | X | singles | F:2 C1:3 C2:3 C3:3 C4:3"), /only singles and pairs/);
  assert.throws(() => card.parse("25 | X | regular | C1:2 C1:2 C1:2 C2:2 C3:2 C4:2 C5:2"), /more natural tiles/);
});

test("winning hands match only entered groups, allowing jokers in sets but not pairs", () => {
  const hand = [
    ...tiles("flower", 0, 2),
    ...tiles("characters", 1, 3),
    ...tiles("characters", 2, 3),
    ...tiles("characters", 3, 3),
    ...tiles("characters", 4, 2), tile("joker")
  ];
  assert.ok(card.matchLine(line(), hand, []));
  const invalidPair = [...hand];
  invalidPair[0] = tile("joker");
  assert.equal(card.matchLine(line(), invalidPair, []), null);
  const wrongTile = [...hand];
  wrongTile[2] = tile("circles", 1);
  assert.equal(card.matchLine(line(), wrongTile, []), null);
});

test("exposures must match an exposed card group; concealed hands cannot have them", () => {
  const meld = { tiles: [...tiles("characters", 1, 2), tile("joker")], targetKey: "characters-1" };
  const hand = [
    ...tiles("flower", 0, 2), ...tiles("characters", 2, 3),
    ...tiles("characters", 3, 3), ...tiles("characters", 4, 3)
  ];
  assert.ok(card.matchLine(line(), hand, [meld]));
  assert.equal(card.matchLine({ ...line(), concealed: true }, hand, [meld]), null);
  assert.equal(card.matchLine(line(), hand, [{ ...meld, tiles: tiles("characters", 5, 3) }]), null);
});

test("claims use allowed groups, including jokers, and exclude concealed hands", () => {
  const hand = [...tiles("characters", 1, 2), tile("joker")];
  const player = { hand, melds: [] };
  const discard = tile("characters", 1);
  const options = card.claims([line()], player, discard);
  assert.deepEqual(options.map((option) => option.type), ["pung", "pung"]);
  assert.deepEqual(options.map((option) => option.tiles.filter((item) => item.type === "joker").length), [0, 1]);
  assert.deepEqual(card.claims([{ ...line(), concealed: true }], player, discard), []);
  assert.deepEqual(card.claims([line()], player, tile("joker")), []);
});

test("examples reserve natural tiles for pairs and use jokers only where required", () => {
  const sample = card.parse("30 | X | regular | C1:5 C1:2 C2:3 F:4")[0];
  const supply = [
    ...tiles("characters", 1, 4), ...tiles("characters", 2, 4),
    ...Array.from({ length: 8 }, (_, value) => tile("flower", value)),
    ...tiles("joker", 0, 8)
  ];
  const groups = card.exampleGroups(sample, supply);
  assert.deepEqual(groups.map((group) => group.length), [5, 2, 3, 4]);
  assert.equal(groups[0].filter((item) => item.type === "joker").length, 3);
  assert.ok(groups[1].every((item) => item.type !== "joker"));
  const hand = groups.flat();
  assert.equal(new Set(hand.map((item) => item.id)).size, 14);
  assert.ok(card.matchLine(sample, hand, []));
});

test("provided patterns generate playable 14-tile examples with valid suit and dragon variations", () => {
  const { patterns, unavailable } = card.suppliedPatterns();
  const supply = [
    ...["characters", "circles", "bamboo"].flatMap((type) =>
      Array.from({ length: 9 }, (_, index) => tiles(type, index + 1, 4)).flat()),
    ...Array.from({ length: 4 }, (_, value) => tiles("wind", value, 4)).flat(),
    ...Array.from({ length: 3 }, (_, value) => tiles("dragon", value, 4)).flat(),
    ...tiles("flower", 0, 8), ...tiles("joker", 0, 8)
  ];
  for (const pattern of patterns) {
    for (const variation of pattern.lines) {
      const hand = card.exampleGroups(variation, supply).flat();
      assert.equal(hand.length, 14, pattern.name);
      assert.equal(new Set(hand.map((item) => item.id)).size, 14, pattern.name);
      assert.ok(card.matchLine(variation, hand, []), pattern.name);
    }
  }
  const matchingDragons = patterns.find((pattern) => pattern.name.includes("2026 DDD"));
  for (const variation of matchingDragons.lines) {
    const groups = variation.groups;
    const dragonFor = { characters: 0, circles: 2, bamboo: 1 };
    const firstSuit = groups[0].key.split("-")[0];
    const secondSuit = groups[5].key.split("-")[0];
    assert.notEqual(firstSuit, secondSuit);
    assert.equal(groups[4].key, `dragon-${dragonFor[firstSuit]}`);
    assert.equal(groups[6].key, `dragon-${dragonFor[secondSuit]}`);
  }
  assert.ok(unavailable.some((name) => name.includes("1D unclear")));
  assert.ok(unavailable.some((name) => name.includes("15 tiles")));
});

test("provided consecutive pattern uses the written groups and supports runs through 9", () => {
  const pattern = card.suppliedPatterns().patterns.find((item) => item.name.includes("FFF 1111 234 5555"));
  assert.ok(pattern.lines.some((line) => line.groups.map((group) => group.key).join(" ") ===
    "flower-0 bamboo-5 bamboo-6 bamboo-7 bamboo-8 bamboo-9"));
  assert.deepEqual(pattern.lines[0].groups.map((group) => group.size), [3, 4, 1, 1, 1, 4]);
});

test("card scoring accounts for discard, self draw, jokerless, and singles", () => {
  const joker = [tile("joker")];
  assert.deepEqual(card.payouts(line(), 0, 1, joker), [0, 50, 25, 25]);
  assert.deepEqual(card.payouts(line(), 0, null, joker), [0, 50, 50, 50]);
  assert.deepEqual(card.payouts(line(), 0, 1, []), [0, 100, 50, 50]);
  assert.deepEqual(card.payouts(line(), 0, null, []), [0, 100, 100, 100]);
  assert.deepEqual(card.payouts({ ...line(), singles: true }, 0, null, []), [0, 50, 50, 50]);
});
