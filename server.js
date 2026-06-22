const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};
const bullets = [];

const MAX_PLAYERS = 10;

// 🧱 ROterede forhindringer
const walls = [
    { x: 300, y: 200, w: 160, h: 30, rot: 0.6 },
    { x: 600, y: 350, w: 200, h: 30, rot: -0.4 },
    { x: 200, y: 500, w: 180, h: 30, rot: 1.2 },
    { x: 700, y: 150, w: 140, h: 30, rot: 0.9 }
];

// cooldown tracking
const lastShot = {};

setInterval(() => {
    io.emit("state", { players, bullets, walls });
}, 50);

// bullets movement + collision
setInterval(() => {

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        b.x += b.vx;
        b.y += b.vy;

        // remove out of bounds
        if (b.x < -200 || b.x > 3000 || b.y < -200 || b.y > 3000) {
            bullets.splice(i, 1);
            continue;
        }

        // player hit
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
                    p.x = 200;
                    p.y = 200;
                }
                break;
            }
        }
    }

}, 30);

io.on("connection", (socket) => {

    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit("full");
        socket.disconnect();
        return;
    }

    // 🧍 PLAYER SPAWN (FIX NAME ISSUE + HP)
    players[socket.id] = {
        x: 200,
        y: 200,
        hp: 100,
        name: "Player"
    };

    socket.emit("id", socket.id);

    // NAME FIX (det her var det der manglede før)
    socket.on("name", (name) => {
        if (!players[socket.id]) return;
        players[socket.id].name = String(name).slice(0, 12);
    });

    socket.on("move", (data) => {
        const p = players[socket.id];
        if (!p) return;

        p.x = data.x;
        p.y = data.y;
    });

    // 🔫 SHOOT WITH COOLDOWN (ANTI AUTOCLICK)
    socket.on("shoot", (data) => {

        const now = Date.now();
        if (!lastShot[socket.id]) lastShot[socket.id] = 0;

        if (now - lastShot[socket.id] < 250) return; // cooldown
        lastShot[socket.id] = now;

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
        delete lastShot[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0");
