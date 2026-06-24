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
const bullets = [];

const PLAYER_SIZE = 30;
const BULLET_SPEED = 10;

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 900;

io.on("connection", (socket) => {

    players[socket.id] = {
        x: 700,
        y: 450,
        name: "Player",
        hp: 100
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
        p.name = String(name).trim().substring(0, 12) || "Player";
    });

    socket.on("shoot", (data) => {
        const p = players[socket.id];
        if (!p) return;

        bullets.push({
            owner: socket.id,
            x: p.x + PLAYER_SIZE / 2,
            y: p.y + PLAYER_SIZE / 2,
            vx: Math.cos(data.angle) * BULLET_SPEED,
            vy: Math.sin(data.angle) * BULLET_SPEED
        });
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

// enkel hitbox (server ved ikke rotation → kun grov bounds)
function pointInRect(px, py, w) {
    return px > w.x && px < w.x + w.w && py > w.y && py < w.y + w.h;
}

// (samme vægge som client – simple bounding boxes til bullets)
const walls = [
    {x:120,y:120,w:220,h:40},
    {x:450,y:90,w:180,h:40},
    {x:850,y:130,w:240,h:40},
    {x:180,y:300,w:40,h:220},
    {x:500,y:260,w:280,h:40},
    {x:980,y:250,w:40,h:240},
    {x:250,y:600,w:220,h:40},
    {x:650,y:540,w:40,h:220},
    {x:900,y:650,w:260,h:40},
    {x:1080,y:430,w:180,h:40},
    {x:320,y:430,w:160,h:40},
    {x:730,y:350,w:170,h:40}
];

setInterval(() => {

    for (let i = bullets.length - 1; i >= 0; i--) {

        const b = bullets[i];

        b.x += b.vx;
        b.y += b.vy;

        // fjern hvis ude af map
        if (b.x < 0 || b.y < 0 || b.x > MAP_WIDTH || b.y > MAP_HEIGHT) {
            bullets.splice(i, 1);
            continue;
        }

        // væg collision
        for (const w of walls) {
            if (pointInRect(b.x, b.y, w)) {
                bullets.splice(i, 1);
                break;
            }
        }

        // player collision
        for (const id in players) {

            if (id === b.owner) continue;

            const p = players[id];

            if (
                b.x > p.x &&
                b.x < p.x + PLAYER_SIZE &&
                b.y > p.y &&
                b.y < p.y + PLAYER_SIZE
            ) {
                p.hp -= 25;

                if (p.hp <= 0) {
                    p.hp = 100;
                    p.x = 700;
                    p.y = 450;
                }

                bullets.splice(i, 1);
                break;
            }
        }
    }

    io.emit("state", { players, bullets });

}, 50);

server.listen(process.env.PORT || 3000);
