const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

function load(context, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first);
  vm.runInContext(source.slice(first, last), context);
}

function undoContext(game) {
  const context = vm.createContext({
    game, undoState: null, undoContinuation: null,
    humanHandOrder: [1, 2], playerScores: [10, 20], americanCardScores: [30, 40],
    botTimer: null, speechAvailable: false, pendingTileAnimations: [], readyTileAnimations: [],
    elements: { gameReview: {}, turnNarration: {} },
    clearTileAnimationGhosts() {}, render() {}
  });
  load(context, "function copyUndoValue(", "/** Formats a readable label");
  return context;
}

test("undo restores the wall, hand, discards, shared references and scores", () => {
  const tile = { id: 1 };
  const discard = { tile, claimed: false };
  const context = undoContext({
    wall: [{ id: 2 }], players: [{ hand: [tile] }],
    discards: [discard], pendingDiscard: discard, reviewOpen: false
  });
  context.saveUndoState();
  context.game.wall.pop();
  context.game.players[0].hand.pop();
  context.game.pendingDiscard.claimed = true;
  context.playerScores[0] += 5;
  context.americanCardScores[1] += 25;
  context.humanHandOrder.reverse();
  context.undoLastMove();
  assert.equal(context.game.wall[0].id, 2);
  assert.equal(context.game.players[0].hand[0], context.game.pendingDiscard.tile);
  assert.equal(context.game.pendingDiscard, context.game.discards[0]);
  assert.equal(context.game.pendingDiscard.claimed, false);
  assert.deepEqual(context.playerScores, [10, 20]);
  assert.deepEqual(context.americanCardScores, [30, 40]);
  assert.deepEqual(Array.from(context.humanHandOrder), [1, 2]);
  assert.equal(context.undoState, null);
});

test("continue expires undo and resumes a human claim pass exactly once", () => {
  const game = {
    phase: "claim", current: 0, pendingDiscard: { player: 1, tile: { id: 9 } },
    claimQueue: [{ player: 0 }, { player: 2 }], claimIndex: 0,
    players: [{ name: "You" }, { name: "Alex" }, { name: "Jordan" }]
  };
  const context = undoContext(game);
  Object.assign(context, {
    possessivePlayerName: () => "Alex's", tileDescription: () => "tile",
    recordHumanWin() {}, narrateTurn() {}, scheduleBotTurn() {},
    advanceAfterDiscard() { throw new Error("Unexpected end of claim queue"); }
  });
  load(context, "function passClaim(", "/** Applies a selected meld claim");
  context.passClaim();
  assert.equal(context.game.phase, "undo-pending");
  assert.equal(context.game.claimIndex, 0);
  context.continueAfterMove();
  assert.equal(context.undoState, null);
  assert.equal(context.game.phase, "claim");
  assert.equal(context.game.current, 2);
  assert.equal(context.game.claimIndex, 1);
  context.continueAfterMove();
  assert.equal(context.game.claimIndex, 1);
});

test("undoing a passed claim returns to the same claim", () => {
  const game = {
    phase: "claim", current: 0, pendingDiscard: { player: 1, tile: { id: 9 } },
    claimQueue: [{ player: 0 }], claimIndex: 0, players: [{ name: "You" }]
  };
  const context = undoContext(game);
  Object.assign(context, {
    possessivePlayerName: () => "Alex's", tileDescription: () => "tile",
    recordHumanWin() {}, narrateTurn() {}, scheduleBotTurn() {}, advanceAfterDiscard() {}
  });
  load(context, "function passClaim(", "/** Applies a selected meld claim");
  context.passClaim();
  context.undoLastMove();
  assert.equal(context.game.phase, "claim");
  assert.equal(context.game.claimIndex, 0);
  assert.equal(context.undoContinuation, null);
});

test("undoing a declared card win restores the score and hand", () => {
  const game = {
    card: [{}], cardSource: "supplied", current: 0, phase: "discard", winner: null,
    variantId: "american", reviewOpen: false,
    players: [{ name: "You", hand: [{ id: 1 }], melds: [], drawnTileId: 1 }]
  };
  const context = undoContext(game);
  Object.assign(context, {
    PLAYER_NAMES: ["You", "Alex"], AmericanCard: {
      winningLines: () => [{ line: { value: 25 }, groups: [] }]
    },
    cardWinningLines: () => context.AmericanCard.winningLines(),
    isWinningHand: () => true, recordHumanWin() {}, tileDescription: () => "tile",
    narrateTurn() {}, elements: { gameReview: {}, turnNarration: {}, turnMessage: {} }
  });
  load(context, "function declareSelfDraw(", "/** Declares riichi");
  load(context, "function finishHand(", "/** Starts the next hand");
  context.declareSelfDraw();
  assert.equal(context.game.winner, 0);
  assert.equal(context.americanCardScores[0], 55);
  context.undoLastMove();
  assert.equal(context.game.winner, null);
  assert.equal(context.game.phase, "discard");
  assert.equal(context.americanCardScores[0], 30);
});
