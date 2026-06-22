const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};

io.on("connection", (socket) => {

    players[socket.id] = {
        x: 200,
        y: 200,
        name: "Player"
    };

    socket.emit("id", socket.id);

    socket.on("move", (data) => {
        if (!players[socket.id]) return;

        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
    });

    socket.on("name", (name) => {
        if (!players[socket.id]) return;

        players[socket.id].name = String(name).slice(0, 12);
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

// send state 20 fps (let + stabilt)
setInterval(() => {
    io.emit("state", players);
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0");
