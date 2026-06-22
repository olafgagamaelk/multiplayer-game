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

// send state 15x per second (smooth + low lag)
setInterval(() => {
    io.emit("state", { players, bullets });
}, 66);

io.on("connection", (socket) => {

    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit("full");
        socket.disconnect();
        return;
    }

    players[socket.id] = {
        x: Math.random() * 600 + 50,
        y: Math.random() * 400 + 50,
        hp: 100,
        name: "Player"
    };

    socket.emit("id", socket.id);

    socket.on("move", (data) => {
        if (!players[socket.id]) return;
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
    });

    socket.on("shoot", (b) => {
        if (!players[socket.id]) return;

        bullets.push({
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
            owner: socket.id
        });
    });

    socket.on("name", (name) => {
        if (players[socket.id]) {
            players[socket.id].name = name.slice(0, 12);
        }
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

// physics + hits
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
                b.x < p.x + 30 &&
                b.y > p.y &&
                b.y < p.y + 30
            ) {
                p.hp -= 25;
                bullets.splice(i, 1);

                if (p.hp <= 0) {
                    p.hp = 100;
                    p.x = Math.random() * 600 + 50;
                    p.y = Math.random() * 400 + 50;
                }
                break;
            }
        }
    }

}, 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0");
