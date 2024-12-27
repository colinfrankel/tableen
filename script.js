var socket = io('https://tabline.onrender.com');

socket.on('connect', function () {
  console.log("connected!");
  socket.emit('create user');
});

socket.on('disconnect', function (reason) {
  document.body.innerHTML = 'Disconnected, reload to start a new game';
});

// Handles initial card distribution
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
  document.body.innerHTML = `<h1>${status}</h1>`;
});

// Function to update the game UI
function updateGameUI(data, isYourTurn) {
  document.getElementById('title').style.display = 'none';
  document.getElementById('opponentCards').style.display = 'flex';
  
  // Reset card areas
  document.getElementById('cards').innerHTML = '';
  document.getElementById('tableCards').innerHTML = '';
  
  // Populate player's hand
  data.hand.forEach(card => {
    document.getElementById('cards').innerHTML += `
      <img class="card" 
           src="./cards/${card.suit}/${card.card}.svg" 
           onclick="playCard(${card.card}, '${card.suit}')">`;
  });

  // Populate table cards
  updateTableCards(data.table);

  // Show turn status
  if (isYourTurn) {
    document.getElementById('turnStatus').innerText = 'Your turn!';
    document.getElementById('turnStatus').style.color = 'green';
  } else {
    document.getElementById('turnStatus').innerText = 'Wait for your opponent...';
    document.getElementById('turnStatus').style.color = 'red';
  }
}

// Function to update table cards
function updateTableCards(tableCards) {
  const tableCardsDiv = document.getElementById('tableCards');
  tableCardsDiv.innerHTML = '';
  tableCards.forEach(card => {
    tableCardsDiv.innerHTML += `<img class="card" src="./cards/${card.suit}/${card.card}.svg">`;
  });
}

// Function to play a card
function playCard(cardValue, cardSuit) {
  const targetCard = prompt('Enter the value and suit of the card you want to grab (e.g., 4 clubs), or leave blank to play a new card.');
  
  if (targetCard) {
    const [targetValue, targetSuit] = targetCard.split(' ');
    socket.emit('play card', {
      playedCard: { card: cardValue, suit: cardSuit },
      targetCard: { card: parseInt(targetValue), suit: targetSuit }
    });
  } else {
    socket.emit('play card', {
      playedCard: { card: cardValue, suit: cardSuit }
    });
  }
}