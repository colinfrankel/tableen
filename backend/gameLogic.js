// Centralized game rules and state transitions for Tableen

function generateStackId(game) {
  if (!game.nextStackId) game.nextStackId = 1;
  return (game.nextStackId++).toString();
}

function resolveStackIndex(gameState, id) {
  return gameState.tableCards.findIndex(stack => stack.id === id);
}

// Remove card from hand, treating ace (1) and ace (14) as equivalent
function removeCardFromHand(gameState, playerKey, card) {
  const hand = gameState.playerHands[playerKey];
  const idx = hand.findIndex(arr => {
    const handCard = arr[0];
    // Ace weirdness: treat ace in hand (card: 1) as matching played ace (card: 14)
    const isAceMatch = (handCard.card === 1 && card.card === 14) || (handCard.card === 14 && card.card === 1);
    return (handCard.card === card.card && handCard.suit === card.suit) || (isAceMatch && handCard.suit === card.suit);
  });
  if (idx !== -1) hand.splice(idx, 1);
}

function validateAndApplyAction(gameState, action, playerKey) {
  // STACK
  if (action.type === 'stack') {
    const stackIndex = action.stackId ? resolveStackIndex(gameState, action.stackId) : -1;
    if (stackIndex === -1) return { error: 'Stack not found.' };
    const stack = gameState.tableCards[stackIndex];
    const playedCard = action.playedCard;
    if (!playedCard) return { error: 'No card played.' };


    // If stacking as sum
    if (action.stackAsSum) {
      // Just sum, treating ace (14) as 1
      const playedCardValueForSum = playedCard.card === 14 ? 1 : playedCard.card;
      const sum = stack.cards.reduce((acc, c) => acc + (c.card === 14 ? 1 : c.card), 0) + playedCardValueForSum;
      if (sum > 14) return { error: 'Cannot create a stack above 14.' };
      // if player doesnt have sum in hand return error
      const hasSumInHand = gameState.playerHands[playerKey].some(arr => {
        // Ace weirdness: treat 1 and 14 as equivalent for sum
        return arr[0].card === sum ||
          (sum === 1 && arr[0].card === 14) ||
          (sum === 14 && arr[0].card === 1);
      });
      if (!hasSumInHand) return { error: 'You do not have the required card to create this stack.' };
      stack.cards.push(playedCard);
      stack.stackNumber = sum;
      removeCardFromHand(gameState, playerKey, playedCard);
      return { newState: gameState };
    }

    // If played card matches stack sum, allow stacking (do NOT sum or check sum limit)
    const matchesStackSum = playedCard.card === stack.stackNumber;
    if (matchesStackSum) {
      stack.cards.push(playedCard);
      // stack.stackNumber stays the same!
      removeCardFromHand(gameState, playerKey, playedCard);
      return { newState: gameState };
    }

    // Otherwise, reject if sum > 14
    const sum = stack.cards.reduce((acc, c) => acc + c.card, 0) + playedCard.card;
    if (sum > 14) return { error: 'Cannot create a stack above 14.' };
    const hasSumInHand = gameState.playerHands[playerKey].some(arr => {
      // Ace weirdness: treat 1 and 14 as equivalent for sum
      return arr[0].card === sum ||
        (sum === 1 && arr[0].card === 14) ||
        (sum === 14 && arr[0].card === 1);
    });
    if (!hasSumInHand) return { error: 'You do not have the required card to create this stack.' };
    stack.cards.push(playedCard);
    stack.stackNumber = sum;

    // --- AUTO COMBINE SAME SUM STACKS IF CREATED BY PLAYING A CARD ---
    const thisStackId = stack.id;
    const thisStackNumber = stack.stackNumber;
    const matchingStacks = gameState.tableCards.filter(
      s => s.id !== thisStackId && s.stackNumber === thisStackNumber
    );
    if (matchingStacks.length > 0) {
      matchingStacks.forEach(s => {
        stack.cards.push(...s.cards);
      });
      gameState.tableCards = gameState.tableCards.filter(
        s => s.id === thisStackId || s.stackNumber !== thisStackNumber
      );
    }


    removeCardFromHand(gameState, playerKey, playedCard);

    return { newState: gameState };
  }

  // NORMAL (play a card as a new stack)
  if (action.type === 'normal') {
    let playedCard = action.playedCard;
    if (!playedCard) return { error: 'No card played.' };

    // Remove card from hand
    removeCardFromHand(gameState, playerKey, playedCard);

    // ACE WEIRDNESS: If played card is an ace (14), convert to 1 for the board
    if (playedCard.card === 14) {
      playedCard = { ...playedCard, card: 1 };
    }

    gameState.tableCards.push({
      id: generateStackId(gameState),
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
      const stack = gameState.tableCards[stackIndex];
      // ACE WEIRDNESS: Prevent grabbing a single ace (1) with an ace (14)
      if (
        stack.cards.length === 1 &&
        stack.cards[0].card === 1 &&
        playedCard.card === 14
      ) {
        return { error: 'Cannot pick up an ace with an ace.' };
      }
      removeCardFromHand(gameState, playerKey, playedCard);
    }

    // Remove the stack from the table and add to player's collected pile
    const grabbedStack = gameState.tableCards.splice(stackIndex, 1)[0];
    if (!gameState.collected[playerKey]) gameState.collected[playerKey] = [];
    // Add both the played card and the grabbed stack's cards
    if (playedCard) {
      gameState.collected[playerKey].push(playedCard);
    }
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
    if (fromStack.stackNumber === toStack.stackNumber) {
      toStack.cards = [...toStack.cards, ...fromStack.cards];
      toStack.stackNumber = fromStack.stackNumber;
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
  function countAces(cards) { return cards.filter(c => c.card === 1 || c.card === 14).length; }
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