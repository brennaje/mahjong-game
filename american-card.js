/* Card entries describe concrete tile combinations, not a bundled annual card. */
const AmericanCard = (() => {
  const tileTypes = { C: "characters", D: "circles", B: "bamboo" };
  const honors = {
    E: "wind-0", S: "wind-1", W: "wind-2", N: "wind-3",
    R: "dragon-0", G: "dragon-1", "0": "dragon-2", F: "flower-0"
  };

  function key(tile) {
    return `${tile.type}-${tile.type === "flower" ? 0 : tile.value}`;
  }

  function parse(text) {
    const lines = [];
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
      if (!raw.trim()) continue;
      const parts = raw.split("|").map((part) => part.trim());
      const fail = (message) => { throw new Error(`Line ${index + 1}: ${message}`); };
      if (parts.length !== 4) fail("use value | X or C | regular or singles | groups.");
      const value = Number(parts[0]);
      if (!Number.isSafeInteger(value) || value <= 0) fail("the value must be a positive whole number.");
      const exposure = parts[1].toUpperCase();
      if (!["X", "C"].includes(exposure)) fail("choose X (exposed) or C (concealed).");
      const category = parts[2].toLowerCase();
      if (!["regular", "singles"].includes(category)) fail("choose regular or singles.");
      const tokens = parts[3].trim().split(/\s+/);
      const groups = tokens.map((token) => {
        const match = /^([CDB][1-9]|[ESWNRG0F]):([1-6])$/i.exec(token);
        if (!match) fail(`invalid group "${token}".`);
        const code = match[1].toUpperCase();
        return {
          key: code.length === 2 ? `${tileTypes[code[0]]}-${code[1]}` : honors[code],
          size: Number(match[2])
        };
      });
      if (groups.reduce((sum, group) => sum + group.size, 0) !== 14) {
        fail("groups must total exactly 14 tiles.");
      }
      const required = new Map();
      for (const group of groups) {
        const item = required.get(group.key) ?? { total: 0, fixed: 0 };
        item.total += group.size;
        if (group.size < 3) item.fixed += group.size;
        required.set(group.key, item);
      }
      let minimumJokers = 0;
      for (const [tile, count] of required) {
        const available = tile === "flower-0" ? 8 : 4;
        if (count.fixed > available) fail("singles and pairs require more natural tiles than exist.");
        minimumJokers += Math.max(0, count.total - available);
      }
      if (minimumJokers > 8) fail("the combination requires more than eight jokers.");
      if (category === "singles" && groups.some((group) => group.size > 2)) {
        fail("a singles category entry can contain only singles and pairs.");
      }
      lines.push({ value, concealed: exposure === "C", singles: category === "singles", groups });
    }
    if (!lines.length) throw new Error("Enter at least one card combination.");
    return lines;
  }

  function exposureKey(meld) {
    const natural = meld.tiles.find((tile) => tile.type !== "joker");
    return natural ? key(natural) : meld.targetKey;
  }

  function exposureAssignments(line, melds, callback) {
    if (line.concealed && melds.length) return null;
    const used = new Set();
    function assign(index) {
      if (index === melds.length) return callback(used);
      const meld = melds[index];
      const target = exposureKey(meld);
      if (!target || meld.tiles.some((tile) => tile.type !== "joker" && key(tile) !== target)) return null;
      for (const [groupIndex, group] of line.groups.entries()) {
        if (used.has(groupIndex) || group.size < 3 ||
            group.size !== meld.tiles.length || group.key !== target) continue;
        used.add(groupIndex);
        const result = assign(index + 1);
        if (result) return result;
        used.delete(groupIndex);
      }
      return null;
    }
    return assign(0);
  }

  function exposuresFit(line, melds) {
    return Boolean(exposureAssignments(line, melds, () => true));
  }

  function matchLine(line, hand, melds) {
    return exposureAssignments(line, melds, (used) => {
      const remaining = line.groups.filter((_, index) => !used.has(index));
      if (remaining.reduce((sum, group) => sum + group.size, 0) !== hand.length) return null;
      const naturals = new Map();
      const jokers = [];
      for (const tile of hand) {
        if (tile.type === "joker") {
          jokers.push(tile);
        } else {
          const tileKey = key(tile);
          if (!naturals.has(tileKey)) naturals.set(tileKey, []);
          naturals.get(tileKey).push(tile);
        }
      }
      const result = [];
      for (const group of [...remaining].sort((a, b) => a.size - b.size)) {
        const tiles = naturals.get(group.key) ?? [];
        const count = Math.min(tiles.length, group.size);
        if (group.size < 3 && count !== group.size) return null;
        const missing = group.size - count;
        if (missing > jokers.length) return null;
        result.push({
          type: group.size === 2 ? "pair" : "meld",
          label: `${group.size} ${group.key}`,
          tiles: [...tiles.splice(0, count), ...jokers.splice(0, missing)]
        });
      }
      if (jokers.length || [...naturals.values()].some((tiles) => tiles.length)) return null;
      return result;
    });
  }

  function winningLines(card, hand, melds) {
    return card.flatMap((line) => {
      const groups = matchLine(line, hand, melds);
      return groups ? [{ line, groups }] : [];
    });
  }

  function exampleGroups(line, tiles) {
    const available = new Map();
    const jokers = [];
    for (const tile of tiles) {
      if (tile.type === "joker") {
        jokers.push(tile);
      } else {
        const tileKey = key(tile);
        if (!available.has(tileKey)) available.set(tileKey, []);
        available.get(tileKey).push(tile);
      }
    }
    const result = Array(line.groups.length);
    const ordered = line.groups.map((group, index) => ({ group, index }))
      .sort((a, b) => a.group.size - b.group.size || a.index - b.index);
    for (const { group, index } of ordered) {
      const naturals = available.get(group.key) ?? [];
      const naturalCount = Math.min(group.size, naturals.length);
      const jokerCount = group.size - naturalCount;
      if ((group.size < 3 && jokerCount) || jokerCount > jokers.length) {
        throw new Error("Cannot display card example: the required tiles are unavailable.");
      }
      result[index] = [...naturals.splice(0, naturalCount), ...jokers.splice(0, jokerCount)];
    }
    return result;
  }

  function suppliedPatterns() {
    const suits = ["C", "D", "B"];
    const dragons = { C: "R", D: "0", B: "G" };
    const definitions = [
      { name: "2026: 222 000 2222 6666", value: 25, count: 3, distinct: [2], groups: ([a, b, c]) => `${a}2:3 0:3 ${b}2:4 ${c}6:4` },
      { name: "2026: 2026 DDD 2222 DDD", value: 25, count: 2, distinct: [2], groups: ([a, b]) => `${a}2:1 0:1 ${a}2:1 ${a}6:1 ${dragons[a]}:3 ${b}2:4 ${dragons[b]}:3` },
      { name: "2026: FFF 2026 222 6666", value: 25, count: 3, distinct: [3], groups: ([a, b, c]) => `F:3 ${a}2:1 0:1 ${a}2:1 ${a}6:1 ${b}2:3 ${c}6:4` },
      { name: "2026: 22 00 222 666 NEWS", value: 30, count: 3, distinct: [2], groups: ([a, b, c]) => `${a}2:2 0:2 ${b}2:3 ${c}6:3 N:1 E:1 W:1 S:1` },
      { name: "Even: 222 444 6666 8888", value: 25, count: 4, distinct: [1, 2], groups: ([a, b, c, d]) => `${a}2:3 ${b}4:3 ${c}6:4 ${d}8:4` },
      { name: "Even: FF 2222 44 66 8888", value: 30, count: 4, distinct: [2], groups: ([a, b, c, d]) => `F:2 ${a}2:4 ${b}4:2 ${c}6:2 ${d}8:4` },
      { name: "Even: EE 22 444 666 88 WW", value: 30, count: 4, groups: ([a, b, c, d]) => `E:2 ${a}2:2 ${b}4:3 ${c}6:3 ${d}8:2 W:2` },
      { name: "Even: FFF 22 44 666 8888", value: 25, count: 1, groups: ([a]) => `F:3 ${a}2:2 ${a}4:2 ${a}6:3 ${a}8:4` },
      { name: "Odd: NN 111 333 5555 SS", value: 25, count: 3, groups: ([a, b, c]) => `N:2 ${a}1:3 ${b}3:3 ${c}5:4 S:2` },
      { name: "Odd: FFF 11 33 555 DDDD", value: 25, count: 3, groups: ([a, b, c]) => `F:3 ${a}1:2 ${b}3:2 ${c}5:3 ${dragons[c]}:4` },
      { name: "369: FFF 33 666 99 DDDD", value: 25, count: 3, distinct: [3], allDragons: true, groups: ([a, b, c], dragon) => `F:3 ${a}3:2 ${b}6:3 ${c}9:2 ${dragon}:4` },
      { name: "Winds: NNNN EEE WWW SSSS", value: 25, count: 0, groups: () => "N:4 E:3 W:3 S:4" },
      { name: "Winds: NNN EEEE WWWW SSS", value: 25, count: 0, groups: () => "N:3 E:4 W:4 S:3" },
      { name: "Wind and dragon: FFF NNNN FFF DDDD", value: 25, count: 0, allWinds: true, allDragons: true, groups: (_, dragon, wind) => `F:3 ${wind}:4 F:3 ${dragon}:4` },
      { name: "Consecutive: FFF 1111 234 5555", value: 45, count: 1, runs: true, groups: ([a], _, __, start) => `F:3 ${a}${start}:4 ${a}${start + 1}:1 ${a}${start + 2}:1 ${a}${start + 3}:1 ${a}${start + 4}:4` }
    ];
    const patterns = definitions.map((definition) => {
      let assignments = [[]];
      for (let i = 0; i < definition.count; i += 1) {
        assignments = assignments.flatMap((assignment) => suits.map((suit) => [...assignment, suit]));
      }
      if (definition.distinct) {
        assignments = assignments.filter((assignment) => definition.distinct.includes(new Set(assignment).size));
      }
      const lines = [];
      for (const assignment of assignments) {
        for (const dragon of definition.allDragons ? ["R", "G", "0"] : [null]) {
          for (const wind of definition.allWinds ? ["E", "S", "W", "N"] : [null]) {
            for (const start of definition.runs ? [1, 2, 3, 4, 5] : [null]) {
              const groups = definition.groups(assignment, dragon, wind, start);
              lines.push(...parse(`${definition.value} | X | regular | ${groups}`));
            }
          }
        }
      }
      return { name: definition.name, lines };
    });
    const unavailable = [
      "Odd: 11 333 555 777 9999 — 15 tiles",
      "369: 333 666 9999 — 10 tiles",
      "Quint: 11111 4444 DDDD — 13 tiles",
      "Consecutive: 1111 22 3333 — 10 tiles",
      "Singles: NN EE WW SS 1D 1D 1D — 1D unclear",
      "Singles: 2 4 66 88 2 4 66 88 — 12 tiles",
      "Singles: FF 2026 2026 — 10 tiles"
    ];
    return { patterns, unavailable };
  }

  function claims(card, player, discarded) {
    if (discarded.type === "joker") return [];
    const targetKey = key(discarded);
    const matching = player.hand.filter((tile) => tile.type !== "joker" && key(tile) === targetKey);
    const jokers = player.hand.filter((tile) => tile.type === "joker");
    const sizes = new Set(card.filter((line) => !line.concealed)
      .flatMap((line) => line.groups.filter((group) => group.key === targetKey && group.size >= 3)
        .map((group) => group.size)));
    const result = [];
    for (const size of sizes) {
      for (let jokerCount = 0; jokerCount <= Math.min(jokers.length, size - 1); jokerCount += 1) {
        const naturalCount = size - 1 - jokerCount;
        if (naturalCount > matching.length) continue;
        const tiles = [...matching.slice(0, naturalCount), ...jokers.slice(0, jokerCount)];
        const meld = { tiles: [...tiles, discarded], targetKey };
        if (!card.some((line) => exposuresFit(line, [...player.melds, meld]))) continue;
        result.push({
          type: { 3: "pung", 4: "kong", 5: "quint", 6: "sextet" }[size],
          tiles,
          targetKey
        });
      }
    }
    return result;
  }

  function payouts(line, winner, discarder, tiles, playerCount = 4) {
    const jokerless = !line.singles && tiles.every((tile) => tile.type !== "joker");
    const multiplier = jokerless ? 2 : 1;
    return Array.from({ length: playerCount }, (_, index) => index === winner ? 0 :
      line.value * multiplier * (discarder === null || index === discarder ? 2 : 1));
  }

  return { parse, key, exposureKey, exposuresFit, matchLine, winningLines, exampleGroups, suppliedPatterns, claims, payouts };
})();

if (typeof module !== "undefined" && module.exports) module.exports = AmericanCard;
