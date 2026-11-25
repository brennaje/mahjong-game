const SUITS = [
  { id: "characters", label: "Characters", symbol: "萬" },
  { id: "circles", label: "Circles", symbol: "筒" },
  { id: "bamboo", label: "Bamboo", symbol: "索" }
];
const WINDS = ["East", "South", "West", "North"];
const DRAGONS = ["Red", "Green", "White"];
const PLAYER_NAMES = ["You", "Alex", "Jordan", "Morgan"];
const playerScores = PLAYER_NAMES.map(() => 0);
const TILE_TYPE_ORDER = ["characters", "circles", "bamboo", "wind", "dragon", "flower", "joker"];
const VARIANTS = {
  "chinese-classical": {
    label: "Chinese Classical",
    initialHandSize: 13,
    meldsToWin: 4,
    mode: "standard",
    flowers: false,
    flowersReplace: false,
    jokers: false,
    description: "136 tiles · 13-tile hand · four melds and a pair; traditional scoring omitted."
  },
  "hong-kong": {
    label: "Hong Kong Old Style",
    initialHandSize: 13,
    meldsToWin: 4,
    mode: "standard",
    flowers: false,
    flowersReplace: false,
    jokers: false,
    description: "Basic 13-tile play · fan threshold and traditional scoring are not enforced."
  },
  "japanese-riichi": {
    label: "Japanese Riichi (core)",
    initialHandSize: 13,
    meldsToWin: 4,
    mode: "riichi",
    flowers: false,
    flowersReplace: false,
    jokers: false,
    description: "136 tiles · riichi, tanyao, yakuhai, and closed self-draw yaku; hand-value scoring and furiten omitted."
  },
  "taiwanese-16": {
    label: "Taiwanese 16-tile",
    initialHandSize: 16,
    meldsToWin: 5,
    mode: "standard",
    flowers: true,
    flowersReplace: true,
    jokers: false,
    description: "144 tiles · 16-tile hand · five melds and a pair; flowers are replaced from the wall."
  },
  american: {
    label: "American (simplified, no card)",
    initialHandSize: 13,
    meldsToWin: 4,
    mode: "american",
    flowers: true,
    flowersReplace: false,
    jokers: true,
    description: "152 tiles · four matching sets plus a natural pair, with jokers; no yearly card, Charleston, or official scoring."
  }
};
const DIRECTION_AREAS = {
  East: "3 / 1 / 4 / 4",
  South: "2 / 3",
  West: "1 / 1 / 2 / 4",
  North: "2 / 1"
};

const elements = {
  actions: document.querySelector("#actions"),
  discardPile: document.querySelector("#discard-pile"),
  hand: document.querySelector("#hand"),
  melds: document.querySelector("#melds"),
  gameReview: document.querySelector("#game-review"),
  gameReviewRows: document.querySelector("#game-review-rows"),
  gameReviewSummary: document.querySelector("#game-review-summary"),
  gameReviewMethod: document.querySelector("#game-review-method"),
  newGame: document.querySelector("#new-game"),
  patternReference: document.querySelector("#pattern-reference"),
  showPatternExamples: document.querySelector("#show-pattern-examples"),
  showBotHands: document.querySelector("#show-bot-hands"),
  botNarrationEnabled: document.querySelector("#bot-narration-enabled"),
  showSymbolGuide: document.querySelector("#show-symbol-guide"),
  symbolReference: document.querySelector("#symbol-reference"),
  symbolTableBody: document.querySelector("#symbol-table-body"),
  turnNarration: document.querySelector("#turn-narration"),
  privacyCopy: document.querySelector("#privacy-copy"),
  privacyReady: document.querySelector("#privacy-ready"),
  privacyScreen: document.querySelector("#privacy-screen"),
  privacyTitle: document.querySelector("#privacy-title"),
  roundLabel: document.querySelector("#round-label"),
  tutorEnabled: document.querySelector("#tutor-enabled"),
  tutorNote: document.querySelector("#tutor-note"),
  turnMessage: document.querySelector("#turn-message"),
  voiceEnabled: document.querySelector("#voice-enabled"),
  wallCount: document.querySelector("#wall-count"),
  wallDisplay: document.querySelector("#wall-display"),
  variantNote: document.querySelector("#variant-note"),
  variantSelect: document.querySelector("#variant-select")
};

const playerAreas = PLAYER_NAMES.map((_, index) =>
  document.querySelector(`#player-${index}`)
);

let game;
let botTimer = null;
let activeNarrationUtterance = null;
let activeNarrationPlayerIndex = null;
let humanHandOrder = [];
let draggedHandTileId = null;
let pendingTileAnimations = [];
let readyTileAnimations = [];
const heldTileGhosts = new Map();
const speechAvailable = typeof window.speechSynthesis !== "undefined" &&
  typeof window.SpeechSynthesisUtterance === "function";
let voiceEnabled = speechAvailable;
const BOT_MOVE_DELAY_MS = 550;
const REVIEW_SIMULATION_COUNT = 120;

/** Creates the physical tile set for a ruleset. */
function createTiles(variantId) {
  const tiles = [];
  let id = 0;
  const variant = VARIANTS[variantId] ?? VARIANTS["chinese-classical"];

  for (const suit of SUITS) {
    for (let value = 1; value <= 9; value += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        tiles.push({
          id: id++,
          type: suit.id,
          value,
          label: `${value}${suit.symbol}`,
          sort: SUITS.indexOf(suit) * 10 + value
        });
      }
    }
  }

  for (let value = 0; value < WINDS.length; value += 1) {
    for (let copy = 0; copy < 4; copy += 1) {
      tiles.push({
        id: id++,
        type: "wind",
        value,
        label: ["東", "南", "西", "北"][value],
        sort: 30 + value
      });
    }
  }

  for (let value = 0; value < DRAGONS.length; value += 1) {
    for (let copy = 0; copy < 4; copy += 1) {
      tiles.push({
        id: id++,
        type: "dragon",
        value,
        label: ["中", "發", "白"][value],
        sort: 34 + value
      });
    }
  }

  if (variant.flowers) {
    const flowers = ["Spring", "Summer", "Autumn", "Winter", "Plum", "Orchid", "Bamboo", "Chrysanthemum"];
    for (let value = 0; value < flowers.length; value += 1) {
      tiles.push({
        id: id++,
        type: "flower",
        value,
        label: `F${value + 1}`,
        sort: 40 + value
      });
    }
  }

  if (variant.jokers) {
    for (let copy = 0; copy < 8; copy += 1) {
      tiles.push({
        id: id++,
        type: "joker",
        value: 0,
        label: "J",
        sort: 50
      });
    }
  }

  return tiles;
}

/** Shuffles a tile array in place. */
function shuffle(tiles) {
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [tiles[index], tiles[swapIndex]] = [tiles[swapIndex], tiles[index]];
  }
  return tiles;
}

/** Resets the table, deals a hand, and starts the dealer's turn. */
function newGame(dealer = 0, handNumber = 1, variantId = elements.variantSelect.value) {
  humanHandOrder = [];
  draggedHandTileId = null;
  if (botTimer !== null) {
    clearTimeout(botTimer);
    botTimer = null;
  }
  clearTileAnimationGhosts();
  pendingTileAnimations = [];
  readyTileAnimations = [];
  if (speechAvailable) {
    window.speechSynthesis.cancel();
    activeNarrationUtterance = null;
    clearSpokenWordFocus();
    clearNarrationFocus();
  }
  const activeVariantId = VARIANTS[variantId] ? variantId : "chinese-classical";
  const variant = VARIANTS[activeVariantId];
  const wall = shuffle(createTiles(activeVariantId));
  const players = PLAYER_NAMES.map((name, index) => ({
    name,
    direction: WINDS[(index - dealer + 4) % 4],
    hand: [],
    melds: [],
    flowers: [],
    riichi: false,
    riichiPending: false,
    lastDrawnTileId: null,
    drawnTileId: null
  }));

  for (let tile = 0; tile < variant.initialHandSize; tile += 1) {
    for (const player of players) {
      let dealtTile = wall.pop();
      while (dealtTile && dealtTile.type === "flower" && variant.flowersReplace) {
        player.flowers.push(dealtTile);
        dealtTile = wall.pop();
      }
      if (dealtTile) {
        player.hand.push(dealtTile);
      }
    }
  }

  game = {
    players,
    wall,
    discards: [],
    dealer,
    current: dealer,
    phase: "discard",
    claimQueue: [],
    claimIndex: 0,
    pendingDiscard: null,
    winner: null,
    handNumber,
    privacyRequired: false,
    variantId: activeVariantId,
    riichiSticks: 0,
    winningGroups: null,
    reviewCurrentDecision: null,
    reviewTurns: [],
    reviewOpen: false
  };
  elements.gameReview.hidden = true;
  updateVariantNote();
  drawFor(dealer, false);
  render();
  if (game.current === 0 && game.phase === "discard") {
    const drawnTile = game.players[0].hand.find((tile) =>
      tile.id === game.players[0].drawnTileId
    );
    const message = drawnTile
      ? `Your turn. You drew the ${tileDescription(drawnTile)}.`
      : "Your turn.";
    narrateTurn(message, {
      playerIndex: 0,
      cues: drawnTile
        ? [{
          text: tileDescription(drawnTile),
          tileIds: [drawnTile.id],
          animation: "draw"
        }]
        : []
    });
  }
  scheduleBotTurn();
}

/** Draws for a player, replacing bonus flowers when the ruleset requires it. */
function drawFor(playerIndex, announceHuman = true) {
  const player = game.players[playerIndex];
  const variant = VARIANTS[game.variantId];
  let tile = null;
  while (game.wall.length > 0) {
    tile = game.wall.pop();
    if (tile.type === "flower" && variant.flowersReplace) {
      player.flowers.push(tile);
      tile = null;
      continue;
    }
    break;
  }
  if (tile === null) {
    game.phase = "draw";
    game.current = 0;
    game.privacyRequired = false;
    player.drawnTileId = null;
    narrateTurn("No tiles left. The hand is a draw.", { playerIndex });
    return;
  }
  player.hand.push(tile);
  pendingTileAnimations.push({ type: "draw", playerIndex, tileId: tile.id });
  player.drawnTileId = tile.id;
  player.lastDrawnTileId = tile.id;
  game.current = playerIndex;
  game.phase = "discard";
  game.privacyRequired = false;
  if (playerIndex === 0 && announceHuman) {
    narrateTurn(`You draw the ${tileDescription(tile)}.`, {
      playerIndex,
      cues: [{
        text: tileDescription(tile),
        tileIds: [tile.id],
        animation: "draw"
      }]
    });
  }
}

/** Waits for the human to draw, while bots continue drawing automatically. */
function beginPlayerDraw(playerIndex) {
  if (playerIndex === 0 && game.wall.length > 0) {
    game.current = 0;
    game.phase = "awaiting-draw";
    game.players[0].drawnTileId = null;
    game.privacyRequired = false;
    return;
  }
  drawFor(playerIndex);
}

/** Draws a tile when the human confirms the pending draw action. */
function drawHumanTile() {
  if (game.current !== 0 || game.phase !== "awaiting-draw") {
    return;
  }
  drawFor(0);
  render();
  scheduleBotTurn();
}

/** Returns the matching key used to count a tile type and value. */
function tileKey(tile) {
  const value = tile.type === "flower" ? 0 : tile.value;
  return `${tile.type}-${value}`;
}

/** Checks whether two tiles match, treating all flowers as one group. */
function sameTile(first, second) {
  if (first.type === "flower" && second.type === "flower") {
    return true;
  }
  return first.type === second.type && first.value === second.value;
}

