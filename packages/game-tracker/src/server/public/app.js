// The table's screen. Renders the view the tracker sends over /ws (see
// src/ui/screen.js) and sends back commands. Plain JS, no build step.
"use strict";

const $ = (id) => document.getElementById(id);
const screenEl = $("screen");
const statusEl = $("status");
const offlineEl = $("offline");

let view = null;
let clockOffset = 0; // the Pi's clock minus ours
let socket = null;
let selected = null; // id of the player picked to move, on the lineup
let abandonArmed = false;
let abandonTimer = null;
let renderedScreen = null;

// ---------------- connection ----------------

let retryMs = 1000;
let retryTimer = null;

const connect = () => {
  clearTimeout(retryTimer);
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${scheme}://${location.host}/ws`);

  socket.onopen = () => {
    retryMs = 1000;
    offlineEl.hidden = true;
  };
  socket.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type !== "view") return;
    clockOffset = message.now - Date.now();
    view = message.view;
    render();
  };
  socket.onclose = () => {
    offlineEl.hidden = false;
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, 5000);
  };
};

// An iPad that slept may have a dead socket; reconnect as soon as it wakes.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!socket || socket.readyState === WebSocket.CLOSED) connect();
  requestWakeLock();
});

const send = (command) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "command", command }));
  }
};

// Keep the screen on while the page is open (where the browser allows it).
let wakeLock = null;
const requestWakeLock = async () => {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    }
  } catch {
    // not allowed yet (needs a tap) or not supported
  }
};
document.addEventListener("pointerdown", requestWakeLock, { once: true });

// ---------------- helpers ----------------

const escape = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

const can = (type) => Boolean(view?.actions?.includes(type));

const nameOf = (player) => (player.alias ? player.alias : `#${player.id}`);

const players = (side) => side.filter(Boolean);

const teamName = (side) => players(side).map(nameOf).join(" & ") || "—";

const SIDE_NAMES = ["Side A", "Side B"];
const SIDE_CLASSES = ["a", "b"];

// Which side is drawn on the left depends on which end of the table the iPad
// sits at. By default side A is on the right; Flip (remembered per device)
// puts it on the left for the other end.
const FLIP_KEY = "foosball.sideAOnLeft";
let sideAOnLeft = false;
try {
  sideAOnLeft = localStorage.getItem(FLIP_KEY) === "1";
} catch {
  // storage unavailable; use the default
}
const leftToRight = () => (sideAOnLeft ? [0, 1] : [1, 0]);

$("flip").addEventListener("click", () => {
  sideAOnLeft = !sideAOnLeft;
  try {
    localStorage.setItem(FLIP_KEY, sideAOnLeft ? "1" : "0");
  } catch {
    // not remembered, but still flipped for now
  }
  renderedScreen = null; // registration re-renders only on a screen change
  render();
});

const remaining = (deadline) => Math.max(0, deadline - (Date.now() + clockOffset));

const formatSeconds = (ms) => {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
};

// A countdown that tick() keeps current.
const countdown = (deadline) =>
  deadline
    ? `<span class="countdown" data-deadline="${deadline}">${formatSeconds(remaining(deadline))}</span>`
    : "";

const tick = () => {
  document.querySelectorAll("[data-deadline]").forEach((el) => {
    el.textContent = formatSeconds(remaining(Number(el.dataset.deadline)));
  });
};
setInterval(tick, 250);

const icons = {
  badge: `<svg class="hero-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M10 3v3h4V3"/><circle cx="12" cy="11.5" r="2.5"/><path d="M8 17c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6"/></svg>`,
  swap: "⇄",
};

// ---------------- status line ----------------

const SENSOR_NAMES = {
  badgeReader: "Badge reader",
  goals: "Goal sensors",
  vibration: "Vibration sensor",
  scoreboard: "Scoreboard",
};

const renderStatus = () => {
  const items = [];
  const sync = view.status?.sync ?? {};

  (view.status?.sensors ?? []).forEach(({ name, running, restarts }) => {
    const label = SENSOR_NAMES[name] ?? name;
    if (!running) items.push(["bad", `${label} stopped`]);
    else if (restarts >= 3) items.push(["warn", `${label} restarting`]);
  });

  if (view.status?.simulate) {
    items.push(["warn", "Simulator · games aren't saved online"]);
  } else {
    if (sync.failed) items.push(["bad", `${sync.failed} not saved`]);
    if (sync.pending) items.push(["warn", `${sync.pending} waiting to sync`]);
    if (sync.online === true) items.push(["good", "Online"]);
    else if (sync.online === false) items.push(["warn", "Offline"]);
  }

  statusEl.innerHTML = items
    .map(([kind, text]) => `<span class="${kind}"><span class="dot"></span>${escape(text)}</span>`)
    .join("");
};

// ---------------- screens ----------------

const sidePanel = (index, inner, extraClass = "") =>
  `<section class="side ${SIDE_CLASSES[index]} ${extraClass}">
    <div class="side-name">${SIDE_NAMES[index]}</div>
    ${inner}
  </section>`;

