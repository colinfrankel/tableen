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

socket.on('status', (msg) => {
  showStatusModal(msg);
  updateDebugInfo({ extra: msg });
});

socket.on('round over', (data) => {
  // Helper to format a card as a mini image
function miniCardText(c) {
  // Card value
  let val = c.card;
  if (val === 1 || val === 14) val = 'A';
  if (val === 11) val = 'J';
  if (val === 12) val = 'Q';
  if (val === 13) val = 'K';

  // Suit emoji and color
  let suit = '';
  let color = '';
  switch (c.suit) {
    case 'hearts':
      suit = '♥️'; color = 'red'; break;
    case 'diamonds':
      suit = '♦️'; color = 'red'; break;
    case 'clubs':
      suit = '♣️'; color = 'black'; break;
    case 'spades':
      suit = '♠️'; color = 'black'; break;
  }
  return `<span class="mini-card" style="display:inline-block;min-width:22px;color:${color};font-weight:bold;font-size:1.1em;text-align:center;">${val}${suit}</span>`;
}

  function summarize(cards) {
    // Separate aces (card 1 or 14)
    const aces = cards.filter(c => c.card === 1 || c.card === 14);
    // Spades (not ace or 2)
    const spades = cards.filter(c => c.suit === 'spades' && c.card !== 1 && c.card !== 2);
    // 2 of spades
    const twoSpades = cards.filter(c => c.card === 2 && c.suit === 'spades');
    // 10 of diamonds
    const tenDiamonds = cards.filter(c => c.card === 10 && c.suit === 'diamonds');
    // Other cards
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

  // Determine which player you are
  const myKey = socket.id === data.playerIds?.playerOne ? 'playerOne' : 'playerTwo';
  const oppKey = myKey === 'playerOne' ? 'playerTwo' : 'playerOne';
  const myCards = data.collected[myKey] || [];
  const oppCards = data.collected[oppKey] || [];

  let html = `<b>Your collected cards:</b><br>${summarize(myCards)}<br>`;
  html += `<b>Opponent's collected cards:</b><br>${summarize(oppCards)}<br>`;

  showStatusModal(`${data.message}<br><br>${html}`);
  updateDebugInfo({ extra: html });
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
    const displayCardValue = card.card === 1 ? 14 : card.card;
    const cardElement = document.createElement('img');
    cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
    cardElement.classList.add('card');
    cardElement.setAttribute('draggable', true);

    cardElement.addEventListener('dragstart', function (e) {
      draggedCard = { card: displayCardValue, suit: card.suit, stackSum: card.stackSum };
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
          if (sum <= 14) {
            if (numInHand === 1) {
              if (hasSumCard) {
                showStackChoiceModal('Grab this pile or stack as sum?', (choice) => {
                  console.log(`Player chose to ${choice} the stack`);
                  let playedCardValue = draggedCard.card;
                  if (choice === 'stack' && draggedCard.card === 14) {
                    playedCardValue = 1;
                  }
                  playCard({
                    type: choice === 'stack' ? "stack" : "grab",
                    gameCode: currentGameCode,
                    playedCard: { card: playedCardValue, suit: draggedCard.suit },
                    stackId: stackObj.id,
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
                console.log(`Player chose to ${choice} the stack`);
                let playedCardValue = draggedCard.card;
                if (choice === 'stack' && draggedCard.card === 14) {
                  playedCardValue = 1;
                }
                playCard({
                  type: choice === 'stack' ? "stack" : "grab",
                  gameCode: currentGameCode,
                  playedCard: { card: playedCardValue, suit: draggedCard.suit },
                  stackId: stackObj.id,
                  stackAsSum: choice === 'sum'
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
                console.log(`Player chose to ${choice} the stack`);
                let playedCardValue = draggedCard.card;
                if (choice === 'stack' && draggedCard.card === 14) {
                  playedCardValue = 1;
                }
                playCard({
                  type: choice === 'sum' ? "stack" : "grab",
                  gameCode: currentGameCode,
                  playedCard: { card: playedCardValue, suit: draggedCard.suit },
                  stackId: stackObj.id,
                  stackAsSum: choice === 'sum'
                });
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
        if (draggedCard.card === stackSum) {
          const numStackSumInHand = playerHand.filter(arr => arr[0].card === stackSum).length;
          if (numStackSumInHand > 1) {
            showStackChoiceModal('Grab this pile or just stack?', (choice) => {
              console.log(`Player chose to ${choice} the stack`);
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
        const hasSumCard = playerHand.some(arr => arr[0].card === sum);
        const hasStackCard = playerHand.some(arr => arr[0].card === toStack.stackNumber);

        if (sum <= 14) {
          if (hasSumCard && hasStackCard) {
            showStackChoiceModal('Combine as sum or keep as stack?', (choice) => {
              console.log(`Player chose to ${choice} the stack`);
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

        // Otherwise, send boardstack with stackAsSum: true if sum <= 14
        const allCards = [...fromStack.cards, ...toStack.cards];
        const totalSum = allCards.reduce((acc, c) => acc + c.card, 0);
        if (totalSum > 14) {
          showStatusModal('Cannot create a stack above 14.');
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