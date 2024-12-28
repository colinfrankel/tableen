var socket = io('https://tabline.onrender.com');

socket.on('connect', function () {
  console.log("connected!");
  socket.emit('create user');
});

socket.on('disconnect', function () {
  document.body.innerHTML = 'Disconnected, reload to start a new game';
});

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

function updateGameUI(data, isYourTurn) {
  document.getElementById('opponentCards').style.display = 'flex';

  // Update player's hand
  const cardsDiv = document.getElementById('cards');
  cardsDiv.innerHTML = '';
  data.hand.forEach(card => {
    const cardImg = document.createElement('img');
    cardImg.className = 'card';
    cardImg.src = `./cards/${card.suit}/${card.card}.svg`;
    cardImg.onclick = () => playCard(card.card, card.suit);
    cardsDiv.appendChild(cardImg);
  });

  // Update table cards
  updateTableCards(data.table);

  // Show turn status
  const turnStatusDiv = document.getElementById('turnStatus');
  if (isYourTurn) {
    turnStatusDiv.innerText = 'Your turn!';
    turnStatusDiv.style.color = 'green';
  } else {
    turnStatusDiv.innerText = 'Wait for your opponent...';
    turnStatusDiv.style.color = 'red';
  }
}

function updateTableCards(tableCards) {
  const tableCardsDiv = document.getElementById('tableCards');
  tableCardsDiv.innerHTML = '';

  tableCards.forEach((stack, index) => {
    const stackDiv = document.createElement('div');
    stackDiv.className = 'card-stack';
    stackDiv.dataset.stackIndex = index;

    stack.forEach(card => {
      const cardImg = document.createElement('img');
      cardImg.className = 'card';
      cardImg.src = `./cards/${card.suit}/${card.card}.svg`;
      stackDiv.appendChild(cardImg);
    });

    tableCardsDiv.appendChild(stackDiv);
  });
}

function playCard(cardValue, cardSuit) {
  const action = prompt('Enter "grab" to grab a card, "stack" to stack, or leave blank to play.');
  if (action === 'grab') {
    const targetCard = prompt('Enter the value and suit of the card to grab (e.g., 4 clubs).');
    if (targetCard) {
      const [targetValue, targetSuit] = targetCard.split(' ');
      socket.emit('play card', {
        playedCard: { card: cardValue, suit: cardSuit },
        targetCard: { card: parseInt(targetValue), suit: targetSuit }
      });
    }
  } else if (action === 'stack') {
    const stackSum = prompt('Enter the current stack sum.');
    if (stackSum) {
      socket.emit('play card', {
        playedCard: { card: cardValue, suit: cardSuit },
        stackTarget: { sum: parseInt(stackSum) }
      });
    }
  } else {
    socket.emit('play card', { playedCard: { card: cardValue, suit: cardSuit } });
  }
}
