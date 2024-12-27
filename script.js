var socket = io('https://tabline.onrender.com');
let collectedCards = [];

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

socket.on('error', function (message) {
  const turnStatus = document.getElementById('turnStatus');
  turnStatus.innerText = `Invalid Move: ${message}`;
  turnStatus.style.color = 'red';
  setTimeout(() => {
    turnStatus.innerText = '';
  }, 3000);
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
           draggable="true" 
           ondragstart="dragCard(event)" 
           data-value="${card.card}" 
           data-suit="${card.suit}">`;
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
    tableCardsDiv.innerHTML += `<img class="card" src="./cards/${card.suit}/${card.card}.svg" data-value="${card.card}" data-suit="${card.suit}">`;
  });
}

// Drag-and-Drop Functions
function dragCard(event) {
  const cardValue = event.target.getAttribute('data-value');
  const cardSuit = event.target.getAttribute('data-suit');
  event.dataTransfer.setData('card', JSON.stringify({ card: cardValue, suit: cardSuit }));
}

function allowDrop(event) {
  event.preventDefault();
}

function dropCard(event, target) {
  event.preventDefault();
  const droppedCard = JSON.parse(event.dataTransfer.getData('card'));

  // Check the target
  if (target === 'table') {
    const tableCard = event.target.closest('.card');
    const tableCardValue = tableCard ? tableCard.getAttribute('data-value') : null;
    const tableCardSuit = tableCard ? tableCard.getAttribute('data-suit') : null;

    // Emit a play card event
    socket.emit('play card', {
      playedCard: droppedCard,
      targetCard: tableCard ? { card: parseInt(tableCardValue), suit: tableCardSuit } : null
    });
  }
}

// Collect Cards
socket.on('collect', function (cards) {
  collectedCards.push(...cards);
  updateCollectedCards();
});

function updateCollectedCards() {
  const collectedDiv = document.getElementById('collectedCards');
  collectedDiv.innerHTML = '';
  collectedCards.forEach(card => {
    collectedDiv.innerHTML += `<img class="card" src="./cards/${card.suit}/${card.card}.svg">`;
  });
}