const swapButton = () =>
  can("SWAP_SIDES")
    ? `<button class="btn icon" data-command="SWAP_SIDES" aria-label="Switch ends">${icons.swap}</button>`
    : "";

const scorePanel = (i, winner) =>
  sidePanel(
    i,
    `${winner === i ? '<span class="badge">Winner</span>' : ""}
    <div class="team">${escape(teamName(view.sides[i]))}</div>
    <div class="score">${view.score?.[i] ?? 0}</div>`,
    winner === i ? "winner" : ""
  );

const scoreTable = ({ winner = null } = {}) => {
  const [left, right] = leftToRight();
  return `<div class="table">
    ${scorePanel(left, winner)}
    <div class="middle">${swapButton()}</div>
    ${scorePanel(right, winner)}
  </div>`;
};

const abandonButton = () =>
  can("ABANDON")
    ? `<button class="btn danger ${abandonArmed ? "armed" : ""}" data-action="abandon">${
        abandonArmed ? "Tap again to end" : "End game"
      }</button>`
    : "";

const screens = {
  idle: () => `
    <div class="center">
      ${icons.badge}
      <h1 class="title">Scan your badge to play</h1>
      <p class="subtitle">One or two players a side</p>
    </div>`,

  searching: () => `
    <div class="center">
      <div class="spinner" aria-hidden="true"></div>
      <h1 class="title">Looking you up…</h1>
    </div>`,

  starting: () => `
    <div class="center">
      <div class="spinner" aria-hidden="true"></div>
      <h1 class="title">Starting the game…</h1>
    </div>`,

  lineup: () => {
    const slots = (side) =>
      view.sides[side]
        .map((player, slot) => {
          const isSelected = player && player.id === selected;
          return player
            ? `<button class="slot filled ${isSelected ? "selected" : ""}" data-side="${side}" data-slot="${slot}" data-id="${escape(player.id)}">
                <span class="name">${escape(nameOf(player))}</span>
              </button>`
            : `<button class="slot" data-side="${side}" data-slot="${slot}">${
                selected ? "Move here" : "Open"
              }</button>`;
        })
        .join("");

    const picked = selected && players(view.sides.flat()).find((p) => p.id === selected);
    let hint;
    if (picked) hint = `<p class="hint">Tap where ${escape(nameOf(picked))} should go</p>`;
    else if (view.canStart) hint = `<p class="hint go">Insert a coin to start</p>`;
    else hint = `<p class="hint">Scan badges to join · one or more players on each side</p>`;
    if (!picked && view.full) hint += `<p class="hint">The table is full. Remove someone to add another player.</p>`;

    const [left, right] = leftToRight();
    return `
      <p class="subtitle">Tap a player to move or remove them</p>
      <div class="table ${selected ? "selecting" : ""}">
        ${sidePanel(left, `<div class="slots">${slots(left)}</div>`)}
        <div class="middle">${swapButton()}</div>
        ${sidePanel(right, `<div class="slots">${slots(right)}</div>`)}
      </div>
      ${hint}
      ${
        picked
          ? `<div class="actions">
              <button class="btn danger" data-action="remove">Remove ${escape(nameOf(picked))}</button>
              <button class="btn" data-action="deselect">Done</button>
            </div>`
          : ""
      }`;
  },

  register: () => `
    <div class="center">
      <h1 class="title">New badge! What's your name?</h1>
      <input class="alias-input" id="alias" type="text" inputmode="text"
        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
        enterkeyhint="done" maxlength="10" placeholder="Tap to type" />
      <p class="hint">Letters and numbers, up to 10</p>
      <div class="actions">
        <button class="btn primary big" data-command="CONFIRM" id="save">Save</button>
        <button class="btn" data-command="DENY">Cancel</button>
      </div>
      <p class="hint">Cancels in <span id="register-countdown"></span></p>
    </div>`,

  resume: () => `
    <h1 class="title">Pick up where you left off?</h1>
    ${scoreTable()}
    <div class="actions">
      <button class="btn primary big" data-command="CONFIRM">Resume</button>
      <button class="btn big" data-command="DENY">Start over</button>
    </div>`,

  playing: () => `
    ${scoreTable()}
    <div class="actions">
      ${can("UNDO_GOAL") ? '<button class="btn" data-command="UNDO_GOAL">Undo last goal</button>' : ""}
      ${abandonButton()}
    </div>
    ${can("SWAP_SIDES") ? '<p class="hint">Wrong ends? Switch before the first goal.</p>' : ""}`,

  stillPlaying: () => {
    const [left, right] = leftToRight();
    return `
    <div class="center">
      <h1 class="title">Still playing?</h1>
      <p class="subtitle">${escape(teamName(view.sides[left]))} ${view.score[left]} – ${view.score[right]} ${escape(teamName(view.sides[right]))}</p>
      <p class="hint">The game ends in ${countdown(view.deadline)} unless someone plays</p>
      <div class="actions">
        <button class="btn primary big" data-command="CONFIRM">Keep playing</button>
        ${abandonButton()}
      </div>
    </div>`;
  },

  final: () => {
    const { winner } = view;
    const title =
      winner === null ? "It's a draw" : `${escape(teamName(view.sides[winner]))} win${players(view.sides[winner]).length > 1 ? "" : "s"}!`;
    return `
      <h1 class="title">${title}</h1>
      ${scoreTable({ winner })}
      <div class="actions">
        <button class="btn primary big" data-command="REMATCH">Rematch</button>
        ${
          can("UNDO_GOAL")
            ? `<button class="btn big" data-command="UNDO_GOAL">Undo last goal (${countdown(view.deadline)})</button>`
            : ""
        }
      </div>
      <p class="hint">${
        view.saved
          ? `Clears in ${countdown(view.deadline)} · scan a badge to start a new lineup`
          : "Saving the result when the undo time runs out"
      }</p>`;
  },
};

