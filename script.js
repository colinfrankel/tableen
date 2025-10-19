document.addEventListener('DOMContentLoaded', () => {
  const joinCodeInput = document.getElementById('joinCode');
  if (joinCodeInput) joinCodeInput.value = '';
  initProfileAndTheme();
});

// Modal logic
function showStackChoiceModal(message, onChoice, btn1Label = "Stack", btn2Label = "Sum") {
  const overlay = document.getElementById('modalOverlay');
  const msg = document.getElementById('modalMessage');
  const btns = document.querySelector('.modal-buttons');
  msg.innerHTML = message || 'Stack as two cards or as a single sum?';
  overlay.classList.remove('hidden');
  btns.innerHTML = `<button id="modalOption1">${btn1Label}</button><button id="modalOption2">${btn2Label}</button>`;
  const btn1 = document.getElementById('modalOption1');
  const btn2 = document.getElementById('modalOption2');
  function cleanup() {
    overlay.classList.add('hidden');
    btn1.removeEventListener('click', asOne);
    btn2.removeEventListener('click', asTwo);
  }
  function asOne() { cleanup(); onChoice(btn1Label.toLowerCase()); }
  function asTwo() { cleanup(); onChoice(btn2Label.toLowerCase()); }
  btn1.addEventListener('click', asOne);
  btn2.addEventListener('click', asTwo);
}

// Show status in a modal (replace alert)
function showStatusModal(msg) {
  const overlay = document.getElementById('modalOverlay');
  const msgDiv = document.getElementById('modalMessage');
  const btns = document.querySelector('.modal-buttons');
  msgDiv.innerHTML = msg;
  overlay.classList.remove('hidden');
  btns.innerHTML = '<button id="modalOk">OK</button>';
  document.getElementById('modalOk').onclick = () => overlay.classList.add('hidden');
}

let draggedCard = null;
let draggedTableCard = null;
let currentGameCode = null;

let socket;

if (window.location.toString().startsWith('file://')) {
  socket = io("http://localhost:3000");
} else {
  socket = io("https://tabline.onrender.com");
}

// UI elements
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinCodeInput = document.getElementById('joinCode');
const gameCodeBox = document.getElementById('gameCodeBox');
const gameCodeSpan = document.getElementById('gameCode');
const lobbyStatus = document.getElementById('lobbyStatus');

createBtn.addEventListener('click', () => {
  socket.emit('create game', (res) => { });
});

joinBtn.addEventListener('click', () => {
  const code = (joinCodeInput.value || '').trim().toUpperCase();
  if (!code) return alert('Enter a game code.');
  socket.emit('join game', code, (res) => {
    if (res && res.ok) {
      currentGameCode = res.code;
      showGameCode(res.code);
    } else {
      console.error('Join game error:', res);
      alert((res && res.message) || 'Could not join game.');
    }
  });
});

joinCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

function showGameCode(code) {
  gameCodeSpan.innerText = code;
  gameCodeBox.classList.remove('hidden');
  document.getElementById('debugInfo').classList.remove('hidden');
}

// socket events
socket.on('connect', () => {
  console.info('Connected to server');
});

socket.on('game created', ({ code }) => {
  currentGameCode = code;
  showGameCode(code);
  lobbyStatus.innerText = `Waiting for other player...`;
  document.getElementById('gameStartOptions').classList.add('hidden');
  updateDebugInfo({ gameCode: currentGameCode });

});

socket.on('joined', (data) => {
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('tableCards').classList.remove('hidden');
  updateDebugInfo({
    gameCode: currentGameCode,
    extra: `
      <b>Deck Size:</b> 40<br>
    `
  });

});

socket.on('your turn', (data) => {
  currentGameCode = data.gameCode || currentGameCode;
  updateGameUI(data, true);
  updateDebugInfo({
    gameCode: currentGameCode,
    extra: `
      <b>Deck Size:</b> ${data.deck ? data.deck.length : '—'}<br>
    `
  });
});

