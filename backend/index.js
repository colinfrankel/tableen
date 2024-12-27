const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let fullDeck = createDeck();
let deck = [...fullDeck];
let tableCards = [];
let players = {};
let currentPlayerTurn = null;

function createDeck() {
  const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
  const deck = [];
  suits.forEach(suit => {
    for (let card = 1; card <= 13; card++) {
      deck.push({ card, suit });
    }
  });
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    if (currentPlayerTurn === socket.id) {
      currentPlayerTurn = null;
    }
    if (Object.keys(players).length < 2) {
      tableCards = [];
      deck = [...fullDeck];
    }
  });

  socket.on('create user', () => {
    if (Object.keys(players).length >= 2) {
      socket.emit('status', 'Too many players');
      return;
    }

    players[socket.id] = { hand: [], collected: [] };

    if (Object.keys(players).length === 2) {
      startGame();
    }
  });

  socket.on('play card', ({ playedCard, targetCard }) => {
    if (socket.id !== currentPlayerTurn) {
      socket.emit('error', 'Not your turn');
      return;
    }

    const player = players[socket.id];
    const isValidMove = validateMove(playedCard, targetCard);

    if (!isValidMove.success) {
      socket.emit('error', isValidMove.message);
      return;
    }

    if (isValidMove.action === 'collect') {
      player.collected.push(...isValidMove.collectedCards);
    }

    tableCards = isValidMove.updatedTable;
    player.hand = player.hand.filter(card => card.card !== playedCard.card || card.suit !== playedCard.suit);

    currentPlayerTurn = Object.keys(players).find(id => id !== socket.id);
    updatePlayers();
  });
});

function startGame() {
  shuffle(deck);
  const playerIds = Object.keys(players);

  playerIds.forEach((id, index) => {
    players[id].hand = deck.slice(index * 4, (index + 1) * 4);
  });

  tableCards = deck.slice(8, 12);
  deck.splice(0, 12);

  currentPlayerTurn = playerIds[0];
  updatePlayers();
}

function validateMove(playedCard, targetCard) {
  if (!playedCard) {
    return { success: false, message: 'No card played.' };
  }

  if (targetCard) {
    const match = tableCards.find(card => card.card === targetCard.card && card.suit === targetCard.suit);
    if (!match) {
      return { success: false, message: 'Target card not on the table.' };
    }

    if (playedCard.card !== targetCard.card) {
      return { success: false, message: 'Cards do not match.' };
    }

    return {
      success: true,
      action: 'collect',
      collectedCards: [playedCard, targetCard],
      updatedTable: tableCards.filter(card => card !== match),
    };
  }

  return {
    success: true,
    action: 'play',
    updatedTable: [...tableCards, playedCard],
  };
}

function updatePlayers() {
  Object.keys(players).forEach(id => {
    const player = players[id];
    io.to(id).emit('cards', {
      table: tableCards,
      player: player.hand || [], // Ensure 'player' array is sent
    });
    io.to(id).emit(currentPlayerTurn === id ? 'turn' : 'wait');
    io.to(id).emit('collect', player.collected || []); // Ensure 'collected' array is sent
  });
}


server.listen(3000, () => console.log('Server is running on port 3000'));
