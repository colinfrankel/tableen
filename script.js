var socket = io('https://tabline.onrender.com');

// Drag-and-drop variables
let draggedCard = null;
let draggedFromHand = false;

// Handle connection and disconnection
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
  alert(status);
});

// Function to update the game UI
function updateGameUI(data, isYourTurn) {
  document.getElementById('opponentCards').style.display = 'flex';

  // Reset card areas
  document.getElementById('cards').innerHTML = '';
  document.getElementById('tableCards').innerHTML = '';

  // Populate player's hand
  data.hand.forEach(card => {
    const cardElement = document.createElement('img');
    cardElement.classList.add('card');
    cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
    cardElement.setAttribute('draggable', 'true');
    cardElement.setAttribute('data-card', JSON.stringify(card));
    cardElement.addEventListener('dragstart', handleDragStart);
    document.getElementById('cards').appendChild(cardElement);
  });

  // Populate table cards
  updateTableCards(data.table);

  // Show turn status
  const turnStatusElement = document.getElementById('turnStatus');
  if (isYourTurn) {
    turnStatusElement.innerText = 'Your turn!';
    turnStatusElement.style.color = 'green';
  } else {
    turnStatusElement.innerText = 'Wait for your opponent...';
    turnStatusElement.style.color = 'red';
  }
}

// Function to update table cards
function updateTableCards(tableCards) {
  const tableCardsDiv = document.getElementById('tableCards');
  tableCardsDiv.innerHTML = '';
  tableCards.forEach(card => {
    const cardElement = document.createElement('img');
    cardElement.classList.add('card');
    cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
    cardElement.setAttribute('data-card', JSON.stringify(card));
    cardElement.addEventListener('dragover', handleDragOver);
    cardElement.addEventListener('drop', handleDrop);
    tableCardsDiv.appendChild(cardElement);
  });
}

// Handle drag start event
function handleDragStart(event) {
  draggedCard = JSON.parse(event.target.getAttribute('data-card'));
  draggedFromHand = true;
}

// Handle drag over event
function handleDragOver(event) {
  event.preventDefault(); // Allow drop
}

// Handle drop event (either grab or stack)
function handleDrop(event) {
  event.preventDefault();

  const droppedCard = JSON.parse(event.target.getAttribute('data-card'));
  let actionType = '';

  // If dragged card is from hand and matches a card on table, it's a grab
  if (draggedFromHand && draggedCard.card === droppedCard.card && draggedCard.suit === droppedCard.suit) {
    actionType = 'grab';
  } else {
    // Otherwise, it's a stack action
    const stackSum = tableCards.reduce((sum, card) => sum + card.card, 0);
    actionType = 'stack';
  }

  // Send the action to the backend
  socket.emit('play card', {
    playedCard: draggedCard,
    targetCard: droppedCard,
    stackTarget: { sum: stackSum }
  });

  // Reset dragged state
  draggedCard = null;
  draggedFromHand = false;
}

// Function to play a card (used in drag-and-drop case)
function playCard(cardValue, cardSuit) {
  // This will be handled by the drag-and-drop functionality above
}
