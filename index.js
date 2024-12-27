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
  
  var ful
  
  function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle.
    while (currentIndex != 0) {
  
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
  }
  
  const app = require('express')();
  const port = process.env.PORT

  app.get('/', (req, res) => {
    res.render('pages/index')
  })

  app.listen(port, () => {
    console.log(`App listening on port ${port}`)
  })

  
//   const server = require('http').createServer(app);
//   const io = require('socket.io')(server, {
//     cors: {
//       origin: "https://tabline.niloc3.repl.co",
//       methods: ["GET", "POST"]
//     },
//     closeOnBeforeunload: true
//   });
  
  
//   var clientCount = 0
//   var playerOneId = ''
//   var playerTwoId = ''
  
//   io.on('connection', (socket) => {
//     console.log('user connected')
//     clientCount++
    
//     socket.on('disconnect', () => {
//       console.log('user disconnected');
//       clientCount--
//       if (socket.id == playerOneId || socket.id == playerTwoId) {
//         playerOneId = ''
//         playerTwoId = ''
//         deck = fullDeck.slice(0);
//         io.sockets.sockets.forEach(function(s) {
//           s.disconnect(true);
//         });
//       }
  
      
//     });
  
//     socket.on('create user', (user) => {
//       if (clientCount > 2) socket.emit('status', 'too many players')
//       if (clientCount == 1) playerOneId = socket.id
//       if (clientCount == 2) {
//         playerTwoId = socket.id
//         shuffle(deck);
//         var playerOneCards = deck.slice(0, 4)
//         var playerTwoCards = deck.slice(4, 8)
//         var tableCards = deck.slice(8, 12)
  
//         deck.splice(0, 12)
  
//         const p1 = {
//           table: tableCards,
//           player: playerOneCards
//         }
  
//         const p2 = {
//           table: tableCards,
//           player: playerTwoCards
//         }
  
//         io.sockets.sockets.get(playerOneId).emit('cards', p1)
//         io.sockets.sockets.get(playerTwoId).emit('cards', p2)
  
//       }
      
//     });
  
  
//   });
//   server.listen(5006);