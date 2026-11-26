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

  const SUITS = ["C", "D", "B"];
  const MATCHING_DRAGON = { C: "R", D: "0", B: "G" };
  const MAX_VARIATIONS = 2000;

  /** Expands suit variables (x y z v), matching dragons (Dx), any dragon (D*), any wind (W*), and runs (xn, xn+1). */
  function expandGroups(groupText, suitRule, fail) {
    const tokens = groupText.split(/\s+/).filter(Boolean);
    if (!tokens.length) fail("enter at least one group.");
    const parsed = tokens.map((token) => {
      const match = /^([^:]+):([1-6])$/.exec(token);
      if (!match) fail(`invalid group "${token}".`);
      const code = match[1];
      const size = Number(match[2]);
      let item;
      if ((item = /^([CDB])([1-9])$/i.exec(code))) return { kind: "fixed", code: `${item[1].toUpperCase()}${item[2]}`, size };
      if (/^[ESWNRG0F]$/i.test(code)) return { kind: "fixed", code: code.toUpperCase(), size };
      if ((item = /^([xyzv])([1-9])$/i.exec(code))) return { kind: "suit", variable: item[1].toLowerCase(), number: Number(item[2]), size };
      if ((item = /^([xyzv])n(?:\+([1-8]))?$/i.exec(code))) return { kind: "run", variable: item[1].toLowerCase(), offset: Number(item[2] ?? 0), size };
      if ((item = /^D([xyzv])$/i.exec(code))) return { kind: "dragon", variable: item[1].toLowerCase(), size };
      if (/^D\*$/i.test(code)) return { kind: "anyDragon", size };
      if (/^W\*$/i.test(code)) return { kind: "anyWind", size };
      return fail(`invalid group "${token}".`);
    });
    const variables = [...new Set(parsed.filter((group) => group.variable).map((group) => group.variable))];
    let allowed = null;
    if (suitRule) {
      const rule = /^suits\s+([1-3])(?:\s*(?:-|–|to)\s*([1-3]))?$/i.exec(suitRule);
      if (!rule) fail('write the suit rule as "suits 2" or "suits 1-2".');
      const low = Number(rule[1]);
      const high = Number(rule[2] ?? rule[1]);
      if (high < low || high > Math.max(1, variables.length)) fail("the suit rule needs that many suit letters (x y z v).");
      allowed = Array.from({ length: high - low + 1 }, (_, index) => low + index);
    } else if (variables.length > 1) {
      // Card convention: different letters are different suits; with four letters, all three suits appear.
      allowed = [Math.min(variables.length, SUITS.length)];
    }
    let assignments = [{}];
    for (const variable of variables) {
      assignments = assignments.flatMap((assignment) => SUITS.map((suit) => ({ ...assignment, [variable]: suit })));
    }
    if (allowed) assignments = assignments.filter((assignment) => allowed.includes(new Set(Object.values(assignment)).size));
    const runs = parsed.filter((group) => group.kind === "run");
    const maxOffset = Math.max(0, ...runs.map((group) => group.offset));
    const starts = runs.length ? Array.from({ length: 9 - maxOffset }, (_, index) => index + 1) : [null];
    const dragons = parsed.some((group) => group.kind === "anyDragon") ? ["R", "G", "0"] : [null];
    const winds = parsed.some((group) => group.kind === "anyWind") ? ["E", "S", "W", "N"] : [null];
    if (assignments.length * starts.length * dragons.length * winds.length > MAX_VARIATIONS) {
      fail(`the pattern creates more than ${MAX_VARIATIONS} variations; add a suit rule or use fewer letters.`);
    }
    const variations = [];
    for (const assignment of assignments) {
      for (const start of starts) {
        for (const dragon of dragons) {
          for (const wind of winds) {
            variations.push(parsed.map((group) => {
              const code = group.kind === "fixed" ? group.code
                : group.kind === "suit" ? `${assignment[group.variable]}${group.number}`
                : group.kind === "run" ? `${assignment[group.variable]}${start + group.offset}`
                : group.kind === "dragon" ? MATCHING_DRAGON[assignment[group.variable]]
                : group.kind === "anyDragon" ? dragon : wind;
              return { key: code.length === 2 ? `${tileTypes[code[0]]}-${code[1]}` : honors[code], size: group.size };
            }));
          }
        }
      }
    }
    return variations;
  }

  /**
   * Parses card text. Each non-comment line is either
   * "value | X or C | regular or singles | groups" or
   * "name | value | X or C | regular or singles | groups [| suits N or N-M]".
   * Lines starting with # are comments. Variables expand into every allowed variation.
   */
  function parse(text) {
    const lines = [];
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
      if (!raw.trim() || raw.trim().startsWith("#")) continue;
      const fail = (message) => { throw new Error(`Line ${index + 1}: ${message}`); };
      let parts = raw.split("|").map((part) => part.trim());
      let name = null;
      let suitRule = "";
      if (parts.length === 5 || parts.length === 6) {
        name = parts[0];
        suitRule = parts[5] ?? "";
        parts = parts.slice(1, 5);
        if (!name) fail("enter a pattern name before the first |.");
      } else if (parts.length !== 4) {
        fail("use name | points | X or C | regular or singles | groups | optional suit rule.");
      }
      const value = Number(parts[0]);
      if (!Number.isSafeInteger(value) || value <= 0) fail("the value must be a positive whole number.");
      const exposure = parts[1].toUpperCase();
      if (!["X", "C"].includes(exposure)) fail("choose X (exposed) or C (concealed).");
      const category = parts[2].toLowerCase();
      if (!["regular", "singles"].includes(category)) fail("choose regular or singles.");
      const seen = new Set();
      for (const groups of expandGroups(parts[3], suitRule, fail)) {
        const signature = groups.map((group) => `${group.key}:${group.size}`).join(" ");
        if (seen.has(signature)) continue;
        seen.add(signature);
        lines.push(validateLine({ name, pattern: index + 1, value, concealed: exposure === "C", singles: category === "singles", groups }, fail));
      }
    }
    if (!lines.length) throw new Error("Enter at least one card combination.");
    return lines;
  }

  function validateLine(line, fail) {
    const { groups } = line;
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
    if (line.singles && groups.some((group) => group.size > 2)) {
      fail("a singles category entry can contain only singles and pairs.");
    }
    return line;
  }

  /** Groups parsed lines by the card text line (pattern) they came from. */
  function patterns(lines) {
    const result = new Map();
    for (const line of lines) {
      if (!result.has(line.pattern)) {
        result.set(line.pattern, { id: line.pattern, name: line.name ?? `Line ${line.pattern}`, value: line.value, concealed: line.concealed, lines: [] });
      }
      result.get(line.pattern).lines.push(line);
    }
    return [...result.values()];
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

  /** Measures how far a concealed hand plus exposures is from one card line. */
  function progress(line, hand, melds) {
    return exposureAssignments(line, melds, (used) => {
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
      const groups = line.groups.map((group, index) => ({
        index, key: group.key, size: group.size, exposed: used.has(index), tiles: []
      }));
      const open = groups.filter((group) => !group.exposed).sort((a, b) => a.size - b.size);
      for (const group of open) {
        const tiles = naturals.get(group.key) ?? [];
        group.tiles.push(...tiles.splice(0, Math.min(tiles.length, group.size)));
      }
      for (const group of open) {
        if (group.size >= 3) group.tiles.push(...jokers.splice(0, group.size - group.tiles.length));
      }
      return {
        line,
        groups,
        need: open.reduce((sum, group) => sum + group.size - group.tiles.length, 0),
        keep: new Set(open.flatMap((group) => group.tiles.map((tile) => tile.id)))
      };
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

  const DEFAULT_CARD_TEXT = [
    "# 2026 patterns from your list. One pattern per line:",
    "# name | points | X exposed or C concealed | regular or singles | groups | optional suit rule",
    "# Groups are tile:count. Fixed tiles: C1-C9 Craks, D1-D9 Dots, B1-B9 Bams, E S W N winds, R G 0 dragons (0 = Soap), F flower.",
    "# Suit letters x y z v stand for any suit (x2:3 = three 2s of suit x); Dx = dragon matching suit x;",
    "# D* = any dragon, W* = any wind; xn, xn+1 ... = consecutive numbers. \"suits 2\" or \"suits 1-2\" limits how many different suits the letters use; without one, different letters are different suits.",
    "2026: 222 000 2222 6666 · Any 2 suits | 25 | X | regular | x2:3 0:3 y2:4 z6:4 | suits 2",
    "2026: 2026 DDD 2222 DDD · 2 suits, matching dragons | 25 | X | regular | x2:1 0:1 x2:1 x6:1 Dx:3 y2:4 Dy:3 | suits 2",
    "2026: FFF 2026 222 6666 · Any 3 suits | 25 | X | regular | F:3 x2:1 0:1 x2:1 x6:1 y2:3 z6:4 | suits 3",
    "2026: 22 00 222 666 NEWS · Any 2 suits | 30 | X | regular | x2:2 0:2 y2:3 z6:3 N:1 E:1 W:1 S:1 | suits 2",
    "Even: 222 444 6666 8888 · 1-2 suits | 25 | X | regular | x2:3 y4:3 z6:4 v8:4 | suits 1-2",
    "Even: FF 2222 44 66 8888 · Any 2 suits | 30 | X | regular | F:2 x2:4 y4:2 z6:2 v8:4 | suits 2",
    "Even: EE 22 444 666 88 WW · East and West only | 30 | X | regular | E:2 x2:2 y4:3 z6:3 v8:2 W:2",
    "Even: FFF 22 44 666 8888 · Any 1 suit | 25 | X | regular | F:3 x2:2 x4:2 x6:3 x8:4",
    "Odd: NN 111 333 5555 SS · North and South only | 25 | X | regular | N:2 x1:3 y3:3 z5:4 S:2",
    "Odd: FFF 11 33 555 DDDD · Matching dragon | 25 | X | regular | F:3 x1:2 y3:2 z5:3 Dz:4",
    "369: FFF 33 666 99 DDDD · Any 3 suits | 25 | X | regular | F:3 x3:2 y6:3 z9:2 D*:4 | suits 3",
    "Winds: NNNN EEE WWW SSSS | 25 | X | regular | N:4 E:3 W:3 S:4",
    "Winds: NNN EEEE WWWW SSS | 25 | X | regular | N:3 E:4 W:4 S:3",
    "Wind and dragon: FFF NNNN FFF DDDD · Any wind, any dragon | 25 | X | regular | F:3 W*:4 F:3 D*:4",
    "Consecutive: FFF 1111 234 5555 · Run + quint | 45 | X | regular | F:3 xn:4 xn+1:1 xn+2:1 xn+3:1 xn+4:4",
    "# These patterns from your list do not total 14 tiles as written. Correct the groups and remove the # to play them:",
    "# Odd: 11 333 555 777 9999 (15 tiles) | 25 | X | regular | x1:2 x3:3 x5:3 x7:3 x9:4",
    "# 369: 333 666 9999 (10 tiles) | 25 | X | regular | x3:3 y6:3 z9:4 | suits 2-3",
    "# Quint: 11111 4444 DDDD (13 tiles) | 40 | X | regular | x1:5 x4:4 Dx:4",
    "# Consecutive: 1111 22 3333 (10 tiles) | 40 | X | regular | xn:4 xn+1:2 xn+2:4",
    "# Singles: NN EE WW SS 1D 1D 1D (1D unclear) | 50 | C | singles | N:2 E:2 W:2 S:2 C1:1 D1:1 B1:1",
    "# Singles: 2 4 66 88 2 4 66 88 (12 tiles) | 50 | C | singles | x2:1 x4:1 x6:2 x8:2 y2:1 y4:1 y6:2 y8:2 | suits 2",
    "# Singles: FF 2026 2026 (10 tiles) | 75 | C | singles | F:2 x2:1 0:1 x2:1 x6:1 y2:1 0:1 y2:1 y6:1 | suits 2"
  ].join("\n");

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

  return { parse, patterns, defaultCardText: DEFAULT_CARD_TEXT, key, exposureKey, exposuresFit, matchLine, progress, winningLines, exampleGroups, claims, payouts };
})();

if (typeof module !== "undefined" && module.exports) module.exports = AmericanCard;
