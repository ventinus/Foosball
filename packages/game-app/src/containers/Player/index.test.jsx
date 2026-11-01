import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "@/utils/api";
import { renderRoute, game } from "@/test-utils";
import Player from ".";

vi.mock("@/utils/api");

const renderPlayer = () =>
  renderRoute(<Player />, { path: "/players/:playerId", url: "/players/1" });

describe("Player", () => {
  it("shows a known player's games", async () => {
    api.getPlayer.mockResolvedValue({
      fobId: "1",
      alias: "ann",
      games: { items: [{ game: game() }] },
    });

    renderPlayer();

    expect(
      await screen.findByRole("heading", { name: "ann" })
    ).toBeInTheDocument();
    expect(screen.getByText("ann VS bob")).toBeInTheDocument();
    expect(screen.getByText("12 minutes")).toBeInTheDocument();
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
  });
});
