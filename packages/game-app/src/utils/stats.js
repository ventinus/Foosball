// Pure helpers that derive relationships (records, rivals, partners,
// head-to-head) from the games the API returns.

const byStartedAtDesc = (a, b) => new Date(b.startedAt) - new Date(a.startedAt);

const aliasOf = (game, id) =>
  game.players?.items?.find(({ playerID }) => playerID === id)?.player
    ?.alias ?? id;

// Same format the tracker builds: teams sorted and joined with "V".
export const toCompetitionId = (...teams) =>
  teams.map((ids) => [...ids].sort().join("::")).sort().join("V");

export const competitionTeamIds = (competitionId = "") =>
  competitionId ? competitionId.split("V").map((team) => team.split("::")) : [];

export const isSingles = (competitionId) =>
  competitionTeamIds(competitionId).every((team) => team.length === 1);

export const isFinished = (game) => Boolean(game?.endedAt);

// The two sides of a game in table order (side A first), with points and the
// winner resolved. `switched` means the competition's second team is side A.
export const gameSides = (game) => {
  const teams = competitionTeamIds(game?.competitionId);
  if (teams.length !== 2) return [];
  const ordered = game.switched ? [...teams].reverse() : teams;
  const points = [game.sideAPoints ?? 0, game.sideBPoints ?? 0];
  return ordered.map((ids, i) => ({
    ids,
    points: points[i],
    players: ids.map((id) => ({ id, alias: aliasOf(game, id) })),
    won: isFinished(game) && points[i] > points[1 - i],
  }));
};

// The two sides in competition order (independent of `switched`), so a
// matchup's games can be listed with a stable column per team.
export const competitionSides = (game) => {
  const sides = gameSides(game);
  return game.switched ? [...sides].reverse() : sides;
};

export const winRate = ({ wins, losses }) =>
  wins + losses ? wins / (wins + losses) : null;

export const formatPct = (rate) =>
  rate === null ? "–" : `${Math.round(rate * 100)}%`;

const resultFor = (mine, theirs) => (mine.won ? "W" : theirs.won ? "L" : "T");

const addTally = (map, id, alias, result, extra = {}) => {
  const entry = map.get(id) ?? { id, alias, games: 0, wins: 0, losses: 0 };
  entry.games += 1;
  if (result === "W") entry.wins += 1;
  if (result === "L") entry.losses += 1;
  map.set(id, { ...entry, ...extra });
};

const sortTallies = (map) =>
  [...map.values()].sort(
    (a, b) => b.games - a.games || b.wins - a.wins || a.alias.localeCompare(b.alias)
  );

