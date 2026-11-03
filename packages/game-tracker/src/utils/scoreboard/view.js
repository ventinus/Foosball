// What the scoreboard should show for a game machine snapshot:
// { points: [sideA, sideB], final, winner } or null for a blank board.

const SHOW_SCORE = ["shouldResume", "active", "pauseWarning", "complete"];

exports.scoreboardView = (snapshot) => {
  const game = snapshot.context.currentGame;
  if (!game || !SHOW_SCORE.some((state) => snapshot.matches(state))) return null;

  const points = game.teamPoints;
  const final = snapshot.matches("complete");
  const winner = !final || points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1;
  return { points, final, winner };
};

// Keeps a finished game's score up for `lingerMs` before blanking, unless a
// new score arrives first. `draw(view)` updates the display.
exports.createScoreboard = ({
  draw,
  lingerMs = 30000,
  now = Date.now,
  schedule = setTimeout,
  cancel = clearTimeout,
}) => {
  let finalUntil = 0;
  let timer = null;

  const show = (view) => {
    cancel(timer);
    timer = null;

    if (view) {
      finalUntil = view.final ? now() + lingerMs : 0;
      return draw(view);
    }

    const remaining = finalUntil - now();
    if (remaining <= 0) return draw(null);
    timer = schedule(() => {
      timer = null;
      finalUntil = 0;
      draw(null);
    }, remaining);
  };

  return { show };
};
