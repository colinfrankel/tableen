// Modal logic
function showStackChoiceModal(message, onChoice, btn1Label = "Stack", btn2Label = "Sum") {
  const overlay = document.getElementById('modalOverlay');
  const msg = document.getElementById('modalMessage');
  const btns = document.querySelector('.modal-buttons');
  msg.textContent = message || 'Stack as two cards or as a single sum?';
  overlay.classList.remove('hidden');
  btns.innerHTML = `<button id="modalOption1">${btn1Label}</button><button id="modalOption2">${btn2Label}</button>`;
  const btn1 = document.getElementById('modalOption1');
  const btn2 = document.getElementById('modalOption2');
  function cleanup() {
    overlay.classList.add('hidden');
    btn1.removeEventListener('click', asOne);
    btn2.removeEventListener('click', asTwo);
  }
  function asOne() { cleanup(); onChoice('stack'); }
  function asTwo() { cleanup(); onChoice('grab'); }
  btn1.addEventListener('click', asOne);
  btn2.addEventListener('click', asTwo);
}

let draggedCard = null;
let draggedTableCard = null;
let currentGameCode = null;
let socket = io("http://localhost:3000");

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

function showGameCode(code) {
  gameCodeSpan.innerText = code;
  gameCodeBox.classList.remove('hidden');
  lobbyStatus.innerText = `In game ${code}`;
}

// socket events
socket.on('connect', () => {
  updateDebugInfo({ extra: `Connected to Server!` });
});

socket.on('game created', ({ code }) => {
  currentGameCode = code;
  showGameCode(code);
  lobbyStatus.innerText = `Game ${code} created — waiting for other player...`;
  document.getElementById('gameStartOptions').classList.add('hidden');
  updateDebugInfo({ gameCode: currentGameCode, socketId: socket.id });

});

socket.on('joined', (data) => {
  document.getElementById('lobby').classList.add('hidden');
  updateDebugInfo({ gameCode: currentGameCode, socketId: socket.id });

});

socket.on('your turn', (data) => {
  currentGameCode = data.gameCode || currentGameCode;
  updateGameUI(data, true);
  updateDebugInfo({
    gameCode: currentGameCode,
    socketId: socket.id,
    extra: `
      <b>Deck Size:</b> ${data.deck ? data.deck.length : '—'}<br>
      <b>Your Hand:</b> ${data.hand.map(arr => arr[0].card + arr[0].suit[0].toUpperCase()).join(', ')}<br>
      <b>Opponent Cards:</b> ${data.opponentCards}<br>
      <b>Table:</b> ${data.table.map(s => `[${s.stackNumber}: ${s.cards.map(c => c.card + c.suit[0].toUpperCase()).join(', ')}]`).join(' ')}<br>
    `
  });
});

socket.on('wait', (data) => {
  currentGameCode = data.gameCode || currentGameCode;
  updateGameUI(data, false);
  updateDebugInfo({
    gameCode: currentGameCode,
    socketId: socket.id,
    extra: `
      <b>Deck Size:</b> ${data.deck ? data.deck.length : '—'}<br>
      <b>Your Hand:</b> ${data.hand.map(arr => arr[0].card + arr[0].suit[0].toUpperCase()).join(', ')}<br>
      <b>Opponent Cards:</b> ${data.opponentCards}<br>
      <b>Table:</b> ${data.table.map(s => `[${s.stackNumber}: ${s.cards.map(c => c.card + c.suit[0].toUpperCase()).join(', ')}]`).join(' ')}<br>
    `
  });
});

socket.on('update table', (table, hand) => {
  updateTableCards(table, hand);
});

// Show status in a modal (replace alert)
function showStatusModal(msg) {
  const overlay = document.getElementById('modalOverlay');
  const msgDiv = document.getElementById('modalMessage');
  const btns = document.querySelector('.modal-buttons');
  msgDiv.textContent = msg;
  overlay.classList.remove('hidden');
  btns.innerHTML = '<button id="modalOk">OK</button>';
  document.getElementById('modalOk').onclick = () => overlay.classList.add('hidden');
}

