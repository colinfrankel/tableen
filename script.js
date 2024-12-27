var socket = io('https://tabline-backend.niloc3.repl.co');

socket.on('connect', function () {
  console.log("connected!")
  socket.emit('create user')
 });

socket.on('disconnect', function (reason) {
  document.body.innerHTML = 'Disconnected, reload to start a new game'
 });

socket.on('cards', function (cards) {
  document.getElementById('title').style.display = 'none'
  document.getElementById('opponentCards').style.display = 'flex'
  for (var i = 0; i < cards.table.length; i++) {
    document.getElementById('cards').innerHTML += `<img class="card" src="./cards/${cards.player[i].suit}/${cards.player[i].card}.svg">`
    document.getElementById('tableCards').innerHTML += `<img class="card" src="./cards/${cards.table[i].suit}/${cards.table[i].card}.svg">`
  }
 });


socket.on('status', function (s) {
  document.body.innerHTML = s
 });