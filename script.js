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
  alert(status);
});

// Function to update the game UI
function updateGameUI(data, isYourTurn) {
  document.getElementById('opponentCards').style.display = 'flex';
  
  // Reset card areas
  document.getElementById('cards').innerHTML = '';
  document.getElementById('tableCards').innerHTML = '';
  
  // Populate player's hand with draggable cards
  data.hand.forEach(card => {
    const cardElement = document.createElement('img');
    cardElement.classList.add('card');
    cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
    cardElement.draggable = true;

    // Set up drag events for each card
    cardElement.addEventListener('dragstart', (e) => handleDragStart(e, card));
    document.getElementById('cards').appendChild(cardElement);
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

// Function to update table cards (stacking visually)
function updateTableCards(tableCards) {
  const tableCardsDiv = document.getElementById('tableCards');
  tableCardsDiv.innerHTML = '';

  tableCards.forEach((card, index) => {
    const cardElement = document.createElement('img');
    cardElement.classList.add('card');
    cardElement.src = `./cards/${card.suit}/${card.card}.svg`;
    
    // Stacking logic (making stacked cards overlap)
    cardElement.style.position = 'absolute';
    cardElement.style.left = `${index * 10}px`;  // Small offset for stacking effect
    cardElement.style.top = `${index * 10}px`;
    tableCardsDiv.appendChild(cardElement);

    // Allow dropping cards onto table
    cardElement.addEventListener('dragover', (e) => handleDragOver(e));
    cardElement.addEventListener('drop', (e) => handleDrop(e, card));
  });
}

// Drag-and-Drop handlers
let draggedCard = null;  // To store the dragged card details

function handleDragStart(e, card) {
  draggedCard = card;
  e.dataTransfer.setData('text', `${card.card} ${card.suit}`);
}

function handleDragOver(e) {
  e.preventDefault();  // Allow drop
}

function handleDrop(e, targetCard) {
  e.preventDefault();

  // Check if we are stacking or grabbing a card
  if (draggedCard.card === targetCard.card && draggedCard.suit === targetCard.suit) {
    // Grab the card
    socket.emit('play card', {
      playedCard: draggedCard,
      targetCard: targetCard
    });
  } else {
    // Stack the card on top of the target card
    const stackSum = prompt('Enter the current sum of the stack you want to add to:');
    if (stackSum) {
      socket.emit('play card', {
        playedCard: draggedCard,
        stackTarget: { sum: parseInt(stackSum) }
      });
    }
  }
}

// Add event listener to the table for generic drop zones
document.getElementById('tableCards').addEventListener('dragover', handleDragOver);
document.getElementById('tableCards').addEventListener('drop', (e) => {
  e.preventDefault();
  // Logic to handle dropping on an empty space can go here
});
