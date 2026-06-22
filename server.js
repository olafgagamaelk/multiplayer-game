const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};
const bullets = [];

const MAX_PLAYERS = 5;

// send state (players + bullets)
setInterval(() => {
    io.emit("players", players);
    io.emit("bullets", bullets);
}, 50);

io.on("connection", (socket) => {

    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit("serverFull");
        socket.disconnect(true);
        return;
    }

    players[socket.id] = {
        x: Math.random() * 700 + 50,
        y: Math.random() * 400 + 50,
        name: "Spiller",
        hp: 100
    };

    socket.emit("yourId", socket.id);

    socket.on("setName", (name) => {
        if (!players[socket.id]) return;
        players[socket.id].name = String(name).substring(0, 16);
    });

    socket.on("move", (data) => {
        if (!players[socket.id]) return;
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
    });

    socket.on("shoot", (data) => {
        if (!players[socket.id]) return;

        bullets.push({
            x: data.x,
            y: data.y,
            vx: data.vx,
            vy: data.vy,
            owner: socket.id
        });
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

// bullet + damage system
setInterval(() => {

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        b.x += b.vx;
        b.y += b.vy;

        for (const id in players) {
            const p = players[id];

            if (id === b.owner) continue;

            if (
                b.x > p.x &&
                b.x < p.x + 40 &&
                b.y > p.y &&
                b.y < p.y + 40
            ) {
                p.hp -= 20;
                bullets.splice(i, 1);

                if (p.hp <= 0) {
                    p.hp = 100;
                    p.x = Math.random() * 700 + 50;
                    p.y = Math.random() * 400 + 50;
                }

                break;
            }
        }
    }

}, 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0");
