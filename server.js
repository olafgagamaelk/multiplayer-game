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

// ─────────────────────────────
// GAME LOOP (server authority)
// ─────────────────────────────
setInterval(() => {

    // move bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        b.x += b.vx;
        b.y += b.vy;

        // remove if out of bounds
        if (b.x < -100 || b.x > 5000 || b.y < -100 || b.y > 5000) {
            bullets.splice(i, 1);
        }
    }

    io.emit("state", { players, bullets });

}, 50);

// ─────────────────────────────
// CONNECTIONS
// ─────────────────────────────
io.on("connection", (socket) => {

    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit("full");
        socket.disconnect();
        return;
    }

    players[socket.id] = {
        x: 200,
        y: 200
    };

    socket.emit("id", socket.id);

    socket.on("move", (data) => {
        const p = players[socket.id];
        if (!p) return;

        p.x = data.x;
        p.y = data.y;
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0");
