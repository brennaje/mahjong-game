const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

function element(tag) {
  return {
    tag,
    children: [],
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; }
  };
}

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