// Registration keeps its text field across updates, so typing isn't disturbed.
const updateRegister = () => {
  const input = $("alias");
  if (document.activeElement !== input && input.value !== view.newPlayer.alias) {
    input.value = view.newPlayer.alias;
  }
  $("save").disabled = !can("CONFIRM");
  $("register-countdown").innerHTML = countdown(view.deadline);
};

const render = () => {
  if (!view) return;
  renderStatus();

  // forget a pick that no longer makes sense
  const seated = players(view.sides.flat()).map((p) => p.id);
  if (view.screen !== "lineup" || !seated.includes(selected)) selected = null;
  if (!can("ABANDON")) disarmAbandon(false);

  if (view.screen === "register" && renderedScreen === "register") {
    updateRegister();
    return;
  }

  screenEl.innerHTML = (screens[view.screen] ?? screens.idle)();
  renderedScreen = view.screen;
  if (view.screen === "register") updateRegister();
  renderSimulator();
};

// ---------------- input ----------------

const disarmAbandon = (rerender = true) => {
  clearTimeout(abandonTimer);
  if (!abandonArmed) return;
  abandonArmed = false;
  if (rerender) render();
};

screenEl.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target || target.disabled) return;

  if (target.dataset.command) {
    if (target.dataset.command === "CONFIRM" && $("alias")) {
      send({ type: "SET_ALIAS", alias: $("alias").value });
    }
    send({ type: target.dataset.command });
    return;
  }

  switch (target.dataset.action) {
    case "abandon":
      if (abandonArmed) {
        disarmAbandon(false);
        send({ type: "ABANDON" });
      } else {
        abandonArmed = true;
        abandonTimer = setTimeout(() => disarmAbandon(), 3000);
        render();
      }
      return;
    case "remove":
      send({ type: "REMOVE_PLAYER", id: selected });
      selected = null;
      return;
    case "deselect":
      selected = null;
      render();
      return;
  }

  if (target.classList.contains("slot")) {
    const side = Number(target.dataset.side);
    const slot = Number(target.dataset.slot);
    const id = target.dataset.id;
    if (!selected) {
      if (id) {
        selected = id;
        render();
      }
    } else if (id === selected) {
      selected = null;
      render();
    } else {
      send({ type: "MOVE_PLAYER", id: selected, side, slot });
      selected = null;
    }
  }
});

screenEl.addEventListener("input", (event) => {
  if (event.target.id !== "alias") return;
  const clean = event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 10);
  if (clean !== event.target.value) event.target.value = clean;
  send({ type: "SET_ALIAS", alias: clean });
});

screenEl.addEventListener("keydown", (event) => {
  if (event.target.id === "alias" && event.key === "Enter") {
    event.preventDefault();
    send({ type: "SET_ALIAS", alias: event.target.value });
    send({ type: "CONFIRM" });
  }
});

// ---------------- simulator (TRACKER_SIMULATE=1) ----------------

let simEl = null;
const renderSimulator = () => {
  if (!view.status?.simulate) {
    simEl?.remove();
    simEl = null;
    return;
  }
  if (simEl) return;
  simEl = document.createElement("footer");
  simEl.className = "sim";
  simEl.innerHTML = `
    <span>Simulator</span>
    <input id="sim-badge" inputmode="numeric" placeholder="Badge id" value="1" />
    <button class="btn" data-sim="scan">Scan badge</button>
    <button class="btn" data-sim="goal-a">Goal A</button>
    <button class="btn" data-sim="goal-b">Goal B</button>
    <button class="btn" data-sim="coin">Coin</button>
    <button class="btn" data-sim="idle">Go idle</button>`;
  simEl.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const input = $("sim-badge");
    switch (button.dataset.sim) {
      case "scan": {
        send({ type: "BADGE_SCAN", id: input.value.trim() });
        // next badge, so repeated scans add different players
        const next = Number(input.value) + 1;
        if (Number.isInteger(next)) input.value = String(next);
        break;
      }
      case "goal-a":
        return send({ type: "SCORE_POINT", index: 0 });
      case "goal-b":
        return send({ type: "SCORE_POINT", index: 1 });
      case "coin":
        return send({ type: "INITIATE_GAME" });
      case "idle":
        return send({ type: "WARN_PAUSE" });
    }
  });
  document.body.appendChild(simEl);
};

connect();
