const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};

// players update loop (anti-lag fix)
setInterval(() => {
    io.emit("players", players);
}, 50);

io.on("connection", (socket) => {

    if (Object.keys(players).length >= 2) {
        socket.emit("serverFull");
        socket.disconnect(true);
        return;
    }

    players[socket.id] = {
        x: Math.random() * 700 + 50,
        y: Math.random() * 400 + 50,
        name: "Spiller"
    };

    socket.emit("yourId", socket.id);

    socket.on("setName", (name) => {
        if (!players[socket.id]) return;

        players[socket.id].name =
            String(name).substring(0, 16) || "Spiller";
    });

    socket.on("move", (data) => {
        if (!players[socket.id]) return;

        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server kører på port ${PORT}`);
});
