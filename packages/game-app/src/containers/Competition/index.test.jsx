import { screen, within } from "@testing-library/react";

import * as api from "@/utils/api";
import { renderRoute, game } from "@/test-utils";
import Competition from ".";

vi.mock("@/utils/api");

const renderCompetition = () =>
  renderRoute(<Competition />, {
    path: "/competitions/:competitionId",
    url: "/competitions/1V2",
  });

describe("Competition", () => {
  it("shows the series and each game in a fixed team order", async () => {
    // The API doesn't need to return competitionId; it comes from the URL.
    const withoutId = (g) => {
      delete g.competitionId;
      return g;
    };
    api.getCompetitionGames.mockResolvedValue({
      items: [
        withoutId(game({ id: "g1" })),
        withoutId(
          game({
            id: "g2",
            switched: true,
            sideAPoints: 5,
            sideBPoints: 2,
            startedAt: "2026-01-02T10:00:00.000Z",
            endedAt: "2026-01-02T10:09:00.000Z",
          })
        ),
      ],
    });

    renderCompetition();

    expect(
      await screen.findByRole("img", { name: "Series: 1 to 1" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Series tied · Goals 7–8/)).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Games in this matchup" });
    const [header, ...rows] = within(table).getAllByRole("row");
    expect(header).toHaveTextContent("DateannbobWinnerDuration");
    // g2 is newest; bob was side A, so ann's column shows 2.
    expect(rows[0]).toHaveTextContent("Fri Jan 02 202625bob9 minutes");
    expect(rows[1]).toHaveTextContent("Thu Jan 01 202653ann12 minutes");
  });

  it("explains when there are no games", async () => {
    api.getCompetitionGames.mockResolvedValue({ items: [] });
    renderCompetition();
    expect(
      await screen.findByText("Could not find games for this competition")
    ).toBeInTheDocument();
  });
});
