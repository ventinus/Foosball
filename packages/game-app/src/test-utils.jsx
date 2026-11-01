import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Render `element` at `url`, matched by `path`, inside the same providers main.jsx uses.
export const renderRoute = (element, { path = "/", url = path } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

export const game = (overrides = {}) => ({
  id: "game-1",
  competitionId: "1V2",
  switched: false,
  sideAPoints: 5,
  sideBPoints: 3,
  startedAt: "2026-01-01T10:00:00.000Z",
  endedAt: "2026-01-01T10:12:00.000Z",
  players: {
    items: [
      { playerID: "1", player: { alias: "ann" } },
      { playerID: "2", player: { alias: "bob" } },
    ],
  },
  ...overrides,
});
