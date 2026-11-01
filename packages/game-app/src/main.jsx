import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { Amplify } from "aws-amplify";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Container from "@mui/material/Container";
import CssBaseline from "@mui/material/CssBaseline";

import { Dashboard, Game, Player, Competition } from "@/containers";
import reportWebVitals from "./reportWebVitals";
import awsconfig from "./aws-exports";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

Amplify.configure(awsconfig);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CssBaseline />
      <BrowserRouter>
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/games/:gameId" element={<Game />} />
            <Route path="/players/:playerId" element={<Player />} />
            <Route
              path="/competitions/:competitionId"
              element={<Competition />}
            />
          </Routes>
        </Container>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);

// Pass a function (e.g. console.log) to start measuring performance.
reportWebVitals();
