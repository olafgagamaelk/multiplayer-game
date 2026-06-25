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

const BULLET_SPEED = 8;
const PLAYER_HP = 100;

function getAngle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

io.on("connection", (socket) => {
  players[socket.id] = {
    x: 700,
    y: 450,
    name: "Player",
    hp: PLAYER_HP
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

  // 🔫 SKYD
  socket.on("shoot", (data) => {
    const p = players[socket.id];
    if (!p) return;

    const angle = data.angle;

    bullets.push({
      x: p.x + 15,
      y: p.y + 15,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      owner: socket.id,
      damage: 25 // Standard skade
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

function updateGame() {
  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    b.x += b.vx;
    b.y += b.vy;

    // hit players
    for (const id in players) {
      const p = players[id];

      if (id === b.owner) continue;

      const dx = p.x - b.x;
      const dy = p.y - b.y;

      if (Math.sqrt(dx * dx + dy * dy) < 25) {
        p.hp -= b.damage || 25;

        bullets.splice(i, 1);

        if (p.hp <= 0) {
          p.hp = PLAYER_HP;
          p.x = 700 + Math.random() * 200 - 100;
          p.y = 450 + Math.random() * 200 - 100;
        }
        break;
      }
    }

    // remove out of bounds
    if (
      b.x < 0 || b.y < 0 ||
      b.x > 2000 || b.y > 2000
    ) {
      bullets.splice(i, 1);
    }
  }

  io.emit("state", {
    players,
    bullets
  });
}

setInterval(updateGame, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started");
});
