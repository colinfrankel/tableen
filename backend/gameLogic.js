// Centralized game rules and state transitions for Tableen

let nextStackId = 1;
function generateStackId() {
  return (nextStackId++).toString();
}

function resolveStackIndex(gameState, id) {
  return gameState.tableCards.findIndex(stack => stack.id === id);
}

function removeCardFromHand(gameState, playerKey, card) {
  const hand = gameState.playerHands[playerKey];
  const idx = hand.findIndex(arr => arr[0].card === card.card && arr[0].suit === card.suit);
  if (idx !== -1) hand.splice(idx, 1);
}

function validateAndApplyAction(gameState, action, playerKey) {
  console.log('Received action:', action);

  // STACK
  if (action.type === 'stack') {
    const stackIndex = action.stackId ? resolveStackIndex(gameState, action.stackId) : -1;
    if (stackIndex === -1) return { error: 'Stack not found.' };
    const stack = gameState.tableCards[stackIndex];
    const playedCard = action.playedCard;
    if (!playedCard) return { error: 'No card played.' };

    // Remove card from hand
    removeCardFromHand(gameState, playerKey, playedCard);

    const matchesStackSum = playedCard.card === stack.stackNumber;
    if (matchesStackSum) {
      stack.cards.push(playedCard);
      stack.stackNumber = playedCard.card;
      return { newState: gameState };
    }

    // If stacking as sum
    if (action.stackAsSum) {
      const sum = stack.cards.reduce((acc, c) => acc + c.card, 0) + playedCard.card;
      if (sum > 14) return { error: 'Cannot create a stack above 14.' };
      stack.cards.push(playedCard); // Keep all cards for UI
      stack.stackNumber = sum;      // Show sum as stackNumber
      return { newState: gameState };
    }

    // Otherwise, reject if sum > 14
    const sum = stack.cards.reduce((acc, c) => acc + c.card, 0) + playedCard.card;
    if (sum > 14) return { error: 'Cannot create a stack above 14.' };
    stack.cards.push(playedCard);
    stack.stackNumber = sum;
    return { newState: gameState };
  }

  // NORMAL (play a card as a new stack)
  if (action.type === 'normal') {
    const playedCard = action.playedCard;
    if (!playedCard) return { error: 'No card played.' };

    // Remove card from hand
    removeCardFromHand(gameState, playerKey, playedCard);

    gameState.tableCards.push({
      id: generateStackId(),
      cards: [playedCard],
      stackNumber: playedCard.card
    });
    return { newState: gameState };
  }

  // GRAB (remove table stack and remove player's played card)
  if (action.type === 'grab') {
    const stackIndex = action.stackId ? resolveStackIndex(gameState, action.stackId) : -1;
    if (stackIndex === -1) return { error: 'Stack not found.' };

    const playedCard = action.playedCard;
    if (playedCard) {
      removeCardFromHand(gameState, playerKey, playedCard);
    }

    // Remove the stack from the table and add to player's collected pile
    const grabbedStack = gameState.tableCards.splice(stackIndex, 1)[0];
    if (!gameState.collected[playerKey]) gameState.collected[playerKey] = [];
    gameState.collected[playerKey].push(...grabbedStack.cards);

    return { newState: gameState };
  }

  // BOARDSTACK (combine two stacks)
  if (action.type === 'boardstack') {
    const fromIndex = typeof action.from === 'string' ? resolveStackIndex(gameState, action.from) : -1;
    const toIndex = typeof action.to === 'string' ? resolveStackIndex(gameState, action.to) : -1;
    if (fromIndex === -1 || toIndex === -1) return { error: 'One or both table cards not found.' };
    if (fromIndex === toIndex) return { error: 'Cannot boardstack a stack onto itself.' };
    const fromStack = gameState.tableCards[fromIndex];
    const toStack = gameState.tableCards[toIndex];

    // If stackAsSum, sum all cards (must be ≤ 14)
    if (action.stackAsSum) {
      const allCards = [...fromStack.cards, ...toStack.cards];
      const sum = allCards.reduce((acc, c) => acc + c.card, 0);
      if (sum > 14) return { error: 'Cannot create a stack above 14.' };
      toStack.cards = allCards;
      toStack.stackNumber = sum;
      gameState.tableCards.splice(fromIndex, 1);
      return { newState: gameState };
    }

    // If all cards in both stacks are the same value, just merge (do NOT sum)
    const allFromSame = fromStack.cards.every(c => c.card === fromStack.cards[0].card);
    const allToSame = toStack.cards.every(c => c.card === toStack.cards[0].card);
    const sameValue = allFromSame && allToSame && (fromStack.cards[0].card === toStack.cards[0].card);

    if (sameValue) {
      toStack.cards = [...toStack.cards, ...fromStack.cards];
      toStack.stackNumber = toStack.cards[0].card;
      gameState.tableCards.splice(fromIndex, 1);
      return { newState: gameState };
    }

    // If the sum of both stacks matches, allow merging (do NOT sum)
    const fromSum = fromStack.cards.reduce((acc, c) => acc + c.card, 0);
    const toSum = toStack.cards.reduce((acc, c) => acc + c.card, 0);
    if (fromSum === toSum) {
      toStack.cards = [...toStack.cards, ...fromStack.cards];
      toStack.stackNumber = toSum;
      gameState.tableCards.splice(fromIndex, 1);
      return { newState: gameState };
    }

    // Otherwise, reject if sum > 14
    const allCards = [...fromStack.cards, ...toStack.cards];
    const sum = allCards.reduce((acc, c) => acc + c.card, 0);
    if (sum > 14) return { error: 'Cannot create a stack above 14.' };
    toStack.cards = allCards;
    toStack.stackNumber = sum;
    gameState.tableCards.splice(fromIndex, 1);
    return { newState: gameState };
  }

  return { error: 'Unknown action type.' };
}

// Scoring function
function calculatePoints(collectedA, collectedB) {
  function cardCount(cards) { return cards.length; }
  function countAces(cards) { return cards.filter(c => c.card === 1).length; }
  function hasTwoSpades(cards) { return cards.some(c => c.card === 2 && c.suit === 'spades') ? 1 : 0; }
  function hasTenDiamonds(cards) { return cards.some(c => c.card === 10 && c.suit === 'diamonds') ? 2 : 0; }
  function countSpades(cards) { return cards.filter(c => c.suit === 'spades').length; }

  let pointsA = 0, pointsB = 0;

  // 3 points for most cards
  const countA = cardCount(collectedA);
  const countB = cardCount(collectedB);
  if (countA > countB) pointsA += 3;
  else if (countB > countA) pointsB += 3;

  // 1 point per ace
  pointsA += countAces(collectedA);
  pointsB += countAces(collectedB);

  // 1 point for 2 of spades
  pointsA += hasTwoSpades(collectedA);
  pointsB += hasTwoSpades(collectedB);

  // 2 points for 10 of diamonds
  pointsA += hasTenDiamonds(collectedA);
  pointsB += hasTenDiamonds(collectedB);

  // 1 point for most spades
  const spadesA = countSpades(collectedA);
  const spadesB = countSpades(collectedB);
  if (spadesA > spadesB) pointsA += 1;
  else if (spadesB > spadesA) pointsB += 1;

  return { pointsA, pointsB };
}

module.exports = { validateAndApplyAction, generateStackId, calculatePoints };