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

// 🧱 walls / obstacles
const walls = [
    { x: 300, y: 200, w: 200, h: 30 },
    { x: 600, y: 400, w: 30, h: 200 }
];

// cooldown tracking
const lastShot = {};

setInterval(() => {
    io.emit("state", { players, bullets, walls });
}, 50);

// bullet + collision system
setInterval(() => {

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        b.x += b.vx;
        b.y += b.vy;

        // hit walls
        for (const w of walls) {
            if (
                b.x > w.x &&
                b.x < w.x + w.w &&
                b.y > w.y &&
                b.y < w.y + w.h
            ) {
                bullets.splice(i, 1);
                break;
            }
        }

        // hit players
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

    players[socket.id] = {
        x: 200,
        y: 200,
        hp: 100
    };

    socket.emit("id", socket.id);

    socket.on("move", (data) => {
        const p = players[socket.id];
        if (!p) return;

        // wall collision (simple)
        let nx = data.x;
        let ny = data.y;

        for (const w of walls) {
            if (
                nx < w.x + w.w &&
                nx + 30 > w.x &&
                ny < w.y + w.h &&
                ny + 30 > w.y
            ) {
                return; // stop movement
            }
        }

        p.x = nx;
        p.y = ny;
    });

    // 🔫 SHOOT WITH COOLDOWN
    socket.on("shoot", (data) => {

        const now = Date.now();
        if (!lastShot[socket.id]) lastShot[socket.id] = 0;

        if (now - lastShot[socket.id] < 300) return; // 300ms cooldown
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