socket.on('wait', (data) => {
  currentGameCode = data.gameCode || currentGameCode;
  updateGameUI(data, false);
  updateDebugInfo({
    gameCode: currentGameCode,
    extra: `
      <b>Deck Size:</b> ${data.deck ? data.deck.length : '—'}<br>
    `
  });
});



socket.on('update table', (table, hand) => {
  updateTableCards(table, hand);
});

socket.on('status', (msg) => {
  showStatusModal(msg);
  updateDebugInfo({ extra: msg });
});

socket.on('opponent action', (data) => {
  const box = document.getElementById('opponentLastAction');
  box.classList.remove('hidden');

  // Helper for card display
  function miniCardText(c) {
    if (!c) return '';
    let val = c.card;
    if (val === 1 || val === 14) val = 'A';
    if (val === 11) val = 'J';
    if (val === 12) val = 'Q';
    if (val === 13) val = 'K';
    let suit = '';
    let color = '';
    switch (c.suit) {
      case 'hearts': suit = '♥️'; color = 'red'; break;
      case 'diamonds': suit = '♦️'; color = 'red'; break;
      case 'clubs': suit = '♣️'; color = 'black'; break;
      case 'spades': suit = '♠️'; color = 'black'; break;
    }
    return `<span style="color:${color};font-weight:bold;">${val}${suit}</span>`;
  }

  // Helper to get stack label and cards
  function stackLabel(stackId, stackCards, stackNumber) {
    let label = '';
    if (stackNumber === 1 || stackNumber === 14) label = 'Aces';
    else if (stackNumber === 11) label = 'Jacks';
    else if (stackNumber === 12) label = 'Queens';
    else if (stackNumber === 13) label = 'Kings';
    else label = stackNumber;
    const cards = stackCards.map(miniCardText).join(', ');
    return `${label} [${cards}]`;
  }

  // Build a readable action description
  let actionText = '';
  if (data.type === 'normal') {
    actionText = `Played ${miniCardText(data.playedCard)} to the table.`;
  } else if (data.type === 'stack') {
    // If stacking two cards as a sum (e.g., Q on A to make K)
    if (
      data.stackCards &&
      data.stackCards.length === 2 &&
      data.stackAsSum
    ) {
      let resultLabel = '';
      if (data.stackNumber === 11) resultLabel = 'J';
      else if (data.stackNumber === 12) resultLabel = 'Q';
      else if (data.stackNumber === 13) resultLabel = 'K';
      else if (data.stackNumber === 14) resultLabel = 'A';
      else resultLabel = data.stackNumber;
      actionText = `Stacked ${miniCardText(data.playedCard)} on ${miniCardText(data.stackCards[0])} to make ${resultLabel}`;
    }
    // If stacking two identical cards (classic stack, not sum)
    else if (
      data.stackCards &&
      data.stackCards.length >= 2 &&
      !data.stackAsSum &&
      data.stackCards.every(c => c.card === data.stackCards[0].card)
    ) {
      actionText = `Stacked ${miniCardText(data.playedCard)} on stack ${miniCardText(data.stackCards[0])}`;
    }
    // If stacking onto a multi-card stack, show all cards
    else if (data.stackCards && data.stackCards.length > 1) {
      const stackCardsText = data.stackCards.map(miniCardText).join(', ');
      actionText = `Stacked ${miniCardText(data.playedCard)} on stack ${stackCardsText}`;
      if (data.stackAsSum) actionText += ' (as sum)';
    }
    // Default: stacked on a pile, show only first card
    else {
      actionText = `Stacked ${miniCardText(data.playedCard)} on stack ${miniCardText(data.stackCards[0])}`;
      if (data.stackAsSum) actionText += ' (as sum)';
    }
  } else if (data.type === 'grab') {
    // Show all cards in the grabbed stack
    const grabbedCards = data.stackCards && data.stackCards.length > 0
      ? data.stackCards.map(miniCardText).join(', ')
      : '';
    actionText = `Grabbed stack ${grabbedCards} with ${miniCardText(data.playedCard)}.`;
  } else if (data.type === 'boardstack') {
    // If both stacks have only one card, show just those cards
    const fromCard = data.fromStackCards && data.fromStackCards.length === 1 ? miniCardText(data.fromStackCards[0]) : '';
    const toCard = data.toStackCards && data.toStackCards.length === 1 ? miniCardText(data.toStackCards[0]) : '';
    if (fromCard && toCard) {
      if (data.stackAsSum) {
        actionText = `Combined stacks ${fromCard} and ${toCard} as sum.`;
      } else {
        actionText = `Stacked stack ${fromCard} onto stack ${toCard}.`;
      }
    } else {
      // Fallback: show all cards in each stack
      const fromCards = data.fromStackCards ? data.fromStackCards.map(miniCardText).join(', ') : '';
      const toCards = data.toStackCards ? data.toStackCards.map(miniCardText).join(', ') : '';
      if (data.stackAsSum) {
        actionText = `Combined stacks [${fromCards}] and [${toCards}] as sum.`;
      } else {
        actionText = `Stacked stack [${fromCards}] onto stack [${toCards}].`;
      }
    }
  } else {
    actionText = 'Gonna be so honest no idea what just happened. This shouldn\'t happen.';
  }

  box.innerHTML = `<b>Opponent's last action:</b><br>${actionText}`;
});

