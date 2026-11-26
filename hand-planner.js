/* Finds the closest "sets plus a pair" winning pattern for a hand and how many tiles it still needs. */
const HandPlanner = (() => {
  const SUITS = ["characters", "circles", "bamboo"];
  const KINDS = [
    ...SUITS.flatMap((suit) => Array.from({ length: 9 }, (_, index) => `${suit}-${index + 1}`)),
    "wind-0", "wind-1", "wind-2", "wind-3", "dragon-0", "dragon-1", "dragon-2", "flower-0"
  ];

  function suitedValue(key) {
    const [type, value] = key.split("-");
    return SUITS.includes(type) ? Number(value) : 0;
  }

  /**
   * Plans the hand.
   * counts: Map of tile key to natural tiles held. sets: sets still to form.
   * jokers: jokers held (fill sets only). sequences: whether runs count as sets.
   * available: optional Map of key to unseen copies; missing tiles must be available.
   * pairAllowed: optional test for which keys may form the pair.
   * Returns { need, groups }, where each group is { kind, tiles: [{ key, held, joker }] }.
   */
  function plan({ counts, sets, jokers = 0, sequences = true, available = null, pairAllowed = () => true }) {
    const held = KINDS.map((key) => counts.get(key) ?? 0);
    const unseen = (index, amount) => amount <= 0 || !available || (available.get(KINDS[index]) ?? 0) >= amount;
    const sameSuitAt = (index, offset) => {
      const value = suitedValue(KINDS[index]);
      const target = index + offset;
      return value > 0 && value + offset >= 1 && value + offset <= 9 && target >= 0 && target < KINDS.length;
    };
    const memo = new Map();

    function tiles(keys, heldFlags, jokerCount = 0) {
      let jokersLeft = jokerCount;
      return keys.map((key, index) => {
        if (heldFlags[index]) return { key, held: true, joker: false };
        if (jokersLeft > 0) {
          jokersLeft -= 1;
          return { key, held: true, joker: true };
        }
        return { key, held: false, joker: false };
      });
    }

    function solve(start, slots, pairDone, jokersLeft) {
      let index = start;
      while (index < KINDS.length && held[index] === 0) index += 1;
      if (index === KINDS.length) {
        let need = 0;
        let jokerPool = jokersLeft;
        const groups = [];
        for (let slot = 0; slot < slots; slot += 1) {
          const fill = Math.min(jokerPool, 2);
          jokerPool -= fill;
          need += 3 - fill;
          groups.push({ kind: "any", tiles: tiles([null, null, null], [false, false, false], fill) });
        }
        if (!pairDone) {
          need += 2;
          groups.push({ kind: "pair", tiles: tiles([null, null], [false, false]) });
        }
        return { need, groups };
      }
      const memoKey = `${index}|${held[index]},${held[index + 1] ?? 0},${held[index + 2] ?? 0}|${slots}|${pairDone}|${jokersLeft}`;
      if (memo.has(memoKey)) return memo.get(memoKey);

      const key = KINDS[index];
      let best = null;
      const consider = (taken, cost, group, nextSlots, nextPair, nextJokers) => {
        for (const [position, amount] of taken) held[position] -= amount;
        const rest = solve(index, nextSlots, nextPair, nextJokers);
        for (const [position, amount] of taken) held[position] += amount;
        const need = rest.need + cost;
        if (!best || need < best.need) best = { need, groups: group ? [group, ...rest.groups] : rest.groups };
      };

      if (slots > 0) {
        for (let naturals = Math.min(held[index], 3); naturals >= 1; naturals -= 1) {
          const useJokers = Math.min(jokersLeft, 3 - naturals);
          const missing = 3 - naturals - useJokers;
          if (!unseen(index, missing)) continue;
          consider([[index, naturals]], missing,
            { kind: "pung", tiles: tiles([key, key, key], [0, 1, 2].map((slot) => slot < naturals), useJokers) },
            slots - 1, pairDone, jokersLeft - useJokers);
        }
        if (sequences && suitedValue(key)) {
          // Earlier tiles are used up, so this tile is the lowest held tile of any run through it.
          const runs = [
            { offsets: [0, 1, 2], haves: [[0, 1, 2], [0, 1], [0, 2], [0]] },
            { offsets: [-1, 0, 1], haves: [[0, 1], [0]] },
            { offsets: [-2, -1, 0], haves: [[0]] }
          ];
          for (const { offsets, haves } of runs) {
            if (!offsets.every((offset) => sameSuitAt(index, offset))) continue;
            for (const have of haves) {
              if (have.some((offset) => held[index + offset] < 1)) continue;
              const missing = offsets.filter((offset) => !have.includes(offset));
              if (missing.some((offset) => !unseen(index + offset, 1))) continue;
              consider(have.map((offset) => [index + offset, 1]), missing.length,
                { kind: "chow", tiles: offsets.map((offset) => ({ key: KINDS[index + offset], held: have.includes(offset), joker: false })) },
                slots - 1, pairDone, jokersLeft);
            }
          }
        }
      }
      if (!pairDone && pairAllowed(key)) {
        if (held[index] >= 2) consider([[index, 2]], 0, { kind: "pair", tiles: tiles([key, key], [true, true]) }, slots, true, jokersLeft);
        if (unseen(index, 1)) consider([[index, 1]], 1, { kind: "pair", tiles: tiles([key, key], [true, false]) }, slots, true, jokersLeft);
      }
      consider([[index, 1]], 0, null, slots, pairDone, jokersLeft);

      memo.set(memoKey, best);
      return best;
    }

    return solve(0, Math.max(0, sets), false, jokers);
  }

  return { kinds: KINDS, plan };
})();

if (typeof module !== "undefined" && module.exports) module.exports = HandPlanner;
