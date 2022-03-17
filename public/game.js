const BOARD_VALUE = {
    M0: ' ',
    M1: '1',
    M2: '2',
    M3: '3',
    M4: '4',
    M5: '5',
    M6: '6',
    M7: '7',
    M8: '8',
    M9: '9',
    RED_FLAG: 'R',
    BLUE_FLAG: 'B',
    UNREVEAL: 'U',
    BOMB: 'X',
};

class Board {
    constructor(width, height, gameEngine) {
        this.gameEngine = gameEngine;
        this.width = width;
        this.height = height;
        this.cells = new Array(height * width);
        this.cells.fill(BOARD_VALUE.UNREVEAL);
        this.lastMove = [null, null];
        this.initBoard();
    }

    initBoard() {
        for (let i = 0; i < this.height; i++) {
            const row = $(".template .cell-row").clone().appendTo(".cell-container");
            for (let j = 0; j < this.width; j++) {
                const value = this.getCell(i, j);
                let cell;
                switch (value) {
                    case BOARD_VALUE.BOMB:
                        cell = $(".template .cell").clone().removeClass("blue-flag red-flag unreveal").attr("id", `cell_${i}_${j}`).appendTo(row);
                        cell.find("span").html("&#128163;");
                    break;
                    case BOARD_VALUE.UNREVEAL:
                        cell = $(".template .cell").clone().removeClass("blue-flag red-flag").addClass("unreveal").attr("id", `cell_${i}_${j}`).appendTo(row);
                    break;
                    case BOARD_VALUE.RED_FLAG:
                        cell = $(".template .cell").clone().removeClass("blue-flag unreveal").addClass("red-flag").attr("id", `cell_${i}_${j}`).appendTo(row);
                        cell.find("span").html("&#9873;");
                    break;
                    case BOARD_VALUE.BLUE_FLAG:
                        cell = $(".template .cell").clone().removeClass("red-flag unreveal").addClass("blue-flag").attr("id", `cell_${i}_${j}`).appendTo(row);
                        cell.find("span").html("&#9873;");
                    break;
                    default:
                        cell = $(".template .cell").clone().removeClass("blue-flag red-flag unreveal").attr("id", `cell_${i}_${j}`).appendTo(row);
                        cell.find("span").html(value);
                }
            }
        }
        $(".cell").on("click", this.clickedCell.bind(this));
    }

    getCell(row, col) {
        return this.cells[row * this.width + col];
    }

    setCell(row, col, value) {
        this.cells[row * this.width + col] = value;
        return value;
    }

    reveal(row, col, value) {
        this.setCell(row, col, value);
        let cell;
        switch(value) {
            case BOARD_VALUE.BOMB:
                cell = $(`#cell_${row}_${col}`).removeClass("blue-flag red-flag unreveal");
                cell.find("span").html("&#128163;");
            break;
            case BOARD_VALUE.UNREVEAL:
                cell = $(`#cell_${row}_${col}`).removeClass("blue-flag red-flag").addClass("unreveal");
            break;
            case BOARD_VALUE.RED_FLAG:
                cell = $(`#cell_${row}_${col}`).removeClass("blue-flag unreveal").addClass("red-flag");
                cell.find("span").html("&#9873;");
            break;
            case BOARD_VALUE.BLUE_FLAG:
                cell = $(`#cell_${row}_${col}`).removeClass("unreveal red-flag").addClass("blue-flag");
                cell.find("span").html("&#9873;");
            break;
            default:
                cell = $(`#cell_${row}_${col}`).removeClass("blue-flag red-flag unreveal");
                cell.find("span").html(value);
        }
    }

    clickedCell(event) {
        const element = event.target;
        const id_split = $(element).closest(".cell")[0].id.split("_");
        const r = parseInt(id_split[1]);
        const c = parseInt(id_split[2]);
        console.log("clicked", r, c);
        this.gameEngine.clickedCell.bind(this.gameEngine)(r, c);
    }

    destroy() {
        $(".cell-container").empty();
    }

    setLastMove(lastMove) {
        $(".cell").removeClass("red-last-move blue-last-move");
        this.lastMove = lastMove;
        for (let i = 0; i < lastMove.length; i++) {
            const [row, col] = lastMove[i];
            let cell = $(`#cell_${row}_${col}`).addClass(i == 0 ? "red-last-move" : "blue-last-move");
        }
    }
}

// Class for whole game engine
class GameEngine {
    constructor() {
        this.socket = io();
        this.initSocket();
        this.setMovable(false);
        this.processing = false;
    }

    reset() {
        if (this.board) {
            this.board.destroy();
        }
        this.board = new Board(16, 16, this);
        this.setMovable(false);
        this.processing = false;
    }

