const express = require("express");
const nunjucks = require("nunjucks");
const app = express();
const port = 5000;
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { customAlphabet } = require("nanoid");
const { e } = require("nunjucks/src/filters");
const nanoid = customAlphabet("0123456789", 5);

let games = {};

const gameConfig = {
  width: 16,
  height: 16,
  bomb: 51,
  bombToWin: 26,
}


nunjucks.configure("views", {
    autoescape: true,
    express: app
});

app.use(express.static("public"));


app.get("/", (req, res) => {
  res.render("minesweeper.html")
});

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  socket.on("new", (cb) => {
    console.log("New game");
    roomID = nanoid();
    socket.join(roomID);
    cb(roomID);
  });

  socket.on("join", (roomID, cb) => {
    console.log("Join game", roomID);
    const playerList = io.of("/").adapter.rooms.get(roomID);
    if(playerList && playerList.size == 1) {
      socket.join(roomID);
      cb(roomID);
      startGame(roomID);
    } else {
      cb(-1);
    }
  });

  socket.on("move", (roomID, r, c, cb) => {
    // if (socket.rooms.has(roomID)) {
    //   // Do something if socket is in room 'abc'
    // } else {
    //   // Do something if socket is NOT in room 'abc'
    // }
    playerID = games[roomID].player.indexOf(socket.id);
    if (games[roomID].whoToMove == playerID) {
      if (games[roomID].reveal[r*games[roomID].width + c]) {
        cb(null, "Already revealed.");
        return;
      }
      games[roomID].lastMove[playerID] = [r, c];
      const [revealed, turnOver] = revealCell(games[roomID], r, c, playerID);
      if (turnOver) {
        games[roomID].whoToMove = 1 - games[roomID].whoToMove;
        io.to(roomID).emit("turn", games[roomID].whoToMove);
      }
      cb(revealed, null);
      io.to(roomID).emit("reveal", revealed);
      io.to(roomID).emit("last_move", games[roomID].lastMove);
      io.to(roomID).emit("score", games[roomID].score);
      for (let i = 0; i < games[roomID].score.length; i++) {
        if (games[roomID].score[i] >= games[roomID].gameConfig.bombToWin) {
          // This player wins
          // generate all bomb and reveal
          io.to(roomID).emit("finish", i, listUnrevealedBomb(games[roomID]));
        }
      }
    } else {
      cb(null, "Not your turn yet.");
    }
  })
});

io.of("/").adapter.on("leave-room", (roomID, id) => {
  console.log(`socket ${id} has left room ${roomID}`);
  if (roomID in games) {
    io.to(roomID).emit("leave", listUnrevealedBomb(games[roomID]));
  }
});

io.of("/").adapter.on("delete-room", (roomID) => {
  console.log(`room ${roomID} deleted`);
  if (roomID in games) {
    delete games[roomID];
  }
});

function* whoToStart() {
  const first = Math.random() < 0.5;
  yield first;
  return !first;
}

const startGame = (roomID) => {
  const s = whoToStart();
  const player = new Array(2);
  for (const sid of io.of("/").adapter.rooms.get(roomID)) {
    const turn = s.next().value;
    if (turn) {
      player[0] = sid;
      io.to(sid).emit("start", 0);
    } else {
      player[1] = sid;
      io.to(sid).emit("start", 1);
    }
  }
  games[roomID] = initBoard(16, 16);
  games[roomID].player = player;
  games[roomID].whoToMove = 0;
  games[roomID].score = [0, 0];
  games[roomID].lastMove = [null, null];
  games[roomID].gameConfig = gameConfig;
}

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

const initBoard = (width, height) => {
  reveal = new Array(width*height);
  reveal.fill(false);
  board = new Array(width*height);
  board.fill(0);
  for (let i = 0; i < 51; i++) {
    board[i] = "X";
  }
  shuffle(board);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (board[i*width + j] === "X") {
        for (let x = -1; x <= 1; x++) {
          for (let y = -1; y <= 1; y++) {
            const r = i + x;
            const c = j + y;
            if (r < 0 || r >= height || c < 0 || c >= width) {
              continue;
            }
            if (board[r*width + c] !== "X") {
              board[r*width + c]++;
            }
          }
        }
      }
    }
  }
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (board[i*width + j] !== "X") {
        board[i*width + j] = "" + board[i*width + j];
        if (board[i*width + j] === "0")
          board[i*width + j] = " ";
      }
    }
  }
  printBoard(board, height, width);
  return {
    board: board,
    reveal: reveal,
    height: height,
    width: width,
  }
}

const revealCell = (game, sr, sc, turn) => {
  const board = game.board;
  const reveal = game.reveal;
  const width = game.width;
  const height = game.height;
  const score = game.score;
  let turnOver = true;
  let toReveal = [[sr, sc, 0]];
  let revealed = [];
  
  // console.log(game);
  while(toReveal.length > 0) {
    const [r, c, d] = toReveal.shift();
    if (r < 0 || r >= height || c < 0 || c >= width)
      continue;
    if (reveal[r*width + c])
      continue;
    
    if (board[r*width + c] == "X") {
      revealed.push([r, c, d, playerID == 0 ? "R" : "B"]);
      score[playerID]++;
      turnOver = false;
    } else {
      revealed.push([r, c, d, board[r*width + c]]);
    }
    reveal[r*width + c] = true;
    if (board[r*width + c] == " ") {
      toReveal = toReveal.concat([
        [r-1, c-1, d+1],
        [r-1, c, d+1],
        [r-1, c+1, d+1],
        [r, c-1, d+1],
        [r, c+1, d+1],
        [r+1, c-1, d+1],
        [r+1, c, d+1],
        [r+1, c+1, d+1],
      ]);
    }
  }
  return [revealed, turnOver];
}

const listUnrevealedBomb = (game) => {
  const board = game.board;
  const reveal = game.reveal;
  const width = game.width;
  const height = game.height;
  const score = game.score;
  let count = 0;

  let revealed = [];

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!reveal[r*width + c] && board[r*width + c] == "X") {
        revealed.push([r, c, count++, board[r*width + c]]);
      }
    }
  }
  return revealed;
}

const printBoard = (board, height, width) => {
  for (let i = 0; i < height; i++) {
    let s = "";
    for (let j = 0; j < width; j++) {
      s += board[i*width + j];
    }
    console.log(s);
  }
}

server.listen(port, () => {
  console.log(`listening on *:${port}`);
});