// server.js
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

  // SKYD
  socket.on("shoot", (data) => {
    const p = players[socket.id];
    if (!p) return;

    bullets.push({
      x: p.x + 15,
      y: p.y + 15,
      vx: data.vx,
      vy: data.vy,
      owner: socket.id
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    b.x += b.vx;
    b.y += b.vy;

    // ram spiller
    for (const id in players) {
      const p = players[id];
      if (!p) continue;

      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 20 && id !== b.owner) {
        p.hp -= 20;
        bullets.splice(i, 1);
        break;
      }
    }

    // fjern hvis ude
    if (b.x < 0 || b.y < 0 || b.x > 2000 || b.y > 2000) {
      bullets.splice(i, 1);
    }
  }
}

setInterval(() => {
  updateBullets();
  io.emit("state", { players, bullets });
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started");
});