socket.on('round over', (data) => {
  // Helper to format a card as a mini image
  function miniCardText(c) {
    let val = c.card;
    if (val === 1 || val === 14) val = 'A';
    if (val === 11) val = 'J';
    if (val === 12) val = 'Q';
    if (val === 13) val = 'K';
    let suit = '';
    let color = '';
    switch (c.suit) {
      case 'hearts': suit = '♥️'; color = 'red'; break;
      case 'diamonds': suit = '♦️'; color = 'red'; break;
      case 'clubs': suit = '♣️'; color = 'black'; break;
      case 'spades': suit = '♠️'; color = 'black'; break;
    }
    return `<span class="mini-card" style="display:inline-block;min-width:22px;color:${color};font-weight:bold;font-size:1.1em;text-align:center;">${val}${suit}</span>`;
  }

  function summarize(cards) {
    const aces = cards.filter(c => c.card === 1 || c.card === 14);
    const spades = cards.filter(c => c.suit === 'spades' && c.card !== 1 && c.card !== 2);
    const twoSpades = cards.filter(c => c.card === 2 && c.suit === 'spades');
    const tenDiamonds = cards.filter(c => c.card === 10 && c.suit === 'diamonds');
    const others = cards.filter(c =>
      c.card !== 1 &&
      c.card !== 14 &&
      !(c.card === 2 && c.suit === 'spades') &&
      !(c.card === 10 && c.suit === 'diamonds') &&
      !(c.suit === 'spades' && c.card !== 1 && c.card !== 2)
    );

    let html = '';
    if (aces.length) html += `<p>Aces:</p> ${aces.map(miniCardText).join(' ')}<br>`;
    if (spades.length) html += `<p>Spades:</p> ${spades.map(miniCardText).join(' ')}<br>`;
    if (twoSpades.length) html += `<p>2 of Spades:</p> ${twoSpades.map(miniCardText).join(' ')}<br>`;
    if (tenDiamonds.length) html += `<p>10 of Diamonds:</p> ${tenDiamonds.map(miniCardText).join(' ')}<br>`;
    if (others.length) html += `<p>Other cards:</p> ${others.map(miniCardText).join(' ')}<br>`;
    html += `<p>Total cards:</p> ${cards.length}<br>`;
    return html;
  }

  let html = `<b>Your collected cards:</b><br>${summarize(data.myCards)}<br>`;
  html += `<b>Opponent's collected cards:</b><br>${summarize(data.opponentCards)}<br>`;
  html += `<b>Your Tableens:</b> ${data.myTableens || 0}<br>`;
  html += `<b>Opponent's Tableens:</b> ${data.opponentTableens || 0}<br>`;

  showStatusModal(`${data.message}<br><br>${html}`);

  // Update local profile stats
  try {
    const p = getProfile() || { name: 'Player', games: 0, wins: 0, theme: 'dark', accent: '#0a84ff' };
    p.games = (p.games || 0) + 1;
    const msg = (data.message || '').toLowerCase();
    if (msg.includes('you win') || msg.includes('you won') || msg.includes('you take the round')) {
      p.wins = (p.wins || 0) + 1;
    }
    saveProfile(p);
    updateUserBadge(p);
  } catch {}
});