    initSocket() {
        this.socket.on("disconnect", (reason) => {
            $(".message1").html("Connection lost, please restart.");
            this.setMovable(false);
        });
        this.socket.on("start", (playerID) => {
            this.reset();
            this.playerID = playerID;
            if (playerID == 0) {
                $(".message1").html("Your turn now.");
                this.setMovable(true);
                $(".message2").addClass("red-scoreboard");
            } else {
                $(".message1").html("Opponent turn now.");
                this.setMovable(false);
                $(".message2").addClass("blue-scoreboard");
            }
        });
        this.socket.on("turn", (playerID) => {
            if (playerID == this.playerID) {
                $(".message1").html("Your turn now.");
                this.setMovable(true);
            } else {
                $(".message1").html("Opponent turn now.");
                this.setMovable(false);
            }
        });
        this.socket.on("reveal", (revealed) => {
            if (revealed.length > 1) {
                $("#audio-ohno")[0].currentTime = 0;
                $("#audio-ohno")[0].play();
            } else {
                if (revealed[0][3] == BOARD_VALUE.RED_FLAG ||revealed[0][3] == BOARD_VALUE.BLUE_FLAG ) {
                    $("#audio-move-flag")[0].currentTime = 0;
                    $("#audio-move-flag")[0].play();
                } else {
                    $("#audio-move-normal")[0].currentTime = 0;
                    $("#audio-move-normal")[0].play();
                }
            }
            for (let i = 0; i < revealed.length; i++) {
                setTimeout(() => {
                    this.board.reveal.bind(this.board)(revealed[i][0], revealed[i][1], revealed[i][3]);
                }, revealed[i][2] * 50);
            }
        });
        this.socket.on("score", (score) => {
            $(".message2").html(`${score[0]} R | B ${score[1]}`);
        });
        this.socket.on("last_move", (lastMove) => {
            this.board.setLastMove(lastMove);
        });
        this.socket.on("finish", (winner, revealed) => {
            if (winner == this.playerID) {
                $(".message1").html("You win.");
                this.setMovable(false);
            } else {
                $(".message1").html("You lose.");
                this.setMovable(false);
            }
            for (let i = 0; i < revealed.length; i++) {
                setTimeout(() => {
                    this.board.reveal.bind(this.board)(revealed[i][0], revealed[i][1], revealed[i][3]);
                }, revealed[i][2] * 50);
            }
        });
        this.socket.on("leave", (revealed) => {
            $(".message1").html("Opponenet left.");
            this.setMovable(false);
            for (let i = 0; i < revealed.length; i++) {
                setTimeout(() => {
                    this.board.reveal.bind(this.board)(revealed[i][0], revealed[i][1], revealed[i][3]);
                }, revealed[i][2] * 50);
            }
        });
    }

    clickNewGame() {
        this.socket.emit("new", this.newGame.bind(this));
    }

    clickJoinGame() {
        $(".panel-newOrJoin, .panel-game").hide();
        $(".panel-join").show();
        $(".panel-join input").focus();
    }

    clickEnterRoom() {
        const roomID = $(".input-room-id").val();
        this.socket.emit("join", roomID, this.newGame.bind(this));
    }

    newGame(roomID) {
        console.log("New game with id", roomID);
        if (roomID == -1) {
            return;
        }
        this.roomID = roomID;
        $(".message1").html("Waiting opponent");
        $(".message2").html(`Room ID: ${roomID}`);
        $(".panel-newOrJoin, .panel-join").hide();
        $(".panel-game").show();
    }

    setMovable(movable) {
        this.move = movable;
        if (this.board) {
            for (let i = 0; i < this.board.height; i++) {
                for (let j = 0; j < this.board.width; j++) {
                    const value = this.board.getCell(i, j);
                    let cell;
                    switch (value) {
                        case BOARD_VALUE.UNREVEAL:
                            if (movable) {
                                cell = $(`#cell_${i}_${j}`).addClass("cell-clickable");
                            } else {
                                cell = $(`#cell_${i}_${j}`).removeClass("cell-clickable");
                            }
                        break;
                        default:
                            cell = $(`#cell_${i}_${j}`).removeClass("cell-clickable");
                    }
                }
            }
        }
    }

    clickedCell(r, c) {
        if (!this.move)
            return;
        this.processing = true;
        this.socket.emit("move", this.roomID, r, c, this.handleClickedCell.bind(this));
    }

    handleClickedCell(revealed, error) {
        console.log(revealed, error);
        this.processing = false;
        if (revealed == null) {
            $(".message1").html(error);
        } else {
            // for (let i = 0; i < revealed.length; i++) {
            //     setTimeout(() => {
            //         this.board.reveal.bind(this.board)(revealed[i][0], revealed[i][1], revealed[i][3]);
            //     }, revealed[i][2] * 50);
            // }
        }
    }
}

$(function() {
    gameEngine = new GameEngine();
    $(".panel-game, .panel-join").hide();

    $(".new-game").on("click", gameEngine.clickNewGame.bind(gameEngine));
    $(".join-game").on("click", gameEngine.clickJoinGame.bind(gameEngine));
    $(".enter-room").on("click", gameEngine.clickEnterRoom.bind(gameEngine));
});