/** Returns a copy of a hand sorted into display order. */
function sortedHand(hand) {
  return [...hand].sort((first, second) => first.sort - second.sort || first.id - second.id);
}

/** Maps a tile type to its visual CSS class. */
function tileClass(tile) {
  if (tile.type === "joker") {
    return "joker";
  }
  if (tile.type === "flower") {
    return "flower";
  }
  if (["characters", "circles", "bamboo"].includes(tile.type)) {
    return tile.type;
  }
  return "honors";
}

/** Creates a tile face element with its label and accessible description. */
function makeTile(tile, small = false) {
  const face = document.createElement("span");
  face.className = `tile ${tileClass(tile)}${small ? " small" : ""}`;
  face.dataset.tileId = String(tile.id);
  face.textContent = tile.label;
  face.title = tileDescription(tile);
  return face;
}

/** Produces the spoken and accessible name for a tile. */
function tileDescription(tile) {
  if (tile.type === "joker") {
    return "Joker";
  }
  if (tile.type === "flower") {
    return `${["Spring", "Summer", "Autumn", "Winter", "Plum", "Orchid", "Bamboo", "Chrysanthemum"][tile.value]} flower`;
  }
  if (tile.type === "wind") {
    return `${WINDS[tile.value]} wind`;
  }
  if (tile.type === "dragon") {
    return `${DRAGONS[tile.value]} dragon`;
  }
  return `${tile.value} of ${SUITS.find((suit) => suit.id === tile.type).label}`;
}

/** Builds the two-row legend for tile symbols. */
function renderSymbolGuide() {
  const symbols = [
    { type: "characters", symbol: "萬", name: "Characters suit" },
    { type: "circles", symbol: "筒", name: "Circles suit" },
    { type: "bamboo", symbol: "索", name: "Bamboo suit" },
    ...WINDS.map((wind, value) => ({
      type: "wind",
      symbol: ["東", "南", "西", "北"][value],
      name: `${wind} wind`
    })),
    ...DRAGONS.map((dragon, value) => ({
      type: "dragon",
      symbol: ["中", "發", "白"][value],
      name: `${dragon} dragon`
    })),
    { type: "flower", symbol: "F", name: "Flower bonus" },
    { type: "joker", symbol: "J", name: "Joker" }
  ];

  const rows = [];
  for (let start = 0; start < symbols.length; start += 6) {
    const row = document.createElement("tr");
    for (const { type, symbol: label, name } of symbols.slice(start, start + 6)) {
      const cell = document.createElement("td");
      const entry = document.createElement("div");
      const face = document.createElement("span");
      const nameLabel = document.createElement("span");

      entry.className = "symbol-entry";
      face.className = `tile ${tileClass({ type })} small`;
      face.textContent = label;
      face.setAttribute("aria-hidden", "true");
      nameLabel.className = "symbol-name";
      nameLabel.textContent = name;
      entry.append(face, nameLabel);
      cell.append(entry);
      row.append(cell);
    }
    rows.push(row);
  }

  elements.symbolTableBody.replaceChildren(...rows);
}

/** Renders the current game state and stages its tile animations. */
function render() {
  ensureReviewDecision();
  const recommendation = getTutorRecommendation();
  renderPlayers();
  renderDiscards();
  renderHand(recommendation);
  renderMelds();
  renderActions();
  renderTutor(recommendation);
  elements.roundLabel.textContent =
    `Hand ${game.handNumber} · Dealer: ${game.players[game.dealer].name} · ${VARIANTS[game.variantId].label}`;
  renderWall();
  updateVariantNote();
  elements.privacyScreen.hidden = !game.privacyRequired;
  if (game.privacyRequired) {
    const player = game.players[game.current];
    elements.privacyTitle.textContent = game.phase === "claim"
      ? `${player.name}: check for a claim`
      : `Pass to ${player.name}`;
    elements.privacyCopy.textContent = game.phase === "claim"
      ? "Only this player should look at the screen. Check your hand, then choose a claim or pass."
      : "Keep your tiles private. When the device is ready, reveal this player’s hand.";
  }
  updateTurnMessage();
  preparePendingTileAnimations();
}

/** Renders the remaining face-down tiles in the wall. */
function renderWall() {
  elements.wallCount.textContent = `${game.wall.length} tiles in wall`;
  const tile = document.createElement("span");
  tile.className = "tile bot-hidden-tile wall-tile";
  tile.setAttribute("aria-hidden", "true");
  elements.wallDisplay.replaceChildren(tile);
}

/** Captures tile positions and queues animations for the next render. */
function preparePendingTileAnimations() {
  if (pendingTileAnimations.length === 0) {
    return;
  }
  const animations = pendingTileAnimations;
  pendingTileAnimations = [];
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    readyTileAnimations = [];
    clearTileAnimationGhosts();
    return;
  }
  for (const animation of animations) {
    let target;
    if (animation.type === "draw") {
      target = playerAreas[animation.playerIndex].querySelector(
        `.player-hand [data-tile-id="${animation.tileId}"]`
      );
      if (target) {
        readyTileAnimations.push({
          ...animation,
          handRect: snapshotRect(target.getBoundingClientRect()),
          tileTemplate: target.cloneNode(true)
        });
      }
    } else if (animation.type === "discard") {
      target = elements.discardPile.querySelector(
        `[data-tile-id="${animation.tileId}"]`
      );
      if (target) {
        readyTileAnimations.push({
          ...animation
        });
      }
    }
  }
  if (!voiceEnabled || !speechAvailable) {
    playReadyTileAnimationsImmediately();
  }
}

/** Copies a DOM rectangle into a plain object for later animation. */
function snapshotRect(rect) {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

/** Finds the wall's center point as the source for a draw animation. */
function wallSourceRect(targetRect) {
  const wallDisplay = elements.wallDisplay.getBoundingClientRect();
  if (!wallDisplay.width || !wallDisplay.height) {
    return null;
  }
  const width = targetRect.width * 0.65;
  const height = targetRect.height * 0.65;
  return {
    left: wallDisplay.left + wallDisplay.width / 2 - width / 2,
    top: wallDisplay.top + wallDisplay.height / 2 - height / 2,
    width,
    height
  };
}

/** Plays queued tile animations that match a narration cue. */
function playTileAnimationCue(type, tileIds) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    readyTileAnimations = [];
    clearTileAnimationGhosts();
    return;
  }
  const ids = new Set(tileIds.map(String));
  const matches = [];
  readyTileAnimations = readyTileAnimations.filter((animation) => {
    if (animation.type === type && ids.has(String(animation.tileId))) {
      matches.push(animation);
      return false;
    }
    return true;
  });
  for (const animation of matches) {
    if (type === "draw") {
      animateDrawnTile(animation);
    } else if (type === "discard") {
      animateDiscardedTile(animation);
    }
  }
}

/** Animates a drawn tile from the wall into its hand position. */
function animateDrawnTile(animation) {
  const selector = `[data-tile-id="${animation.tileId}"]`;
  const handTile = playerAreas[animation.playerIndex].querySelector(
    `.player-hand ${selector}`
  );
  const visibleTile = playerAreas[animation.playerIndex].querySelector(selector);
  const sourceRect = wallSourceRect(animation.handRect);
  if (!sourceRect) {
    return;
  }
  if (handTile) {
    animateTileFlight(handTile, sourceRect);
    return;
  }
  if (visibleTile && !elements.discardPile.contains(visibleTile)) {
    animateTileFlight(visibleTile, sourceRect);
    return;
  }
  const nextDiscard = readyTileAnimations.find((candidate) =>
    candidate.type === "discard" && candidate.tileId === animation.tileId
  );
  const discardTile = elements.discardPile.querySelector(selector);
  if (!discardTile || !nextDiscard) {
    animateDetachedDraw(animation, sourceRect);
    return;
  }
  const ghost = createTileGhost(animation.tileTemplate, animation.handRect);
  const held = { element: ghost, handRect: animation.handRect, animation: null };
  heldTileGhosts.set(animation.tileId, held);
  discardTile.style.visibility = "hidden";
  held.discardTile = discardTile;
  if (discardTile.classList.contains("voice-focus")) {
    ghost.classList.add("voice-focus");
  }
  held.animation = animateOverlayTile(
    ghost,
    sourceRect,
    animation.handRect,
    480
  );
  if (!held.animation) {
    ghost.remove();
    discardTile.style.visibility = "";
    heldTileGhosts.delete(animation.tileId);
  }
}

/** Animates a discarded tile into the center discard pile. */
function animateDiscardedTile(animation) {
  const tile = elements.discardPile.querySelector(
    `[data-tile-id="${animation.tileId}"]`
  );
  if (!tile) {
    return;
  }
  const held = heldTileGhosts.get(animation.tileId);
  if (held) {
    held.animation?.cancel();
    tile.style.visibility = "hidden";
    if (tile.classList.contains("voice-focus")) {
      held.element.classList.add("voice-focus");
    }
    const destination = snapshotRect(tile.getBoundingClientRect());
    const flight = animateOverlayTile(
      held.element,
      held.handRect,
      destination,
      360
    );
    if (flight) {
      flight.onfinish = () => {
        held.element.remove();
        tile.style.visibility = "";
        heldTileGhosts.delete(animation.tileId);
      };
    } else {
      held.element.remove();
      tile.style.visibility = "";
      heldTileGhosts.delete(animation.tileId);
    }
    return;
  }
  animateTileFlight(tile, animation.sourceRect);
}

/** Shows a temporary tile flight when the drawn tile is no longer in the DOM. */
function animateDetachedDraw(animation, sourceRect) {
  const ghost = createTileGhost(animation.tileTemplate, animation.handRect);
  const flight = animateOverlayTile(ghost, sourceRect, animation.handRect, 480);
  if (flight) {
    flight.onfinish = () => ghost.remove();
  } else {
    ghost.remove();
  }
}

/** Creates a fixed-position visual copy used during tile flights. */
function createTileGhost(template, rect) {
  const ghost = template.cloneNode(true);
  ghost.classList.add("tile-flight-ghost");
  ghost.removeAttribute("data-tile-id");
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    pointerEvents: "none",
    transform: "none",
    transformOrigin: "center center",
    zIndex: "1000"
  });
  document.body.append(ghost);
  return ghost;
}

/** Animates an overlay tile between two screen positions. */
function animateOverlayTile(tile, sourceRect, destinationRect, duration) {
  if (typeof tile.animate !== "function") {
    return null;
  }
  Object.assign(tile.style, {
    left: `${destinationRect.left}px`,
    top: `${destinationRect.top}px`,
    width: `${destinationRect.width}px`,
    height: `${destinationRect.height}px`
  });
  const offsetX = sourceRect.left + sourceRect.width / 2 -
    (destinationRect.left + destinationRect.width / 2);
  const offsetY = sourceRect.top + sourceRect.height / 2 -
    (destinationRect.top + destinationRect.height / 2);
  const scaleX = sourceRect.width / destinationRect.width;
  const scaleY = sourceRect.height / destinationRect.height;
  return tile.animate([
    {
      opacity: 0.7,
      transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})`
    },
    { opacity: 1, transform: "none" }
  ], {
    duration,
    easing: "cubic-bezier(0.22, 0.75, 0.28, 1)",
    fill: "forwards"
  });
}

/** Animates a visible tile from its saved source position to its current one. */
function animateTileFlight(tile, sourceRect) {
  if (typeof tile.animate !== "function") {
    return;
  }
  const targetRect = tile.getBoundingClientRect();
  const offsetX = sourceRect.left + sourceRect.width / 2 -
    (targetRect.left + targetRect.width / 2);
  const offsetY = sourceRect.top + sourceRect.height / 2 -
    (targetRect.top + targetRect.height / 2);
  const scaleX = sourceRect.width / targetRect.width;
  const scaleY = sourceRect.height / targetRect.height;
  tile.animate([
    {
      opacity: 0.7,
      transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})`
    },
    { opacity: 1, transform: "scale(1)" }
  ], {
    duration: tile.classList.contains("discard-tile") ? 360 : 480,
    easing: "cubic-bezier(0.22, 0.75, 0.28, 1)"
  });
}