socket.on('opponent disconnected', (data) => {
  updateDebugInfo({ extra: "Opponent disconnected!" });
});

// drag/drop base handlers
document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  // if dropped outside a stack, play normally (new pile)
  if (draggedCard) {
    playCard({
      type: "normal",
      gameCode: currentGameCode,
      playedCard: { card: draggedCard.card, suit: draggedCard.suit }
    });
    draggedCard = null;
  }
});

// Update UI with player's hand + table
function updateGameUI(data, isYourTurn) {
  document.getElementById('cards').innerHTML = '';
  document.getElementById('opponentCards').style.display = 'flex';
  document.getElementById('opponentCards').innerHTML = '';

  for (let i = 1; i <= data.opponentCards; i++) {
    const opponentCardElement = document.createElement('img');
    opponentCardElement.src = `./cards/cardback.svg`;
    opponentCardElement.classList.add('card');
    document.getElementById('opponentCards').appendChild(opponentCardElement);
  }

  // player's hand (draggable)
  data.hand.forEach(cardArray => {
    const card = cardArray[0];
    const displayCardValue = card.card === 14 ? 1 : card.card;
    const cardElement = document.createElement('img');
    cardElement.src = `./cards/${card.suit}/${displayCardValue}.svg`;
    cardElement.classList.add('card');
    cardElement.setAttribute('draggable', true);

    cardElement.addEventListener('dragstart', function (e) {
      draggedCard = { card: displayCardValue, suit: card.suit, stackSum: card.stackSum };
      socket.emit('drag card', {
        gameCode: currentGameCode,
        card: draggedCard
      });
    });

    cardElement.addEventListener('dragend', function (e) {
      socket.emit('drag end', {
        gameCode: currentGameCode
      });
    });

    document.getElementById('cards').appendChild(cardElement);
  });

  updateTableCards(data.table, data.hand);

  const turnStatus = document.getElementById('turnStatus');
  if (isYourTurn) {
    turnStatus.innerText = 'Your turn!';
    turnStatus.style.color = 'lime';
  } else {
    turnStatus.innerText = 'Wait for your opponent...';
    turnStatus.style.color = 'red';
  }
}

