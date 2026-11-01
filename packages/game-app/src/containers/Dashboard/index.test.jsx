import { screen } from "@testing-library/react";

import * as api from "@/utils/api";
import { renderRoute, game } from "@/test-utils";
import Dashboard from ".";

vi.mock("@/utils/api");

describe("Dashboard", () => {
  it("lists active games, recent games and players", async () => {
    api.listActiveGames.mockResolvedValue({ games: [] });
    api.listRecentGames.mockResolvedValue({ games: [game()] });
    api.listPlayers.mockResolvedValue({
      players: [{ fobId: "1", alias: "ann" }],
    });

    renderRoute(<Dashboard />);

    expect(await screen.findByText("No active games")).toBeInTheDocument();
    expect(await screen.findByText("ann VS bob")).toHaveAttribute(
      "href",
      "/games/game-1"
    );
    expect(screen.getByText("5 - 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ann" })).toHaveAttribute(
      "href",
      "/players/1"
    );
  });

  it("shows an error message when games fail to load", async () => {
    api.listActiveGames.mockRejectedValue(new Error("boom"));
    api.listRecentGames.mockResolvedValue({ games: [] });
    api.listPlayers.mockResolvedValue({ players: [] });

    renderRoute(<Dashboard />);

    expect(
      await screen.findByText("Unable to load active games")
    ).toBeInTheDocument();
  });
});
