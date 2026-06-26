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

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 900;
const PLAYER_SIZE = 30;
const BULLET_SPEED = 14;        // hurtigere generelt
const SNIPER_BULLET_SPEED = 22; // sniper er hurtigst
const BULLET_RADIUS = 4;

const WEAPON_DAMAGE = {
    revolver: 20,
    shotgun: 22,    // +5
    sniper: 50,
    ak47: 10,
    secret: 10
};

const walls = [
    {x:120,y:120,w:220,h:40,r:20},
    {x:450,y:90,w:180,h:40,r:-25},
    {x:850,y:130,w:240,h:40,r:15},
    {x:180,y:300,w:40,h:220,r:35},
    {x:500,y:260,w:280,h:40,r:-15},
    {x:980,y:250,w:40,h:240,r:10},
    {x:250,y:600,w:220,h:40,r:30},
    {x:650,y:540,w:40,h:220,r:-20},
    {x:900,y:650,w:260,h:40,r:12},
    {x:1080,y:430,w:180,h:40,r:-35},
    {x:320,y:430,w:160,h:40,r:45},
    {x:730,y:350,w:170,h:40,r:-40}
];

const players = {};
const bullets = [];
let bulletId = 0;

function pointInRotatedRect(px, py, wall) {
    const cx = wall.x + wall.w / 2;
    const cy = wall.y + wall.h / 2;
    const rad = -wall.r * Math.PI / 180;
    const dx = px - cx;
    const dy = py - cy;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
    return (
        localX > -wall.w / 2 &&
        localX <  wall.w / 2 &&
        localY > -wall.h / 2 &&
        localY <  wall.h / 2
    );
}

function playerHitsWall(x, y) {
    const points = [
        [x, y],
        [x + PLAYER_SIZE, y],
        [x, y + PLAYER_SIZE],
        [x + PLAYER_SIZE, y + PLAYER_SIZE]
    ];
    for (const wall of walls) {
        for (const p of points) {
            if (pointInRotatedRect(p[0], p[1], wall)) return true;
        }
    }
    return false;
}

function getRandomSpawn() {
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * (MAP_WIDTH - PLAYER_SIZE);
        const y = Math.random() * (MAP_HEIGHT - PLAYER_SIZE);
        if (!playerHitsWall(x, y)) return { x, y };
    }
    return { x: 700, y: 450 };
}

io.on("connection", (socket) => {
    players[socket.id] = {
        x: 700,
        y: 450,
        name: "Player",
        hp: 100,
        aimAngle: 0,
        weapon: "revolver",
        kills: 0
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
        const trimmed = String(name).trim().substring(0, 12) || "Player";
        p.name = trimmed;

        // Hemmelig pistol til Bubber123
        if (trimmed === "Bubber123") {
            p.weapon = "secret";
            socket.emit("secretUnlocked");  // fortæl klienten
        }
    });

    socket.on("changeWeapon", (weapon) => {
        const p = players[socket.id];
        if (!p) return;
        // Bubber123 kan IKKE skifte væk fra secret (men kan stadig vælge den)
        if (p.name === "Bubber123" && weapon !== "secret") return;
        if (["revolver", "shotgun", "sniper", "ak47", "secret"].includes(weapon)) {
            p.weapon = weapon;
        }
    });

    socket.on("shoot", (data) => {
        const p = players[socket.id];
        if (!p) return;

        const angle = data.angle;
        const weapon = data.weapon || "revolver";
        p.aimAngle = angle;

        const centerX = p.x + PLAYER_SIZE / 2;
        const centerY = p.y + PLAYER_SIZE / 2;

        const damage = WEAPON_DAMAGE[weapon] || 20;
        const speed = weapon === "sniper" ? SNIPER_BULLET_SPEED : BULLET_SPEED;

        if (weapon === "shotgun") {
            const spreadAngles = [-0.15, 0, 0.15];
            for (const spread of spreadAngles) {
                const a = angle + spread;
                bullets.push({
                    id: bulletId++,
                    x: centerX,
                    y: centerY,
                    vx: speed * Math.cos(a),
                    vy: speed * Math.sin(a),
                    ownerId: socket.id,
                    damage: damage
                });
            }
        } else {
            bullets.push({
                id: bulletId++,
                x: centerX,
                y: centerY,
                vx: speed * Math.cos(angle),
                vy: speed * Math.sin(angle),
                ownerId: socket.id,
                damage: damage
            });
        }
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    const toRemove = new Set();
    const hitEvents = [];

    for (const b of bullets) {
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < 0 || b.x > MAP_WIDTH || b.y < 0 || b.y > MAP_HEIGHT) {
            toRemove.add(b.id);
            continue;
        }

        let hitWall = false;
        for (const wall of walls) {
            if (pointInRotatedRect(b.x, b.y, wall)) {
                hitWall = true;
                toRemove.add(b.id);
                hitEvents.push({ type: "wall", x: b.x, y: b.y });
                break;
            }
        }
        if (hitWall) continue;

        for (const id in players) {
            if (id === b.ownerId) continue;
            const p = players[id];
            const closestX = Math.max(p.x, Math.min(b.x, p.x + PLAYER_SIZE));
            const closestY = Math.max(p.y, Math.min(b.y, p.y + PLAYER_SIZE));
            const dx = b.x - closestX;
            const dy = b.y - closestY;
            if (dx * dx + dy * dy < BULLET_RADIUS * BULLET_RADIUS) {
                p.hp -= b.damage;
                toRemove.add(b.id);
                hitEvents.push({ type: "player", x: b.x, y: b.y, targetId: id });
                io.to(id).emit("damaged", { amount: b.damage });

                if (p.hp <= 0) {
                    if (b.ownerId && players[b.ownerId] && b.ownerId !== id) {
                        players[b.ownerId].kills = (players[b.ownerId].kills || 0) + 1;
                        io.emit("killFeed", {
                            killer: players[b.ownerId].name,
                            victim: p.name
                        });
                    }
                    const spawn = getRandomSpawn();
                    p.x = spawn.x;
                    p.y = spawn.y;
                    p.hp = 100;
                }
                break;
            }
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        if (toRemove.has(bullets[i].id)) {
            bullets.splice(i, 1);
        }
    }

    if (hitEvents.length > 0) {
        io.emit("bulletHit", hitEvents);
    }

    io.emit("state", {
        players: players,
        bullets: bullets
    });
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log("Server started");
});
