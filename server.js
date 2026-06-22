const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};

io.on("connection", (socket) => {

    if (Object.keys(players).length >= 2) {
        socket.emit("serverFull");
        socket.disconnect(true);
        return;
    }

    players[socket.id] = {
        x: Math.random() * 600 + 50,
        y: Math.random() * 300 + 50,
        name: "Player"
    };

    socket.emit("yourId", socket.id);
    io.emit("players", players);

    socket.on("setName", (name) => {
        if (!players[socket.id]) return;

        players[socket.id].name = String(name).slice(0, 16) || "Player";
        io.emit("players", players);
    });

    socket.on("move", (data) => {
        if (!players[socket.id]) return;

        players[socket.id].x = data.x;
        players[socket.id].y = data.y;

        io.emit("players", players);
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("players", players);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});