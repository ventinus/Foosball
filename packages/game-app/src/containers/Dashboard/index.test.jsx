import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "@/utils/api";
import { renderRoute, game } from "@/test-utils";
import Dashboard from ".";

vi.mock("@/utils/api");

const finished = [
  game(),
  game({ id: "game-2", sideAPoints: 2, sideBPoints: 5 }),
  game({ id: "game-3" }),
];

describe("Dashboard", () => {
  beforeEach(() => {
    api.listActiveGames.mockResolvedValue({ games: [] });
    api.listRecentGames.mockResolvedValue({ games: [game()] });
    api.listFinishedGames.mockResolvedValue(finished);
    api.listAllPlayers.mockResolvedValue([
      { fobId: "1", alias: "ann" },
      { fobId: "2", alias: "bob" },
      { fobId: "3", alias: "cat" },
    ]);
  });

  it("lists active and recent games", async () => {
    renderRoute(<Dashboard />);

    expect(await screen.findByText("No active games")).toBeInTheDocument();
    const recent = await screen.findByRole("table", { name: "Games" });
    expect(within(recent).getByRole("link", { name: "5 - 3" })).toHaveAttribute(
      "href",
      "/games/game-1"
    );
    expect(within(recent).getByRole("link", { name: "bob" })).toHaveAttribute(
      "href",
      "/players/2"
    );
  });

  it("ranks players on the leaderboard", async () => {
    renderRoute(<Dashboard />);

    const board = await screen.findByRole("table", { name: "Leaderboard" });
    const rows = within(board).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "1ann32–167%+1",
      "2bob31–233%-1",
      "–cat00–0–0",
    ]);
    expect(within(board).getByRole("link", { name: "ann" })).toHaveAttribute(
      "href",
      "/players/1"
    );
    expect(
      screen.getByText("Across 3 finished games")
    ).toBeInTheDocument();
  });

  it("shows a head-to-head grid that links to the matchup", async () => {
    const user = userEvent.setup();
    const { container } = renderRoute(<Dashboard />);

    const cell = await screen.findByLabelText("ann vs bob: 2–1 in 3 games");
    expect(cell).toHaveTextContent("2–1");
    expect(screen.getByLabelText("bob vs ann: 1–2 in 3 games")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("cat vs");

    await user.click(screen.getByRole("button", { name: "All games" }));
    expect(screen.getByLabelText("ann vs bob: 2–1 in 3 games")).toBeInTheDocument();
  });

  it("shows an error message when games fail to load", async () => {
    api.listActiveGames.mockRejectedValue(new Error("boom"));
    api.listRecentGames.mockResolvedValue({ games: [] });

    renderRoute(<Dashboard />);

    expect(
      await screen.findByText("Unable to load active games")
    ).toBeInTheDocument();
  });
});
