// Centralized game rules and state transitions for Tabline

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

    // If stacking as sum
    if (action.stackAsSum) {
      const sum = stack.cards[0].card + playedCard.card;
      if (sum > 14) return { error: 'Sum exceeds 14.' };
      stack.cards.push(playedCard);
      stack.stackNumber = sum;
      return { newState: gameState };
    } else {
      stack.cards.push(playedCard);
      // If all cards in stack are the same value, keep that value; otherwise, use the sum
      const allSame = stack.cards.every(c => c.card === stack.cards[0].card);
      if (allSame) {
        stack.stackNumber = stack.cards[0].card;
      } else {
        stack.stackNumber = stack.cards.reduce((sum, c) => sum + c.card, 0);
      }
      return { newState: gameState };
    }
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

    // Remove the stack from the table
    gameState.tableCards.splice(stackIndex, 1);
    // (You may want to add logic to give the stack to the player)
    return { newState: gameState };
  }

  // BOARDSTACK (combine two stacks)
  if (action.type === 'boardstack') {
    const fromIndex = typeof action.from === 'string' ? resolveStackIndex(gameState, action.from) : -1;
    const toIndex = typeof action.to === 'string' ? resolveStackIndex(gameState, action.to) : -1;
    console.log('Received boardstack:', action.from, action.to, gameState.tableCards.map(s => s.id));
    if (fromIndex === -1 || toIndex === -1) return { error: 'One or both table cards not found.' };
    if (fromIndex === toIndex) return { error: 'Cannot boardstack a stack onto itself.' };
    const fromStack = gameState.tableCards[fromIndex];
    const toStack = gameState.tableCards[toIndex];

    // If stacking as sum
    if (action.stackAsSum) {
      const sum = fromStack.cards[0].card + toStack.cards[0].card;
      if (sum > 14) return { error: 'Sum exceeds 14.' };
      toStack.cards = [...toStack.cards, ...fromStack.cards];
      toStack.stackNumber = sum;
      gameState.tableCards.splice(fromIndex, 1);
      return { newState: gameState };
    } else {
      // Stack as two cards (not sum)
      toStack.cards = [...toStack.cards, ...fromStack.cards];
      // If all cards in stack are the same value, keep that value; otherwise, use the sum
      const allSame = toStack.cards.every(c => c.card === toStack.cards[0].card);
      if (allSame) {
        toStack.stackNumber = toStack.cards[0].card;
      } else {
        toStack.stackNumber = toStack.cards.reduce((sum, c) => sum + c.card, 0);
      }
      gameState.tableCards.splice(fromIndex, 1);
      return { newState: gameState };
    }
  }

  return { error: 'Unknown action type.' };
}

module.exports = { validateAndApplyAction, generateStackId };