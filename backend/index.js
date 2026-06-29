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
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10); // random digit 0-9
  }
  return code;
}

const games = {};
const socketMap = {};

function cloneTableCards(tableCards) {
  return tableCards.map(stack => ({
    id: stack.id,
    stackNumber: stack.stackNumber,
    cards: stack.cards.map(card => ({ ...card }))
  }));
}

function setTurnStartSnapshot(game) {
  game.turnStartTableCards = cloneTableCards(game.tableCards);
  game.turnBoardstackHistory = [];
}

function getBoardstackChainTargetIds(history, finalTargetId) {
  const keepIds = new Set();
  let currentTargetId = finalTargetId;

  while (currentTargetId) {
    const entry = [...history].reverse().find(item => item.toStackId === currentTargetId && !keepIds.has(item.historyId));
    if (!entry) break;
    keepIds.add(entry.historyId);
    currentTargetId = entry.fromStackId;
  }

  return keepIds;
}

function restoreTableAfterTurn(game, finalTargetId = null) {
  if (!Array.isArray(game.turnStartTableCards)) {
    game.turnStartTableCards = [];
  }

  if (!Array.isArray(game.turnBoardstackHistory)) {
    game.turnBoardstackHistory = [];
  }

  if (finalTargetId === null) {
    game.tableCards = game.turnStartTableCards.filter(stack => stack.id !== game.turnLastActionStackId);
    game.turnStartTableCards = [];
    game.turnBoardstackHistory = [];
    game.turnLastActionStackId = null;
    return;
  }

  const history = Array.isArray(game.turnBoardstackHistory) ? game.turnBoardstackHistory : [];
  const turnStartTableCards = Array.isArray(game.turnStartTableCards) ? cloneTableCards(game.turnStartTableCards) : [];

  if (history.length === 0) {
    game.turnStartTableCards = [];
    game.turnBoardstackHistory = [];
    return;
  }

  const keepHistoryIds = getBoardstackChainTargetIds(history, finalTargetId);
  if (keepHistoryIds.size === 0) {
    const currentTargetStack = finalTargetId
      ? game.tableCards.find(stack => stack.id === finalTargetId)
      : null;

    game.tableCards = turnStartTableCards;
    if (currentTargetStack) {
      const targetIndex = game.tableCards.findIndex(stack => stack.id === finalTargetId);
      if (targetIndex === -1) {
        game.tableCards.push(currentTargetStack);
      } else {
        game.tableCards[targetIndex] = currentTargetStack;
      }
    }
    game.turnStartTableCards = [];
    game.turnBoardstackHistory = [];
    return;
  }

  const rebuiltTableCards = cloneTableCards(turnStartTableCards);

  const applyHistoryEntry = (entry) => {
    const fromIndex = rebuiltTableCards.findIndex(stack => stack.id === entry.fromStackId);
    const toIndex = rebuiltTableCards.findIndex(stack => stack.id === entry.toStackId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    const fromStack = rebuiltTableCards[fromIndex];
    const toStack = rebuiltTableCards[toIndex];
    toStack.cards = [...toStack.cards, ...fromStack.cards];
    toStack.stackNumber = entry.stackNumber;
    rebuiltTableCards.splice(fromIndex, 1);
  };

  history
    .filter(entry => keepHistoryIds.has(entry.historyId))
    .forEach(applyHistoryEntry);

  if (finalTargetId) {
    const currentTargetStack = game.tableCards.find(stack => stack.id === finalTargetId);
    if (currentTargetStack) {
      const targetIndex = rebuiltTableCards.findIndex(stack => stack.id === finalTargetId);
      if (targetIndex === -1) {
        rebuiltTableCards.push(currentTargetStack);
      } else {
        rebuiltTableCards[targetIndex] = currentTargetStack;
      }
    }
  }

  game.tableCards = rebuiltTableCards;
  game.turnStartTableCards = [];
  game.turnBoardstackHistory = [];
  game.turnLastActionStackId = null;
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('create game', (payload, cb) => {
    if (typeof payload === 'function') {
      cb = payload;
      payload = {};
    }
    const creatorName = (payload && payload.playerName) ? String(payload.playerName).trim().slice(0, 18) : 'Player';
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
      tableens: { playerOne: 0, playerTwo: 0 },
      playerNames: { playerOne: creatorName, playerTwo: 'Opponent' },
      nextStackId: 1,
      lastGrabber: null,
      turnStartTableCards: [],
      turnBoardstackHistory: [],
      turnLastActionStackId: null
    };

    socket.join(code);
    socketMap[socket.id] = { gameCode: code, playerKey: 'playerOne' };

    console.log(`Game ${code} created by ${socket.id}`);
    if (typeof cb === 'function') cb({ ok: true, code });
    socket.emit('game created', { code });
  });

  socket.on('join game', (payload, cb) => {
    if (typeof payload === 'function') {
      cb = payload;
      payload = {};
    }
    const code = typeof payload === 'string' ? payload : payload.code;
    const joinerName = (payload && payload.playerName) ? String(payload.playerName).trim().slice(0, 18) : 'Player';
    const game = games[code];
    if (!game) {
      if (typeof cb === 'function') cb({ ok: false, message: 'Game not found' });
      return;
    }

    let playerKey = null;
    // Assign player slot based on disconnected status
    if (!game.playerIds.playerOne || !io.sockets.sockets.get(game.playerIds.playerOne)) {
      game.playerIds.playerOne = socket.id;
      playerKey = 'playerOne';
    } else if (!game.playerIds.playerTwo || !io.sockets.sockets.get(game.playerIds.playerTwo)) {
      game.playerIds.playerTwo = socket.id;
      playerKey = 'playerTwo';
    } else {
      if (typeof cb === 'function') cb({ ok: false, message: 'Game full' });
      return;
    }

    // After assigning playerKey and updating game.playerIds...

    // If currentPlayer is not a connected socket, and it matches the previous socket for this player, update to new socket.id
    if (
      game.currentPlayer &&
      !io.sockets.sockets.get(game.currentPlayer) &&
      (
        (playerKey === 'playerOne' && game.currentPlayer !== game.playerIds.playerOne) ||
        (playerKey === 'playerTwo' && game.currentPlayer !== game.playerIds.playerTwo)
      )
    ) {
      // If the disconnected currentPlayer was this player, update to new socket.id
      game.currentPlayer = socket.id;
    }

    socket.join(code);
    socketMap[socket.id] = { gameCode: code, playerKey };
    game.playerNames = game.playerNames || { playerOne: 'Player', playerTwo: 'Opponent' };
    game.playerNames[playerKey] = joinerName;

    // --- FIX: If currentPlayer is not a connected socket, assign to whoever just joined/rejoined ---
    const validPlayerIds = [game.playerIds.playerOne, game.playerIds.playerTwo];
    const currentPlayerConnected = game.currentPlayer && io.sockets.sockets.get(game.currentPlayer);

    if (!currentPlayerConnected || !validPlayerIds.includes(game.currentPlayer)) {
      game.currentPlayer = socket.id;
    }

    // If game already started, just send current state
    if (game.playerHands.playerOne.length && game.playerHands.playerTwo.length && game.tableCards.length) {
      const otherKey = playerKey === 'playerOne' ? 'playerTwo' : 'playerOne';
      if (game.currentPlayer === socket.id) {
        socket.emit('your turn', {
          ...game,
          hand: game.playerHands[playerKey],
          table: game.tableCards,
          opponentCards: game.playerHands[playerKey === 'playerOne' ? 'playerTwo' : 'playerOne'].length,
          playerName: game.playerNames[playerKey],
          opponentName: game.playerNames[otherKey],
          gameCode: code
        });
      } else {
        socket.emit('wait', {
          ...game,
          hand: game.playerHands[playerKey],
          table: game.tableCards,
          opponentCards: game.playerHands[playerKey === 'playerOne' ? 'playerTwo' : 'playerOne'].length,
          playerName: game.playerNames[playerKey],
          opponentName: game.playerNames[otherKey],
          gameCode: code
        });
      }

      // Also update the other player
      const otherId = game.playerIds[otherKey];
      if (otherId) {
        if (game.currentPlayer === otherId) {
          io.to(otherId).emit('your turn', {
            ...game,
            hand: game.playerHands[otherKey],
            table: game.tableCards,
            opponentCards: game.playerHands[playerKey].length,
            playerName: game.playerNames[otherKey],
            opponentName: game.playerNames[playerKey],
            gameCode: code
          });
        } else {
          io.to(otherId).emit('wait', {
            ...game,
            hand: game.playerHands[otherKey],
            table: game.tableCards,
            opponentCards: game.playerHands[playerKey].length,
            playerName: game.playerNames[otherKey],
            opponentName: game.playerNames[playerKey],
            gameCode: code
          });
        }
      }

      if (typeof cb === 'function') cb({ ok: true, code });
      io.to(code).emit('joined', {
        message: 'Both players connected',
        code,
        playerName: game.playerNames.playerOne,
        opponentName: game.playerNames.playerTwo
      });
      return;
    }

    // If game not started, deal hands and table
    game.playerHands.playerOne = game.deck.slice(0, 4);
    game.playerHands.playerTwo = game.deck.slice(4, 8);
    game.tableCards = game.deck.slice(8, 12).map(cardArr => ({
      id: generateStackId(game),
      cards: [...cardArr],
      stackNumber: cardArr[0].card
    }));
    game.deck.splice(0, 12);
    setTurnStartSnapshot(game);

    game.currentPlayer = game.playerIds.playerOne;

    io.to(game.playerIds.playerOne).emit('your turn', {
      ...game,
      hand: game.playerHands.playerOne,
      table: game.tableCards,
      opponentCards: game.playerHands.playerTwo.length,
      playerName: game.playerNames.playerOne,
      opponentName: game.playerNames.playerTwo,
      gameCode: code
    });
    io.to(game.playerIds.playerTwo).emit('wait', {
      ...game,
      hand: game.playerHands.playerTwo,
      table: game.tableCards,
      opponentCards: game.playerHands.playerOne.length,
      playerName: game.playerNames.playerTwo,
      opponentName: game.playerNames.playerOne,
      gameCode: code
    });

    if (typeof cb === 'function') cb({ ok: true, code });
    io.to(code).emit('joined', {
      message: 'Both players connected',
      code,
      playerName: game.playerNames.playerOne,
      opponentName: game.playerNames.playerTwo
    });
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

    // --- EMIT OPPONENT ACTION WITH STACK DETAILS BEFORE STATE CHANGE ---
    const opponentKey = playerKey === 'playerOne' ? 'playerTwo' : 'playerOne';
    const opponentId = game.playerIds[opponentKey];

    function getStackInfo(stackId) {
      const stackObj = game.tableCards.find(s => s.id === stackId);
      return stackObj
        ? { stackCards: stackObj.cards, stackNumber: stackObj.stackNumber }
        : { stackCards: [], stackNumber: null };
    }

    let actionPayload = {
      type: payload.type,
      playedCard: payload.playedCard,
      stackId: payload.stackId,
      from: payload.from,
      to: payload.to,
      stackAsSum: payload.stackAsSum,
      playerName: game.playerNames[playerKey] || payload.playerName || 'Player',
      opponentName: game.playerNames[opponentKey] || 'Opponent',
    };

    // For grab and stack, send stack info BEFORE state changes
    if (payload.type === 'grab' || payload.type === 'stack') {
      const info = getStackInfo(payload.stackId);
      actionPayload.stackCards = info.stackCards;
      actionPayload.stackNumber = info.stackNumber;
    }

    // For boardstack, send info for both stacks BEFORE state changes
    if (payload.type === 'boardstack') {
      const fromInfo = getStackInfo(payload.from);
      const toInfo = getStackInfo(payload.to);
      actionPayload.fromStackCards = fromInfo.stackCards;
      actionPayload.fromStackNumber = fromInfo.stackNumber;
      actionPayload.toStackCards = toInfo.stackCards;
      actionPayload.toStackNumber = toInfo.stackNumber;
    }

    // Track last grabber for end-of-round collection
    if (payload.type === 'grab') {
      game.lastGrabber = playerKey;
      game.turnLastActionStackId = payload.stackId || null;
    }

    if (payload.type === 'boardstack') {
      if (!Array.isArray(game.turnBoardstackHistory)) {
        game.turnBoardstackHistory = [];
      }
      const fromStackBefore = game.tableCards.find(stack => stack.id === payload.from);
      const toStackBefore = game.tableCards.find(stack => stack.id === payload.to);
      game.turnBoardstackHistory.push({
        historyId: `${Date.now()}-${game.turnBoardstackHistory.length}`,
        fromStackId: payload.from,
        toStackId: payload.to,
        stackAsSum: !!payload.stackAsSum,
        stackNumber: toStackBefore ? toStackBefore.stackNumber : null,
        fromCards: fromStackBefore ? fromStackBefore.cards.map(card => ({ ...card })) : []
      });
    }
    
    const { newState, prompt, error } = validateAndApplyAction(game, payload, playerKey);

    if (error) return socket.emit('status', error);
    if (prompt) {
      return socket.emit('prompt', prompt);
    }
    if (newState) {
      games[gameCode] = newState;

      if (payload.type === 'grab') {
        game.turnStartTableCards = [];
        game.turnBoardstackHistory = [];
        game.turnLastActionStackId = null;
      } else if (payload.type !== 'boardstack') {
        const finalTargetId = payload.type === 'normal'
          ? game.tableCards[game.tableCards.length - 1]?.id
          : payload.stackId || null;

        restoreTableAfterTurn(game, finalTargetId);
      }

      if (game.tableCards.length === 0) {
        game.tableens[playerKey] = (game.tableens[playerKey] || 0) + 1;
      }

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
          game.points.playerOne += pointsA + (game.tableens.playerOne || 0);
          game.points.playerTwo += pointsB + (game.tableens.playerTwo || 0);

          io.to(game.playerIds.playerOne).emit('round over', {
            message: `Round over!\nYou: ${game.points.playerOne} points\nOpponent: ${game.points.playerTwo} points`,
            myCards: game.collected.playerOne,
            opponentCards: game.collected.playerTwo,
            myTableens: game.tableens.playerOne,
            opponentTableens: game.tableens.playerTwo,
            playerName: game.playerNames.playerOne,
            opponentName: game.playerNames.playerTwo,
            score: { myScore: game.points.playerOne, opponentScore: game.points.playerTwo }
          });
          io.to(game.playerIds.playerTwo).emit('round over', {
            message: `Round over!\nYou: ${game.points.playerTwo} points\nOpponent: ${game.points.playerOne} points`,
            myCards: game.collected.playerTwo,
            opponentCards: game.collected.playerOne,
            myTableens: game.tableens.playerTwo,
            opponentTableens: game.tableens.playerOne,
            playerName: game.playerNames.playerTwo,
            opponentName: game.playerNames.playerOne,
            score: { myScore: game.points.playerTwo, opponentScore: game.points.playerOne }
          });
          const SCORE_TO_WIN = 21;
          if (game.points.playerOne >= SCORE_TO_WIN || game.points.playerTwo >= SCORE_TO_WIN) {
            let winner = '';
            if (game.points.playerOne > game.points.playerTwo) winner = 'Player 1 wins!';
            else if (game.points.playerTwo > game.points.playerOne) winner = 'Player 2 wins!';
            else winner = 'It\'s a tie!';
            io.to(gameCode).emit('status', `Game over! ${winner}`);
            const winnerPlayerID = game.points.playerOne > game.points.playerTwo ? game.playerIds.playerOne : game.playerIds.playerTwo;
            const loserPlayerID = game.points.playerOne > game.points.playerTwo ? game.playerIds.playerTwo : game.playerIds.playerOne;

            io.to(winnerPlayerID).emit('you won');
            io.to(loserPlayerID).emit('you lost');

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
          setTurnStartSnapshot(game);

          // --- SWAP WHO STARTS EACH ROUND ---
          if (!game.roundStarter || game.roundStarter === 'playerOne') {
            game.roundStarter = 'playerTwo';
          } else {
            game.roundStarter = 'playerOne';
          }
          game.currentPlayer = game.playerIds[game.roundStarter];

          io.to(game.playerIds.playerOne).emit(
            game.currentPlayer === game.playerIds.playerOne ? 'your turn' : 'wait',
            {
              ...game,
              hand: game.playerHands.playerOne,
              table: game.tableCards,
              opponentCards: game.playerHands.playerTwo.length,
              gameCode
            });
          io.to(game.playerIds.playerTwo).emit(
            game.currentPlayer === game.playerIds.playerTwo ? 'your turn' : 'wait',
            {
              ...game,
              hand: game.playerHands.playerTwo,
              table: game.tableCards,
              opponentCards: game.playerHands[playerKey].length,
              gameCode
            });
          return;
        }
      }

      // Emit opponent action with correct stack info
      if (opponentId) {
        io.to(opponentId).emit('opponent action', actionPayload);
      }

      // --- EMIT TABLE UPDATES ---
      io.to(game.playerIds.playerOne).emit('update table', game.tableCards, game.playerHands.playerOne);
      io.to(game.playerIds.playerTwo).emit('update table', game.tableCards, game.playerHands.playerTwo);

      // --- EMIT TURN INFO ---
      if (payload.type !== 'boardstack') {
        game.currentPlayer = game.playerIds[opponentKey];
        setTurnStartSnapshot(game);
        io.to(game.currentPlayer).emit('your turn', {
          ...game,
          hand: game.playerHands[opponentKey],
          table: game.tableCards,
          opponentCards: game.playerHands[playerKey].length,
          playerName: game.playerNames[opponentKey],
          opponentName: game.playerNames[playerKey],
          gameCode
        });
        io.to(socket.id).emit('wait', {
          ...game,
          hand: game.playerHands[playerKey],
          table: game.tableCards,
          opponentCards: game.playerHands[opponentKey].length,
          playerName: game.playerNames[playerKey],
          opponentName: game.playerNames[opponentKey],
          gameCode
        });
      } else {
        io.to(socket.id).emit('your turn', {
          ...game,
          hand: game.playerHands[playerKey],
          table: game.tableCards,
          opponentCards: game.playerHands[playerKey === 'playerOne' ? 'playerTwo' : 'playerOne'].length,
          playerName: game.playerNames[playerKey],
          opponentName: game.playerNames[playerKey === 'playerOne' ? 'playerTwo' : 'playerOne'],
          gameCode
        });
      }
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

    // --- CLEAN UP GAME IF BOTH PLAYERS HAVE LEFT ---
    const playerOneConnected = game.playerIds.playerOne && io.sockets.sockets.get(game.playerIds.playerOne);
    const playerTwoConnected = game.playerIds.playerTwo && io.sockets.sockets.get(game.playerIds.playerTwo);

    if (!playerOneConnected && !playerTwoConnected) {
      console.log(`Deleting game ${gameCode} (both players disconnected)`);
      delete games[gameCode];
      // Clean up socketMap for both players
      if (game.playerIds.playerOne) delete socketMap[game.playerIds.playerOne];
      if (game.playerIds.playerTwo) delete socketMap[game.playerIds.playerTwo];
    }

    // Clean up mapping for this socket
    delete socketMap[socket.id];
  });


});

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Tableen Backend Up and Running!');
});


server.listen(PORT, () => console.log(`Server started!`));