socket.on('status', (msg) => {
  showStatusModal(msg);
  updateDebugInfo({ extra: msg });
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
    const cardElement = document.createElement('img');
    cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
    cardElement.classList.add('card');
    cardElement.setAttribute('draggable', true);

    cardElement.addEventListener('dragstart', function (e) {
      draggedCard = { card: card.card, suit: card.suit, stackSum: card.stackSum };
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
          console.log('Drop on empty stack: playing card as new pile');
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
        // Handle stacking two identical cards
        if (stackObj.cards.length === 1 && stackObj.cards[0].card === draggedCard.card) {
          const sum = stackObj.cards[0].card + draggedCard.card;
          const numInHand = playerHand.filter(arr => arr[0].card === draggedCard.card).length;
          const hasSumCard = playerHand.some(arr => arr[0].card === sum);
          console.log(`[IF] Stacking two identical cards: stack card=${stackObj.cards[0].card}, dragged card=${draggedCard.card}, sum=${sum}, numInHand=${numInHand}, hasSumCard=${hasSumCard}`);
          if (sum <= 14) {
            if (numInHand === 1) {
              if (hasSumCard) {
                console.log('[CHOICE] Only one in hand and CAN sum: prompt for grab or sum');
                showStackChoiceModal('Grab this pile or stack as sum?', (choice) => {
                  console.log(`[MODAL CHOICE] User chose: ${choice}`);
                  playCard({
                    type: choice === 'sum' ? "stack" : "grab",
                    gameCode: currentGameCode,
                    playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                    stackId: stackObj.id,
                    stackAsSum: choice === 'sum'
                  });
                  draggedCard = null;
                });
                return;
              } else {
                console.log('[ACTION] Only one in hand and CAN\'T sum: just grab');
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
              console.log('[CHOICE] More than one in hand: always prompt, even if can\'t sum');
              showStackChoiceModal('Grab this pile or continue stacking?', (choice) => {
                console.log(`[MODAL CHOICE] User chose: ${choice}`);
                playCard({
                  type: choice === 'stack' ? "stack" : "grab",
                  gameCode: currentGameCode,
                  playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                  stackId: stackObj.id,
                  stackAsSum: choice === 'sum'
                });
                draggedCard = null;
              });
              return;
            } else {
              console.log('[ACTION] Only one in hand and can\'t sum: just grab');
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
              console.log('[CHOICE] Sum > 14 and more than one in hand: prompt for grab or stack');
              showStackChoiceModal('Grab this pile or continue stacking?', (choice) => {
                console.log(`[MODAL CHOICE] User chose: ${choice}`);
                playCard({
                  type: choice === 'stack' ? "stack" : "grab",
                  gameCode: currentGameCode,
                  playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                  stackId: stackObj.id
                });
              }, "Stack", "Grab");
              return;
            } else {
              // Only one in hand: auto grab
              console.log('[ACTION] Sum > 14 and only one in hand: auto grab');
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

        console.log('draggedCard:', draggedCard);

        // If card value matches stack sum and player has more than one of that card, prompt for grab/stack
        const stackSum = stackObj.stackNumber;
        if (draggedCard.card === stackSum) {
          console.log(`[IF] Dragged card matches stack sum: stackSum=${stackSum}, draggedCard=${draggedCard.card}`);
          const numStackSumInHand = playerHand.filter(arr => arr[0].card === stackSum).length;
          console.log(playerHand)
          console.log(`[COUNT] Number of stack sum in hand: ${numStackSumInHand}`);
          if (numStackSumInHand > 1) {
            console.log('[CHOICE] More than one matching card in hand: prompt for grab or stack');
            showStackChoiceModal('Grab this pile or just stack?', (choice) => {
              console.log(`[MODAL CHOICE] User chose: ${choice}`);
              if (choice === 'stack') {
                playCard({
                  type: "stack",
                  gameCode: currentGameCode,
                  playedCard: { card: draggedCard.card, suit: draggedCard.suit },
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
          console.log('[ACTION] Only one matching card in hand: auto grab');
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
          console.log('[ACTION] Sum > 14, just stack (not sum)');
          playCard({
            type: "stack",
            gameCode: currentGameCode,
            playedCard: { card: draggedCard.card, suit: draggedCard.suit },
            stackId: stackObj.id
          });
          draggedCard = null;
          return;
        } else if (sum !== null && sum <= 14) {
          console.log('[ACTION] Sum <= 14, send stackAsSum: true');
          playCard({
            type: "stack",
            gameCode: currentGameCode,
            playedCard: { card: draggedCard.card, suit: draggedCard.suit },
            stackId: stackObj.id,
            stackAsSum: true
          });
          draggedCard = null;
          return;
        } else {
          console.log('[ACTION] All other cases, just stack');
          playCard({
            type: "stack",
            gameCode: currentGameCode,
            playedCard: { card: draggedCard.card, suit: draggedCard.suit },
            stackId: stackObj.id
          });
          draggedCard = null;
          return;
        }
      } else if (draggedTableCard) {
        console.log('[IF] Dragging table card:', draggedTableCard);
        // Boardstack (move a whole table-stack onto another)
        const fromStack = window.lastTableState.find(s => s.id === draggedTableCard.stackId);
        const toStack = stackObj;
        if (!fromStack || !toStack) {
          console.log('[ERROR] Invalid stacks for boardstack.');
          showStatusModal('Error: Invalid stacks for boardstack.');
          draggedTableCard = null;
          return;
        }
        // If both stacks are single cards of the same value and sum <= 14, prompt
        if (
          fromStack.cards.length === 1 &&
          toStack.cards.length === 1 &&
          fromStack.cards[0].card === toStack.cards[0].card &&
          fromStack.cards[0].card + toStack.cards[0].card <= 14
        ) {
          console.log('[CHOICE] Both stacks are single cards of same value and sum <= 14: prompt for sum or stack');
          showStackChoiceModal('Combine as sum or keep as stack?', (choice) => {
            console.log(`[MODAL CHOICE] User chose: ${choice}`);
            playCard({
              type: "boardstack",
              gameCode: currentGameCode,
              from: fromStack.id,
              to: toStack.id,
              stackAsSum: choice === 'sum'
            });
            draggedTableCard = null;
          });
          return;
        }
        // If the sum of both stacks matches, just merge (do NOT send stackAsSum)
        const fromSum = fromStack.cards.reduce((acc, c) => acc + c.card, 0);
        const toSum = toStack.cards.reduce((acc, c) => acc + c.card, 0);
        if (fromSum === toSum) {
          console.log('[ACTION] Sum of both stacks matches: just merge');
          playCard({
            type: "boardstack",
            gameCode: currentGameCode,
            from: fromStack.id,
            to: toStack.id
          });
          draggedTableCard = null;
          return;
        }
        // Otherwise, send boardstack with stackAsSum: true if sum <= 14
        const allCards = [...fromStack.cards, ...toStack.cards];
        const sum = allCards.reduce((acc, c) => acc + c.card, 0);
        if (sum <= 14) {
          console.log('[ACTION] Sum of all cards <= 14: send boardstack with stackAsSum: true');
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
          console.log('[ERROR] Cannot create a stack above 14.');
          showStatusModal('Cannot create a stack above 14.');
          draggedTableCard = null;
          return;
        }
      }
    });

    tableCardsDiv.appendChild(stackDiv);
  });
}

function playCard(action) {
  if (!action.gameCode) action.gameCode = currentGameCode;
  socket.emit('play card', action);
  console.info('Action', action);
}

function updateDebugInfo({ gameCode, socketId, extra }) {
  const debugDiv = document.getElementById('debugInfo');
  debugDiv.innerHTML = `
    <b>Game Code:</b> ${gameCode || '—'}<br>
    <b>Socket ID:</b> ${socket.id || '—'}<br>
    ${extra ? `<div>${extra}</div>` : ''}
  `;
}