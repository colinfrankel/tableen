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

const fullDeck = [
  [{ card: 1, suit: 'clubs', stackSum: 1 }], [{ card: 2, suit: 'clubs', stackSum: 2 }],
  [{ card: 3, suit: 'clubs', stackSum: 3 }], [{ card: 4, suit: 'clubs', stackSum: 4 }],
  [{ card: 5, suit: 'clubs', stackSum: 5 }], [{ card: 6, suit: 'clubs', stackSum: 6 }],
  [{ card: 7, suit: 'clubs', stackSum: 7 }], [{ card: 8, suit: 'clubs', stackSum: 8 }],
  [{ card: 9, suit: 'clubs', stackSum: 9 }], [{ card: 10, suit: 'clubs', stackSum: 10 }],
  [{ card: 11, suit: 'clubs', stackSum: 11 }], [{ card: 12, suit: 'clubs', stackSum: 12 }],
  [{ card: 13, suit: 'clubs', stackSum: 13 }],
  [{ card: 1, suit: 'diamonds', stackSum: 1 }], [{ card: 2, suit: 'diamonds', stackSum: 2 }],
  [{ card: 3, suit: 'diamonds', stackSum: 3 }], [{ card: 4, suit: 'diamonds', stackSum: 4 }],
  [{ card: 5, suit: 'diamonds', stackSum: 5 }], [{ card: 6, suit: 'diamonds', stackSum: 6 }],
  [{ card: 7, suit: 'diamonds', stackSum: 7 }], [{ card: 8, suit: 'diamonds', stackSum: 8 }],
  [{ card: 9, suit: 'diamonds', stackSum: 9 }], [{ card: 10, suit: 'diamonds', stackSum: 10 }],
  [{ card: 11, suit: 'diamonds', stackSum: 11 }], [{ card: 12, suit: 'diamonds', stackSum: 12 }],
  [{ card: 13, suit: 'diamonds', stackSum: 13 }],
  [{ card: 1, suit: 'hearts', stackSum: 1 }], [{ card: 2, suit: 'hearts', stackSum: 2 }],
  [{ card: 3, suit: 'hearts', stackSum: 3 }], [{ card: 4, suit: 'hearts', stackSum: 4 }],
  [{ card: 5, suit: 'hearts', stackSum: 5 }], [{ card: 6, suit: 'hearts', stackSum: 6 }],
  [{ card: 7, suit: 'hearts', stackSum: 7 }], [{ card: 8, suit: 'hearts', stackSum: 8 }],
  [{ card: 9, suit: 'hearts', stackSum: 9 }], [{ card: 10, suit: 'hearts', stackSum: 10 }],
  [{ card: 11, suit: 'hearts', stackSum: 11 }], [{ card: 12, suit: 'hearts', stackSum: 12 }],
  [{ card: 13, suit: 'hearts', stackSum: 13 }],
  [{ card: 1, suit: 'spades', stackSum: 1 }], [{ card: 2, suit: 'spades', stackSum: 2 }],
  [{ card: 3, suit: 'spades', stackSum: 3 }], [{ card: 4, suit: 'spades', stackSum: 4 }],
  [{ card: 5, suit: 'spades', stackSum: 5 }], [{ card: 6, suit: 'spades', stackSum: 6 }],
  [{ card: 7, suit: 'spades', stackSum: 7 }], [{ card: 8, suit: 'spades', stackSum: 8 }],
  [{ card: 9, suit: 'spades', stackSum: 9 }], [{ card: 10, suit: 'spades', stackSum: 10 }],
  [{ card: 11, suit: 'spades', stackSum: 11 }], [{ card: 12, suit: 'spades', stackSum: 12 }],
  [{ card: 13, suit: 'spades', stackSum: 13 }],
];

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

    const deck = shuffle(fullDeck);
    games[code] = {
      deck,
      tableCards: [],
      playerHands: { playerOne: [], playerTwo: [] },
      currentPlayer: null,
      playerIds: { playerOne: socket.id, playerTwo: null },
      collected: { playerOne: [], playerTwo: [] },
      points: { playerOne: 0, playerTwo: 0 }
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
      game.deck = shuffle(fullDeck);
    }

    game.playerHands.playerOne = game.deck.slice(0, 4);
    game.playerHands.playerTwo = game.deck.slice(4, 8);
    game.tableCards = game.deck.slice(8, 12).map(cardArr => ({
      id: generateStackId(),
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
          // --- ROUND OVER: Calculate points ---
          const { pointsA, pointsB } = calculatePoints(game.collected.playerOne, game.collected.playerTwo);
          game.points.playerOne += pointsA;
          game.points.playerTwo += pointsB;

          io.to(gameCode).emit('status',
            `Round over!\nPlayer 1: ${game.points.playerOne} points\nPlayer 2: ${game.points.playerTwo} points`
          );

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
          game.deck = shuffle(fullDeck);
          game.playerHands.playerOne = game.deck.slice(0, 4);
          game.playerHands.playerTwo = game.deck.slice(4, 8);
          game.tableCards = game.deck.slice(8, 12).map(cardArr => ({
            id: generateStackId(),
            cards: [...cardArr],
            stackNumber: cardArr[0].card
          }));
          game.deck.splice(0, 12);
          game.collected.playerOne = [];
          game.collected.playerTwo = [];

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