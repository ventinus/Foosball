import { act, screen, within } from "@testing-library/react";

import * as api from "@/utils/api";
import { renderRoute, game } from "@/test-utils";
import Game from ".";

vi.mock("@/utils/api");

const renderGame = () =>
  renderRoute(<Game />, { path: "/games/:gameId", url: "/games/game-1" });

describe("Game", () => {
  let pushUpdate;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    api.getGame.mockResolvedValue(game({ endedAt: null }));
    api.getCompetitionGames.mockResolvedValue({
      items: [
        game({ id: "old-1" }),
        game({ id: "old-2", switched: true }),
        game({ id: "old-3" }),
        game({ endedAt: null }),
      ],
    });
    api.onUpdateGame.mockImplementation((callback) => {
      pushUpdate = callback;
      return unsubscribe;
    });
  });

  it("shows the live score and players", async () => {
    renderGame();

    expect(await screen.findByText("Live game")).toBeInTheDocument();
    expect(screen.getByLabelText("Live")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "ann" })[0]).toHaveAttribute(
      "href",
      "/players/1"
    );
  });

  it("shows the series record for the matchup", async () => {
    renderGame();

    const series = await screen.findByRole("img", { name: "Series: 2 to 1" });
    expect(series).toBeInTheDocument();
    expect(
      screen.getByText(/3 finished games · ann leads the series/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View more games with this matchup" })
    ).toHaveAttribute("href", "/competitions/1V2");
  });

  it("marks the winner of a finished game", async () => {
    api.getGame.mockResolvedValue(game());
    renderGame();

    expect(await screen.findByText("Final score")).toBeInTheDocument();
    const winner = screen.getByText("Winner").parentElement;
    expect(within(winner).getByRole("link", { name: "ann" })).toBeInTheDocument();
  });

  it("applies live score updates and unsubscribes on unmount", async () => {
    const { unmount } = renderGame();
    await screen.findByText("5");

    act(() => pushUpdate({ id: "game-1", sideAPoints: 5, sideBPoints: 4 }));
    expect(await screen.findByText("4")).toBeInTheDocument();

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