// update table stacks rendering
function updateTableCards(tableCards, playerHand = []) {
  window.lastTableState = tableCards;
  const tableCardsDiv = document.getElementById('tableCards');
  tableCardsDiv.innerHTML = '';

  tableCards.forEach((stackObj, stackIndex) => {
    const stackDiv = document.createElement('div');
    stackDiv.classList.add('stack');
    stackDiv.dataset.index = stackIndex;
    stackDiv.dataset.stackId = stackObj.id;

    // Render each card in the stack
    stackObj.cards.forEach((card, idx) => {
      const cardElement = document.createElement('img');
      cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
      cardElement.classList.add('card');
      cardElement.style.setProperty('--stack-index', idx);
      cardElement.setAttribute('draggable', true);
      cardElement.addEventListener('dragstart', (e) => {
        draggedTableCard = { card: card.card, suit: card.suit, stackIndex, stackId: stackObj.id };
        socket.emit('drag card', {
          gameCode: currentGameCode,
          card: draggedCard
        });
      });

      cardElement.addEventListener('dragend', function (e) {
        socket.emit('drag end', {
          gameCode: currentGameCode
        });
      });

      stackDiv.appendChild(cardElement);
    });

    // Always show stack number
    const stackNumberDiv = document.createElement('div');
    stackNumberDiv.classList.add('stack-number');
    stackNumberDiv.innerText = stackObj.stackNumber;
    stackDiv.appendChild(stackNumberDiv);

    let cardTarget = null;
    stackDiv.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target && target.tagName === 'IMG') {
        const srcParts = (target.getAttribute('src') || '').split('/');
        const suit = srcParts[2];
        const cardVal = parseInt(srcParts[3]?.split('.')[0]);
        cardTarget = { card: cardVal, suit };
      } else {
        cardTarget = stackObj.cards[0] ? { card: stackObj.cards[0].card, suit: stackObj.cards[0].suit } : null;
      }
    });

    stackDiv.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!cardTarget && stackObj.cards.length === 0) {
        if (draggedCard) {
          playCard({
            type: "normal",
            gameCode: currentGameCode,
            playedCard: { card: draggedCard.card, suit: draggedCard.suit }
          });
          draggedCard = null;
        }
        return;
      }

      if (draggedCard) {
        // Helper to check if a card is an ace
        const isAce = (card) => card === 1 || card === 14;

        // Handle stacking two identical cards or two aces
        if (
          stackObj.cards.length === 1 &&
          (
            (isAce(stackObj.cards[0].card) && isAce(draggedCard.card)) ||
            stackObj.cards[0].card === draggedCard.card
          )
        ) {
          // Special case: stacking two aces should always be stackAsSum: true
          if (isAce(stackObj.cards[0].card) && isAce(draggedCard.card)) {
            playCard({
              type: "stack",
              gameCode: currentGameCode,
              playedCard: { card: draggedCard.card, suit: draggedCard.suit },
              stackId: stackObj.id,
              stackAsSum: true
            });
            draggedCard = null;
            return;
          }

          // Otherwise, normal identical card stacking logic
          const stackSum = stackObj.cards[0].card + draggedCard.card;
          const numInHand = playerHand.filter(arr => arr[0].card === draggedCard.card).length;
          const hasSumCard = stackSum === 14
            ? playerHand.some(arr => arr[0].card === 1 || arr[0].card === 14)
            : playerHand.some(arr => arr[0].card === stackSum);

          if (stackSum <= 14) {
            if (numInHand === 1) {
              if (hasSumCard) {
                showStackChoiceModal('Grab this pile or stack as sum?', (choice) => {
                  let playedCardValue = draggedCard.card;
                  if (choice === 'stack' && draggedCard.card === 14) {
                    playedCardValue = 1;
                  }
                  playCard({
                    type: "stack",
                    gameCode: currentGameCode,
                    playedCard: { card: playedCardValue, suit: draggedCard.suit },
                    stackId: stackObj.id,
                    stackAsSum: choice === 'sum',
                    stackSum
                  });
                  draggedCard = null;
                });
                return;
              } else {
                playCard({
                  type: "grab",
                  gameCode: currentGameCode,
                  playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                  stackId: stackObj.id
                });
                draggedCard = null;
                return;
              }
            } else if (numInHand > 1) {
              showStackChoiceModal('Grab this pile or continue stacking?', (choice) => {
                let playedCardValue = draggedCard.card;
                if (choice === 'stack' && draggedCard.card === 14) {
                  playedCardValue = 1;
                }
                playCard({
                  type: "stack",
                  gameCode: currentGameCode,
                  playedCard: { card: playedCardValue, suit: draggedCard.suit },
                  stackId: stackObj.id,
                  stackAsSum: choice === 'sum',
                  stackSum
                });
                draggedCard = null;
              }, "Stack", "Grab");
              return;
            } else {
              playCard({
                type: "grab",
                gameCode: currentGameCode,
                playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                stackId: stackObj.id
              });
              draggedCard = null;
              return;
            }
          } else {
            if (numInHand > 1) {
              showStackChoiceModal('Grab this pile or continue stacking?', (choice) => {
                let playedCardValue = draggedCard.card;
                if (choice === 'stack' && draggedCard.card === 14) {
                  playedCardValue = 1;
                }
                playCard({
                  type: "stack",
                  gameCode: currentGameCode,
                  playedCard: { card: playedCardValue, suit: draggedCard.suit },
                  stackId: stackObj.id,
                  stackAsSum: choice === 'sum',
                  stackSum
                });
                draggedCard = null;
              }, "Stack", "Grab");
              return;
            } else {
              playCard({
                type: "grab",
                gameCode: currentGameCode,
                playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                stackId: stackObj.id
              });
              draggedCard = null;
              return;
            }
          }
        }

        // If card value matches stack sum and player has more than one of that card, prompt for grab/stack
        const stackSum = stackObj.stackNumber;
        if (
          draggedCard.card === stackSum ||
          (isAce(draggedCard.card) && (stackSum === 1 || stackSum === 14))
        ) {
          const numStackSumInHand = playerHand.filter(arr =>
            arr[0].card === stackSum ||
            (isAce(arr[0].card) && (stackSum === 1 || stackSum === 14))
          ).length;
          if (numStackSumInHand > 1) {
            showStackChoiceModal(`Continue to stack <code>${stackSum}s</code> or just grab it?`, (choice) => {
              if (choice === 'stack') {
                let playedCardValue = draggedCard.card;
                if (draggedCard.card === 14) {
                  playedCardValue = 1;
                }
                playCard({
                  type: "stack",
                  gameCode: currentGameCode,
                  playedCard: { card: playedCardValue, suit: draggedCard.suit },
                  stackId: stackObj.id
                });
                draggedCard = null;
              } else {
                playCard({
                  type: "grab",
                  gameCode: currentGameCode,
                  playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                  stackId: stackObj.id
                });
                draggedCard = null;
              }
            }, "Stack", "Grab");
            return;
          }
          playCard({
            type: "grab",
            gameCode: currentGameCode,
            playedCard: { card: draggedCard.card, suit: draggedCard.suit },
            stackId: stackObj.id
          });
          draggedCard = null;
          return;
        }

        // Otherwise, just stack (do NOT send stackAsSum if sum > 14 or if just matching stack sum)
        const sum = stackObj.cards.length === 1 ? stackObj.cards[0].card + draggedCard.card : null;
        if (sum !== null && sum > 14) {
          let playedCardValue = draggedCard.card;
          if (draggedCard.card === 14) {
            playedCardValue = 1;
          }
          playCard({
            type: "stack",
            gameCode: currentGameCode,
            playedCard: { card: playedCardValue, suit: draggedCard.suit },
            stackId: stackObj.id
          });
          draggedCard = null;
          return;
        } else if (sum !== null && sum <= 14) {
          let playedCardValue = draggedCard.card;
          if (draggedCard.card === 14) {
            playedCardValue = 1;
          }
          playCard({
            type: "stack",
            gameCode: currentGameCode,
            playedCard: { card: playedCardValue, suit: draggedCard.suit },
            stackId: stackObj.id
          });
          draggedCard = null;
          return;
        } else {
          let playedCardValue = draggedCard.card;
          if (draggedCard.card === 14) {
            playedCardValue = 1;
          }
          playCard({
            type: "stack",
            gameCode: currentGameCode,
            playedCard: { card: playedCardValue, suit: draggedCard.suit },
            stackId: stackObj.id
          });
          draggedCard = null;
          return;
        }
      } else if (draggedTableCard) {
        // Boardstack (move a whole table-stack onto another)
        const fromStack = window.lastTableState.find(s => s.id === draggedTableCard.stackId);
        const toStack = stackObj;
        if (!fromStack || !toStack) {
          showStatusModal('Error: Invalid stacks for boardstack.');
          draggedTableCard = null;
          return;
        }

        // Smart boardstack logic
        const fromSum = fromStack.cards.reduce((acc, c) => acc + c.card, 0);
        const toSum = toStack.cards.reduce((acc, c) => acc + c.card, 0);
        const sum = fromSum + toSum;
        const hasSumCard = sum === 14
          ? playerHand.some(arr => arr[0].card === 1 || arr[0].card === 14)
          : playerHand.some(arr => arr[0].card === sum);
        const hasStackCard = playerHand.some(arr => arr[0].card === toStack.stackNumber);

        if (sum <= 14) {
          // Only prompt if both stacks are made of identical cards
          const allFromSame = fromStack.cards.every(c => c.card === fromStack.cards[0].card);
          const allToSame = toStack.cards.every(c => c.card === toStack.cards[0].card);
          const sameValue = allFromSame && allToSame && (fromStack.cards[0].card === toStack.cards[0].card);

          const isAce = (card) => card === 1 || card === 14;
          const allFromAces = fromStack.cards.every(c => isAce(c.card));
          const allToAces = toStack.cards.every(c => isAce(c.card));
          const bothAceStacks = allFromAces && allToAces;

          if (bothAceStacks) {
            // Always combine as sum for two ace stacks
            playCard({
              type: "boardstack",
              gameCode: currentGameCode,
              from: fromStack.id,
              to: toStack.id,
              stackAsSum: true
            });
            draggedTableCard = null;
            return;
          }

          if (sameValue && hasSumCard && hasStackCard) {
            showStackChoiceModal('Combine as sum or keep as stack?', (choice) => {
              playCard({
                type: "boardstack",
                gameCode: currentGameCode,
                from: fromStack.id,
                to: toStack.id,
                stackAsSum: choice === 'sum'
              });
              draggedTableCard = null;
            }, "Stack", "Sum");
            return;
          } else if (hasSumCard) {
            playCard({
              type: "boardstack",
              gameCode: currentGameCode,
              from: fromStack.id,
              to: toStack.id,
              stackAsSum: true
            });
            draggedTableCard = null;
            return;
          } else {
            playCard({
              type: "boardstack",
              gameCode: currentGameCode,
              from: fromStack.id,
              to: toStack.id,
              stackAsSum: false
            });
            draggedTableCard = null;
            return;
          }
        }

        // If the sum of both stacks matches, just merge (do NOT send stackAsSum)
        if (fromSum === toSum) {
          playCard({
            type: "boardstack",
            gameCode: currentGameCode,
            from: fromStack.id,
            to: toStack.id
          });
          draggedTableCard = null;
          return;
        }
        // If both stacks have the same stackNumber, just merge as a stack (classic stack)
        console.log(fromStack.stackNumber, toStack.stackNumber);
        if (fromStack.stackNumber === toStack.stackNumber) {
          playCard({
            type: "boardstack",
            gameCode: currentGameCode,
            from: fromStack.id,
            to: toStack.id,
            stackAsSum: false // classic stack
          });
          draggedTableCard = null;
          return;
        }

        // Otherwise, send boardstack with stackAsSum: true if sum <= 14
        const allCards = [...fromStack.cards, ...toStack.cards];
        const totalSum = allCards.reduce((acc, c) => acc + c.card, 0);
        if (totalSum > 14) {
          showStatusModal('Cannot create a stack above 14!');
          draggedTableCard = null;
          return;
        }
        playCard({
          type: "boardstack",
          gameCode: currentGameCode,
          from: fromStack.id,
          to: toStack.id,
          stackAsSum: true
        });
        draggedTableCard = null;
        return;
      }
    });

    tableCardsDiv.appendChild(stackDiv);
  });
}

