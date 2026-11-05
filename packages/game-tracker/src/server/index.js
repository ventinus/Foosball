// Serves the table's screen (src/server/public, opened on the iPad) and talks
// to it over a WebSocket at /ws: the page gets the screen view whenever it
// changes and sends back commands, which become machine events.
//
// There's no authentication: anyone on the table's network can send commands.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const { COMMANDS } = require("../ui/screen");

const PUBLIC_DIR = path.join(__dirname, "public");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

// Clients that stop answering pings (an iPad gone to sleep) are dropped.
const PING_INTERVAL_MS = 30 * 1000;

const MAX_ALIAS_INPUT = 50;

// Turns a message from the page into a machine event, keeping only the fields
// each command uses, or returns null to ignore it.
const toEvent = (message, allowed) => {
  const command = message?.command;
  if (message?.type !== "command" || !allowed.has(command?.type)) return null;
  const { type } = command;

  switch (type) {
    case "MOVE_PLAYER": {
      const { id, side, slot } = command;
      if (typeof id !== "string" || !Number.isInteger(side) || !Number.isInteger(slot)) {
        return null;
      }
      return { type, id, side, slot };
    }
    case "REMOVE_PLAYER":
    case "BADGE_SCAN":
      return typeof command.id === "string" ? { type, id: command.id } : null;
    case "SET_ALIAS":
      return typeof command.alias === "string"
        ? { type, alias: command.alias.slice(0, MAX_ALIAS_INPUT) }
        : null;
    case "SCORE_POINT":
      return command.index === 0 || command.index === 1
        ? { type, index: command.index }
        : null;
    default:
      return { type };
  }
};
exports.toEvent = toEvent;

const serveFile = (publicDir, req, res) => {
  const { pathname } = new URL(req.url, "http://table");
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).slice(1);
  const file = path.resolve(publicDir, relative);
  if (!file.startsWith(publicDir + path.sep)) {
    res.writeHead(404).end();
    return;
  }
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404).end();
      return;
    }
    res
      .writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
        // the page changes with the tracker, so always check for a new copy
        "Cache-Control": "no-cache",
      })
      .end(body);
  });
};

// `getView()` returns the current screen view; `onCommand(event)` receives
// each accepted command. `extraCommands` lets more event types through (the
// simulator's fake sensors). Resolves once listening.
exports.createServer = ({
  port = 8080,
  host,
  publicDir = PUBLIC_DIR,
  getView,
  onCommand,
  extraCommands = [],
  log = console.log,
  pingIntervalMs = PING_INTERVAL_MS,
}) => {
  const allowed = new Set([...COMMANDS, ...extraCommands]);
  const root = path.resolve(publicDir);
  const server = http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    serveFile(root, req, res);
  });
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });

  const send = (socket, view) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify({ type: "view", view }));
    }
  };

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.on("pong", () => (socket.isAlive = true));
    socket.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      const event = toEvent(message, allowed);
      if (event) onCommand(event);
    });
    send(socket, getView());
  });

  const pinger = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (!socket.isAlive) return socket.terminate();
      socket.isAlive = false;
      socket.ping();
    });
  }, pingIntervalMs);
  pinger.unref();

  // A broken server shouldn't take the table down; the game goes on without it.
  server.on("error", (err) => log("screen server error", err.message ?? err));

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      resolve({
        port: server.address().port,
        broadcast: (view) => wss.clients.forEach((socket) => send(socket, view)),
        close: () =>
          new Promise((done) => {
            clearInterval(pinger);
            wss.clients.forEach((socket) => socket.terminate());
            wss.close();
            server.close(() => done());
          }),
      });
    });
  });
};