/** Flushes queued tile movements when narration is skipped or finished. */
function playReadyTileAnimationsImmediately() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    readyTileAnimations = [];
    clearTileAnimationGhosts();
    return;
  }
  if (readyTileAnimations.length === 0) {
    return;
  }
  const animations = readyTileAnimations;
  readyTileAnimations = [];
  const discardIds = new Set(
    animations
      .filter((animation) => animation.type === "discard")
      .map((animation) => animation.tileId)
  );
  for (const [tileId, held] of heldTileGhosts) {
    held.animation?.cancel();
    held.element.remove();
    if (held.discardTile?.isConnected) {
      held.discardTile.style.visibility = "";
    }
    heldTileGhosts.delete(tileId);
  }
  for (const animation of animations) {
    if (animation.type !== "draw" || discardIds.has(animation.tileId)) {
      continue;
    }
    const tile = playerAreas[animation.playerIndex].querySelector(
      `[data-tile-id="${animation.tileId}"]`
    );
    if (tile) {
      const sourceRect = wallSourceRect(snapshotRect(tile.getBoundingClientRect()));
      if (sourceRect) {
        animateTileFlight(tile, sourceRect);
      }
    }
  }
  for (const animation of animations) {
    if (animation.type !== "discard") {
      continue;
    }
    const tile = elements.discardPile.querySelector(
      `[data-tile-id="${animation.tileId}"]`
    );
    if (tile) {
      animateTileFlight(tile, animation.sourceRect);
    }
  }
}

/** Removes temporary tile copies and restores any hidden discard tiles. */
function clearTileAnimationGhosts() {
  for (const [tileId, held] of heldTileGhosts) {
    held.animation?.cancel();
    held.element.remove();
    if (held.discardTile?.isConnected) {
      held.discardTile.style.visibility = "";
    }
    heldTileGhosts.delete(tileId);
  }
}

/** Returns the player's discard advice when the current state allows it. */
function getTutorRecommendation() {
  if (!elements.tutorEnabled.checked || game.current !== 0 || game.privacyRequired || game.winner !== null ||
      game.phase !== "discard") {
    return null;
  }
  const player = game.players[0];
  if (isWinningHand(player.hand, player.melds.length, game.variantId, player, "self-draw")) {
    return {
      tile: null,
      explanation: "Your hand is complete. Declare win instead of discarding."
    };
  }
  return recommendDiscard(player);
}

/** Displays tutor advice, claim choices, and the current hand outcome. */
function renderTutor(recommendation) {
  elements.tutorNote.textContent = "";
  if (!elements.tutorEnabled.checked) {
    return;
  }
  if (game.winner !== null) {
    elements.tutorNote.textContent = `${game.players[game.winner].name} won. Start the next hand when ready.`;
    return;
  }
  if (game.current !== 0) {
    return;
  }
  if (game.phase === "claim") {
    const options = game.claimQueue[game.claimIndex]?.options ?? [];
    if (options.some((option) => option.type === "win")) {
      elements.tutorNote.textContent = "You can win on this discard. Choose Win to end the hand.";
    } else {
      const available = options.map(claimLabel).join(", ");
      elements.tutorNote.textContent = `Available claim${options.length === 1 ? "" : "s"}: ${available}. Claim only if it improves your hand; otherwise choose Pass.`;
    }
    return;
  }
  if (recommendation?.tile) {
    elements.tutorNote.textContent =
      `Suggested discard: ${tileDescription(recommendation.tile)}. ${recommendation.explanation}`;
  } else if (recommendation) {
    elements.tutorNote.textContent = recommendation.explanation;
  }
}

/** Renders each player's seat, hand, score, and exposed melds. */
function renderPlayers() {
  for (let index = 0; index < game.players.length; index += 1) {
    const player = game.players[index];
    const isWinner = game.winner === index;
    const hiddenBotHand = index !== 0 && !elements.showBotHands.checked && !isWinner;
    const area = playerAreas[index];
    area.replaceChildren();
    area.style.gridArea = DIRECTION_AREAS[player.direction];
    area.classList.toggle(
      "active",
      game.winner === null && game.current === index && game.phase !== "draw"
    );

    const header = document.createElement("div");
    header.className = "player-header";
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${player.direction} · ${player.name}`;
    const score = document.createElement("span");
    score.className = "player-score";
    score.textContent = `Score ${playerScores[index]}`;
    header.append(name, score);

    const info = document.createElement("span");
    info.className = "player-info";
    const flowerCount = player.flowers.length > 0 ? ` · ${player.flowers.length} flowers` : "";
    const riichi = player.riichi ? " · Riichi" : "";
    info.textContent = isWinner
      ? "Winning hand"
      : `${player.hand.length} tiles · ${player.melds.length} melds${flowerCount}${riichi}`;

    const tiles = document.createElement("div");
    tiles.className = "player-hand";
    tiles.setAttribute(
      "aria-label",
      isWinner
        ? `${player.name}'s winning hand`
        : hiddenBotHand
          ? `${player.name}'s hand with concealed tiles hidden`
          : `${player.name}'s face-up tiles`
    );
    /** Appends a face-up tile and marks a bot's latest draw when appropriate. */
    const appendTile = (
      tile,
      target = tiles,
      lastDrawnTileId = player.lastDrawnTileId,
      drawContext = "Bot's latest draw"
    ) => {
      const face = makeTile(tile, true);
      const hideBotTile = hiddenBotHand &&
        (target === tiles || target.classList.contains("winning-group"));
      if (hideBotTile) {
        face.classList.add("bot-hidden-tile");
        face.textContent = "";
        face.title = "Hidden bot tile";
        face.setAttribute("aria-label", "Hidden bot tile");
      }
      if (index !== 0 && tile.id === lastDrawnTileId) {
        face.classList.add("bot-drawn-tile");
        face.title = hideBotTile
          ? "Bot's latest draw"
          : `${drawContext}: ${tileDescription(tile)}`;
        face.setAttribute("aria-label", face.title);
      }
      target.append(face);
    };
    if (isWinner && game.winningGroups) {
      for (const winningGroup of game.winningGroups) {
        const group = document.createElement("div");
        const isPair = winningGroup.type === "pair";
        group.className = `winning-group ${isPair ? "winning-pair" : "winning-meld"}`;
        group.setAttribute("role", "group");
        group.setAttribute(
          "aria-label",
          hiddenBotHand
            ? isPair ? "Hidden winning pair" : "Hidden winning meld"
            : isPair ? "Winning pair" : `Winning meld: ${winningGroup.label}`
        );
        for (const tile of winningGroup.tiles) {
          appendTile(
            tile,
            group,
            winningGroup.lastDrawnTileId ?? player.lastDrawnTileId,
            "Drawn tile used in this meld"
          );
        }
        tiles.append(group);
      }
    } else {
      for (const tile of sortedHand(player.hand)) {
        appendTile(tile);
      }
      for (const meld of player.melds) {
        const group = document.createElement("div");
        group.className = `player-meld${meld.concealed ? " concealed" : ""}`;
        group.setAttribute(
          "aria-label",
          `${meld.concealed ? "Concealed" : "Open"} ${meld.type}`
        );
        for (const tile of meld.tiles) {
          appendTile(tile, group, meld.lastDrawnTileId, "Drawn tile used in this meld");
        }
        tiles.append(group);
      }
    }
    if (player.flowers.length > 0) {
      const flowers = document.createElement("div");
      flowers.className = "player-meld flower-group";
      flowers.setAttribute("aria-label", "Bonus flowers");
      for (const tile of player.flowers) {
        flowers.append(makeTile(tile, true));
      }
      tiles.append(flowers);
    }
    area.append(header, info, tiles);
  }
}

/** Renders the shared discard pile and its claim state. */
function renderDiscards() {
  const previousDiscardCount = elements.discardPile.children.length;
  elements.discardPile.replaceChildren();
  for (const discard of game.discards) {
    const tile = makeTile(discard.tile, true);
    tile.classList.add("discard-tile");
    if (discard.wasDrawnByBot) {
      tile.classList.add("bot-drawn-tile", "bot-drawn-discard");
      tile.title = `Bot's drawn tile, discarded: ${tileDescription(discard.tile)}`;
      tile.setAttribute("aria-label", tile.title);
    }
    if (discard.claimed) {
      tile.style.opacity = "0.35";
    }
    elements.discardPile.append(tile);
  }
  if (game.discards.length !== previousDiscardCount) {
    elements.discardPile.scrollLeft = game.discards.length > previousDiscardCount
      ? elements.discardPile.scrollWidth
      : 0;
  }
}

