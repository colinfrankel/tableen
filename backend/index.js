const { validateAndApplyAction, generateStackId, calculatePoints } = require('./gameLogic');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// Deck generator function (returns a fresh deck array)
function getFullDeck() {
  const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
  const deck = [];
  for (const suit of suits) {
    for (let card = 1; card <= 13; card++) {
      deck.push([{ card, suit, stackSum: card }]);
    }
  }
  return deck;
}

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeCode(length = 5) {
  return Math.random().toString(36).substr(2, length).toUpperCase();
}

const games = {};
const socketMap = {};

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('create game', (cb) => {
    let code;
    do { code = makeCode(5); } while (games[code]);

    const deck = shuffle(getFullDeck());
    games[code] = {
      deck,
      tableCards: [],
      playerHands: { playerOne: [], playerTwo: [] },
      currentPlayer: null,
      playerIds: { playerOne: socket.id, playerTwo: null },
      collected: { playerOne: [], playerTwo: [] },
      points: { playerOne: 0, playerTwo: 0 },
      nextStackId: 1, // game-specific stack ID
      lastGrabber: null // track last grabber for end-of-round collection
    };

    socket.join(code);
    socketMap[socket.id] = { gameCode: code, playerKey: 'playerOne' };

    console.log(`Game ${code} created by ${socket.id}`);
    if (typeof cb === 'function') cb({ ok: true, code });
    socket.emit('game created', { code });
  });

  socket.on('join game', (code, cb) => {
    const game = games[code];
    if (!game) {
      if (typeof cb === 'function') cb({ ok: false, message: 'Game not found' })
      return;
    }
    if (game.playerIds.playerTwo) {
      if (typeof cb === 'function') cb({ ok: false, message: 'Game full' })
      return;
    }

    game.playerIds.playerTwo = socket.id;
    socket.join(code);
    socketMap[socket.id] = { gameCode: code, playerKey: 'playerTwo' };

    if (game.deck.length < 12) {
      game.deck = shuffle(getFullDeck());
    }

    game.playerHands.playerOne = game.deck.slice(0, 4);
    game.playerHands.playerTwo = game.deck.slice(4, 8);
    game.tableCards = game.deck.slice(8, 12).map(cardArr => ({
      id: generateStackId(game),
      cards: [...cardArr],
      stackNumber: cardArr[0].card
    }));
    game.deck.splice(0, 12);

    game.currentPlayer = game.playerIds.playerOne;

    io.to(game.playerIds.playerOne).emit('your turn', {
      ...game,
      hand: game.playerHands.playerOne,
      table: game.tableCards,
      opponentCards: game.playerHands.playerTwo.length,
      gameCode: code
    });
    io.to(game.playerIds.playerTwo).emit('wait', {
      ...game,
      hand: game.playerHands.playerTwo,
      table: game.tableCards,
      opponentCards: game.playerHands.playerOne.length,
      gameCode: code
    });

    console.log(`Player ${socket.id} joined game ${code}`);
    if (typeof cb === 'function') cb({ ok: true, code });
    io.to(code).emit('joined', { message: 'Both players connected', code });
  });

  socket.on('play card', (payload) => {
    const mapping = socketMap[socket.id];
    if (!mapping) return socket.emit('status', 'You are not in a game.');
    const { gameCode } = payload;
    const game = games[gameCode];
    if (!game) return socket.emit('status', 'Game not found.');
    if (socket.id !== game.currentPlayer) {
      return socket.emit('status', 'Not your turn!');
    }
    const playerKey = game.playerIds.playerOne === socket.id ? 'playerOne' : 'playerTwo';
    const { newState, prompt, error } = validateAndApplyAction(game, payload, playerKey);

    // Track last grabber for end-of-round collection
    if (payload.type === 'grab') {
      game.lastGrabber = playerKey;
    }

    if (error) return socket.emit('status', error);
    if (prompt) {
      return socket.emit('prompt', prompt);
    }
    if (newState) {
      games[gameCode] = newState;

      const handsEmpty = game.playerHands.playerOne.length === 0 && game.playerHands.playerTwo.length === 0;
      if (handsEmpty) {
        if (game.deck.length > 0) {
          game.playerHands.playerOne = game.deck.splice(0, 4);
          game.playerHands.playerTwo = game.deck.splice(0, 4);
        } else {
          // --- ROUND OVER: Award remaining table cards to last grabber ---
          if (game.lastGrabber && game.tableCards.length > 0) {
            const remainingCards = game.tableCards.flatMap(stack => stack.cards);
            game.collected[game.lastGrabber].push(...remainingCards);
            game.tableCards = [];
          }

          // --- ROUND OVER: Calculate points ---
          const { pointsA, pointsB } = calculatePoints(game.collected.playerOne, game.collected.playerTwo);
          game.points.playerOne += pointsA;
          game.points.playerTwo += pointsB;

          io.to(gameCode).emit('round over', {
            message: `Round over!\nPlayer 1: ${game.points.playerOne} points\nPlayer 2: ${game.points.playerTwo} points`,
            collected: {
              playerOne: game.collected.playerOne,
              playerTwo: game.collected.playerTwo
            }
          });

          if (game.points.playerOne >= 21 || game.points.playerTwo >= 21) {
            let winner = '';
            if (game.points.playerOne > game.points.playerTwo) winner = 'Player 1 wins!';
            else if (game.points.playerTwo > game.points.playerOne) winner = 'Player 2 wins!';
            else winner = 'It\'s a tie!';
            io.to(gameCode).emit('status', `Game over! ${winner}`);
            delete games[gameCode];
            return;
          }

          // Otherwise, shuffle and start new round
          game.deck = shuffle(getFullDeck());
          game.playerHands.playerOne = game.deck.slice(0, 4);
          game.playerHands.playerTwo = game.deck.slice(4, 8);
          game.tableCards = game.deck.slice(8, 12).map(cardArr => ({
            id: generateStackId(game),
            cards: [...cardArr],
            stackNumber: cardArr[0].card
          }));
          game.deck.splice(0, 12);
          game.collected.playerOne = [];
          game.collected.playerTwo = [];
          game.nextStackId = 1;
          game.lastGrabber = null;

          game.currentPlayer = game.playerIds.playerOne;
          io.to(game.playerIds.playerOne).emit('your turn', {
            ...game,
            hand: game.playerHands.playerOne,
            table: game.tableCards,
            opponentCards: game.playerHands.playerTwo.length,
            gameCode
          });
          io.to(game.playerIds.playerTwo).emit('wait', {
            ...game,
            hand: game.playerHands.playerTwo,
            table: game.tableCards,
            opponentCards: game.playerHands.playerOne.length,
            gameCode
          });
          return;
        }
      }

      if (payload.type !== 'boardstack') {
        const opponentKey = playerKey === 'playerOne' ? 'playerTwo' : 'playerOne';
        game.currentPlayer = game.playerIds[opponentKey];
        io.to(game.currentPlayer).emit('your turn', {
          ...game,
          hand: game.playerHands[opponentKey],
          table: game.tableCards,
          opponentCards: game.playerHands[playerKey].length,
          gameCode
        });
        io.to(socket.id).emit('wait', {
          ...game,
          hand: game.playerHands[playerKey],
          table: game.tableCards,
          opponentCards: game.playerHands[opponentKey].length,
          gameCode
        });
      } else {
        io.to(socket.id).emit('your turn', {
          ...game,
          hand: game.playerHands[playerKey],
          table: game.tableCards,
          opponentCards: game.playerHands[playerKey === 'playerOne' ? 'playerTwo' : 'playerOne'].length,
          gameCode
        });
      }
      io.to(game.playerIds.playerOne).emit('update table', game.tableCards, game.playerHands.playerOne);
      io.to(game.playerIds.playerTwo).emit('update table', game.tableCards, game.playerHands.playerTwo);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    const mapping = socketMap[socket.id];
    if (!mapping) return;

    const { gameCode, playerKey } = mapping;
    const game = games[gameCode];
    if (!game) {
      delete socketMap[socket.id];
      return;
    }

    const otherPlayerId = playerKey === 'playerOne' ? game.playerIds.playerTwo : game.playerIds.playerOne;
    if (otherPlayerId) {
      io.to(otherPlayerId).emit('opponent disconnected', { message: 'Opponent disconnected' });
    }

    try {
      delete games[gameCode];
      if (game.playerIds.playerOne) delete socketMap[game.playerIds.playerOne];
      if (game.playerIds.playerTwo) delete socketMap[game.playerIds.playerTwo];
    } catch (err) {
      console.error('Error cleaning game:', err);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));