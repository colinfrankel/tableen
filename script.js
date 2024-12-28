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
  alert(status)
});

// Function to update the game UI
function updateGameUI(data, isYourTurn) {
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
  const action = prompt('Enter "grab" to grab a card, "stack" to stack on a pile, or leave blank to play a new card.');
  if (action === 'grab') {
    const targetCard = prompt('Enter the value and suit of the card you want to grab (e.g., 4 clubs).');
    if (targetCard) {
      const [targetValue, targetSuit] = targetCard.split(' ');
      socket.emit('play card', {
        playedCard: { card: cardValue, suit: cardSuit },
        targetCard: { card: parseInt(targetValue), suit: targetSuit }
      });
    }
  } else if (action === 'stack') {
    const stackSum = prompt('Enter the current sum of the stack you want to add to.');
    if (stackSum) {
      socket.emit('play card', {
        playedCard: { card: cardValue, suit: cardSuit },
        stackTarget: { sum: parseInt(stackSum) }
      });
    }
  } else {
    socket.emit('play card', {
      playedCard: { card: cardValue, suit: cardSuit }
    });
  }
}

