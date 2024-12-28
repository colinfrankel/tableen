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
  var tableCards = [];
  var playerHands = {
    playerOne: [],
    playerTwo: []
  };
  var currentPlayer = '';
  
  function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]
      ];
    }
    return array;
  }
  
  function resetGame() {
    deck = fullDeck.slice(0);
    tableCards = [];
    playerHands = {
      playerOne: [],
      playerTwo: []
    };
    currentPlayer = '';
    shuffle(deck);
  }
  
  const app = require('express')();
  const server = require('http').createServer(app);
  const io = require('socket.io')(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    closeOnBeforeunload: true
  });
  
  var playerOneId = '';
  var playerTwoId = '';
  
  io.on('connection', (socket) => {
    console.log('User connected');
    
    socket.on('disconnect', () => {
      console.log('User disconnected');
      if (socket.id === playerOneId || socket.id === playerTwoId) {
        playerOneId = '';
        playerTwoId = '';
        resetGame();
        io.sockets.sockets.forEach(function(s) {
          s.disconnect(true);
        });
      }
    });
  
    socket.on('create user', () => {
      if (!playerOneId) {
        playerOneId = socket.id;
      } else if (!playerTwoId) {
        playerTwoId = socket.id;
        resetGame();
  
        // Deal cards
        playerHands.playerOne = deck.slice(0, 4);
        playerHands.playerTwo = deck.slice(4, 8);
        tableCards = deck.slice(8, 12);
        deck.splice(0, 12);
  
        // Start the game
        currentPlayer = playerOneId;
        io.sockets.sockets.get(playerOneId).emit('your turn', { hand: playerHands.playerOne, table: tableCards });
        io.sockets.sockets.get(playerTwoId).emit('wait', { hand: playerHands.playerTwo, table: tableCards });
      }
    });
  
    socket.on('play card', (data) => {
      if (socket.id !== currentPlayer) {
        socket.emit('status', 'Not your turn!');
        return;
      }
    
      const { playedCard, targetCard, stackTarget } = data; 
      const playerKey = socket.id === playerOneId ? 'playerOne' : 'playerTwo';
      const opponentKey = socket.id === playerOneId ? 'playerTwo' : 'playerOne';
    
      // Handle stacking action
      if (stackTarget) {
        // Find the stack target
        const stackIndex = tableCards.findIndex(
          pile => pile.sum && pile.sum === stackTarget.sum
        );
    
        if (stackIndex !== -1) {
          const playedIndex = playerHands[playerKey].findIndex(
            card => card.card === playedCard.card && card.suit === playedCard.suit
          );
    
          if (playedIndex !== -1 && tableCards[stackIndex].sum + playedCard.card <= 13) {
            // Add card to stack and update sum
            tableCards[stackIndex].cards.push(playerHands[playerKey].splice(playedIndex, 1)[0]);
            tableCards[stackIndex].sum += playedCard.card;
    
            io.sockets.emit('update table', tableCards);
          } else {
            socket.emit('status', 'Invalid stack action');
            return;
          }
        } else {
          socket.emit('status', 'Invalid stack target');
          return;
        }
      } else if (targetCard) {
        // Handle grab action (existing logic)
        const targetIndex = tableCards.findIndex(card =>
          card.card === targetCard.card && card.suit === targetCard.suit
        );
        if (targetIndex !== -1) {
          const playedIndex = playerHands[playerKey].findIndex(card =>
            card.card === playedCard.card && card.suit === playedCard.suit
          );
          if (playedIndex !== -1 && playedCard.card === targetCard.card) {
            tableCards.splice(targetIndex, 1); // Remove target card from table
            playerHands[playerKey].splice(playedIndex, 1); // Remove played card from player hand
            io.sockets.emit('update table', tableCards);
          } else {
            socket.emit('status', 'Invalid move');
            return;
          }
        }
      } else {
        // Play a card (existing logic)
        const playedIndex = playerHands[playerKey].findIndex(
          card => card.card === playedCard.card && card.suit === playedCard.suit
        );
        if (playedIndex !== -1) {
          tableCards.push({ cards: [playerHands[playerKey].splice(playedIndex, 1)[0]], sum: playedCard.card });
          io.sockets.emit('update table', tableCards);
        } else {
          socket.emit('status', 'Invalid move');
          return;
        }
      }
    
      // Switch turns
      currentPlayer = socket.id === playerOneId ? playerTwoId : playerOneId;
      io.sockets.sockets.get(currentPlayer).emit('your turn', { hand: playerHands[opponentKey], table: tableCards });
      socket.emit('wait', { hand: playerHands[playerKey], table: tableCards });
    });
    
  });
  
  server.listen(3000, () => {
    console.log('Server running on port 3000');
  });