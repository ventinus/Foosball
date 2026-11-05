const fs = require("fs");
const os = require("os");
const path = require("path");
const WebSocket = require("ws");

const nodeHttp = require("http");
const { http, passthrough } = require("msw");
const mocks = require("../mocks/server");
const { createServer, toEvent } = require(".");

let publicDir;
let server;
let sockets = [];

const start = async (options = {}) => {
  server = await createServer({
    port: 0,
    host: "127.0.0.1",
    publicDir,
    getView: () => ({ screen: "idle" }),
    onCommand: jest.fn(),
    log: () => {},
    ...options,
  });
  // MSW fails unhandled requests; let these reach the real local server.
  mocks.server.use(http.all(`http://127.0.0.1:${server.port}/*`, () => passthrough()));
  return server;
};

const url = (p) => `http://127.0.0.1:${server.port}${p}`;

// Sends the path exactly as given (fetch would normalize "..").
const rawStatus = (rawPath) =>
  new Promise((resolve, reject) => {
    nodeHttp
      .get({ host: "127.0.0.1", port: server.port, path: rawPath }, (res) => {
        res.resume();
        resolve(res.statusCode);
      })
      .on("error", reject);
  });

// Opens a socket and collects its messages.
const connect = () =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
    socket.messages = [];
    socket.on("message", (data) => socket.messages.push(JSON.parse(data)));
    socket.on("open", () => resolve(socket));
    socket.on("error", reject);
    sockets.push(socket);
  });

const eventually = async (check, ms = 1000) => {
  const until = Date.now() + ms;
  for (;;) {
    try {
      return check();
    } catch (err) {
      if (Date.now() > until) throw err;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
};

beforeEach(() => {
  publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracker-public-"));
  fs.writeFileSync(path.join(publicDir, "index.html"), "<p>table</p>");
  fs.writeFileSync(path.join(publicDir, "app.js"), "1");
  // next to the page's folder, so reachable with "../"
  fs.writeFileSync(path.join(publicDir, "..", "secret.txt"), "no");
});

afterEach(async () => {
  sockets.forEach((socket) => socket.terminate());
  sockets = [];
  await server?.close();
  server = null;
  fs.rmSync(publicDir, { recursive: true, force: true });
  fs.rmSync(path.join(publicDir, "..", "secret.txt"), { force: true });
});

describe("screen server", () => {
  it("should serve the page and its files", async () => {
    await start();
    const page = await fetch(url("/"));
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toMatch(/text\/html/);
    expect(await page.text()).toBe("<p>table</p>");

    const script = await fetch(url("/app.js"));
    expect(script.headers.get("content-type")).toMatch(/javascript/);
  });

  it("should not serve files outside the page's folder", async () => {
    await start();
    expect(await rawStatus("/../secret.txt")).toBe(404);
    expect(await rawStatus("/..%2fsecret.txt")).toBe(404);
    expect(await rawStatus("/%2e%2e%2fsecret.txt")).toBe(404);
    expect((await fetch(url("/missing.js"))).status).toBe(404);
  });

  it("should only answer reads", async () => {
    await start();
    expect((await fetch(url("/"), { method: "POST" })).status).toBe(405);
  });

  it("should send the current view on connect and every broadcast", async () => {
    await start();
    const socket = await connect();
    await eventually(() =>
      expect(socket.messages).toEqual([
        { type: "view", view: { screen: "idle" }, now: expect.any(Number) },
      ])
    );

    server.broadcast({ screen: "playing" });
    await eventually(() =>
      expect(socket.messages.at(-1)).toMatchObject({ type: "view", view: { screen: "playing" } })
    );
  });

  it("should pass commands on as machine events", async () => {
    const onCommand = jest.fn();
    await start({ onCommand });
    const socket = await connect();

    socket.send(JSON.stringify({ type: "command", command: { type: "UNDO_GOAL" } }));
    socket.send(
      JSON.stringify({
        type: "command",
        command: { type: "MOVE_PLAYER", id: "1", side: 1, slot: 0, extra: true },
      })
    );
    await eventually(() =>
      expect(onCommand.mock.calls).toEqual([
        [{ type: "UNDO_GOAL" }],
        [{ type: "MOVE_PLAYER", id: "1", side: 1, slot: 0 }],
      ])
    );
  });

  it("should ignore malformed messages and commands it doesn't allow", async () => {
    const onCommand = jest.fn();
    await start({ onCommand });
    const socket = await connect();

    socket.send("not json");
    socket.send(JSON.stringify({ type: "command", command: { type: "SCORE_POINT", index: 0 } }));
    socket.send(JSON.stringify({ type: "command", command: { type: "BADGE_SCAN", id: "1" } }));
    socket.send(JSON.stringify({ type: "command", command: { type: "CONFIRM" } }));
    await eventually(() => expect(onCommand).toHaveBeenCalledTimes(1));
    expect(onCommand).toHaveBeenCalledWith({ type: "CONFIRM" });
  });

  it("should allow the simulator's sensor commands when asked", async () => {
    const onCommand = jest.fn();
    await start({ onCommand, extraCommands: ["SCORE_POINT"] });
    const socket = await connect();

    socket.send(JSON.stringify({ type: "command", command: { type: "SCORE_POINT", index: 1 } }));
    await eventually(() =>
      expect(onCommand).toHaveBeenCalledWith({ type: "SCORE_POINT", index: 1 })
    );
  });
});

describe("toEvent", () => {
  const allowed = new Set(["MOVE_PLAYER", "REMOVE_PLAYER", "SET_ALIAS", "SCORE_POINT"]);
  const cmd = (command) => toEvent({ type: "command", command }, allowed);

  it("should check each command's fields", () => {
    expect(cmd({ type: "MOVE_PLAYER", id: 1, side: 0, slot: 0 })).toBe(null);
    expect(cmd({ type: "MOVE_PLAYER", id: "1", side: "0", slot: 0 })).toBe(null);
    expect(cmd({ type: "REMOVE_PLAYER" })).toBe(null);
    expect(cmd({ type: "SET_ALIAS", alias: 5 })).toBe(null);
    expect(cmd({ type: "SCORE_POINT", index: 2 })).toBe(null);
  });

  it("should cap the alias sent from the page", () => {
    expect(cmd({ type: "SET_ALIAS", alias: "x".repeat(500) }).alias).toHaveLength(50);
  });

  it("should ignore anything that isn't a command", () => {
    expect(toEvent({ type: "hello" }, allowed)).toBe(null);
    expect(toEvent(null, allowed)).toBe(null);
  });
});
