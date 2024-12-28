const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  closeOnBeforeunload: true
});


var fullDeck = [
  {card:1, suit:'clubs'},
  {card:2, suit:'clubs'},
  {card:3, suit:'clubs'},
  {card:4, suit:'clubs'},
  {card:5, suit:'clubs'},
  {card:6, suit:'clubs'},
  {card:7, suit:'clubs'},
  {card:8, suit:'clubs'},
  {card:9, suit:'clubs'},
  {card:10, suit:'clubs'},
  {card:11, suit:'clubs'},
  {card:12, suit:'clubs'},
  {card:13, suit:'clubs'},
  {card:1, suit:'diamonds'},
  {card:2, suit:'diamonds'},
  {card:3, suit:'diamonds'},
  {card:4, suit:'diamonds'},
  {card:5, suit:'diamonds'},
  {card:6, suit:'diamonds'},
  {card:7, suit:'diamonds'},
  {card:8, suit:'diamonds'},
  {card:9, suit:'diamonds'},
  {card:10, suit:'diamonds'},
  {card:11, suit:'diamonds'},
  {card:12, suit:'diamonds'},
  {card:13, suit:'diamonds'},
  {card:1, suit:'hearts'},
  {card:2, suit:'hearts'},
  {card:3, suit:'hearts'},
  {card:4, suit:'hearts'},
  {card:5, suit:'hearts'},
  {card:6, suit:'hearts'},
  {card:7, suit:'hearts'},
  {card:8, suit:'hearts'},
  {card:9, suit:'hearts'},
  {card:10, suit:'hearts'},
  {card:11, suit:'hearts'},
  {card:12, suit:'hearts'},
  {card:13, suit:'hearts'},
  {card:1, suit:'spades'},
  {card:2, suit:'spades'},
  {card:3, suit:'spades'},
  {card:4, suit:'spades'},
  {card:5, suit:'spades'},
  {card:6, suit:'spades'},
  {card:7, suit:'spades'},
  {card:8, suit:'spades'},
  {card:9, suit:'spades'},
  {card:10, suit:'spades'},
  {card:11, suit:'spades'},
  {card:12, suit:'spades'},
  {card:13, suit:'spades'},
]

var deck = [];
let tableCards = [];
let playerHands = {
  playerOne: [],
  playerTwo: []
};
let collectedCards = {
  playerOne: [],
  playerTwo: []
};
let currentPlayer = '';
let playerOneId = '';
let playerTwoId = '';

function initializeDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  fullDeck = [];

  for (let suit of suits) {
    for (let value of values) {
      fullDeck.push({ card: value, suit: suit });
    }
  }
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function dealCards() {
  playerHands.playerOne = deck.splice(0, 5);
  playerHands.playerTwo = deck.splice(0, 5);
  tableCards.push(deck.pop());
}

function resetGame() {
  deck = fullDeck.slice(0);
  tableCards = [];
  playerHands = {
    playerOne: [],
    playerTwo: []
  };
  collectedCards = {
    playerOne: [],
    playerTwo: []
  };
  currentPlayer = '';
  shuffle(deck);
  dealCards();
}

io.on('connection', (socket) => {
  socket.on('join game', () => {
    if (!playerOneId) {
      playerOneId = socket.id;
      socket.emit('status', 'You are Player One. Waiting for Player Two...');
    } else if (!playerTwoId) {
      playerTwoId = socket.id;
      currentPlayer = playerOneId;
      resetGame();
      io.to(playerOneId).emit('your turn', {
        hand: playerHands.playerOne,
        table: tableCards
      });
      io.to(playerTwoId).emit('wait', {
        hand: playerHands.playerTwo,
        table: tableCards
      });
    } else {
      socket.emit('status', 'Game is full.');
    }
  });

  socket.on('play card', (data) => {
    if (socket.id !== currentPlayer) {
      socket.emit('status', 'Not your turn!');
      return;
    }

    const { playedCard, targetCard } = data;
    const playerKey = socket.id === playerOneId ? 'playerOne' : 'playerTwo';

    // Validate played card exists in player's hand
    const playedIndex = playerHands[playerKey].findIndex(
      (card) => card.card === playedCard.card && card.suit === playedCard.suit
    );
    if (playedIndex === -1) {
      socket.emit('status', 'Invalid move: card not in your hand.');
      return;
    }

    if (targetCard) {
      // Validate target card exists on the table
      const targetIndex = tableCards.findIndex(
        (card) => card.card === targetCard.card && card.suit === targetCard.suit
      );
      if (targetIndex === -1) {
        socket.emit('status', 'Invalid move: target card not on the table.');
        return;
      }

      // Check if the played card matches or stacks with the target card
      if (playedCard.card === targetCard.card) {
        // Collect cards
        collectedCards[playerKey].push(
          ...tableCards.splice(targetIndex, 1),
          playedCard
        );
        playerHands[playerKey].splice(playedIndex, 1); // Remove played card
      } else {
        socket.emit('status', 'Invalid move: cards do not match or stack.');
        return;
      }
    } else {
      // Play a new card if no target is specified
      tableCards.push(playerHands[playerKey].splice(playedIndex, 1)[0]);
    }

    // Notify clients of the updated game state
    io.sockets.emit('update table', tableCards);
    socket.emit('wait', { hand: playerHands[playerKey], table: tableCards });
    io.sockets.sockets
      .get(currentPlayer)
      .emit('your turn', { hand: playerHands[playerKey], table: tableCards });

    // Switch turns
    currentPlayer = socket.id === playerOneId ? playerTwoId : playerOneId;
  });

  socket.on('disconnect', () => {
    if (socket.id === playerOneId || socket.id === playerTwoId) {
      io.sockets.emit('status', 'A player disconnected. Game reset.');
      resetGame();
    }
  });
});

// Initialize the game
initializeDeck();
resetGame();