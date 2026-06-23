const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static("public"));

const players = {};

io.on("connection", (socket) => {

    players[socket.id] = {
        x: 1500,
        y: 1500,
        name: "Player"
    };

    socket.emit("id", socket.id);

    socket.on("move", (data) => {

        const p = players[socket.id];

        if (!p) return;

        p.x = data.x;
        p.y = data.y;
    });

    socket.on("name", (name) => {

        const p = players[socket.id];

        if (!p) return;

        p.name =
            String(name)
            .trim()
            .substring(0, 12) || "Player";
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    io.emit("state", players);
}, 50);

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("Server started");
});
