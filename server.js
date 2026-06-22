const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};
const bullets = [];

// walls sendes ONCE (vigtigt for performance)
const walls = [
    { x: 300, y: 200, w: 180, h: 30, rot: 0.6 },
    { x: 600, y: 350, w: 220, h: 30, rot: -0.4 },
    { x: 200, y: 500, w: 160, h: 30, rot: 1.2 },
    { x: 700, y: 150, w: 140, h: 30, rot: 0.9 }
];

const lastShot = {};

// ─────────────────────────
// SEND ONLY PLAYER STATE (NO BULLETS EVERY FRAME)
// ─────────────────────────
setInterval(() => {
    io.emit("players", players);
}, 100); // 10 fps → MEGET mindre lag

// bullets separat (lavere freq)
setInterval(() => {
    io.emit("bullets", bullets.slice(-50));
}, 100);

// walls kun én gang
io.on("connection", (socket) => {
    socket.emit("walls", walls);
});

// ─────────────────────────
// BULLET SIMULATION (lightweight)
// ─────────────────────────
setInterval(() => {

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        b.x += b.vx;
        b.y += b.vy;

        // cleanup
        if (b.x < -300 || b.x > 3000 || b.y < -300 || b.y > 3000) {
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
                p.hp -= 20;
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

}, 40);

// ─────────────────────────
// SOCKETS
// ─────────────────────────
io.on("connection", (socket) => {

    players[socket.id] = {
        x: 200,
        y: 200,
        hp: 100,
        name: "Player"
    };

    socket.emit("id", socket.id);

    socket.on("name", (name) => {
        if (players[socket.id]) {
            players[socket.id].name = String(name).slice(0, 12);
        }
    });

    socket.on("move", (data) => {
        const p = players[socket.id];
        if (!p) return;

        p.x = data.x;
        p.y = data.y;
    });

    socket.on("shoot", (data) => {

        const now = Date.now();
        if (!lastShot[socket.id]) lastShot[socket.id] = 0;

        if (now - lastShot[socket.id] < 200) return;
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