// Every game from one player's point of view, plus aggregates.
export const playerSummary = (playerId, games = []) => {
  const history = [...games].sort(byStartedAtDesc).map((game) => {
    const sides = gameSides(game);
    const mineIdx = sides.findIndex((side) => side.ids.includes(playerId));
    const mine = sides[mineIdx];
    const theirs = sides[1 - mineIdx];
    if (!mine || !theirs) return { game, result: null };
    return {
      game,
      mine,
      theirs,
      partners: mine.players.filter(({ id }) => id !== playerId),
      opponents: theirs.players,
      result: isFinished(game) ? resultFor(mine, theirs) : null,
    };
  });

  const finished = history.filter(({ result }) => result);
  const totals = { wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  const opponents = new Map();
  const partners = new Map();

  finished.forEach(({ game, mine, theirs, result }) => {
    if (result === "W") totals.wins += 1;
    if (result === "L") totals.losses += 1;
    totals.goalsFor += mine.points;
    totals.goalsAgainst += theirs.points;

    const singles = isSingles(game.competitionId);
    theirs.players.forEach(({ id, alias }) =>
      addTally(
        opponents,
        id,
        alias,
        result,
        singles ? { competitionId: game.competitionId } : {}
      )
    );
    mine.players
      .filter(({ id }) => id !== playerId)
      .forEach(({ id, alias }) => addTally(partners, id, alias, result));
  });

  const streak = { result: null, count: 0 };
  for (const { result } of finished) {
    if (result === "T") break;
    if (streak.result && streak.result !== result) break;
    streak.result = result;
    streak.count += 1;
  }

  return {
    history,
    played: finished.length,
    ...totals,
    winRate: winRate(totals),
    goalDiff: totals.goalsFor - totals.goalsAgainst,
    streak,
    form: finished.slice(0, 10),
    opponents: sortTallies(opponents),
    partners: sortTallies(partners),
  };
};

// Series record for one matchup, keyed to the competition's team order.
export const competitionSummary = (competitionId, games = []) => {
  const teamIds = competitionTeamIds(competitionId);
  const sorted = [...games]
    .map((game) => ({
      ...game,
      competitionId: game.competitionId ?? competitionId,
    }))
    .sort(byStartedAtDesc);
  const finished = sorted.filter(isFinished);
  const teams = teamIds.map((ids) => ({
    ids,
    players: ids.map((id) => ({
      id,
      alias: sorted.length ? aliasOf(sorted[0], id) : id,
    })),
    wins: 0,
    goals: 0,
  }));
  let totalMargin = 0;

  finished.forEach((game) => {
    competitionSides(game).forEach((side, i) => {
      if (!teams[i]) return;
      teams[i].goals += side.points;
      if (side.won) teams[i].wins += 1;
    });
    totalMargin += Math.abs(game.sideAPoints - game.sideBPoints);
  });

  return {
    games: sorted,
    teams,
    played: finished.length,
    avgMargin: finished.length ? totalMargin / finished.length : null,
    live: sorted.filter((game) => !isFinished(game)),
  };
};

// Win/loss table for every known player, ranked by win rate then volume.
export const leaderboard = (players = [], games = []) => {
  const rows = new Map(
    players.map(({ fobId, alias }) => [
      fobId,
      { id: fobId, alias, games: 0, wins: 0, losses: 0, goalDiff: 0 },
    ])
  );

  games.filter(isFinished).forEach((game) => {
    const sides = gameSides(game);
    sides.forEach((side, i) => {
      const other = sides[1 - i];
      side.players.forEach(({ id, alias }) => {
        const row = rows.get(id) ?? {
          id,
          alias,
          games: 0,
          wins: 0,
          losses: 0,
          goalDiff: 0,
        };
        row.games += 1;
        if (side.won) row.wins += 1;
        if (other.won) row.losses += 1;
        row.goalDiff += side.points - other.points;
        rows.set(id, row);
      });
    });
  });

  return [...rows.values()]
    .map((row) => ({ ...row, winRate: winRate(row) }))
    .sort(
      (a, b) =>
        (b.winRate ?? -1) - (a.winRate ?? -1) ||
        b.games - a.games ||
        a.alias.localeCompare(b.alias)
    );
};

// Pairwise records: get(row, col) is the row player's record against col.
export const headToHead = (games = [], { singlesOnly = false } = {}) => {
  const cells = new Map();
  const players = new Set();

  games.filter(isFinished).forEach((game) => {
    if (singlesOnly && !isSingles(game.competitionId)) return;
    const [a, b] = gameSides(game);
    if (!a || !b) return;
    a.ids.forEach((x) =>
      b.ids.forEach((y) => {
        players.add(x).add(y);
        [
          [x, y, a.won, b.won],
          [y, x, b.won, a.won],
        ].forEach(([row, col, rowWon, colWon]) => {
          const key = `${row}|${col}`;
          const cell = cells.get(key) ?? { games: 0, wins: 0, losses: 0 };
          cell.games += 1;
          if (rowWon) cell.wins += 1;
          if (colWon) cell.losses += 1;
          cells.set(key, cell);
        });
      })
    );
  });

  return {
    players,
    get: (row, col) => cells.get(`${row}|${col}`) ?? null,
  };
};
