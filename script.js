// Modal logic
function showStackChoiceModal(message, onChoice) {
  const overlay = document.getElementById('modalOverlay');
  const msg = document.getElementById('modalMessage');
  const btns = document.querySelector('.modal-buttons');
  msg.textContent = message || 'Stack as two cards or as a single sum?';
  overlay.classList.remove('hidden');
  btns.innerHTML = '<button id="modalOption1">Stack</button><button id="modalOption2">Sum</button>';
  const btn1 = document.getElementById('modalOption1');
  const btn2 = document.getElementById('modalOption2');
  function cleanup() {
    overlay.classList.add('hidden');
    btn1.removeEventListener('click', asTwo);
    btn2.removeEventListener('click', asSum);
  }
  function asTwo() { cleanup(); onChoice('stack'); }
  function asSum() { cleanup(); onChoice('sum'); }
  btn1.addEventListener('click', asTwo);
  btn2.addEventListener('click', asSum);
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
  socket.emit('create game', (res) => {});
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
  console.log('Connected to server');
});

socket.on('game created', ({ code }) => {
  currentGameCode = code;
  showGameCode(code);
  lobbyStatus.innerText = `Game ${code} created — waiting for other player...`;
});

socket.on('joined', (data) => {
  lobbyStatus.innerText = `Game ${data.code} started!`;
});

socket.on('your turn', (data) => {
  currentGameCode = data.gameCode || currentGameCode;
  updateGameUI(data, true);
});

socket.on('wait', (data) => {
  currentGameCode = data.gameCode || currentGameCode;
  updateGameUI(data, false);
});

socket.on('update table', (table) => {
  updateTableCards(table);
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
  console.log('Status:', msg);
});

socket.on('opponent disconnected', (data) => {
  alert(data.message || 'Opponent disconnected. The game ended.');
  document.getElementById('title').innerText = 'Opponent disconnected';
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
  document.getElementById('title').innerHTML = '';
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

  updateTableCards(data.table);

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
function updateTableCards(tableCards) {
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

    // Always show stack number (now explicit)
    const stackNumberDiv = document.createElement('div');
    stackNumberDiv.classList.add('stack-number');
    stackNumberDiv.innerText = stackObj.stackNumber;
    stackDiv.appendChild(stackNumberDiv);

    // track the last hovered card inside stack for drop target
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

      // If dragging from hand, stack onto table
      if (draggedCard) {
        // If stacking two identical cards (single card stack), prompt for sum/stack
        if (stackObj.cards.length === 1 && stackObj.cards[0].card === draggedCard.card) {
          const sum = stackObj.cards[0].card + draggedCard.card;
          if (sum <= 14) {
            showStackChoiceModal('Stack as two cards or as a single sum?', (choice) => {
              playCard({
                type: "stack",
                gameCode: currentGameCode,
                playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                stackId: stackObj.id,
                stackAsSum: choice === 'sum'
              });
              draggedCard = null;
            });
            return;
          }
        }
        // If card value matches stack sum, prompt for grab/stack
        const stackSum = stackObj.cards.reduce((acc, num) => acc + num.card, 0);
        if (draggedCard.card === stackSum) {
          showStackChoiceModal('Grab this pile or just stack?', (choice) => {
            if (choice === 'stack') {
              playCard({
                type: "stack",
                gameCode: currentGameCode,
                playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                stackId: stackObj.id
              });
            } else {
              playCard({
                type: "grab",
                gameCode: currentGameCode,
                playedCard: { card: draggedCard.card, suit: draggedCard.suit },
                stackId: stackObj.id
              });
            }
            draggedCard = null;
          });
          return;
        }
        // Otherwise, just stack
        playCard({
          type: "stack",
          gameCode: currentGameCode,
          playedCard: { card: draggedCard.card, suit: draggedCard.suit },
          stackId: stackObj.id
        });
        draggedCard = null;
      } else if (draggedTableCard) {
        // Boardstack (move a whole table-stack onto another) -- use stack IDs!
        const fromStack = window.lastTableState.find(s => s.id === draggedTableCard.stackId);
        const toStack = stackObj;
        if (!fromStack || !toStack) {
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
          showStackChoiceModal('Combine as sum or keep as stack?', (choice) => {
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
        // Otherwise, just send the boardstack action
        playCard({
          type: "boardstack",
          gameCode: currentGameCode,
          from: fromStack.id,
          to: toStack.id
        });
        draggedTableCard = null;
      }
    });

    tableCardsDiv.appendChild(stackDiv);
  });
}

function playCard(action) {
  if (!action.gameCode) action.gameCode = currentGameCode;
  socket.emit('play card', action);
  console.log('ACTION SENT:', action);
}