function playCard(action) {
  if (!action.gameCode) action.gameCode = currentGameCode;
  socket.emit('play card', action);
  console.info(action)
}

let lastDebugGameCode = null;

function updateDebugInfo({ gameCode, extra }) {
  if (gameCode) lastDebugGameCode = gameCode;
  const debugDiv = document.getElementById('debugInfo');
  debugDiv.innerHTML = `
    <b>Game Code:</b> ${lastDebugGameCode || '—'}<br>
    ${extra ? `<div>${extra}</div>` : ''}
  `;
}

// Profile & Theme persistence
const PROFILE_KEY = 'tableen:profile';
function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; } catch { return null; }
}
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
function applyTheme(theme, accent) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  if (accent) document.documentElement.style.setProperty('--accent', accent);
}
function updateUserBadge(profile) {
  const badge = document.getElementById('userBadge');
  if (!badge) return;
  const nameEl = document.getElementById('userName');
  const statsEl = document.getElementById('userStats');
  if (!profile) { badge.classList.add('hidden'); return; }
  nameEl.textContent = profile.name || 'Player';
  const games = profile.games || 0;
  const wins = profile.wins || 0;
  const pct = games ? Math.round((wins / games) * 100) : 0;
  statsEl.textContent = `${wins}W • ${games}G • ${pct}%`;
  badge.classList.remove('hidden');
}
function initProfileAndTheme() {
  const existing = getProfile();
  const overlay = document.getElementById('welcomeOverlay');
  const nameInput = document.getElementById('playerNameInput');
  const accentPicker = document.getElementById('accentPicker');
  const swatches = document.getElementById('accentSwatches');
  const saveBtn = document.getElementById('saveWelcome');
  const themeInputs = document.querySelectorAll('input[name="theme"]');

  function setThemePreview() {
    const selectedTheme = [...themeInputs].find(r => r.checked)?.value || 'dark';
    const acc = accentPicker?.value || '#0a84ff';
    applyTheme(selectedTheme, acc);
  }

  const openSettings = document.getElementById('openSettings');
  if (openSettings) {
    openSettings.addEventListener('click', () => {
      const p = getProfile() || { name: '', theme: 'dark', accent: '#0a84ff', games: 0, wins: 0 };
      if (nameInput) nameInput.value = p.name || '';
      if (accentPicker) accentPicker.value = p.accent || '#0a84ff';
      themeInputs.forEach(r => r.checked = (r.value === (p.theme || 'dark')));
      setThemePreview();
      overlay?.classList.remove('hidden');
    });
  }

  if (swatches) {
    swatches.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-color]');
      if (!btn || !accentPicker) return;
      accentPicker.value = btn.dataset.color;
      setThemePreview();
    });
  }
  accentPicker?.addEventListener('input', setThemePreview);
  themeInputs.forEach(r => r.addEventListener('change', setThemePreview));

  if (existing && existing.name) {
    applyTheme(existing.theme || 'dark', existing.accent || '#0a84ff');
    updateUserBadge(existing);
  } else {
    overlay?.classList.remove('hidden');
    setThemePreview();
  }

  saveBtn?.addEventListener('click', () => {
    const name = (nameInput?.value || '').trim().slice(0, 18) || 'Player';
    const theme = [...themeInputs].find(r => r.checked)?.value || 'dark';
    const accent = accentPicker?.value || '#0a84ff';
    const base = getProfile() || { games: 0, wins: 0 };
    const profile = { ...base, name, theme, accent };
    saveProfile(profile);
    applyTheme(theme, accent);
    updateUserBadge(profile);
    overlay?.classList.add('hidden');
  });
}

// Hook into opponent card rendering to add accent overlay class if possible
const _origUpdateGameUI = typeof updateGameUI === 'function' ? updateGameUI : null;
if (_origUpdateGameUI) {
  window.updateGameUI = function(data, isYourTurn) {
    _origUpdateGameUI.call(this, data, isYourTurn);
    // After base render, add accent class to opponent backs
    document.querySelectorAll('#opponentCards img').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (src.includes('cardback')) img.classList.add('opponent-back');
    });
  }
}