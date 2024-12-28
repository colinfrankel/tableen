var socket = io();

socket.on('connect', function () {
  socket.emit('create user');
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

function updateGameUI(data, isYourTurn) {
  updateTableCards(data.table);
  updatePlayerCards(data.hand);
  document.getElementById('turnStatus').textContent = isYourTurn ? "Your turn!" : "Wait for your opponent...";
}

function updateTableCards(cards) {
  const tableDiv = document.getElementById('tableCards');
  tableDiv.innerHTML = '';
  cards.forEach(card => {
    const img = document.createElement('img');
    img.className = 'card';
    img.src = `./cards/${card.suit}/${card.card}.svg`;
    tableDiv.appendChild(img);
  });
}

function updatePlayerCards(hand) {
  const handDiv = document.getElementById('cards');
  handDiv.innerHTML = '';
  hand.forEach(card => {
    const img = document.createElement('img');
    img.className = 'card';
    img.src = `./cards/${card.suit}/${card.card}.svg`;
    img.onclick = () => playCard(card.card, card.suit);
    handDiv.appendChild(img);
  });
}

function playCard(cardValue, cardSuit) {
  const action = prompt('Play or grab (leave blank for play)?');
  if (action === 'grab') {
    const targetCard = prompt('Card to grab (value suit)?').split(' ');
    socket.emit('play card', { playedCard: { card: cardValue, suit: cardSuit }, targetCard: { card: parseInt(targetCard[0]), suit: targetCard[1] } });
  } else {
    socket.emit('play card', { playedCard: { card: cardValue, suit: cardSuit } });
  }
}
