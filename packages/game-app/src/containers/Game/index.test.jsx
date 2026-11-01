import { act, screen } from "@testing-library/react";

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
    api.onUpdateGame.mockImplementation((callback) => {
      pushUpdate = callback;
      return unsubscribe;
    });
  });

  it("shows the score and players", async () => {
    renderGame();

    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ann" })).toHaveAttribute(
      "href",
      "/players/1"
    );
    expect(
      screen.getByRole("link", { name: "View more games with this matchup" })
    ).toHaveAttribute("href", "/competitions/1V2");
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
