let draggedCard = null;
let socket = io("http://localhost:3000");

socket.on('connect', function () {
  console.log("Connected to server!");
  socket.emit('create user');
});

socket.on('disconnect', function () {
  document.body.innerHTML = 'Disconnected, reload to start a new game';
});

// Update game UI with the current player's cards and table
socket.on('your turn', function (data) {
  updateGameUI(data, true);
});

socket.on('wait', function (data) {
  updateGameUI(data, false);
});

socket.on('update table', function (table) {
  updateTableCards(table);
});

socket.on('status', function (status) {
  alert(status);
});

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.body.addEventListener('drop', function (e) {
  e.preventDefault();
  e.stopPropagation()
  if (draggedCard && e.explicitOriginalTarget.getAttribute("class") != "card") {
    playCard(draggedCard.card, draggedCard.suit, undefined, undefined, "normal");
  }
})

// Function to update the game UI
function updateGameUI(data, isYourTurn) {
  document.getElementById('title').innerHTML = '';
  document.getElementById('cards').innerHTML = '';
  document.getElementById('opponentCards').style.display = 'flex';
  document.getElementById('opponentCards').innerHTML = ''
  for (i = 1; i < data.opponentCards + 1; i++) {
    const opponentCardElement = document.createElement('img');
    opponentCardElement.src = `./cards/cardback.svg`;
    opponentCardElement.classList.add('card');
    document.getElementById('opponentCards').appendChild(opponentCardElement);
  }

  // Populate player's hand with draggable cards
  data.hand.forEach(card => {
    const cardElement = document.createElement('img');
    cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
    cardElement.classList.add('card');
    cardElement.setAttribute('draggable', true);
    cardElement.dataset.card = card.card;
    cardElement.dataset.suit = card.suit;

    cardElement.addEventListener('dragstart', function (e) {
      draggedCard = { card: card.card, suit: card.suit };
    });

    document.getElementById('cards').appendChild(cardElement);
  });

  updateTableCards(data.table);

  // Show turn status
  const turnStatus = document.getElementById('turnStatus');
  if (isYourTurn) {
    turnStatus.innerText = 'Your turn!';
    turnStatus.style.color = 'green';
  } else {
    turnStatus.innerText = 'Wait for your opponent...';
    turnStatus.style.color = 'red';
  }
}

// Function to update table cards
function updateTableCards(tableCards) {
  const tableCardsDiv = document.getElementById('tableCards');
  tableCardsDiv.innerHTML = '';
  tableCards.forEach(card => {
    const cardElement = document.createElement('img');
    cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
    cardElement.classList.add('card');
    let cardTarget;
    cardElement.addEventListener('dragover', function (e) {
      e.preventDefault();
      cardTarget = {
        card: parseInt(e.explicitOriginalTarget.getAttribute("src").split("/")[3].split(".")[0]),
        suit: e.explicitOriginalTarget.getAttribute("src").split("/")[2]
      }
    });
    cardElement.addEventListener('drop', function (e) {
      e.preventDefault();
      if (draggedCard) {
        playCard(draggedCard.card, draggedCard.suit, cardTarget.card, cardTarget.suit, "stack");
        draggedCard = null;
      } else {
        playCard(draggedCard.card, draggedCard.suit, cardTarget.card, cardTarget.suit, "normal");
      }
    });
    tableCardsDiv.appendChild(cardElement);
  });
}

// Function to handle card play
function playCard(cardValue, cardSuit, targetValue, targetSuit, actionType) {
  socket.emit('play card', {
    playedCard: { card: cardValue, suit: cardSuit },
    targetCard: {card: targetValue, suit: targetSuit},
    actionType: actionType
  });
}