/** Renders the human player's hand and its discard guidance. */
function renderHand(recommendation) {
  elements.hand.replaceChildren();
  if (game.privacyRequired || game.current !== 0 || game.winner !== null ||
      game.phase === "draw") {
    return;
  }
  const player = game.players[game.current];
  for (const tile of orderedHumanHand(player.hand)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tile ${tileClass(tile)}`;
    const canDiscard = game.phase === "discard";
    button.disabled = !canDiscard;
    button.draggable = canDiscard;
    if (canDiscard) {
      button.setAttribute("aria-describedby", "hand-help");
      button.setAttribute("aria-keyshortcuts", "Alt+ArrowLeft Alt+ArrowRight");
      button.setAttribute(
        "aria-description",
        "Drag to reorder, or press Alt+Left or Alt+Right to move this tile. Click to discard."
      );
    }
    if (recommendation?.tile?.id === tile.id) {
      button.classList.add("recommended");
    }
    button.textContent = tile.label;
    button.title = canDiscard ? `Discard ${tileDescription(tile)}` : tileDescription(tile);
    button.setAttribute(
      "aria-label",
      canDiscard ? `Discard ${tileDescription(tile)}` : `In your hand: ${tileDescription(tile)}`
    );
    button.dataset.tileId = String(tile.id);
    button.addEventListener("click", () => discardTile(tile.id));
    elements.hand.append(button);
  }
}

/** Returns the human's hand in saved display order, adding new tiles at the end. */
function orderedHumanHand(hand) {
  const tiles = sortedHand(hand);
  const tilesById = new Map(tiles.map((tile) => [tile.id, tile]));
  humanHandOrder = humanHandOrder.filter((tileId) => tilesById.has(tileId));
  const orderedIds = new Set(humanHandOrder);
  for (const tile of tiles) {
    if (!orderedIds.has(tile.id)) {
      humanHandOrder.push(tile.id);
      orderedIds.add(tile.id);
    }
  }
  return humanHandOrder.map((tileId) => tilesById.get(tileId));
}

/** Saves the current human-hand tile order after rearranging it. */
function saveHumanHandOrderFromDOM() {
  humanHandOrder = Array.from(
    elements.hand.querySelectorAll("button[data-tile-id]"),
    (button) => Number(button.dataset.tileId)
  );
}

/** Renders the human player's exposed melds. */
function renderMelds() {
  elements.melds.replaceChildren();
  if (game.privacyRequired || game.current !== 0) {
    return;
  }
  for (const meld of game.players[game.current].melds) {
    const group = document.createElement("div");
    group.className = "meld-group";
    for (const tile of meld.tiles) {
      group.append(makeTile(tile, true));
    }
    elements.melds.append(group);
  }
  const flowers = game.players[game.current].flowers;
  if (flowers.length > 0) {
    const group = document.createElement("div");
    group.className = "meld-group flower-group";
    group.setAttribute("aria-label", "Bonus flowers");
    for (const tile of flowers) {
      group.append(makeTile(tile, true));
    }
    elements.melds.append(group);
  }
}

/** Shows the actions currently available to the human player. */
function renderActions() {
  elements.actions.replaceChildren();
  if (game.winner !== null) {
    addAction(game.reviewOpen ? "Hide game review" : "Game review", toggleGameReview, true);
    addAction("Next hand", nextHand);
    return;
  }
  if (game.privacyRequired || game.current !== 0) {
    return;
  }
  if (game.phase === "claim") {
    const options = game.claimQueue[game.claimIndex]?.options ?? [];
    if (options.some((option) => option.type === "win")) {
      addAction("Win", declareClaimWin);
    }
    for (const option of options) {
      if (option.type === "win") {
        continue;
      }
      addAction(claimLabel(option), () => claimMeld(option));
    }
    addAction("Pass", passClaim, true);
    return;
  }
  if (game.phase === "awaiting-draw") {
    addAction("Draw", drawHumanTile);
    return;
  }
  if (game.phase === "draw") {
    addAction(game.reviewOpen ? "Hide game review" : "Game review", toggleGameReview, true);
    addAction("Start next hand", nextHand);
    return;
  }
  if (game.phase === "discard") {
    const player = game.players[game.current];
    if (isWinningHand(player.hand, player.melds.length, game.variantId, player, "self-draw")) {
      addAction("Declare win", declareSelfDraw);
    }
    if (canDeclareRiichi(player)) {
      addAction("Declare Riichi", declareRiichi, true);
    }
    if (findConcealedKong(player)) {
      addAction("Kong", declareConcealedKong, true);
    }
  }
}

/** Opens or closes the completed-hand review. */
function toggleGameReview() {
  if (game.winner === null && game.phase !== "draw") {
    return;
  }
  game.reviewOpen = !game.reviewOpen;
  elements.gameReview.hidden = !game.reviewOpen;
  if (game.reviewOpen) {
    renderGameReview();
  }
  renderActions();
}

/** Renders the human's recorded decisions and their estimated win chances. */
function renderGameReview() {
  const turns = game.reviewTurns;
  const matches = turns.filter((turn) => turn.matchedBest).length;
  elements.gameReviewSummary.textContent = turns.length === 0
    ? "No human decisions were recorded for this hand."
    : `Best-estimate matches (including ties): ${matches} of ${turns.length} decisions.`;
  elements.gameReviewMethod.textContent =
    `Review covers your discards and winning declarations; meld claims, passes, Riichi, and Kong choices are not scored. Method: ${REVIEW_SIMULATION_COUNT} seeded simulations per discard, using known discards, exposed melds, flowers, your hand, and bot hands when visible. Hidden bot tiles are treated as unavailable unseen tiles. Future bot draws consume tiles, but opponent wins, discards, and claims are not simulated; your future discards follow the tutor's tile-connection heuristic. These are approximate self-draw chances, not guaranteed optimal-play odds.`;

  const rows = turns.map((turn) => {
    const row = document.createElement("tr");
    const actualProbability = Number.isFinite(turn.actualProbability)
      ? `${turn.actualProbability.toFixed(1)}%`
      : "Unavailable";
    const bestProbability = Number.isFinite(turn.bestProbability)
      ? `${turn.bestProbability.toFixed(1)}%`
      : "Unavailable";
    const values = [
      turn.turn,
      turn.actualMove,
      turn.bestMove,
      actualProbability,
      bestProbability,
      turn.matchedBest
        ? "Best estimate / tied"
        : actualProbability === "Unavailable" || bestProbability === "Unavailable"
          ? "Estimate unavailable"
          : "A higher estimate was available"
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  elements.gameReviewRows.replaceChildren(...rows);
}

/** Adds a consistently styled action button to the controls. */
function addAction(label, handler, secondary = false, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (secondary) {
    button.classList.add("secondary");
  }
  button.disabled = disabled;
  button.addEventListener("click", handler);
  elements.actions.append(button);
}

/** Formats a readable label for a possible meld claim. */
function claimLabel(option) {
  if (option.type === "pung") {
    return "Pung";
  }
  if (option.type === "kong") {
    return "Kong";
  }
  if (option.type === "chow") {
    return `Chow ${option.tiles.map((tile) => tile.label).join(" ")}`;
  }
  return option.type;
}

/** Discards a selected tile and begins resolving claims and turn narration. */
function discardTile(tileId) {
  if (game.phase !== "discard" || game.privacyRequired) {
    return;
  }
  const player = game.players[game.current];
  const tileIndex = player.hand.findIndex((tile) => tile.id === tileId);
  if (tileIndex < 0) {
    return;
  }
  if (game.variantId === "japanese-riichi" && player.riichi &&
      !player.riichiPending && tileId !== player.drawnTileId) {
    elements.turnMessage.textContent = "After riichi, discard the tile you just drew.";
    return;
  }
  if (player.riichiPending) {
    const remaining = player.hand.filter((tile) => tile.id !== tileId);
    if (!isTenpai(remaining, player.melds.length, game.variantId)) {
      elements.turnMessage.textContent = "Choose a discard that leaves your hand ready (tenpai) to declare riichi.";
      return;
    }
  }
  if (game.current === 0) {
    recordHumanDiscard(player.hand[tileIndex]);
  }
  if (player.riichiPending) {
    player.riichiPending = false;
    game.riichiSticks += 1;
  }

  const sourceTile = playerAreas[game.current].querySelector(
    `.player-hand [data-tile-id="${tileId}"]`
  );
  const sourceRect = sourceTile?.getBoundingClientRect();
  if (sourceRect) {
    pendingTileAnimations.push({
      type: "discard",
      tileId,
      sourceRect: {
        left: sourceRect.left,
        top: sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height
      }
    });
  }
  const [tile] = player.hand.splice(tileIndex, 1);
  if (game.current === 0) {
    narrateTurn(`You discard the ${tileDescription(tile)}.`, {
      playerIndex: 0,
      cues: [{
        text: tileDescription(tile),
        tileIds: [tile.id],
        animation: "discard"
      }]
    });
  }
  const drawnTileId = player.drawnTileId;
  const wasDrawnByBot = game.current !== 0 && drawnTileId === tile.id;
  player.drawnTileId = null;
  const discard = { tile, player: game.current, claimed: false, wasDrawnByBot };
  game.discards.push(discard);
  game.pendingDiscard = discard;
  game.claimQueue = findClaims(discard);
  game.claimIndex = 0;
  if (game.claimQueue.length > 0) {
    game.phase = "claim";
    game.current = game.claimQueue[0].player;
    game.privacyRequired = false;
    render();
    scheduleBotTurn();
    return;
  }
  advanceAfterDiscard();
}

/** Finds legal claims against a discard and orders them by priority. */
function findClaims(discard) {
  const candidates = [];
  const variant = VARIANTS[game.variantId];
  for (let offset = 1; offset <= 3; offset += 1) {
    const playerIndex = (discard.player + offset) % 4;
    const player = game.players[playerIndex];
    const options = [];
    const withDiscard = [...player.hand, discard.tile];

    if (isWinningHand(withDiscard, player.melds.length, game.variantId, player, "discard")) {
      options.push({ type: "win" });
    }

    const canOpenMeld = variant.mode !== "riichi" || !player.riichi;
    const matching = player.hand.filter((tile) =>
      tile.type !== "joker" && sameTile(tile, discard.tile)
    );
    if (canOpenMeld && discard.tile.type !== "joker" && matching.length >= 2) {
      options.push({ type: "pung", tiles: matching.slice(0, 2) });
    }
    if (canOpenMeld && discard.tile.type !== "joker" && matching.length >= 3) {
      options.push({ type: "kong", tiles: matching.slice(0, 3) });
    }
    if (variant.mode !== "american" && canOpenMeld && offset === 1 &&
        ["characters", "circles", "bamboo"].includes(discard.tile.type)) {
      options.push(...findChows(player.hand, discard.tile));
    }
    if (options.length > 0) {
      candidates.push({ player: playerIndex, options, distance: offset });
    }
  }

  const claims = [];
  const tiers = [
    (option) => option.type === "win",
    (option) => option.type === "pung" || option.type === "kong",
    (option) => option.type === "chow"
  ];
  for (const matchesTier of tiers) {
    for (const candidate of candidates) {
      const options = candidate.options.filter(matchesTier);
      if (options.length > 0) {
        claims.push({ player: candidate.player, options });
      }
    }
  }
  return claims;
}

/** Finds every sequence the hand can form using the given discard. */
function findChows(hand, discard) {
  const options = [];
  for (let start = Math.max(1, discard.value - 2); start <= Math.min(7, discard.value); start += 1) {
    const values = [start, start + 1, start + 2].filter((value) => value !== discard.value);
    const used = [];
    let possible = true;
    for (const value of values) {
      const tile = hand.find((candidate) =>
        candidate.type === discard.type &&
        candidate.value === value &&
        !used.includes(candidate.id)
      );
      if (!tile) {
        possible = false;
        break;
      }
      used.push(tile.id);
    }
    if (possible) {
      const tiles = [...used.map((id) => hand.find((tile) => tile.id === id)), discard]
        .sort((first, second) => first.value - second.value);
      options.push({ type: "chow", tiles });
    }
  }
  return options;
}

/** Declines the current claim and advances to the next eligible player. */
function passClaim() {
  const claim = game.claimQueue[game.claimIndex];
  if (claim) {
    const discarder = game.pendingDiscard?.player;
    const source = discarder === undefined ? "the last discard" :
      `${possessivePlayerName(discarder)} discard`;
    const subject = claim.player === 0 ? "You" : game.players[claim.player].name;
    const verb = claim.player === 0 ? "pass" : "passes";
    const tile = game.pendingDiscard?.tile;
    if (claim.player === 0) {
      recordHumanWin("Claim winning discard");
    }
    narrateTurn(
      tile
        ? `${subject} ${verb} on the ${tileDescription(tile)}.`
        : `${subject} ${verb}.`,
      {
        playerIndex: claim.player,
        cues: tile
          ? [{
            text: tileDescription(tile),
            tileIds: [tile.id],
            animation: "discard"
          }]
          : []
      }
    );
  }
  game.claimIndex += 1;
  if (game.claimIndex < game.claimQueue.length) {
    game.current = game.claimQueue[game.claimIndex].player;
    game.privacyRequired = false;
    render();
    scheduleBotTurn();
    return;
  }
  game.claimQueue = [];
  game.claimIndex = 0;
  advanceAfterDiscard();
}

/** Applies a selected meld claim and starts the claimant's next action. */
function claimMeld(option) {
  const claim = game.claimQueue[game.claimIndex];
  if (!claim || option.type === "win") {
    return;
  }
  const player = game.players[claim.player];
  const discard = game.pendingDiscard;
  narrateClaimAction(claim.player, option, discard);
  const handTiles = option.tiles.filter((tile) => tile.id !== discard.tile.id);
  const drawnTileInMeld = handTiles.some((tile) => tile.id === player.lastDrawnTileId)
    ? player.lastDrawnTileId
    : null;
  const claimedFromHand = handTiles.map((tile) => tile.id);
  player.hand = player.hand.filter((tile) => !claimedFromHand.includes(tile.id));
  discard.claimed = true;
  player.melds.push({
    type: option.type,
    lastDrawnTileId: drawnTileInMeld,
    tiles: [...handTiles, discard.tile]
      .sort((first, second) => first.sort - second.sort)
  });
  game.current = claim.player;
  game.pendingDiscard = null;
  game.claimQueue = [];
  game.claimIndex = 0;

  if (option.type === "kong") {
    beginPlayerDraw(claim.player);
  } else {
    player.drawnTileId = null;
    game.phase = "discard";
    game.privacyRequired = false;
  }
  render();
  scheduleBotTurn();
}

/** Completes a win by claiming the current discard. */
function declareClaimWin() {
  const claim = game.claimQueue[game.claimIndex];
  if (!claim || !claim.options.some((option) => option.type === "win")) {
    return;
  }
  const discarder = game.pendingDiscard?.player;
  const source = discarder === undefined ? "the discard" :
    `${possessivePlayerName(discarder)} discard`;
  const subject = claim.player === 0 ? "You win" : `${game.players[claim.player].name} wins`;
  const tile = game.pendingDiscard?.tile;
  narrateTurn(
    tile
      ? `${subject} on the ${tileDescription(tile)}. Hand ends.`
      : `${subject} on ${source}. Hand ends.`,
    {
      playerIndex: claim.player,
      cues: tile
        ? [{
          text: tileDescription(tile),
          tileIds: [tile.id],
          animation: "discard"
        }]
        : []
    }
  );
  if (tile && game.pendingDiscard) {
    game.pendingDiscard.claimed = true;
    game.players[claim.player].hand.push(tile);
  }
  finishHand(claim.player, "wins on the discard");
}

/** Completes a win using the player's own drawn tile. */
function declareSelfDraw() {
  const player = game.players[game.current];
  if (game.phase === "discard" &&
      isWinningHand(player.hand, player.melds.length, game.variantId, player, "self-draw")) {
    if (game.current === 0) {
      recordHumanWin("Declare self-draw win");
    }
    const drawnTile = player.hand.find((tile) => tile.id === player.drawnTileId);
    const message = drawnTile
      ? game.current === 0
        ? `You win by self-draw with the ${tileDescription(drawnTile)}.`
        : `${player.name} wins by self-draw with the ${tileDescription(drawnTile)}.`
      : game.current === 0
        ? "You win by self-draw."
        : `${player.name} wins by self-draw.`;
    narrateTurn(message, {
      playerIndex: game.current,
      cues: drawnTile
        ? [{
          text: tileDescription(drawnTile),
          tileIds: [drawnTile.id],
          animation: "draw"
        }]
        : []
    });
    finishHand(game.current, "wins by self-draw");
  }
}

/** Declares riichi after confirming the player has a valid tenpai hand. */
function declareRiichi() {
  const player = game.players[game.current];
  if (!canDeclareRiichi(player)) {
    return;
  }
  if (game.current === 0) {
    narrateTurn("Riichi declared. Discard to stay ready.", {
      playerIndex: game.current
    });
  }
  player.riichi = true;
  player.riichiPending = true;
  render();
}

/** Declares a concealed Kong and draws its replacement tile. */
function declareConcealedKong() {
  if (game.phase !== "discard") {
    return;
  }
  const player = game.players[game.current];
  const tiles = findConcealedKong(player);
  if (!tiles) {
    return;
  }
  const drawnTile = player.hand.find((tile) => tile.id === player.drawnTileId);
  const ids = tiles.map((tile) => tile.id);
  const drawnTileInMeld = tiles.some((tile) => tile.id === player.lastDrawnTileId)
    ? player.lastDrawnTileId
    : null;
  let message;
  const cues = [];
  if (drawnTile && drawnTile.id === drawnTileInMeld) {
    message = game.current === 0
      ? `You complete a concealed Kong with the ${tileDescription(drawnTile)}.`
      : `${player.name} completes a concealed Kong with the ${tileDescription(drawnTile)}.`;
    cues.push({
      text: tileDescription(drawnTile),
      tileIds: [drawnTile.id],
      animation: "draw"
    });
  } else if (drawnTile) {
    message = game.current === 0
      ? `You draw the ${tileDescription(drawnTile)} and declare a concealed Kong.`
      : `${player.name} draws the ${tileDescription(drawnTile)} and declares a concealed Kong.`;
    cues.push({
      text: tileDescription(drawnTile),
      tileIds: [drawnTile.id],
      animation: "draw"
    });
  } else {
    message = game.current === 0
      ? "You declare a concealed Kong."
      : `${player.name} declares a concealed Kong.`;
  }
  cues.push({ text: "concealed Kong", tileIds: ids });
  narrateTurn(message, { playerIndex: game.current, cues });
  player.hand = player.hand.filter((tile) => !ids.includes(tile.id));
  player.melds.push({
    type: "kong",
    tiles,
    concealed: true,
    lastDrawnTileId: drawnTileInMeld
  });
  beginPlayerDraw(game.current);
  render();
  scheduleBotTurn();
}

/** Returns the four matching tiles needed for a concealed Kong, if present. */
function findConcealedKong(player) {
  if (game.variantId === "japanese-riichi" && player.riichi) {
    return null;
  }
  const counts = new Map();
  for (const tile of player.hand) {
    if (tile.type === "joker") {
      continue;
    }
    const key = tileKey(tile);
    const group = counts.get(key) ?? [];
    group.push(tile);
    counts.set(key, group);
  }
  return [...counts.values()].find((group) => group.length === 4) ?? null;
}

/** Advances play after a discard has no remaining claims. */
function advanceAfterDiscard() {
  const lastDiscard = game.pendingDiscard;
  const discarder = lastDiscard?.player ?? game.current;
  game.pendingDiscard = null;
  game.claimQueue = [];
  game.claimIndex = 0;
  const nextPlayer = (discarder + 1) % 4;
  if (lastDiscard) {
    const nextTurn = nextPlayer === 0
      ? "Your turn to draw."
      : `${game.players[nextPlayer].name}'s turn.`;
    narrateTurn(
      `No claim on the ${tileDescription(lastDiscard.tile)}. ${nextTurn}`,
      {
        playerIndex: nextPlayer,
          cues: [{
            text: tileDescription(lastDiscard.tile),
            tileIds: [lastDiscard.tile.id],
            animation: "discard"
          }]
      }
    );
  }
  beginPlayerDraw(nextPlayer);
  render();
  scheduleBotTurn();
}

/** Records a completed hand, its winner, score, and winning-tile groups. */
function finishHand(winner, message) {
  if (game.winner !== null) {
    return;
  }
  const player = game.players[winner];
  const concealedGroups = findWinningGroups(
    player.hand,
    player.melds.length,
    game.variantId
  );
  if (!concealedGroups) {
    throw new Error(`Could not group ${player.name}'s winning hand.`);
  }
  game.winningGroups = [
    ...player.melds.map((meld) => ({
      type: "meld",
      label: `${meld.concealed ? "concealed " : "open "}${meld.type}`,
      tiles: meld.tiles,
      lastDrawnTileId: meld.lastDrawnTileId
    })),
    ...concealedGroups
  ];
  playerScores[winner] += 1;
  game.winner = winner;
  game.phase = "over";
  game.privacyRequired = false;
  elements.turnMessage.textContent = `${game.players[winner].name} ${message}.`;
  render();
  elements.turnMessage.textContent = `${game.players[winner].name} ${message}.`;
}

/** Starts the next hand with the correct dealer and hand number. */
function nextHand() {
  newGame((game.dealer + 1) % 4, game.handNumber + 1);
}

/** Checks a complete hand against the selected rules and win conditions. */
function isWinningHand(hand, openMeldCount, variantId, player, winType) {
  if (!isWinningShape(hand, openMeldCount, variantId)) {
    return false;
  }
  if (VARIANTS[variantId].mode === "riichi") {
    return hasRiichiYaku(hand, player, winType);
  }
  return true;
}

/** Checks whether a hand has a winning tile shape for its ruleset. */
function isWinningShape(hand, openMeldCount, variantId) {
  const variant = VARIANTS[variantId];
  if (hand.length !== 2 + (variant.meldsToWin - openMeldCount) * 3) {
    return false;
  }
  if (variant.mode === "american") {
    return isAmericanWinningShape(hand, variant.meldsToWin - openMeldCount);
  }
  const counts = new Map();
  for (const tile of hand) {
    if (tile.type === "joker" || tile.type === "flower") {
      return false;
    }
    const key = tileKey(tile);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [pair, count] of counts) {
    if (count < 2) {
      continue;
    }
    counts.set(pair, count - 2);
    if (canFormMelds(counts)) {
      counts.set(pair, count);
      return true;
    }
    counts.set(pair, count);
  }
  return false;
}

/** Decomposes a winning hand into its pair and melds for highlighting. */
function findWinningGroups(hand, openMeldCount, variantId) {
  const variant = VARIANTS[variantId];
  const groupsToForm = variant.meldsToWin - openMeldCount;
  const naturalTiles = hand.filter((tile) => tile.type !== "joker");
  const checkedPairs = new Set();

  for (const tile of sortedHand(naturalTiles)) {
    const key = tileKey(tile);
    if (tile.type === "flower" || checkedPairs.has(key)) {
      continue;
    }
    checkedPairs.add(key);
    const pair = naturalTiles.filter((candidate) => sameTile(candidate, tile)).slice(0, 2);
    if (pair.length < 2) {
      continue;
    }
    const pairIds = new Set(pair.map((candidate) => candidate.id));
    const remaining = hand.filter((candidate) => !pairIds.has(candidate.id));
    const meldGroups = variant.mode === "american"
      ? findAmericanMeldGroups(remaining, groupsToForm)
      : findStandardMeldGroups(remaining);
    if (meldGroups?.length === groupsToForm) {
      return [{ type: "pair", label: "pair", tiles: pair }, ...meldGroups];
    }
  }
  return null;
}

/** Recursively partitions standard tiles into sequences and triplets. */
function findStandardMeldGroups(tiles) {
  const sorted = sortedHand(tiles);
  if (sorted.length === 0) {
    return [];
  }
  const first = sorted[0];
  const matching = sorted.filter((tile) => sameTile(tile, first));

  if (matching.length >= 3) {
    const group = matching.slice(0, 3);
    const ids = new Set(group.map((tile) => tile.id));
    const rest = findStandardMeldGroups(sorted.filter((tile) => !ids.has(tile.id)));
    if (rest) {
      return [{ type: "meld", label: "triplet", tiles: group }, ...rest];
    }
  }

  if (["characters", "circles", "bamboo"].includes(first.type)) {
    const second = sorted.find((tile) =>
      tile.type === first.type && tile.value === first.value + 1
    );
    const third = sorted.find((tile) =>
      tile.type === first.type && tile.value === first.value + 2
    );
    if (second && third) {
      const group = [first, second, third];
      const ids = new Set(group.map((tile) => tile.id));
      const rest = findStandardMeldGroups(sorted.filter((tile) => !ids.has(tile.id)));
      if (rest) {
        return [{ type: "meld", label: "sequence", tiles: group }, ...rest];
      }
    }
  }
  return null;
}

/** Groups American-style hand tiles into matching sets, using jokers as needed. */
function findAmericanMeldGroups(tiles, groupsLeft) {
  const naturals = sortedHand(tiles.filter((tile) => tile.type !== "joker"));
  const jokers = tiles.filter((tile) => tile.type === "joker");
  if (naturals.length === 0) {
    return jokers.length === 0 && groupsLeft === 0 ? [] : null;
  }
  if (groupsLeft === 0) {
    return null;
  }

  const first = naturals[0];
  const matching = naturals.filter((tile) => sameTile(tile, first));
  for (let groupSize = 3; groupSize <= 5; groupSize += 1) {
    for (let naturalCount = Math.min(matching.length, groupSize); naturalCount >= 1; naturalCount -= 1) {
      const jokersNeeded = groupSize - naturalCount;
      if (jokersNeeded > jokers.length) {
        continue;
      }
      const groupNaturals = matching.slice(0, naturalCount);
      const ids = new Set(groupNaturals.map((tile) => tile.id));
      const remainingNaturals = naturals.filter((tile) => !ids.has(tile.id));
      const rest = findAmericanMeldGroups(
        [...remainingNaturals, ...jokers.slice(jokersNeeded)],
        groupsLeft - 1
      );
      if (rest) {
        return [{
          type: "meld",
          label: "matching set",
          tiles: [...groupNaturals, ...jokers.slice(0, jokersNeeded)]
        }, ...rest];
      }
    }
  }
  return null;
}

/** Tests whether tile counts can be fully split into standard melds. */
function canFormMelds(counts) {
  let firstKey = null;
  for (const [key, count] of counts) {
    if (count > 0 && (firstKey === null || compareTileKeys(key, firstKey) < 0)) {
      firstKey = key;
    }
  }
  if (firstKey === null) {
    return true;
  }

  const [type, valueText] = firstKey.split("-");
  const value = Number(valueText);
  const count = counts.get(firstKey);

  if (count >= 3) {
    counts.set(firstKey, count - 3);
    if (canFormMelds(counts)) {
      counts.set(firstKey, count);
      return true;
    }
    counts.set(firstKey, count);
  }

  if (["characters", "circles", "bamboo"].includes(type) && value <= 7) {
    const nextKey = `${type}-${value + 1}`;
    const lastKey = `${type}-${value + 2}`;
    if ((counts.get(nextKey) ?? 0) > 0 && (counts.get(lastKey) ?? 0) > 0) {
      counts.set(firstKey, count - 1);
      counts.set(nextKey, counts.get(nextKey) - 1);
      counts.set(lastKey, counts.get(lastKey) - 1);
      if (canFormMelds(counts)) {
        counts.set(firstKey, count);
        counts.set(nextKey, counts.get(nextKey) + 1);
        counts.set(lastKey, counts.get(lastKey) + 1);
        return true;
      }
      counts.set(firstKey, count);
      counts.set(nextKey, counts.get(nextKey) + 1);
      counts.set(lastKey, counts.get(lastKey) + 1);
    }
  }
  return false;
}

/** Orders tile keys consistently for winning-hand group searches. */
function compareTileKeys(firstKey, secondKey) {
  const [firstType, firstValue] = firstKey.split("-");
  const [secondType, secondValue] = secondKey.split("-");
  const typeDifference = TILE_TYPE_ORDER.indexOf(firstType) - TILE_TYPE_ORDER.indexOf(secondType);
  return typeDifference || Number(firstValue) - Number(secondValue);
}

/** Validates the natural pair and matching groups in an American hand. */
function isAmericanWinningShape(hand, groupsToForm) {
  const counts = new Map();
  let jokers = 0;
  for (const tile of hand) {
    if (tile.type === "joker") {
      jokers += 1;
      continue;
    }
    const key = tileKey(tile);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const [pairKey, count] of counts) {
    if (count < 2 || pairKey.startsWith("flower-")) {
      continue;
    }
    counts.set(pairKey, count - 2);
    if (canFormAmericanGroups(counts, jokers, groupsToForm)) {
      counts.set(pairKey, count);
      return true;
    }
    counts.set(pairKey, count);
  }
  return false;
}

/** Recursively tests whether American sets can be completed with jokers. */
function canFormAmericanGroups(counts, jokers, groupsLeft) {
  let firstKey = null;
  for (const [key, count] of counts) {
    if (count > 0 && (firstKey === null || compareTileKeys(key, firstKey) < 0)) {
      firstKey = key;
    }
  }
  if (firstKey === null) {
    return groupsLeft === 0 && jokers === 0;
  }
  if (groupsLeft === 0) {
    return false;
  }

  const count = counts.get(firstKey);
  for (let groupSize = 3; groupSize <= 5; groupSize += 1) {
    for (let naturalCount = Math.min(count, groupSize); naturalCount >= 1; naturalCount -= 1) {
      const jokersNeeded = groupSize - naturalCount;
      if (jokersNeeded > jokers) {
        continue;
      }
      counts.set(firstKey, count - naturalCount);
      if (canFormAmericanGroups(counts, jokers - jokersNeeded, groupsLeft - 1)) {
        counts.set(firstKey, count);
        return true;
      }
      counts.set(firstKey, count);
    }
  }
  return false;
}

/** Checks whether adding one legal tile can complete the player's hand. */
function isTenpai(hand, openMeldCount, variantId) {
  const existingCounts = new Map();
  for (const tile of hand) {
    const key = tileKey(tile);
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }
  const checked = new Set();
  for (const candidate of createTiles(variantId)) {
    const key = tileKey(candidate);
    if (checked.has(key) || (existingCounts.get(key) ?? 0) >= 4 ||
        candidate.type === "flower" || candidate.type === "joker") {
      continue;
    }
    checked.add(key);
    if (isWinningShape([...hand, candidate], openMeldCount, variantId)) {
      return true;
    }
  }
  return false;
}

/** Checks the rules and hand state required to declare riichi. */
function canDeclareRiichi(player) {
  if (game.variantId !== "japanese-riichi" || player.riichi ||
      hasOpenMelds(player) || game.phase !== "discard" ||
      isWinningHand(player.hand, player.melds.length, game.variantId, player, "self-draw")) {
    return false;
  }
  return player.hand.some((discard) =>
    isTenpai(
      player.hand.filter((tile) => tile.id !== discard.id),
      player.melds.length,
      game.variantId
    )
  );
}

/** Checks the supported yaku conditions for a riichi win. */
function hasRiichiYaku(hand, player, winType) {
  if (player.riichi || (winType === "self-draw" && !hasOpenMelds(player))) {
    return true;
  }

  const allTiles = [...hand, ...player.melds.flatMap((meld) => meld.tiles)];
  const allSimples = allTiles.every((tile) =>
    ["characters", "circles", "bamboo"].includes(tile.type) &&
    tile.value >= 2 && tile.value <= 8
  );
  if (allSimples) {
    return true;
  }

  const counts = new Map();
  for (const tile of allTiles) {
    const key = tileKey(tile);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const seatWind = WINDS.indexOf(player.direction);
  for (const [key, count] of counts) {
    const [type, valueText] = key.split("-");
    const value = Number(valueText);
    if (count >= 3 && (type === "dragon" ||
        (type === "wind" && (value === seatWind || value === 0)))) {
      return true;
    }
  }
  return false;
}

/** Reports whether a player has any non-concealed melds. */
function hasOpenMelds(player) {
  return player.melds.some((meld) => !meld.concealed);
}

/** Selects the lowest-value discard candidate for a player. */
function recommendDiscard(player) {
  const candidates = player.hand.map((tile) => ({
    tile,
    keepValue: tileKeepValue(tile, player.hand)
  }));
  candidates.sort((first, second) =>
    first.keepValue - second.keepValue ||
    first.tile.sort - second.tile.sort ||
    first.tile.id - second.tile.id
  );
  const tile = candidates[0]?.tile;
  return tile ? { tile, explanation: explainDiscard(tile, player.hand) } : null;
}

/** Estimates how useful a tile is to keep based on nearby hand tiles. */
function tileKeepValue(tile, hand) {
  const matches = hand.filter((candidate) => sameTile(candidate, tile)).length;
  if (VARIANTS[game.variantId].mode === "american") {
    if (tile.type === "joker") {
      return 4.5;
    }
    return matches >= 4 ? 10 : matches === 3 ? 7 : matches === 2 ? 2.7 : 0;
  }
  if (matches >= 4) {
    return 10;
  }
  if (matches === 3) {
    return 7;
  }
  let score = matches === 2 ? 2.7 : 0;
  if (!["characters", "circles", "bamboo"].includes(tile.type)) {
    return score;
  }

  for (const distance of [1, 2]) {
    const neighbors = [
      tile.value - distance,
      tile.value + distance
    ].filter((value) => value >= 1 && value <= 9);
    for (const value of neighbors) {
      if (hand.some((candidate) => candidate.type === tile.type && candidate.value === value)) {
        score += distance === 1 ? 1.4 : 0.6;
      }
    }
  }
  if (isInCompleteSequence(tile, hand)) {
    score += 3;
  }
  return score;
}

/** Checks whether the tile belongs to a completed sequence in the hand. */
function isInCompleteSequence(tile, hand) {
  if (!["characters", "circles", "bamboo"].includes(tile.type)) {
    return false;
  }
  for (let start = Math.max(1, tile.value - 2); start <= Math.min(7, tile.value); start += 1) {
    if ([start, start + 1, start + 2].every((value) =>
      hand.some((candidate) => candidate.type === tile.type && candidate.value === value)
    )) {
      return true;
    }
  }
  return false;
}

/** Explains why the tutor recommends discarding a particular tile. */
function explainDiscard(tile, hand) {
  const matches = hand.filter((candidate) => sameTile(candidate, tile)).length;
  if (tile.type === "flower") {
    return matches === 1
      ? "It is an unmatched flower in this simplified practice mode."
      : "This flower group is less useful than the other matching sets.";
  }
  if (matches === 1 && !["characters", "circles", "bamboo"].includes(tile.type)) {
    return "It is an unmatched honor; pairs, triplets, and suited connections are usually more useful.";
  }
  const hasNeighbor = ["characters", "circles", "bamboo"].includes(tile.type) &&
    hand.some((candidate) => candidate.type === tile.type &&
      Math.abs(candidate.value - tile.value) <= 2 && candidate.value !== tile.value);
  if (matches === 1 && !hasNeighbor) {
    return "It has no matching tile or nearby sequence link, so it is your least-connected tile.";
  }
  return "This tile contributes less to a pair or sequence than the other choices; keep your stronger groups together.";
}

/** Builds the visible-tile signature for the current human discard decision. */
function reviewDecisionSignature(player) {
  const knownTileIds = [];
  for (const discard of game.discards) {
    if (!discard.claimed) {
      knownTileIds.push(discard.tile.id);
    }
  }
  for (const [playerIndex, knownPlayer] of game.players.entries()) {
    if (playerIndex === 0 || elements.showBotHands.checked) {
      knownTileIds.push(...knownPlayer.hand.map((tile) => tile.id));
    }
    knownTileIds.push(...knownPlayer.flowers.map((tile) => tile.id));
    for (const meld of knownPlayer.melds) {
      knownTileIds.push(...meld.tiles.map((tile) => tile.id));
    }
  }
  return [
    game.variantId,
    game.wall.length,
    game.players.slice(1).map((bot) => bot.hand.length).join(","),
    player.riichi,
    player.riichiPending,
    player.drawnTileId,
    player.melds.map((meld) => `${meld.type}:${meld.concealed}`).join(","),
    elements.showBotHands.checked,
    player.hand.map((tile) => tile.id).sort((a, b) => a - b).join(","),
    knownTileIds.sort((a, b) => a - b).join(",")
  ].join("|");
}

/** Returns the tiles whose locations are not known to the human player. */
function reviewUnseenTiles() {
  const knownTileIds = new Set();
  for (const discard of game.discards) {
    if (!discard.claimed) {
      knownTileIds.add(discard.tile.id);
    }
  }
  for (const [playerIndex, player] of game.players.entries()) {
    if (playerIndex === 0 || elements.showBotHands.checked) {
      for (const tile of player.hand) {
        knownTileIds.add(tile.id);
      }
    }
    for (const tile of player.flowers) {
      knownTileIds.add(tile.id);
    }
    for (const meld of player.melds) {
      for (const tile of meld.tiles) {
        knownTileIds.add(tile.id);
      }
    }
  }
  return createTiles(game.variantId).filter((tile) => !knownTileIds.has(tile.id));
}

/** Creates the legal distinct-tile discard candidates for a human decision. */
function reviewDiscardCandidates(player) {
  const candidates = new Map();
  for (const tile of sortedHand(player.hand)) {
    if (game.variantId === "japanese-riichi" && player.riichi &&
        !player.riichiPending && tile.id !== player.drawnTileId) {
      continue;
    }
    const key = tileKey(tile);
    if (candidates.has(key)) {
      continue;
    }
    const remaining = player.hand.filter((handTile) => handTile.id !== tile.id);
    if (player.riichiPending &&
        !isTenpai(remaining, player.melds.length, game.variantId)) {
      continue;
    }
    candidates.set(key, {
      key,
      tile,
      keepValue: tileKeepValue(tile, player.hand)
    });
  }
  return [...candidates.values()].sort((first, second) =>
    first.keepValue - second.keepValue ||
    first.tile.sort - second.tile.sort ||
    first.tile.id - second.tile.id
  );
}

/** Returns a deterministic random generator for repeatable review estimates. */
function reviewRandomGenerator(signature) {
  let seed = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    seed = Math.imul(seed ^ signature.charCodeAt(index), 16777619);
  }
  let state = seed >>> 0;
  return () => {
    let value = state += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Shuffles a sampled wall using the review's seeded random generator. */
function shuffleForReview(tiles, random) {
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [tiles[index], tiles[swapIndex]] = [tiles[swapIndex], tiles[index]];
  }
  return tiles;
}

/** Simulates one candidate discard through the remaining self-draw opportunities. */
function simulateReviewCandidate(player, candidate, sampledWall) {
  const hand = [...player.hand];
  const discardIndex = hand.findIndex((tile) => tile.id === candidate.tile.id);
  if (discardIndex < 0) {
    return false;
  }
  hand.splice(discardIndex, 1);

  const simulatedPlayer = {
    ...player,
    hand,
    riichi: player.riichi || player.riichiPending,
    riichiPending: false
  };
  const variant = VARIANTS[game.variantId];
  let wallIndex = 0;
  const drawNextTile = () => {
    while (wallIndex < sampledWall.length) {
      const tile = sampledWall[wallIndex];
      wallIndex += 1;
      if (!variant.flowersReplace || tile.type !== "flower") {
        return tile;
      }
    }
    return null;
  };

  while (true) {
    for (let opponent = 0; opponent < PLAYER_NAMES.length - 1; opponent += 1) {
      if (!drawNextTile()) {
        return false;
      }
    }
    const drawnTile = drawNextTile();
    if (!drawnTile) {
      return false;
    }
    hand.push(drawnTile);
    if (isWinningHand(
      hand,
      simulatedPlayer.melds.length,
      game.variantId,
      simulatedPlayer,
      "self-draw"
    )) {
      return true;
    }

    const discard = simulatedPlayer.riichi
      ? drawnTile
      : recommendDiscard(simulatedPlayer)?.tile;
    const nextDiscardIndex = discard
      ? hand.findIndex((tile) => tile.id === discard.id)
      : -1;
    if (nextDiscardIndex < 0) {
      return false;
    }
    hand.splice(nextDiscardIndex, 1);
  }
}

/** Estimates each legal discard's self-draw chance with bounded simulations. */
function calculateReviewDecision(player, signature) {
  const candidates = reviewDiscardCandidates(player);
  if (candidates.length === 0) {
    return {
      signature,
      candidates: [],
      bestOptions: [],
      bestWinCount: 0,
      bestProbability: 0,
      bestAction: { type: "none", label: "No legal discard estimate" }
    };
  }

  const unseenTiles = reviewUnseenTiles();
  const hiddenBotTiles = elements.showBotHands.checked
    ? 0
    : game.players.slice(1).reduce((total, bot) => total + bot.hand.length, 0);
  const random = reviewRandomGenerator(signature);
  const winCounts = new Map(candidates.map((candidate) => [candidate.key, 0]));
  for (let trial = 0; trial < REVIEW_SIMULATION_COUNT; trial += 1) {
    const shuffledUnseen = shuffleForReview([...unseenTiles], random);
    const sampledWall = shuffledUnseen.slice(hiddenBotTiles);
    for (const candidate of candidates) {
      if (simulateReviewCandidate(player, candidate, sampledWall)) {
        winCounts.set(candidate.key, winCounts.get(candidate.key) + 1);
      }
    }
  }

  const scoredCandidates = candidates.map((candidate) => ({
    ...candidate,
    winCount: winCounts.get(candidate.key),
    probability: winCounts.get(candidate.key) / REVIEW_SIMULATION_COUNT * 100
  }));
  const bestWinCount = Math.max(...scoredCandidates.map((candidate) => candidate.winCount));
  const bestOptions = scoredCandidates.filter((candidate) =>
    candidate.winCount === bestWinCount
  );
  const bestCandidate = bestOptions[0];
  const canWinNow = isWinningHand(
    player.hand,
    player.melds.length,
    game.variantId,
    player,
    "self-draw"
  );

  return {
    signature,
    candidates: scoredCandidates,
    bestOptions,
    bestWinCount,
    bestProbability: canWinNow ? 100 : bestWinCount / REVIEW_SIMULATION_COUNT * 100,
    bestAction: canWinNow
      ? { type: "win", label: "Declare self-draw win" }
      : {
        type: "discard",
        label: `Discard ${tileDescription(bestCandidate.tile)}${bestOptions.length > 1
          ? ` (+${bestOptions.length - 1} tied)`
          : ""}`
      }
  };
}

/** Refreshes the current estimate only when the visible decision state changes. */
function ensureReviewDecision() {
  if (!game || game.winner !== null || game.current !== 0 || game.phase !== "discard") {
    return;
  }
  const player = game.players[0];
  const signature = reviewDecisionSignature(player);
  if (game.reviewCurrentDecision?.signature === signature) {
    return;
  }
  game.reviewCurrentDecision = calculateReviewDecision(player, signature);
}

/** Records a human discard alongside its estimate and the best estimated choice. */
function recordHumanDiscard(tile) {
  ensureReviewDecision();
  const decision = game.reviewCurrentDecision;
  const actual = decision?.candidates.find((candidate) => candidate.key === tileKey(tile));
  const bestAction = decision?.bestAction;
  game.reviewTurns.push({
    turn: game.reviewTurns.length + 1,
    actualMove: `Discard ${tileDescription(tile)}`,
    bestMove: bestAction?.label ?? "Estimate unavailable",
    actualProbability: actual?.probability ?? null,
    bestProbability: decision?.bestProbability ?? null,
    matchedBest: bestAction?.type === "discard" &&
      actual?.winCount === decision.bestWinCount
  });
  game.reviewCurrentDecision = null;
}

/** Records a human win action as the best available move for that decision. */
function recordHumanWin(action) {
  game.reviewTurns.push({
    turn: game.reviewTurns.length + 1,
    actualMove: action,
    bestMove: action,
    actualProbability: 100,
    bestProbability: 100,
    matchedBest: true
  });
  game.reviewCurrentDecision = null;
}

/** Schedules the next bot action after narration and animations can finish. */
function scheduleBotTurn(delay = BOT_MOVE_DELAY_MS) {
  if (botTimer !== null || !game || game.winner !== null ||
      game.current === 0 || game.privacyRequired) {
    return;
  }
  botTimer = setTimeout(() => {
    botTimer = null;
    if (voiceEnabled && speechAvailable && window.speechSynthesis.speaking) {
      scheduleBotTurn(250);
      return;
    }
    runBotTurn();
  }, delay);
}

/** Chooses the preferred available English speech-synthesis voice. */
function getNarrationVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => /zira/i.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-")) ??
    null;
}

/** Removes tile and player highlights left by the previous narration. */
function clearNarrationFocus() {
  for (const area of playerAreas) {
    area.classList.remove("narrating");
  }
  document.querySelectorAll(".voice-focus").forEach((tile) => {
    tile.classList.remove("voice-focus");
  });
}

/** Clears the current word highlight from the narration text. */
function clearSpokenWordFocus() {
  elements.turnNarration.querySelectorAll(".spoken-word").forEach((word) => {
    word.classList.remove("spoken-word");
  });
}

/** Highlights the player and tiles associated with a narration cue. */
function setNarrationFocus(playerIndex, tileIds) {
  clearNarrationFocus();
  if (playerIndex !== undefined && playerIndex !== null) {
    playerAreas[playerIndex].classList.add("narrating");
  }
  const focusedIds = new Set(tileIds.map(String));
  document.querySelectorAll("[data-tile-id]").forEach((tile) => {
    if (focusedIds.has(tile.dataset.tileId)) {
      tile.classList.add("voice-focus");
    }
  });
  for (const [tileId, held] of heldTileGhosts) {
    if (focusedIds.has(String(tileId))) {
      held.element.classList.add("voice-focus");
    }
  }
}

/** Finds the character ranges of narration cues within a message. */
function narrationCueRanges(message, cues) {
  let searchFrom = 0;
  const lowerMessage = message.toLowerCase();
  const ranges = [];
  for (const cue of cues) {
    const start = lowerMessage.indexOf(cue.text.toLowerCase(), searchFrom);
    if (start === -1) {
      continue;
    }
    ranges.push({
      start,
      end: start + cue.text.length,
      tileIds: cue.tileIds,
      animation: cue.animation
    });
    searchFrom = start + cue.text.length;
  }
  return ranges;
}

/** Renders narration text as word spans for synchronized highlighting. */
function renderNarrationWords(message) {
  const nodes = [];
  const wordRanges = [];
  const pattern = /\S+/g;
  let match;
  let previousEnd = 0;

  while ((match = pattern.exec(message)) !== null) {
    if (match.index > previousEnd) {
      nodes.push(document.createTextNode(message.slice(previousEnd, match.index)));
    }
    const word = document.createElement("span");
    word.textContent = match[0];
    nodes.push(word);
    wordRanges.push({
      start: match.index,
      end: match.index + match[0].length,
      element: word
    });
    previousEnd = match.index + match[0].length;
  }
  if (previousEnd < message.length) {
    nodes.push(document.createTextNode(message.slice(previousEnd)));
  }
  elements.turnNarration.replaceChildren(...nodes);
  return wordRanges;
}

/** Highlights the word currently being spoken by the browser voice. */
function focusNarrationWord(wordRanges, charIndex) {
  const activeWord = wordRanges.find((range) =>
    charIndex >= range.start && charIndex < range.end
  );
  for (const range of wordRanges) {
    range.element.classList.toggle("spoken-word", range === activeWord);
  }
}

/** Speaks a turn message while synchronizing focus and tile animations. */
function narrateTurn(message, { playerIndex, cues = [] } = {}) {
  const botSpeechDisabled = playerIndex > 0 && !elements.botNarrationEnabled.checked;
  if (!voiceEnabled || !speechAvailable || botSpeechDisabled) {
    elements.turnNarration.textContent = message;
    playReadyTileAnimationsImmediately();
    return;
  }
  const utterance = new window.SpeechSynthesisUtterance(message);
  const cueRanges = narrationCueRanges(message, cues);
  const triggeredCues = new Set();
  let wordRanges = [];
  const voice = getNarrationVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onstart = () => {
    wordRanges = renderNarrationWords(message);
    activeNarrationUtterance = utterance;
    activeNarrationPlayerIndex = playerIndex ?? null;
    setNarrationFocus(playerIndex, []);
  };
  utterance.onboundary = (event) => {
    if (activeNarrationUtterance !== utterance ||
        !Number.isFinite(event.charIndex)) {
      return;
    }
    focusNarrationWord(wordRanges, event.charIndex);
    const activeCueIndex = cueRanges.findIndex((cue) =>
      event.charIndex >= cue.start && event.charIndex < cue.end
    );
    const activeCue = cueRanges[activeCueIndex];
    setNarrationFocus(playerIndex, activeCue?.tileIds ?? []);
    if (activeCue?.animation && !triggeredCues.has(activeCueIndex)) {
      triggeredCues.add(activeCueIndex);
      playTileAnimationCue(activeCue.animation, activeCue.tileIds);
    }
  };
  /** Clears narration state and finishes any animations when speech ends. */
  const finishUtterance = () => {
    if (activeNarrationUtterance === utterance) {
      cueRanges.forEach((cue, index) => {
        if (cue.animation && !triggeredCues.has(index)) {
          triggeredCues.add(index);
          playTileAnimationCue(cue.animation, cue.tileIds);
        }
      });
      activeNarrationUtterance = null;
      activeNarrationPlayerIndex = null;
      focusNarrationWord(wordRanges, -1);
      clearNarrationFocus();
    }
  };
  utterance.onend = finishUtterance;
  utterance.onerror = () => {
    if (activeNarrationUtterance === utterance) {
      elements.turnNarration.textContent = message;
      finishUtterance();
      playReadyTileAnimationsImmediately();
    }
  };
  window.speechSynthesis.speak(utterance);
}

/** Lists players skipped between the discarder and a claimant. */
function getSkippedPlayers(discarderIndex, claimantIndex) {
  const skipped = [];
  for (let offset = 1; offset < 4; offset += 1) {
    const playerIndex = (discarderIndex + offset) % 4;
    if (playerIndex === claimantIndex) {
      break;
    }
    skipped.push(game.players[playerIndex].name);
  }
  return skipped;
}

/** Joins player names into a natural spoken list. */
function joinPlayerNames(names) {
  if (names.length < 2) {
    return names[0] ?? "";
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Formats a player's name as a natural possessive phrase. */
function possessivePlayerName(playerIndex) {
  return playerIndex === 0 ? "your" : `${game.players[playerIndex].name}'s`;
}

/** Narrates a claim and highlights the claimant and tiles involved. */
function narrateClaimAction(claimantIndex, option, discard) {
  const claimant = game.players[claimantIndex];
  const subject = claimantIndex === 0 ? "You" : claimant.name;
  const verb = claimantIndex === 0 ? "claim" : "claims";
  const skipped = getSkippedPlayers(discard.player, claimantIndex);
  const claimType = `${option.type[0].toUpperCase()}${option.type.slice(1)}`;
  const skipNotice = skipped.length > 0
    ? `Skipping ${joinPlayerNames(skipped)}.`
    : "";
  const followup = option.type === "kong"
    ? claimantIndex === 0
      ? "Draw a replacement tile."
      : `${claimant.name} draws a replacement tile.`
    : claimantIndex === 0
      ? "You discard next."
      : `${claimant.name} discards next.`;
  const message = [
    `${subject} ${verb} a ${claimType} on the ${tileDescription(discard.tile)}.`,
    skipNotice,
    followup
  ].filter(Boolean).join(" ");
  const cues = [{
    text: claimType,
    tileIds: option.tiles.map((tile) => tile.id)
  }, {
    text: tileDescription(discard.tile),
    tileIds: [discard.tile.id],
    animation: "discard"
  }];
  narrateTurn(message, { playerIndex: claimantIndex, cues });
}

/** Chooses and performs the bot's best available turn action. */
function runBotTurn() {
  if (!game || game.winner !== null || game.current === 0 || game.privacyRequired) {
    return;
  }
  if (game.phase === "claim") {
    const claim = game.claimQueue[game.claimIndex];
    if (!claim || claim.player !== game.current) {
      return;
    }
    if (claim.options.some((option) => option.type === "win")) {
      declareClaimWin();
      return;
    }
    const option = claim.options.find((candidate) => candidate.type === "kong") ??
      claim.options.find((candidate) => candidate.type === "pung") ??
      claim.options.find((candidate) => candidate.type === "chow");
    if (option) {
      claimMeld(option);
    } else {
      passClaim();
    }
    return;
  }
  if (game.phase !== "discard") {
    return;
  }

  const player = game.players[game.current];
  if (isWinningHand(player.hand, player.melds.length, game.variantId, player, "self-draw")) {
    declareSelfDraw();
    return;
  }
  if (findConcealedKong(player)) {
    declareConcealedKong();
    return;
  }
  const recommendation = recommendDiscard(player);
  if (!recommendation) {
    elements.turnMessage.textContent = `${player.name} has no tile available to discard.`;
    return;
  }
  const drawnTile = player.hand.find((tile) => tile.id === player.drawnTileId);
  const message = drawnTile
    ? `${player.name} draws the ${tileDescription(drawnTile)}, then discards the ${tileDescription(recommendation.tile)}.`
    : `${player.name} discards the ${tileDescription(recommendation.tile)}.`;
  const cues = drawnTile
    ? [
      {
        text: tileDescription(drawnTile),
        tileIds: [drawnTile.id],
        animation: "draw"
      },
      {
        text: tileDescription(recommendation.tile),
        tileIds: [recommendation.tile.id],
        animation: "discard"
      }
    ]
    : [{
      text: tileDescription(recommendation.tile),
      tileIds: [recommendation.tile.id],
      animation: "discard"
    }];
  narrateTurn(message, { playerIndex: game.current, cues });
  discardTile(recommendation.tile.id);
}

/** Updates the status text for the current phase, turn, or hand result. */
function updateTurnMessage() {
  if (game.winner !== null) {
    elements.turnMessage.textContent = `${game.players[game.winner].name} wins the hand.`;
  } else if (game.phase === "awaiting-draw") {
    elements.turnMessage.textContent = "Your turn to draw.";
  } else if (game.phase === "draw") {
    elements.turnMessage.textContent = "The wall is empty. The hand is a draw.";
  } else if (game.current !== 0 && game.phase === "claim") {
    elements.turnMessage.textContent = `${game.players[game.current].name} is deciding whether to claim the last discard.`;
  } else if (game.current !== 0) {
    elements.turnMessage.textContent = `${game.players[game.current].name} is taking a turn and choosing a discard.`;
  } else if (game.phase === "claim") {
    elements.turnMessage.textContent = `${game.players[game.current].name}, check the last discard for a claim.`;
  } else if (game.players[game.current].riichiPending) {
    elements.turnMessage.textContent = `${game.players[game.current].name}: choose a discard that keeps the hand ready to declare riichi.`;
  } else {
    elements.turnMessage.textContent = `${game.players[game.current].name} to discard.`;
  }
}

elements.hand.addEventListener("dragstart", (event) => {
  const button = event.target.closest("button[data-tile-id]");
  if (!button || !button.draggable) {
    return;
  }
  draggedHandTileId = Number(button.dataset.tileId);
  button.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(draggedHandTileId));
});
elements.hand.addEventListener("dragover", (event) => {
  if (draggedHandTileId === null) {
    return;
  }
  const target = event.target.closest("button[data-tile-id]");
  if (!target || Number(target.dataset.tileId) === draggedHandTileId) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});
elements.hand.addEventListener("drop", (event) => {
  const target = event.target.closest("button[data-tile-id]");
  const rawDraggedId = event.dataTransfer.getData("text/plain");
  const draggedId = rawDraggedId === "" ? draggedHandTileId : Number(rawDraggedId);
  if (!target || !Number.isInteger(draggedId) ||
      draggedHandTileId === null || draggedHandTileId !== draggedId ||
      Number(target.dataset.tileId) === draggedId) {
    return;
  }
  const source = Array.from(
    elements.hand.querySelectorAll("button[data-tile-id]")
  ).find((button) => Number(button.dataset.tileId) === draggedId);
  if (!source) {
    return;
  }
  event.preventDefault();
  const targetRect = target.getBoundingClientRect();
  const insertAfter = event.clientX > targetRect.left + targetRect.width / 2;
  elements.hand.insertBefore(source, insertAfter ? target.nextElementSibling : target);
  source.classList.remove("dragging");
  saveHumanHandOrderFromDOM();
  source.focus();
});
elements.hand.addEventListener("dragend", (event) => {
  const button = event.target.closest("button[data-tile-id]");
  button?.classList.remove("dragging");
  draggedHandTileId = null;
});
elements.hand.addEventListener("keydown", (event) => {
  if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
    return;
  }
  const button = event.target.closest("button[data-tile-id]");
  if (!button || button.disabled) {
    return;
  }
  event.preventDefault();
  const buttons = Array.from(elements.hand.querySelectorAll("button[data-tile-id]"));
  const index = buttons.indexOf(button);
  const nextIndex = index + (event.key === "ArrowLeft" ? -1 : 1);
  if (nextIndex < 0 || nextIndex >= buttons.length) {
    return;
  }
  const neighbor = buttons[nextIndex];
  elements.hand.insertBefore(
    button,
    event.key === "ArrowLeft" ? neighbor : neighbor.nextElementSibling
  );
  saveHumanHandOrderFromDOM();
  button.focus();
});

elements.privacyReady.addEventListener("click", () => {
  game.privacyRequired = false;
  render();
});
elements.newGame.addEventListener("click", () => newGame());
elements.variantSelect.addEventListener("change", updateVariantNote);
elements.showSymbolGuide.addEventListener("change", updateGuideVisibility);
elements.showPatternExamples.addEventListener("change", updateGuideVisibility);
elements.showBotHands.addEventListener("change", renderPlayers);
elements.tutorEnabled.addEventListener("change", () => {
  const recommendation = getTutorRecommendation();
  renderHand(recommendation);
  renderTutor(recommendation);
});
if (!speechAvailable) {
  elements.voiceEnabled.checked = false;
  elements.voiceEnabled.disabled = true;
  elements.botNarrationEnabled.checked = false;
  elements.botNarrationEnabled.disabled = true;
  elements.turnNarration.textContent = "Spoken narration is unavailable in this browser.";
}
elements.voiceEnabled.addEventListener("change", () => {
  voiceEnabled = speechAvailable && elements.voiceEnabled.checked;
  if (!voiceEnabled) {
    if (speechAvailable) {
      activeNarrationUtterance = null;
      activeNarrationPlayerIndex = null;
      window.speechSynthesis.cancel();
    }
    playReadyTileAnimationsImmediately();
    clearTileAnimationGhosts();
    clearNarrationFocus();
    elements.turnNarration.textContent = "Turn narration is off; actions will still be shown here.";
    return;
  }
  narrateTurn("Narration on.");
});
elements.botNarrationEnabled.addEventListener("change", () => {
  if (elements.botNarrationEnabled.checked ||
      activeNarrationPlayerIndex === null ||
      activeNarrationPlayerIndex === 0 ||
      !activeNarrationUtterance) {
    return;
  }
  activeNarrationUtterance = null;
  activeNarrationPlayerIndex = null;
  window.speechSynthesis.cancel();
  playReadyTileAnimationsImmediately();
  clearTileAnimationGhosts();
  clearNarrationFocus();
  elements.turnNarration.textContent = "Bot move narration is off; actions will still be shown here.";
});

/** Updates the note describing the selected ruleset and its status. */
function updateVariantNote() {
  const selected = VARIANTS[elements.variantSelect.value] ?? VARIANTS["chinese-classical"];
  const active = game ? VARIANTS[game.variantId].label : selected.label;
  elements.variantNote.textContent = `${selected.label}: ${selected.description} Selection applies to the next hand (active hand: ${active}).`;
}

/** Applies the symbol and example guide checkbox settings. */
function updateGuideVisibility() {
  elements.symbolReference.hidden = !elements.showSymbolGuide.checked;
  elements.patternReference.hidden = !elements.showPatternExamples.checked;
}

updateGuideVisibility();
renderSymbolGuide();
newGame(0, 1, elements.variantSelect.value);
