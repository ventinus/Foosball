import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "@/utils/api";
import { renderRoute, game } from "@/test-utils";
import Player from ".";

vi.mock("@/utils/api");

const renderPlayer = () =>
  renderRoute(<Player />, { path: "/players/:playerId", url: "/players/1" });

const doublesPlayers = {
  items: [
    { playerID: "1", player: { alias: "ann" } },
    { playerID: "2", player: { alias: "bob" } },
    { playerID: "3", player: { alias: "cat" } },
    { playerID: "4", player: { alias: "dan" } },
  ],
};

describe("Player", () => {
  it("summarizes a known player's games", async () => {
    api.getPlayer.mockResolvedValue({
      fobId: "1",
      alias: "ann",
      games: {
        items: [
          { game: game() },
          {
            game: game({
              id: "game-2",
              switched: true,
              sideAPoints: 5,
              sideBPoints: 1,
              startedAt: "2026-01-02T10:00:00.000Z",
              endedAt: "2026-01-02T10:05:00.000Z",
            }),
          },
          {
            game: game({
              id: "game-3",
              competitionId: "1::3V2::4",
              players: doublesPlayers,
              startedAt: "2026-01-03T10:00:00.000Z",
              endedAt: "2026-01-03T10:05:00.000Z",
            }),
          },
        ],
      },
    });

    renderPlayer();

    expect(
      await screen.findByRole("heading", { name: "ann" })
    ).toBeInTheDocument();
    const tile = (name) => screen.getByRole("group", { name });
    expect(tile("Record")).toHaveTextContent("2–13 games");
    expect(tile("Win rate")).toHaveTextContent("67%");
    expect(tile("Goal difference")).toHaveTextContent("011 for · 11 against");
    expect(tile("Streak")).toHaveTextContent("W11 win in a row");

    const rivals = screen.getByRole("table", { name: "Rivals" });
    expect(within(rivals).getByRole("link", { name: "bob" })).toHaveAttribute(
      "href",
      "/players/2"
    );
    expect(
      within(rivals).getByRole("link", { name: "1v1 history ›" })
    ).toHaveAttribute("href", "/competitions/1V2");

    const partners = screen.getByRole("table", { name: "Partners" });
    expect(within(partners).getByRole("link", { name: "cat" })).toBeInTheDocument();

    // Scores are shown from ann's side, even when sides were switched.
    const history = screen.getByRole("table", { name: "Game history" });
    const rows = within(history).getAllByRole("row").slice(1);
    expect(within(rows[1]).getByRole("link", { name: "1 - 5" })).toHaveAttribute(
      "href",
      "/games/game-2"
    );
    expect(within(rows[1]).getByLabelText("Loss")).toBeInTheDocument();
    expect(within(rows[2]).getByText("12 minutes")).toBeInTheDocument();
  });

  it("registers an unknown badge", async () => {
    api.getPlayer.mockResolvedValue(null);
    api.createPlayer.mockResolvedValue({
      fobId: "1",
      alias: "newbie",
      games: { items: [] },
    });

    renderPlayer();

    await userEvent.type(await screen.findByLabelText("Alias"), "newbie");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(api.createPlayer.mock.calls[0][0]).toEqual({
      alias: "newbie",
      fobId: "1",
    });
    expect(
      await screen.findByRole("heading", { name: "newbie" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("No games found, get out and play!")
    ).toBeInTheDocument();
  });
});
