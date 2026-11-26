const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
const start = source.indexOf("function renderTileFace(");
const end = source.indexOf("/** Builds the two-row legend", start);
assert.ok(start >= 0 && end > start, "Tile renderer not found");

function node(tag) {
  return {
    tag,
    children: [],
    attributes: {},
    classList: { add() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    append(child) { this.children.push(child); }
  };
}

function setup(variantId) {
  const context = vm.createContext({
    game: { variantId },
    document: { createElementNS: (_, tag) => node(tag) },
    WINDS: ["East", "South", "West", "North"],
    DRAGONS: ["Red", "Green", "White"],
    SUITS: [{ id: "characters", label: "Characters" }, { id: "circles", label: "Circles" }, { id: "bamboo", label: "Bamboo" }]
  });
  vm.runInContext(source.slice(start, end), context);
  return context;
}

test("American numbered tiles render the correct number of dots and bams", () => {
  const context = setup("american");
  for (let value = 2; value <= 9; value += 1) {
    for (const [type, shape, perTile] of [["circles", "circle", 3], ["bamboo", "line", 3]]) {
      const face = node("span");
      context.renderTileFace(face, { type, value });
      assert.equal(face.children[0].children.filter((child) => child.tag === shape).length, value * perTile);
      assert.equal(face.children[0].attributes["aria-hidden"], "true");
    }
  }
});

test("American tile names and soap image differ from other variants", () => {
  const american = setup("american");
  assert.equal(american.tileDescription({ type: "characters", value: 3 }), "3 Crak");
  assert.equal(american.tileDescription({ type: "circles", value: 4 }), "4 Dot");
  assert.equal(american.tileDescription({ type: "bamboo", value: 5 }), "5 Bam");
  assert.equal(american.tileDescription({ type: "dragon", value: 2 }), "White dragon (Soap)");
  const soap = node("span");
  american.renderTileFace(soap, { type: "dragon", value: 2 });
  assert.equal(soap.children[0].children.filter((child) => child.tag === "rect").length, 2);

  const standard = setup("chinese-classical");
  const face = node("span");
  standard.renderTileFace(face, { type: "circles", value: 4, label: "4筒" });
  assert.equal(face.textContent, "4筒");
  assert.equal(standard.tileDescription({ type: "circles", value: 4 }), "4 of Circles");
});
